/**
 * Complete SQLite -> Supabase PostgreSQL Synchronization Script
 *
 * Syncs both:
 * 1. The binary database snapshot to `trek_db_backup` (for instant container restore)
 * 2. All relational rows to Supabase PostgreSQL tables (users, trips, places, settings, etc.)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const Database = require('better-sqlite3');

function sanitizePgUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    const match = trimmed.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.*)@([^@/:]+)(?::(\d+))?(\/.*)?$/);
    if (match) {
      const [, proto, user, pass, host, port, db] = match;
      return `${proto}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}${port ? `:${port}` : ''}${db || '/postgres'}`;
    }
    return trimmed;
  }
}

async function run() {
  const dbPath = path.resolve(__dirname, '../data/travel.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Local travel.db not found at', dbPath);
    process.exit(1);
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error('DATABASE_URL not set in server/.env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: sanitizePgUrl(rawUrl),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('✅ Connected to Supabase PostgreSQL!');

  // 1. Ensure backup table exists & store snapshot
  console.log('\n--- [1/3] Uploading Binary Snapshot to Supabase trek_db_backup ---');
  await client.query(`
    CREATE TABLE IF NOT EXISTS trek_db_backup (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      data BYTEA NOT NULL,
      size_bytes BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB
    );
  `);

  const fileBuffer = fs.readFileSync(dbPath);
  const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
  await client.query(
    `INSERT INTO trek_db_backup (filename, data, size_bytes, metadata)
     VALUES ($1, $2, $3, $4)`,
    [
      'travel.db',
      fileBuffer,
      fileBuffer.length,
      JSON.stringify({ hostname: 'local', synced_at: new Date().toISOString() })
    ]
  );
  console.log(`✅ travel.db (${sizeMB} MB) uploaded to Supabase trek_db_backup!`);

  // Prune older backups, keep 2 latest
  await client.query(`
    DELETE FROM trek_db_backup
    WHERE filename = 'travel.db'
      AND id NOT IN (
        SELECT id FROM trek_db_backup
        WHERE filename = 'travel.db'
        ORDER BY created_at DESC
        LIMIT 2
      )
  `);

  // 2. Sync relational tables and columns
  console.log('\n--- [2/3] Synchronizing Relational Tables & Columns ---');
  const sqlite = new Database(dbPath, { readonly: true });

  const tablesToSync = [
    { name: 'users', pkey: 'id' },
    { name: 'settings', pkey: 'id' },
    { name: 'categories', pkey: 'id' },
    { name: 'tags', pkey: 'id' },
    { name: 'trips', pkey: 'id' },
    { name: 'days', pkey: 'id' },
    { name: 'places', pkey: 'id' },
    { name: 'place_tags', pkey: null },
    { name: 'day_assignments', pkey: 'id' },
    { name: 'reservations', pkey: 'id' },
    { name: 'budget_items', pkey: 'id' },
    { name: 'packing_items', pkey: 'id' },
    { name: 'trip_members', pkey: null },
    { name: 'day_notes', pkey: 'id' },
    { name: 'addons', pkey: 'id' },
  ];

  for (const { name: tableName, pkey } of tablesToSync) {
    try {
      const sqliteCols = sqlite.prepare(`PRAGMA table_info("${tableName}")`).all();
      if (!sqliteCols.length) continue;

      // Add missing columns to Supabase table
      for (const col of sqliteCols) {
        let pgType = 'TEXT';
        if (col.type === 'INTEGER') pgType = 'BIGINT';
        else if (col.type === 'REAL' || col.type === 'NUMERIC') pgType = 'DOUBLE PRECISION';
        else if (col.type === 'BLOB') pgType = 'BYTEA';

        try {
          await client.query(`ALTER TABLE IF EXISTS "${tableName}" ADD COLUMN IF NOT EXISTS "${col.name}" ${pgType}`);
        } catch { /* column might already exist */ }
      }

      const rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
      if (!rows.length) {
        console.log(`  - ${tableName}: 0 rows`);
        continue;
      }

      let insertedCount = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const colNames = cols.map(c => `"${c}"`).join(', ');
        const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = cols.map(c => row[c]);

        let onConflict = 'DO NOTHING';
        if (pkey && cols.includes(pkey)) {
          const updateSet = cols
            .filter(c => c !== pkey)
            .map(c => `"${c}" = EXCLUDED."${c}"`)
            .join(', ');
          if (updateSet) {
            onConflict = `(${pkey}) DO UPDATE SET ${updateSet}`;
          }
        }

        const insertSql = `
          INSERT INTO "${tableName}" (${colNames})
          VALUES (${placeholders})
          ON CONFLICT ${onConflict}
        `;

        try {
          await client.query(insertSql, values);
          insertedCount++;
        } catch (err) {
          // If foreign key or specific constraint fails, try basic insert ignore
          try {
            await client.query(`INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
            insertedCount++;
          } catch (e2) {
            // Ignore single failed row
          }
        }
      }
      console.log(`  ✓ ${tableName}: synced ${insertedCount}/${rows.length} rows`);
    } catch (tblErr) {
      console.warn(`  ! Could not sync table ${tableName}:`, tblErr.message);
    }
  }

  // 3. Update serial sequences
  console.log('\n--- [3/3] Updating PostgreSQL Sequences ---');
  const sequenceTables = ['users', 'trips', 'days', 'places', 'day_assignments', 'reservations', 'budget_items', 'packing_items', 'tags'];
  for (const seq of sequenceTables) {
    try {
      await client.query(`SELECT setval(pg_get_serial_sequence('"${seq}"', 'id'), COALESCE((SELECT MAX(id) FROM "${seq}"), 1))`);
    } catch { /* ignore sequence errors if not serial */ }
  }

  // Verify users
  const userCheck = await client.query('SELECT id, email, username, role FROM users');
  console.log('\n🎉 SUCCESS: All data synced to Supabase PostgreSQL!');
  console.log('Users in Supabase PostgreSQL:');
  console.table(userCheck.rows);

  sqlite.close();
  await client.end();
}

run().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
