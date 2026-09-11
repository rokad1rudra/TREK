-- ============================================================================
-- GlobeTrotter & TrekAI - Supabase PostgreSQL Full Cloud Schema
-- Run this script in the Supabase SQL Editor (https://app.supabase.com)
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  maps_api_key TEXT,
  unsplash_api_key TEXT,
  openweather_api_key TEXT,
  avatar TEXT,
  oidc_sub TEXT,
  oidc_issuer TEXT,
  last_login TIMESTAMPTZ,
  mfa_enabled INTEGER DEFAULT 0,
  mfa_secret TEXT,
  mfa_backup_codes TEXT,
  immich_url TEXT,
  immich_access_token TEXT,
  synology_url TEXT,
  synology_username TEXT,
  synology_password TEXT,
  synology_sid TEXT,
  must_change_password INTEGER DEFAULT 0,
  password_version INTEGER NOT NULL DEFAULT 0,
  feed_token TEXT,
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_hash ON password_reset_tokens(token_hash);

-- 3. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value TEXT,
  CONSTRAINT uq_user_setting UNIQUE(user_id, key)
);

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(50) DEFAULT '#6366f1',
  icon VARCHAR(50) DEFAULT '📍',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tags Table
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Trips Table
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  origin_location TEXT,
  destination_location TEXT,
  start_date VARCHAR(50),
  end_date VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'INR',
  cover_image TEXT,
  is_archived INTEGER DEFAULT 0,
  reminder_days INTEGER DEFAULT 3,
  feed_token TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(start_date, end_date);

-- 7. Days Table
CREATE TABLE IF NOT EXISTS days (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date VARCHAR(50),
  notes TEXT,
  title VARCHAR(255),
  CONSTRAINT uq_trip_day UNIQUE(trip_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_days_trip ON days(trip_id);

-- 8. Places Table
CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price DOUBLE PRECISION,
  currency VARCHAR(10),
  reservation_status VARCHAR(50) DEFAULT 'none',
  reservation_notes TEXT,
  reservation_datetime VARCHAR(100),
  place_time VARCHAR(50),
  end_time VARCHAR(50),
  duration_minutes INTEGER DEFAULT 60,
  notes TEXT,
  image_url TEXT,
  google_place_id TEXT,
  google_ftid TEXT,
  osm_id TEXT,
  website TEXT,
  phone TEXT,
  transport_mode VARCHAR(50) DEFAULT 'walking',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_trip ON places(trip_id);
CREATE INDEX IF NOT EXISTS idx_places_coords ON places(lat, lng);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category_id);

-- 9. Place Tags
CREATE TABLE IF NOT EXISTS place_tags (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, tag_id)
);

-- 10. Day Assignments Table
CREATE TABLE IF NOT EXISTS day_assignments (
  id SERIAL PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  reservation_status VARCHAR(50) DEFAULT 'none',
  reservation_notes TEXT,
  reservation_datetime VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_day_place UNIQUE(day_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_day_assignments_day ON day_assignments(day_id);
CREATE INDEX IF NOT EXISTS idx_day_assignments_place ON day_assignments(place_id);

-- 11. Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id INTEGER REFERENCES days(id) ON DELETE SET NULL,
  end_day_id INTEGER REFERENCES days(id) ON DELETE SET NULL,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  assignment_id INTEGER REFERENCES day_assignments(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'other',
  title VARCHAR(255) NOT NULL,
  name TEXT,
  accommodation_id TEXT,
  reservation_time VARCHAR(100),
  reservation_end_time VARCHAR(100),
  location TEXT,
  confirmation_number TEXT,
  confirmation_code VARCHAR(100),
  day_number INTEGER,
  price DOUBLE PRECISION,
  currency VARCHAR(10) DEFAULT 'INR',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservations_trip ON reservations(trip_id);

-- 12. Budget Items Table
CREATE TABLE IF NOT EXISTS budget_items (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title VARCHAR(255),
  name VARCHAR(255),
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  amount DOUBLE PRECISION DEFAULT 0,
  total_price DOUBLE PRECISION DEFAULT 0,
  paid INTEGER DEFAULT 0,
  persons INTEGER,
  days INTEGER,
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_trip ON budget_items(trip_id);

-- 13. Packing Items
CREATE TABLE IF NOT EXISTS packing_items (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  checked INTEGER DEFAULT 0,
  category VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packing_items_trip ON packing_items(trip_id);

-- 14. Trip Members & Sharing
CREATE TABLE IF NOT EXISTS trip_members (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'editor',
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_trip_member UNIQUE(trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);

-- 15. Day Notes
CREATE TABLE IF NOT EXISTS day_notes (
  id SERIAL PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  time VARCHAR(50),
  icon VARCHAR(50) DEFAULT '📝',
  sort_order DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Addons
CREATE TABLE IF NOT EXISTS addons (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'global',
  icon VARCHAR(50) DEFAULT 'Puzzle',
  enabled INTEGER DEFAULT 0,
  config TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0
);

-- 17. Seed Default Categories
INSERT INTO categories (name, color, icon) VALUES
  ('Sightseeing', '#3b82f6', 'Landmark'),
  ('Food & Dining', '#f59e0b', 'Utensils'),
  ('Activities & Adventure', '#10b981', 'Mountain'),
  ('Stay & Accommodation', '#8b5cf6', 'Hotel'),
  ('Transit & Transport', '#6b7280', 'Car'),
  ('Shopping & Heritage', '#ec4899', 'ShoppingBag')
ON CONFLICT (name) DO NOTHING;
