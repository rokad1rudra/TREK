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


-- ============================================================================
-- DATA SEEDING FROM LOCAL SQLITE
-- ============================================================================

-- Data for users (5 rows)
INSERT INTO "users" ("id", "username", "email", "password_hash", "role", "maps_api_key", "unsplash_api_key", "openweather_api_key", "avatar", "oidc_sub", "oidc_issuer", "last_login", "mfa_enabled", "mfa_secret", "mfa_backup_codes", "immich_url", "immich_access_token", "synology_url", "synology_username", "synology_password", "synology_sid", "must_change_password", "password_version", "feed_token", "is_guest", "created_at", "updated_at", "immich_api_key", "synology_skip_ssl", "synology_did", "first_seen_version", "login_count", "immich_auto_upload", "airtrail_url", "airtrail_api_key", "airtrail_allow_insecure_tls", "airtrail_write_enabled", "display_name")
VALUES
  (1, 'admin', 'admin@trek.local', '$2a$12$GiqHl7.pmxv32/RHmKJ2heBZtF5xypGUnXR9SzzeQCZZIdfsvLTMC', 'admin', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 0, '2026-08-22 06:10:06', '2026-09-11 17:27:05', NULL, 0, NULL, '0.0.0', 0, 0, NULL, NULL, 0, 0, NULL),
  (2, 'rudra', 'rokadrudra29@gmail.com', '$2a$12$b2O0n.cXqIBzX5PL.fVzLuCnF3HpxwIGs3p9roQTwoh2vdoduV2ri', 'user', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-11 16:40:30', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '603849d4-41d3-45cc-956c-39a5010cf01e', 0, '2026-08-22 07:13:04', '2026-08-22 07:13:04', NULL, 0, NULL, '0.0.0', 11, 0, NULL, NULL, 0, 0, NULL),
  (3, 'rudra_rokad', 'workr9871@gmail.com', '$2a$12$PAX.zVn7jBc1vywsg6Fo5OVK9pamtFyd9z3u3GtNiFpoPmRshBGTu', 'user', NULL, NULL, NULL, NULL, NULL, NULL, '2026-08-28 08:22:55', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 0, '2026-08-22 07:22:00', '2026-08-22 07:22:00', NULL, 0, NULL, '0.0.0', 1, 0, NULL, NULL, 0, 0, NULL),
  (4, 'rudra rokad', 'rokadrudra49@gmail.com', '$2a$12$eyhzX36/SwdA.7sEce0jLuAQeMv6AVMiFFo8qAd6fswAhSEeXlHLe', 'user', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 0, '2026-08-23 08:14:14', '2026-08-23 08:14:14', NULL, 0, NULL, '0.0.0', 0, 0, NULL, NULL, 0, 0, NULL),
  (5, 'rudra rokad 39', 'rokadrudra39@gmail.com', '$2a$12$cWd0zcq4IZknXmGZti85sOjFZvB3SGTCuV8J0.N..cVEW8xFc.k7q', 'user', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 0, '2026-08-24 20:27:55', '2026-08-24 20:27:55', NULL, 0, NULL, '0.0.0', 0, 0, NULL, NULL, 0, 0, NULL)
ON CONFLICT ("id") DO NOTHING;

-- Data for settings (8 rows)
INSERT INTO "settings" ("id", "user_id", "key", "value")
VALUES
  (1, 2, 'dashboard_fx_from', 'AFN'),
  (2, 2, 'dark_mode', 'dark'),
  (4, 2, 'dashboard_timezones', '["Asia/Calcutta","Europe/London","Asia/Tokyo","Indian/Reunion"]'),
  (6, 3, 'dark_mode', 'dark'),
  (11, 3, 'dashboard_fx_to', 'INR'),
  (12, 3, 'dashboard_fx_from', 'INR'),
  (20, 4, 'dark_mode', 'dark'),
  (22, 5, 'dark_mode', 'dark')
ON CONFLICT ("user_id", "key") DO NOTHING;

-- Data for categories (10 rows)
INSERT INTO "categories" ("id", "name", "color", "icon", "user_id", "created_at")
VALUES
  (1, 'Hotel', '#3b82f6', '🏨', NULL, '2026-08-22 06:10:06'),
  (2, 'Restaurant', '#ef4444', '🍽️', NULL, '2026-08-22 06:10:06'),
  (3, 'Attraction', '#8b5cf6', '🏛️', NULL, '2026-08-22 06:10:06'),
  (4, 'Shopping', '#f59e0b', '🛍️', NULL, '2026-08-22 06:10:06'),
  (5, 'Transport', '#6b7280', '🚌', NULL, '2026-08-22 06:10:06'),
  (6, 'Activity', '#10b981', '🎯', NULL, '2026-08-22 06:10:06'),
  (7, 'Bar/Cafe', '#f97316', '☕', NULL, '2026-08-22 06:10:06'),
  (8, 'Beach', '#06b6d4', '🏖️', NULL, '2026-08-22 06:10:06'),
  (9, 'Nature', '#84cc16', '🌿', NULL, '2026-08-22 06:10:06'),
  (10, 'Other', '#6366f1', '📍', NULL, '2026-08-22 06:10:06')
ON CONFLICT ("name") DO NOTHING;

-- Data for trips (16 rows)
INSERT INTO "trips" ("id", "user_id", "title", "description", "start_date", "end_date", "currency", "cover_image", "is_archived", "reminder_days", "feed_token", "created_at", "updated_at", "origin_location", "destination_location")
VALUES
  (7, 4, 'trip', NULL, '2026-10-20', '2026-10-20', 'AED', '/uploads/covers/34fb800e-967d-4e82-84b7-8ce66e84090d.jpg', 1, 3, NULL, '2026-08-23 08:15:00', '2026-08-24 05:00:26', NULL, NULL),
  (8, 4, 'visiting girnar', NULL, '2026-08-20', '2026-08-28', 'INR', '/uploads/covers/de3e58b6-5007-4595-93a7-23e4fc83512f.jpg', 1, 3, NULL, '2026-08-23 17:54:41', '2026-08-27 10:56:53', NULL, NULL),
  (9, 4, 'Trip to 32.2456', 'abcd', '2026-08-25', '2026-09-03', 'INR', '/uploads/covers/26f0a1a1-30d6-4206-9209-7da0350876da.jpg', 1, 3, NULL, '2026-08-24 05:43:52', '2026-08-27 10:56:31', NULL, NULL),
  (10, 4, 'Trip to Manali', 'hav fun', '2026-08-12', '2026-08-27', 'INR', '/uploads/covers/c535703a-fbba-4072-b079-83e6aa994091.jpg', 0, 3, NULL, '2026-08-24 06:00:07', '2026-08-24 06:00:07', NULL, NULL),
  (11, 4, 'Trip to Rajasthan', NULL, NULL, NULL, 'EUR', NULL, 0, 3, NULL, '2026-08-24 06:08:37', '2026-08-24 06:08:37', NULL, NULL),
  (12, 4, 'Trip to Karnataka', NULL, NULL, NULL, 'EUR', NULL, 0, 3, NULL, '2026-08-24 06:15:52', '2026-08-24 06:15:52', NULL, NULL),
  (13, 2, 'Trip to Manali', NULL, '2026-09-19', '2026-09-30', 'EUR', NULL, 0, 3, NULL, '2026-08-24 08:16:26', '2026-08-27 12:34:05', 'Trip', 'Manali'),
  (14, 2, 'Trip to Rajasthan', NULL, '2026-08-26', '2026-09-18', 'EUR', NULL, 0, 3, NULL, '2026-08-24 18:56:10', '2026-08-24 18:56:10', NULL, NULL),
  (15, 5, 'Trip to Karnataka', NULL, '2026-08-26', '2026-09-19', 'EUR', NULL, 0, 3, NULL, '2026-08-24 20:28:51', '2026-08-24 20:28:51', NULL, NULL),
  (18, 2, '5-Day Surat to Mount Abu Adventure', 'AI Planned Trip from Surat, Gujarat, India to Mount Abu, Rajasthan, India.
Distance: ~470 km (Western Zone (Gujarat & Maharashtra Corridor)).
Est. Budget: ₹25,000', '2026-08-28', '2026-08-31', 'INR', NULL, 0, 3, NULL, '2026-08-27 05:56:20', '2026-08-27 12:34:45', 'Surat, Gujarat, India', 'Mount Abu, Rajasthan, India'),
  (19, 2, 'Trip to Nagaland', NULL, '2026-10-13', '2026-10-30', 'INR', NULL, 0, 3, NULL, '2026-08-27 10:49:59', '2026-08-27 10:49:59', 'Goa, India', 'Nagaland, India'),
  (21, 2, 'Trip to Karnataka', NULL, '2026-08-29', '2026-08-31', 'EUR', NULL, 0, 3, NULL, '2026-08-27 10:54:04', '2026-08-27 12:34:31', 'Mumbai, Mumbai Suburban District, Maharashtra, 400051, India', 'Karnataka, India'),
  (22, 2, 'Trip to Rajasthan', NULL, '2026-09-09', '2026-09-25', 'EUR', NULL, 0, 3, NULL, '2026-08-27 11:07:31', '2026-08-27 12:32:50', 'Mumbai, Mumbai Suburban District, Maharashtra, 400051, India', 'Rajasthan, India'),
  (23, 2, 'Trip to Rishikesh', NULL, '2027-02-03', '2027-02-25', 'INR', NULL, 0, 3, NULL, '2026-08-27 12:39:26', '2026-08-27 12:39:26', 'Mini Bazar, Surat', 'Rishikesh, Dehradun, Uttarakhand, 249201, India'),
  (24, 2, '5-Day Rajkot, Gujarat, India Journey from Surat, Gujarat, India', 'AI Planned Trip from Surat, Gujarat, India to Rajkot, Gujarat, India.
Distance: ~594.08 km (Regional Zone).
Est. Budget: ₹11,199.7
Stay: Zostel / Central Backpacker Hostel Rajkot, Gujarat, India (Central Rajkot, Gujarat, India)', '2026-08-30', '2026-09-03', 'INR', NULL, 0, 3, NULL, '2026-08-29 12:07:49', '2026-08-29 12:07:49', 'Surat, Gujarat, India', 'Rajkot, Gujarat, India'),
  (25, 2, 'Trip to Adlabs Imagica Theme Park', NULL, NULL, NULL, 'EUR', NULL, 0, 3, NULL, '2026-08-29 12:40:41', '2026-08-29 12:40:41', 'Surat, Katargam Taluka, Surat, Gujarat, 395008, India', 'Adlabs Imagica Theme Park, NH548A, Vadwal, Khalapur Taluka, Raigad, Maharashtra, India')
ON CONFLICT ("id") DO NOTHING;

-- Data for days (188 rows)
INSERT INTO "days" ("id", "trip_id", "day_number", "date", "notes", "title")
VALUES
  (27, 7, 1, '2026-10-20', NULL, NULL),
  (28, 8, 1, '2026-08-20', NULL, NULL),
  (29, 8, 2, '2026-08-21', NULL, NULL),
  (30, 8, 3, '2026-08-22', NULL, NULL),
  (31, 8, 4, '2026-08-23', NULL, NULL),
  (32, 8, 5, '2026-08-24', NULL, NULL),
  (33, 8, 6, '2026-08-25', NULL, NULL),
  (34, 8, 7, '2026-08-26', NULL, NULL),
  (35, 8, 8, '2026-08-27', NULL, NULL),
  (36, 8, 9, '2026-08-28', NULL, NULL),
  (37, 9, 1, '2026-08-25', NULL, NULL),
  (38, 9, 2, '2026-08-26', NULL, NULL),
  (39, 9, 3, '2026-08-27', NULL, NULL),
  (40, 9, 4, '2026-08-28', NULL, NULL),
  (41, 9, 5, '2026-08-29', NULL, NULL),
  (42, 9, 6, '2026-08-30', NULL, NULL),
  (43, 9, 7, '2026-08-31', NULL, NULL),
  (44, 9, 8, '2026-09-01', NULL, NULL),
  (45, 9, 9, '2026-09-02', NULL, NULL),
  (46, 9, 10, '2026-09-03', NULL, NULL),
  (47, 10, 1, '2026-08-12', NULL, NULL),
  (48, 10, 2, '2026-08-13', NULL, NULL),
  (49, 10, 3, '2026-08-14', NULL, NULL),
  (50, 10, 4, '2026-08-15', NULL, NULL),
  (51, 10, 5, '2026-08-16', NULL, NULL),
  (52, 10, 6, '2026-08-17', NULL, NULL),
  (53, 10, 7, '2026-08-18', NULL, NULL),
  (54, 10, 8, '2026-08-19', NULL, NULL),
  (55, 10, 9, '2026-08-20', NULL, NULL),
  (56, 10, 10, '2026-08-21', NULL, NULL),
  (57, 10, 11, '2026-08-22', NULL, NULL),
  (58, 10, 12, '2026-08-23', NULL, NULL),
  (59, 10, 13, '2026-08-24', NULL, NULL),
  (60, 10, 14, '2026-08-25', NULL, NULL),
  (61, 10, 15, '2026-08-26', NULL, NULL),
  (62, 10, 16, '2026-08-27', NULL, NULL),
  (63, 11, 1, NULL, NULL, NULL),
  (64, 11, 2, NULL, NULL, NULL),
  (65, 11, 3, NULL, NULL, NULL),
  (66, 11, 4, NULL, NULL, NULL),
  (67, 11, 5, NULL, NULL, NULL),
  (68, 11, 6, NULL, NULL, NULL),
  (69, 11, 7, NULL, NULL, NULL),
  (70, 12, 1, NULL, NULL, NULL),
  (71, 12, 2, NULL, NULL, NULL),
  (72, 12, 3, NULL, NULL, NULL),
  (73, 12, 4, NULL, NULL, NULL),
  (74, 12, 5, NULL, NULL, NULL),
  (75, 12, 6, NULL, NULL, NULL),
  (76, 12, 7, NULL, NULL, NULL),
  (77, 13, 1, '2026-09-19', NULL, NULL),
  (78, 13, 2, '2026-09-20', NULL, NULL),
  (79, 13, 3, '2026-09-21', NULL, NULL),
  (84, 14, 1, '2026-08-26', NULL, NULL),
  (85, 14, 2, '2026-08-27', NULL, NULL),
  (86, 14, 3, '2026-08-28', NULL, NULL),
  (87, 14, 4, '2026-08-29', NULL, NULL),
  (88, 14, 5, '2026-08-30', NULL, NULL),
  (89, 14, 6, '2026-08-31', NULL, NULL),
  (90, 14, 7, '2026-09-01', NULL, NULL),
  (91, 14, 8, '2026-09-02', NULL, NULL),
  (92, 14, 9, '2026-09-03', NULL, NULL),
  (93, 14, 10, '2026-09-04', NULL, NULL),
  (94, 14, 11, '2026-09-05', NULL, NULL),
  (95, 14, 12, '2026-09-06', NULL, NULL),
  (96, 14, 13, '2026-09-07', NULL, NULL),
  (97, 14, 14, '2026-09-08', NULL, NULL),
  (98, 14, 15, '2026-09-09', NULL, NULL),
  (99, 14, 16, '2026-09-10', NULL, NULL),
  (100, 14, 17, '2026-09-11', NULL, NULL),
  (101, 14, 18, '2026-09-12', NULL, NULL),
  (102, 14, 19, '2026-09-13', NULL, NULL),
  (103, 14, 20, '2026-09-14', NULL, NULL),
  (104, 14, 21, '2026-09-15', NULL, NULL),
  (105, 14, 22, '2026-09-16', NULL, NULL),
  (106, 14, 23, '2026-09-17', NULL, NULL),
  (107, 14, 24, '2026-09-18', NULL, NULL),
  (108, 15, 1, '2026-08-26', NULL, NULL),
  (109, 15, 2, '2026-08-27', NULL, NULL),
  (110, 15, 3, '2026-08-28', NULL, NULL),
  (111, 15, 4, '2026-08-29', NULL, NULL),
  (112, 15, 5, '2026-08-30', NULL, NULL),
  (113, 15, 6, '2026-08-31', NULL, NULL),
  (114, 15, 7, '2026-09-01', NULL, NULL),
  (115, 15, 8, '2026-09-02', NULL, NULL),
  (116, 15, 9, '2026-09-03', NULL, NULL),
  (117, 15, 10, '2026-09-04', NULL, NULL),
  (118, 15, 11, '2026-09-05', NULL, NULL),
  (119, 15, 12, '2026-09-06', NULL, NULL),
  (120, 15, 13, '2026-09-07', NULL, NULL),
  (121, 15, 14, '2026-09-08', NULL, NULL),
  (122, 15, 15, '2026-09-09', NULL, NULL),
  (123, 15, 16, '2026-09-10', NULL, NULL),
  (124, 15, 17, '2026-09-11', NULL, NULL),
  (125, 15, 18, '2026-09-12', NULL, NULL),
  (126, 15, 19, '2026-09-13', NULL, NULL),
  (127, 15, 20, '2026-09-14', NULL, NULL),
  (128, 15, 21, '2026-09-15', NULL, NULL),
  (129, 15, 22, '2026-09-16', NULL, NULL),
  (130, 15, 23, '2026-09-17', NULL, NULL),
  (131, 15, 24, '2026-09-18', NULL, NULL),
  (132, 15, 25, '2026-09-19', NULL, NULL),
  (145, 18, 1, '2026-08-28', NULL, NULL),
  (146, 18, 2, '2026-08-29', NULL, NULL),
  (147, 18, 3, '2026-08-30', NULL, NULL),
  (148, 18, 4, '2026-08-31', NULL, NULL),
  (150, 19, 1, '2026-10-13', NULL, NULL),
  (151, 19, 2, '2026-10-14', NULL, NULL),
  (152, 19, 3, '2026-10-15', NULL, NULL),
  (153, 19, 4, '2026-10-16', NULL, NULL),
  (154, 19, 5, '2026-10-17', NULL, NULL),
  (155, 19, 6, '2026-10-18', NULL, NULL),
  (156, 19, 7, '2026-10-19', NULL, NULL),
  (157, 19, 8, '2026-10-20', NULL, NULL),
  (158, 19, 9, '2026-10-21', NULL, NULL),
  (159, 19, 10, '2026-10-22', NULL, NULL),
  (160, 19, 11, '2026-10-23', NULL, NULL),
  (161, 19, 12, '2026-10-24', NULL, NULL),
  (162, 19, 13, '2026-10-25', NULL, NULL),
  (163, 19, 14, '2026-10-26', NULL, NULL),
  (164, 19, 15, '2026-10-27', NULL, NULL),
  (165, 19, 16, '2026-10-28', NULL, NULL),
  (166, 19, 17, '2026-10-29', NULL, NULL),
  (167, 19, 18, '2026-10-30', NULL, NULL),
  (185, 21, 1, '2026-08-29', NULL, NULL),
  (186, 21, 2, '2026-08-30', NULL, NULL),
  (187, 21, 3, '2026-08-31', NULL, NULL),
  (192, 22, 1, '2026-09-09', NULL, NULL),
  (193, 22, 2, '2026-09-10', NULL, NULL),
  (194, 22, 3, '2026-09-11', NULL, NULL),
  (195, 22, 4, '2026-09-12', NULL, NULL),
  (196, 22, 5, '2026-09-13', NULL, NULL),
  (197, 22, 6, '2026-09-14', NULL, NULL),
  (198, 22, 7, '2026-09-15', NULL, NULL),
  (199, 22, 8, '2026-09-16', NULL, NULL),
  (200, 22, 9, '2026-09-17', NULL, NULL),
  (201, 22, 10, '2026-09-18', NULL, NULL),
  (202, 22, 11, '2026-09-19', NULL, NULL),
  (203, 22, 12, '2026-09-20', NULL, NULL),
  (204, 22, 13, '2026-09-21', NULL, NULL),
  (205, 22, 14, '2026-09-22', NULL, NULL),
  (206, 22, 15, '2026-09-23', NULL, NULL),
  (207, 22, 16, '2026-09-24', NULL, NULL),
  (208, 22, 17, '2026-09-25', NULL, NULL),
  (209, 13, 4, '2026-09-22', NULL, NULL),
  (210, 13, 5, '2026-09-23', NULL, NULL),
  (211, 13, 6, '2026-09-24', NULL, NULL),
  (212, 13, 7, '2026-09-25', NULL, NULL),
  (213, 13, 8, '2026-09-26', NULL, NULL),
  (214, 13, 9, '2026-09-27', NULL, NULL),
  (215, 13, 10, '2026-09-28', NULL, NULL),
  (216, 13, 11, '2026-09-29', NULL, NULL),
  (217, 13, 12, '2026-09-30', NULL, NULL),
  (218, 23, 1, '2027-02-03', NULL, NULL),
  (219, 23, 2, '2027-02-04', NULL, NULL),
  (220, 23, 3, '2027-02-05', NULL, NULL),
  (221, 23, 4, '2027-02-06', NULL, NULL),
  (222, 23, 5, '2027-02-07', NULL, NULL),
  (223, 23, 6, '2027-02-08', NULL, NULL),
  (224, 23, 7, '2027-02-09', NULL, NULL),
  (225, 23, 8, '2027-02-10', NULL, NULL),
  (226, 23, 9, '2027-02-11', NULL, NULL),
  (227, 23, 10, '2027-02-12', NULL, NULL),
  (228, 23, 11, '2027-02-13', NULL, NULL),
  (229, 23, 12, '2027-02-14', NULL, NULL),
  (230, 23, 13, '2027-02-15', NULL, NULL),
  (231, 23, 14, '2027-02-16', NULL, NULL),
  (232, 23, 15, '2027-02-17', NULL, NULL),
  (233, 23, 16, '2027-02-18', NULL, NULL),
  (234, 23, 17, '2027-02-19', NULL, NULL),
  (235, 23, 18, '2027-02-20', NULL, NULL),
  (236, 23, 19, '2027-02-21', NULL, NULL),
  (237, 23, 20, '2027-02-22', NULL, NULL),
  (238, 23, 21, '2027-02-23', NULL, NULL),
  (239, 23, 22, '2027-02-24', NULL, NULL),
  (240, 23, 23, '2027-02-25', NULL, NULL),
  (241, 24, 1, '2026-08-30', NULL, NULL),
  (242, 24, 2, '2026-08-31', NULL, NULL),
  (243, 24, 3, '2026-09-01', NULL, NULL),
  (244, 24, 4, '2026-09-02', NULL, NULL),
  (245, 24, 5, '2026-09-03', NULL, NULL),
  (246, 25, 1, NULL, NULL, NULL),
  (247, 25, 2, NULL, NULL, NULL),
  (248, 25, 3, NULL, NULL, NULL),
  (249, 25, 4, NULL, NULL, NULL),
  (250, 25, 5, NULL, NULL, NULL),
  (251, 25, 6, NULL, NULL, NULL),
  (252, 25, 7, NULL, NULL, NULL)
ON CONFLICT ("id") DO NOTHING;

-- Data for places (50 rows)
INSERT INTO "places" ("id", "trip_id", "name", "description", "lat", "lng", "address", "category_id", "price", "currency", "reservation_status", "reservation_notes", "reservation_datetime", "place_time", "end_time", "duration_minutes", "notes", "image_url", "google_place_id", "google_ftid", "website", "phone", "transport_mode", "created_at", "updated_at", "osm_id", "route_geometry")
VALUES
  (5, 7, 'Visit the National Museum of Dubai', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 60, 'AI Recommendation: Free museum entry and a wealth of information about Dubai''s history and culture.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-23 17:52:40', '2026-08-23 17:52:40', NULL, NULL),
  (6, 7, 'Explore the Dubai Mall', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 60, 'AI Recommendation: Free shopping and dining options, as well as a variety of attractions and entertainment.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-23 17:52:41', '2026-08-23 17:52:41', NULL, NULL),
  (7, 7, 'Take a stroll along the Dubai Marina', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 60, 'AI Recommendation: Panoramic views of the city and a relaxing atmosphere.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-23 17:52:42', '2026-08-23 17:52:42', NULL, NULL),
  (8, 8, 'Local Market', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 60, 'AI Recommendation: Experience the local culture and try authentic street food.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-23 17:57:27', '2026-08-23 17:57:27', NULL, NULL),
  (9, 8, 'Walking Tour', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 60, 'AI Recommendation: Explore the city''s historic square and nearby landmarks on foot.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-23 17:57:32', '2026-08-23 17:57:32', NULL, NULL),
  (10, 8, 'Local Eateries', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 60, 'AI Recommendation: Enjoy budget-friendly local cuisine and try street food vendors.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-23 17:57:34', '2026-08-23 17:57:34', NULL, NULL),
  (28, 18, 'Surat Departure Point', NULL, 21.1702, 72.8311, 'Surat Departure Point, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '06:30 AM · Embark on the journey towards Mount Abu along NH48 -> Abu Road.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:21', '2026-08-27 05:56:21', NULL, NULL),
  (29, 18, 'Mount Abu Hotel Check-in & Refreshment', NULL, 24.5925, 72.7156, 'Mount Abu Hotel Check-in & Refreshment, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '03:30 PM · Check into accommodation in Mount Abu, refresh, and enjoy mountain/scenic views.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:22', '2026-08-27 05:56:22', NULL, NULL),
  (30, 18, 'Mount Abu Evening Promenade & Dinner', NULL, 24.5925, 72.7156, 'Mount Abu Evening Promenade & Dinner, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '07:00 PM · Savor authentic local delicacies and take an evening stroll around Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:22', '2026-08-27 05:56:22', NULL, NULL),
  (31, 18, 'Mount Abu Iconic Landmark', NULL, 24.5925, 72.7156, 'Mount Abu Iconic Landmark, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:00 AM · Explore prime attractions and panoramic viewpoints in Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:22', '2026-08-27 05:56:22', NULL, NULL),
  (32, 18, 'Mount Abu Adventure & Heritage Spot', NULL, 24.5925, 72.7156, 'Mount Abu Adventure & Heritage Spot, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '02:30 PM · Engage in curated activities, photography, and cultural heritage in Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (33, 18, 'Mount Abu Evening Cuisine & Cultural Walk', NULL, 24.5925, 72.7156, 'Mount Abu Evening Cuisine & Cultural Walk, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '06:30 PM · Taste authentic Mount Abu specialties (Local Street Specialties) and enjoy night viewpoints.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (34, 18, 'Mount Abu Iconic Landmark', NULL, 24.5925, 72.7156, 'Mount Abu Iconic Landmark, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:00 AM · Explore prime attractions and panoramic viewpoints in Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (35, 18, 'Mount Abu Adventure & Heritage Spot', NULL, 24.5925, 72.7156, 'Mount Abu Adventure & Heritage Spot, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '02:30 PM · Engage in curated activities, photography, and cultural heritage in Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (36, 18, 'Mount Abu Evening Cuisine & Cultural Walk', NULL, 24.5925, 72.7156, 'Mount Abu Evening Cuisine & Cultural Walk, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '06:30 PM · Taste authentic Mount Abu specialties (Fresh Chai & Snacks) and enjoy night viewpoints.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (37, 18, 'Mount Abu Iconic Landmark', NULL, 24.5925, 72.7156, 'Mount Abu Iconic Landmark, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:00 AM · Explore prime attractions and panoramic viewpoints in Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (38, 18, 'Mount Abu Adventure & Heritage Spot', NULL, 24.5925, 72.7156, 'Mount Abu Adventure & Heritage Spot, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '02:30 PM · Engage in curated activities, photography, and cultural heritage in Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (39, 18, 'Mount Abu Evening Cuisine & Cultural Walk', NULL, 24.5925, 72.7156, 'Mount Abu Evening Cuisine & Cultural Walk, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '06:30 PM · Taste authentic Mount Abu specialties (Authentic Regional Thali) and enjoy night viewpoints.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (40, 18, 'Mount Abu Morning Market & Landmarks', NULL, 24.5925, 72.7156, 'Mount Abu Morning Market & Landmarks, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '08:30 AM · Explore traditional local bazaars and heritage spots for souvenirs in Mount Abu.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (41, 18, 'Mount Abu Traditional Lunch & Check-out', NULL, 24.5925, 72.7156, 'Mount Abu Traditional Lunch & Check-out, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '01:00 PM · Sample authentic regional dishes (Authentic Regional Thali, Local Street Specialties) and complete hotel check-out.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (42, 18, 'Return Transit to Surat', NULL, 21.1702, 72.8311, 'Return Transit to Surat, Mount Abu, Rajasthan, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '04:00 PM · Commence smooth return journey to Surat with memorable travel experiences.', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-27 05:56:23', '2026-08-27 05:56:23', NULL, NULL),
  (43, 24, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '01:30 PM - 02:30 PM · Hotel Check-in & Freshen Up', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (44, 24, 'Local Authentic Diner near Central Rajkot, Gujarat, India', NULL, 26.9144, 75.7893, 'Local Authentic Diner near Central Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '02:45 PM - 03:45 PM · Regional Lunch Break', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (45, 24, 'Central Heritage Bazaar & Street Food Walk', NULL, 26.915, 75.81, 'Central Heritage Bazaar & Street Food Walk, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '04:30 PM - 07:00 PM · Central Heritage Bazaar & Street Food Walk', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (46, 24, 'Rooftop Restaurant in Rajkot, Gujarat, India', NULL, 26.916, 75.811, 'Rooftop Restaurant in Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '07:45 PM - 09:00 PM · Dinner Break & Night Ambiance', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (47, 24, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:15 PM · Overnight Rest', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (48, 24, 'Breakfast at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Breakfast at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '08:30 AM - 09:30 AM · Morning Breakfast', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (49, 24, 'Historic Old Fort & Palace of Rajkot, Gujarat, India', NULL, 26.92, 75.82, 'Historic Old Fort & Palace of Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:45 AM - 12:30 PM · Historic Old Fort & Palace of Rajkot, Gujarat, India', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (50, 24, 'Renowned Traditional Restaurant near (75.82, 26.92)', NULL, 26.921000000000003, 75.821, 'Renowned Traditional Restaurant near (75.82, 26.92), Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '01:00 PM - 02:15 PM · Lunch Break & Rest', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (51, 24, 'Scenic Sunset Ridge & Valley Point', NULL, 26.93, 75.83, 'Scenic Sunset Ridge & Valley Point, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '02:45 PM - 05:00 PM · Scenic Sunset Ridge & Valley Point', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (52, 24, 'Ancient Sacred Shrine & Temple', NULL, 26.91, 75.8, 'Ancient Sacred Shrine & Temple, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '05:30 PM - 07:00 PM · Ancient Sacred Shrine & Temple', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (53, 24, 'Dinner Cafe in Rajkot, Gujarat, India', NULL, 26.911, 75.801, 'Dinner Cafe in Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '07:45 PM - 09:00 PM · Dinner Break', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (54, 24, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:15 PM · Overnight Rest', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (55, 24, 'Breakfast at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Breakfast at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '08:30 AM - 09:30 AM · Morning Breakfast', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (56, 24, 'Central Heritage Bazaar & Street Food Walk', NULL, 26.915, 75.81, 'Central Heritage Bazaar & Street Food Walk, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:45 AM - 12:30 PM · Central Heritage Bazaar & Street Food Walk', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (57, 24, 'Renowned Traditional Restaurant near (75.81, 26.915)', NULL, 26.916, 75.811, 'Renowned Traditional Restaurant near (75.81, 26.915), Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '01:00 PM - 02:15 PM · Lunch Break & Rest', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (58, 24, 'Historic Old Fort & Palace of Rajkot, Gujarat, India', NULL, 26.92, 75.82, 'Historic Old Fort & Palace of Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '02:45 PM - 05:00 PM · Historic Old Fort & Palace of Rajkot, Gujarat, India', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (59, 24, 'Scenic Sunset Ridge & Valley Point', NULL, 26.93, 75.83, 'Scenic Sunset Ridge & Valley Point, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '05:30 PM - 07:00 PM · Scenic Sunset Ridge & Valley Point', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (60, 24, 'Dinner Cafe in Rajkot, Gujarat, India', NULL, 26.931, 75.831, 'Dinner Cafe in Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '07:45 PM - 09:00 PM · Dinner Break', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (61, 24, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:15 PM · Overnight Rest', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (62, 24, 'Breakfast at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Breakfast at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '08:30 AM - 09:30 AM · Morning Breakfast', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (63, 24, 'Ancient Sacred Shrine & Temple', NULL, 26.91, 75.8, 'Ancient Sacred Shrine & Temple, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:45 AM - 12:30 PM · Ancient Sacred Shrine & Temple', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (64, 24, 'Renowned Traditional Restaurant near (75.8, 26.91)', NULL, 26.911, 75.801, 'Renowned Traditional Restaurant near (75.8, 26.91), Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '01:00 PM - 02:15 PM · Lunch Break & Rest', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (65, 24, 'Central Heritage Bazaar & Street Food Walk', NULL, 26.915, 75.81, 'Central Heritage Bazaar & Street Food Walk, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '02:45 PM - 05:00 PM · Central Heritage Bazaar & Street Food Walk', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (66, 24, 'Historic Old Fort & Palace of Rajkot, Gujarat, India', NULL, 26.92, 75.82, 'Historic Old Fort & Palace of Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '05:30 PM - 07:00 PM · Historic Old Fort & Palace of Rajkot, Gujarat, India', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (67, 24, 'Dinner Cafe in Rajkot, Gujarat, India', NULL, 26.921000000000003, 75.821, 'Dinner Cafe in Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '07:45 PM - 09:00 PM · Dinner Break', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (68, 24, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '09:15 PM · Overnight Rest', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (69, 24, 'Breakfast Cafe at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Breakfast Cafe at Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '08:30 AM - 09:30 AM · Morning Breakfast Break', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (70, 24, 'Scenic Sunset Ridge & Valley Point', NULL, 26.93, 75.83, 'Scenic Sunset Ridge & Valley Point, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '10:00 AM - 12:30 PM · Scenic Sunset Ridge & Valley Point', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL),
  (71, 24, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India', NULL, 26.9124, 75.7873, 'Zostel / Central Backpacker Hostel Rajkot, Gujarat, India, Rajkot, Gujarat, India', NULL, NULL, NULL, 'none', NULL, NULL, NULL, NULL, 90, '01:00 PM - 02:00 PM · Hotel Check-out & Departure', NULL, NULL, NULL, NULL, NULL, 'walking', '2026-08-29 12:07:50', '2026-08-29 12:07:50', NULL, NULL)
ON CONFLICT ("id") DO NOTHING;

-- Data for trip_members (12 rows)
INSERT INTO "trip_members" ("id", "trip_id", "user_id", "invited_by", "added_at")
VALUES
  (9, 8, 1, 4, '2026-08-23 17:54:41'),
  (10, 8, 2, 4, '2026-08-23 17:54:41'),
  (11, 8, 3, 4, '2026-08-23 17:54:41'),
  (12, 9, 1, 4, '2026-08-24 05:43:52'),
  (13, 9, 2, 4, '2026-08-24 05:43:52'),
  (14, 9, 3, 4, '2026-08-24 05:43:52'),
  (15, 10, 3, 4, '2026-08-24 06:00:07'),
  (16, 14, 3, 2, '2026-08-24 18:56:10'),
  (17, 19, 4, 2, '2026-08-27 10:49:59'),
  (18, 19, 5, 2, '2026-08-27 10:49:59'),
  (19, 23, 1, 2, '2026-08-27 12:39:26'),
  (20, 23, 5, 2, '2026-08-27 12:39:26')
ON CONFLICT ("trip_id", "user_id") DO NOTHING;

-- Data for addons (13 rows)
INSERT INTO "addons" ("id", "name", "description", "type", "icon", "enabled", "config", "sort_order")
VALUES
  ('collab', 'Collab', 'Notes, polls, and live chat for trip collaboration', 'trip', 'Users', 1, '{}', 6),
  ('memories', 'Photos', NULL, 'trip', 'Image', 0, '{}', 7),
  ('mcp', 'MCP', 'Model Context Protocol for AI assistant integration', 'integration', 'Terminal', 0, '{}', 12),
  ('naver_list_import', 'Naver List Import', 'Import places from shared Naver Maps lists', 'trip', 'Link2', 1, '{}', 13),
  ('journey', 'Journey', 'Trip tracking & travel journal — check-ins, photos, daily stories', 'global', 'Compass', 0, '{}', 35),
  ('airtrail', 'AirTrail', 'Sync flights from your self-hosted AirTrail instance', 'integration', 'Plane', 0, '{}', 14),
  ('collections', 'Collections', 'Personal place library — save places across trips into named lists, copy into any trip, share with others', 'global', 'Bookmark', 0, '{}', 16),
  ('packing', 'Lists', 'Packing lists and to-do tasks for your trips', 'trip', 'ListChecks', 1, '{}', 0),
  ('budget', 'Costs', 'Track and split trip expenses', 'trip', 'Wallet', 1, '{}', 1),
  ('documents', 'Documents', 'Store and manage travel documents', 'trip', 'FileText', 1, '{}', 2),
  ('vacay', 'Vacay', 'Personal vacation day planner with calendar view', 'global', 'CalendarDays', 1, '{}', 10),
  ('atlas', 'Atlas', 'World map of your visited countries with travel stats', 'global', 'Globe', 1, '{}', 11),
  ('llm_parsing', 'AI Parsing', 'LLM fallback for booking imports kitinerary cannot read', 'integration', 'Sparkles', 0, '{}', 15)
ON CONFLICT ("id") DO NOTHING;


-- ============================================================================
-- UPDATE POSTGRESQL SEQUENCES
-- ============================================================================
SELECT setval(pg_get_serial_sequence('"users"', 'id'), COALESCE(MAX(id), 1)) FROM "users";
SELECT setval(pg_get_serial_sequence('"trips"', 'id'), COALESCE(MAX(id), 1)) FROM "trips";
SELECT setval(pg_get_serial_sequence('"days"', 'id'), COALESCE(MAX(id), 1)) FROM "days";
SELECT setval(pg_get_serial_sequence('"places"', 'id'), COALESCE(MAX(id), 1)) FROM "places";
SELECT setval(pg_get_serial_sequence('"day_assignments"', 'id'), COALESCE(MAX(id), 1)) FROM "day_assignments";
SELECT setval(pg_get_serial_sequence('"reservations"', 'id'), COALESCE(MAX(id), 1)) FROM "reservations";
SELECT setval(pg_get_serial_sequence('"budget_items"', 'id'), COALESCE(MAX(id), 1)) FROM "budget_items";
SELECT setval(pg_get_serial_sequence('"packing_items"', 'id'), COALESCE(MAX(id), 1)) FROM "packing_items";
SELECT setval(pg_get_serial_sequence('"tags"', 'id'), COALESCE(MAX(id), 1)) FROM "tags";
