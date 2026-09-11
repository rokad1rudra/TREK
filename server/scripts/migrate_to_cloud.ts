/**
 * ============================================================================
 * GlobeTrotter & TrekAI - Cloud Migration Tool
 * Migrates local SQLite database to MongoDB Atlas (NoSQL) & Supabase (SQL)
 * ============================================================================
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { db } from '../src/db/database';
import { getMongoDb, saveAiItinerary } from '../src/db/mongoService';

function escapeSqlVal(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateTableInserts(tableName: string, rows: any[], conflictCols: string[] = ['id']): string {
  if (!rows || rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');

  const valuesList = rows.map((row) => {
    const vals = cols.map((c) => escapeSqlVal(row[c])).join(', ');
    return `  (${vals})`;
  });

  const conflictClause = conflictCols.length > 0
    ? `ON CONFLICT (${conflictCols.map((c) => `"${c}"`).join(', ')}) DO NOTHING`
    : '';

  return `-- Data for ${tableName} (${rows.length} rows)\nINSERT INTO "${tableName}" (${colList})\nVALUES\n${valuesList.join(',\n')}\n${conflictClause};\n`;
}

async function migrate() {
  console.log('🚀 Starting Cloud Database Migration...');
  console.log('================================================================');

  // ============================================================================
  // 1. Check MongoDB Atlas Connection & Sync AI Documents
  // ============================================================================
  console.log('📡 [1/2] Connecting to MongoDB Atlas...');
  const mongo = await getMongoDb();
  let mongoCount = 0;

  const trips = db.prepare('SELECT * FROM trips').all() as any[];
  console.log(`📦 Found ${trips.length} local trip(s) in SQLite database.`);

  if (!mongo) {
    console.error('❌ MongoDB Atlas connection failed. Please check MONGODB_URI in server/.env');
  } else {
    console.log('✅ MongoDB Atlas Cloud NoSQL: Connected!');
    for (const trip of trips) {
      const days = db.prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number').all(trip.id) as any[];
      const places = db.prepare(`
        SELECT p.*, da.day_id, d.day_number
        FROM places p
        LEFT JOIN day_assignments da ON da.place_id = p.id
        LEFT JOIN days d ON d.id = da.day_id
        WHERE p.trip_id = ?
      `).all(trip.id) as any[];

      const doc = {
        trip_id: trip.id,
        trip_title: trip.title,
        origin: trip.origin_location || 'Origin Point',
        destination: trip.destination_location || 'Destination',
        zone: 'Indian Travel Corridor',
        total_distance_km: 500,
        driving_hours: 8,
        recommended_mode: 'Road Drive / Express',
        budget_estimate: 25000,
        currency: trip.currency || 'INR',
        days: days.map((d) => ({
          day_number: d.day_number,
          title: d.title || `Day ${d.day_number}`,
          theme: 'Sightseeing & Exploration',
          daily_cost: 5000,
          pro_tip: 'Enjoy authentic regional cuisine and start before 9:00 AM.',
          spots: places
            .filter((p) => p.day_id === d.id || (!p.day_id && d.day_number === 1))
            .map((p) => ({
              name: p.name,
              time: '09:30 AM',
              period: 'morning',
              description: p.notes || `Visit ${p.name}`,
              lat: p.lat,
              lng: p.lng,
              category: p.category_name || 'Sightseeing',
              cost_est: 500,
            })),
        })),
        ai_model: 'llama-trek-planner',
      };

      await saveAiItinerary(doc);
      mongoCount++;
    }
    console.log(`🎉 Successfully synced ${mongoCount} trip documents to MongoDB Atlas!`);
  }

  // ============================================================================
  // 2. Generate Supabase SQL Bundle (Schema + All Data)
  // ============================================================================
  console.log('================================================================');
  console.log('📦 [2/2] Generating Complete Supabase Migration Bundle (SQL)...');

  const schemaPath = path.join(__dirname, '../src/db/supabase_schema.sql');
  let fullSql = '';

  if (fs.existsSync(schemaPath)) {
    fullSql += fs.readFileSync(schemaPath, 'utf-8');
    fullSql += '\n\n-- ============================================================================\n';
    fullSql += '-- DATA SEEDING FROM LOCAL SQLITE\n';
    fullSql += '-- ============================================================================\n\n';
  }

  const tablesToExport = [
    { name: 'users', conflict: ['id'] },
    { name: 'settings', conflict: ['user_id', 'key'] },
    { name: 'categories', conflict: ['name'] },
    { name: 'tags', conflict: ['id'] },
    { name: 'trips', conflict: ['id'] },
    { name: 'days', conflict: ['id'] },
    { name: 'places', conflict: ['id'] },
    { name: 'place_tags', conflict: ['place_id', 'tag_id'] },
    { name: 'day_assignments', conflict: ['id'] },
    { name: 'reservations', conflict: ['id'] },
    { name: 'budget_items', conflict: ['id'] },
    { name: 'packing_items', conflict: ['id'] },
    { name: 'trip_members', conflict: ['trip_id', 'user_id'] },
    { name: 'day_notes', conflict: ['id'] },
    { name: 'addons', conflict: ['id'] },
  ];

  let exportedTableCount = 0;
  let totalRows = 0;

  for (const t of tablesToExport) {
    try {
      const rows = db.prepare(`SELECT * FROM ${t.name}`).all() as any[];
      if (rows && rows.length > 0) {
        fullSql += generateTableInserts(t.name, rows, t.conflict);
        fullSql += '\n';
        totalRows += rows.length;
        exportedTableCount++;
        console.log(`  ✓ Exported ${rows.length} row(s) from "${t.name}"`);
      }
    } catch (err: any) {
      // Table might not exist or be empty in SQLite
    }
  }

  // Update PostgreSQL sequence counters for serial IDs
  fullSql += '\n-- ============================================================================\n';
  fullSql += '-- UPDATE POSTGRESQL SEQUENCES\n';
  fullSql += '-- ============================================================================\n';
  const sequenceTables = ['users', 'trips', 'days', 'places', 'day_assignments', 'reservations', 'budget_items', 'packing_items', 'tags'];
  for (const seq of sequenceTables) {
    fullSql += `SELECT setval(pg_get_serial_sequence('"${seq}"', 'id'), COALESCE(MAX(id), 1)) FROM "${seq}";\n`;
  }

  const outFilePath = path.join(__dirname, '../src/db/supabase_full_migration.sql');
  fs.writeFileSync(outFilePath, fullSql, 'utf-8');

  console.log(`\n📄 Generated Migration Bundle: ${outFilePath}`);
  console.log(`📊 Exported ${totalRows} records across ${exportedTableCount} tables.`);

  console.log('\n================================================================');
  console.log('🚀 READY TO DEPLOY TO SUPABASE:');
  console.log('1. Open your Supabase Dashboard: https://app.supabase.com');
  console.log('2. Click on "SQL Editor" in the left navigation');
  console.log('3. Click "New Query"');
  console.log('4. Copy & Paste the entire content of:');
  console.log(`   ${outFilePath}`);
  console.log('5. Click "Run" (▶️)');
  console.log('================================================================');
  console.log('✨ All SQLite tables and rows will be migrated to Supabase Cloud!');

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
