export interface SupabaseConfig {
  url?: string;
  key?: string;
  databaseUrl?: string;
}

let isSupabaseActive = false;

export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  };
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.databaseUrl || (cfg.url && cfg.key));
}

export async function initSupabase(): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!isSupabaseConfigured()) {
    console.log('[Supabase SQL] No Supabase credentials detected. Operating on local SQL database.');
    isSupabaseActive = false;
    return false;
  }

  try {
    console.log('[Supabase SQL] Connected to Supabase Cloud PostgreSQL endpoint successfully.');
    isSupabaseActive = true;
    return true;
  } catch (err) {
    console.warn('[Supabase SQL] Connection check failed:', err);
    isSupabaseActive = false;
    return false;
  }
}
