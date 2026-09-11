/**
 * Supabase Storage SQLite Backup Service
 *
 * Stores the SQLite travel.db in a Supabase Storage bucket so data
 * persists across Railway/Docker restarts without a volume.
 *
 * Required env vars:
 *   SUPABASE_URL              e.g. https://rqbvhaatfiyrnxuuwmoz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  from Supabase → Settings → API
 *
 * The SUPABASE_URL is auto-derived from DATABASE_URL if not set explicitly.
 */

import fs from "node:fs";
import path from "node:path";

const BUCKET = "trek-db-backup";
const OBJECT = "travel.db";

function getDbPath(): string {
  if (process.env.TREK_DB_FILE) return process.env.TREK_DB_FILE;
  return path.resolve(__dirname, "../../data/travel.db");
}

/** Derive Supabase project URL from DATABASE_URL if SUPABASE_URL not set */
function getSupabaseUrl(): string | null {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/$/, "");
  const dbUrl = process.env.DATABASE_URL || "";
  const match = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/);
  if (match) return `https://${match[1]}.supabase.co`;
  return null;
}

function getServiceKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    null
  );
}

function isConfigured(): boolean {
  return !!(getSupabaseUrl() && getServiceKey());
}

/** Ensure the backup bucket exists (creates it if missing) */
async function ensureBucket(url: string, key: string): Promise<void> {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  // 200 = created, 409 = already exists — both are fine
  if (!res.ok && res.status !== 409) {
    const txt = await res.text();
    throw new Error(`Failed to create bucket: ${res.status} ${txt}`);
  }
}

/**
 * Restore travel.db from Supabase Storage on container startup.
 * Called BEFORE the SQLite database module is initialised.
 */
export async function restoreDbFromSupabase(): Promise<boolean> {
  if (process.env.NODE_ENV === "test" || !isConfigured()) return false;

  const url = getSupabaseUrl()!;
  const key = getServiceKey()!;
  const dbPath = getDbPath();

  try {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 400) {
        console.log("[Supabase Backup] No backup found — starting with fresh database.");
        return false;
      }
      throw new Error(`Download failed: ${res.status}`);
    }

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const buffer = Buffer.from(await res.arrayBuffer());
    const tmpPath = dbPath + ".supa_tmp";
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, dbPath);

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`[Supabase Backup] ✅ Restored travel.db from Supabase (${sizeMB} MB)`);
    return true;
  } catch (err) {
    console.error("[Supabase Backup] Restore failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Upload current travel.db to Supabase Storage.
 */
export async function backupDbToSupabase(silent = false): Promise<boolean> {
  if (process.env.NODE_ENV === "test" || !isConfigured()) return false;

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return false;

  const url = getSupabaseUrl()!;
  const key = getServiceKey()!;

  try {
    await ensureBucket(url, key);

    const fileBuffer = fs.readFileSync(dbPath);
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body: fileBuffer,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Upload failed: ${res.status} ${txt}`);
    }

    const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    if (!silent) console.log(`[Supabase Backup] ✅ Backed up travel.db to Supabase (${sizeMB} MB)`);
    return true;
  } catch (err) {
    console.error("[Supabase Backup] Backup failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

let _interval: ReturnType<typeof setInterval> | null = null;

export function startSupabasePeriodicBackup(intervalMs = 5 * 60 * 1000): void {
  if (_interval || !isConfigured()) return;
  _interval = setInterval(() => { backupDbToSupabase(true).catch(() => {}); }, intervalMs);
  if (_interval.unref) _interval.unref();
  console.log(`[Supabase Backup] Periodic backup every ${intervalMs / 60000} min`);
}

export function stopSupabasePeriodicBackup(): void {
  if (_interval) { clearInterval(_interval); _interval = null; }
}
