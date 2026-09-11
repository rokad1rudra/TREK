/**
 * Supabase PostgreSQL SQLite Backup Service
 *
 * Uses DATABASE_URL (direct PostgreSQL connection to Supabase) to persist
 * the SQLite travel.db in a PostgreSQL `trek_db_backup` table.
 *
 * Persists data across container restarts without volumes:
 *   - Startup:  restoreDbFromSupabase() -> downloads latest snapshot from Supabase Postgres
 *   - Periodic: backupDbToSupabase(true) -> stores snapshot in Supabase Postgres every 5m
 *   - Shutdown: backupDbToSupabase() -> final flush before termination
 */

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const DB_FILENAME = 'travel.db';
let _backupInterval: ReturnType<typeof setInterval> | null = null;

/** Resolve SQLite DB path */
function getDbPath(): string {
  if (process.env.TREK_DB_FILE) return process.env.TREK_DB_FILE;
  const dataDir = path.resolve(__dirname, '../../data');
  return path.join(dataDir, DB_FILENAME);
}

/**
 * Sanitize PostgreSQL connection URL in case the password contains
 * unencoded special characters like '%' or '/' which break URL parsing.
 */
export function sanitizePgUrl(rawUrl?: string): string | null {
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

async function getPgClient(): Promise<Client | null> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return null;

  const connectionString = sanitizePgUrl(rawUrl);
  if (!connectionString) return null;

  try {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await client.connect();

    // Ensure backup table exists
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

    return client;
  } catch (err) {
    console.warn('[Supabase Backup] Could not connect to Supabase Postgres:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Restore travel.db from Supabase Postgres on startup.
 * Returns true if restored, false if no backup found.
 */
export async function restoreDbFromSupabase(): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) return false;

  const dbPath = getDbPath();
  const client = await getPgClient();
  if (!client) return false;

  try {
    const res = await client.query<{ data: Buffer; size_bytes: string; created_at: Date }>(
      `SELECT data, size_bytes, created_at
       FROM trek_db_backup
       WHERE filename = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [DB_FILENAME]
    );

    if (!res.rows.length || !res.rows[0].data) {
      console.log('[Supabase Backup] No backup found in Supabase Postgres.');
      return false;
    }

    const backup = res.rows[0];
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmpPath = `${dbPath}.restore_tmp`;
    fs.writeFileSync(tmpPath, backup.data);
    try {
      if (fs.existsSync(dbPath)) {
        try { fs.unlinkSync(dbPath); } catch { /* ignore if locked */ }
      }
      fs.renameSync(tmpPath, dbPath);
    } catch {
      fs.copyFileSync(tmpPath, dbPath);
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }

    const sizeMB = (Number(backup.size_bytes) / 1024 / 1024).toFixed(2);
    console.log(`[Supabase Backup] ✅ Restored travel.db from Supabase Postgres (${sizeMB} MB, saved ${new Date(backup.created_at).toISOString()})`);
    return true;
  } catch (err) {
    console.error('[Supabase Backup] Restore failed:', err instanceof Error ? err.message : err);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Upload travel.db to Supabase Postgres bytea backup table.
 * Retains the 2 most recent backups to prevent table bloat.
 */
export async function backupDbToSupabase(silent = false): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) return false;

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return false;

  const client = await getPgClient();
  if (!client) return false;

  try {
    const buffer = fs.readFileSync(dbPath);
    const size = buffer.length;

    await client.query(
      `INSERT INTO trek_db_backup (filename, data, size_bytes, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        DB_FILENAME,
        buffer,
        size,
        JSON.stringify({
          hostname: process.env.RAILWAY_REPLICA_ID || 'local',
          node_env: process.env.NODE_ENV || 'production',
        }),
      ]
    );

    // Keep only the 2 most recent backups to save storage
    await client.query(`
      DELETE FROM trek_db_backup
      WHERE filename = $1
        AND id NOT IN (
          SELECT id FROM trek_db_backup
          WHERE filename = $1
          ORDER BY created_at DESC
          LIMIT 2
        )
    `, [DB_FILENAME]);

    const sizeMB = (size / 1024 / 1024).toFixed(2);
    if (!silent) console.log(`[Supabase Backup] ✅ Backed up travel.db to Supabase Postgres (${sizeMB} MB)`);
    return true;
  } catch (err) {
    console.error('[Supabase Backup] Backup failed:', err instanceof Error ? err.message : err);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Start periodic background backup to Supabase Postgres.
 */
export function startSupabasePeriodicBackup(intervalMs = 5 * 60 * 1000): void {
  if (_backupInterval || !process.env.DATABASE_URL) return;
  _backupInterval = setInterval(() => {
    backupDbToSupabase(true).catch(() => {});
  }, intervalMs);
  _backupInterval.unref?.();
  console.log(`[Supabase Backup] Periodic backup enabled (every ${Math.round(intervalMs / 60000)}m)`);
}

/**
 * Stop periodic background backup to Supabase Postgres.
 */
export function stopSupabasePeriodicBackup(): void {
  if (_backupInterval) {
    clearInterval(_backupInterval);
    _backupInterval = null;
  }
}
