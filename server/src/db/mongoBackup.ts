/**
 * MongoDB GridFS SQLite Backup Service
 *
 * Stores the entire SQLite travel.db in MongoDB Atlas using GridFS so data
 * persists across Railway/Docker container restarts without needing a volume.
 *
 * Flow:
 *   Startup  → restoreDbFromMongo()   → download travel.db from MongoDB GridFS
 *   Every 5m → backupDbToMongo(true)  → upload travel.db snapshot silently
 *   Shutdown → backupDbToMongo()      → final upload before container stops
 */

import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, GridFSBucket } from 'mongodb';

const BUCKET_NAME = 'trek_sqlite_backup';
const DB_FILENAME = 'travel.db';
let _backupInterval: ReturnType<typeof setInterval> | null = null;

/** Resolve the canonical SQLite DB path (mirrors database.ts logic) */
function getDbPath(): string {
  if (process.env.TREK_DB_FILE) return process.env.TREK_DB_FILE;
  const dataDir = path.resolve(__dirname, '../../data');
  return path.join(dataDir, 'travel.db');
}

interface BackupConn {
  client: MongoClient;
  mongoDb: ReturnType<MongoClient['db']>;
}

async function getBackupConn(): Promise<BackupConn | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    const dbName = process.env.MONGODB_DATABASE || 'trek';
    return { client, mongoDb: client.db(dbName) };
  } catch (err) {
    console.warn('[MongoDB Backup] Could not connect:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Restore travel.db from MongoDB GridFS on container startup.
 * Must be called BEFORE the database module is imported (SQLite init).
 * Returns true if restored, false if no backup found (fresh start).
 */
export async function restoreDbFromMongo(): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' || !process.env.MONGODB_URI) return false;

  const dbPath = getDbPath();
  const conn = await getBackupConn();
  if (!conn) return false;
  const { client, mongoDb } = conn;

  try {
    const bucket = new GridFSBucket(mongoDb, { bucketName: BUCKET_NAME });
    const files = await bucket.find({ filename: DB_FILENAME }).toArray();

    if (!files.length) {
      console.log('[MongoDB Backup] No backup found — starting with fresh database.');
      return false;
    }

    // Pick most recent backup
    files.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
    const latest = files[0];

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Download to temp file then atomic rename to avoid partial writes
    const tmpPath = dbPath + '.restore_tmp';
    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(tmpPath);
      const downloadStream = bucket.openDownloadStreamByName(DB_FILENAME);
      downloadStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      downloadStream.on('error', reject);
    });

    fs.renameSync(tmpPath, dbPath);
    const sizeMB = (latest.length / 1024 / 1024).toFixed(2);
    console.log(`[MongoDB Backup] ✅ Restored travel.db from MongoDB (${sizeMB} MB, saved ${latest.uploadDate.toISOString()})`);
    return true;
  } catch (err) {
    console.error('[MongoDB Backup] Restore failed — fresh start:', err instanceof Error ? err.message : err);
    return false;
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * Upload the current travel.db snapshot to MongoDB GridFS.
 * Keeps the 2 most recent backups and deletes older ones.
 */
export async function backupDbToMongo(silent = false): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' || !process.env.MONGODB_URI) return false;

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return false;

  const conn = await getBackupConn();
  if (!conn) return false;
  const { client, mongoDb } = conn;

  try {
    const bucket = new GridFSBucket(mongoDb, { bucketName: BUCKET_NAME });

    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(dbPath);
      const uploadStream = bucket.openUploadStream(DB_FILENAME, {
        metadata: {
          backed_up_at: new Date(),
          hostname: process.env.RAILWAY_REPLICA_ID || 'local',
        },
      });
      readStream.pipe(uploadStream);
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
      readStream.on('error', reject);
    });

    // Keep only the 2 most recent backups to save space
    const allFiles = await bucket.find({ filename: DB_FILENAME }).toArray();
    allFiles.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
    for (const old of allFiles.slice(2)) {
      await bucket.delete(old._id).catch(() => {});
    }

    const sizeMB = (fs.statSync(dbPath).size / 1024 / 1024).toFixed(2);
    if (!silent) console.log(`[MongoDB Backup] ✅ Backed up travel.db to MongoDB (${sizeMB} MB)`);
    return true;
  } catch (err) {
    console.error('[MongoDB Backup] Backup failed:', err instanceof Error ? err.message : err);
    return false;
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * Start periodic background backup every `intervalMs` ms (default 5 minutes).
 */
export function startPeriodicBackup(intervalMs = 5 * 60 * 1000): void {
  if (_backupInterval || !process.env.MONGODB_URI) return;
  _backupInterval = setInterval(() => {
    backupDbToMongo(true).catch(() => {});
  }, intervalMs);
  if (_backupInterval.unref) _backupInterval.unref();
  console.log(`[MongoDB Backup] Periodic backup every ${intervalMs / 60000} min`);
}

export function stopPeriodicBackup(): void {
  if (_backupInterval) {
    clearInterval(_backupInterval);
    _backupInterval = null;
  }
}
