-- ====================================================================
-- TrueNorth Bookings - Initial Consolidated Schema (Phase 1 MVP)
-- Cloudflare D1 (SQLite) dialect
-- Compatible with calrs v1.18.0 + Canadian White-Label & Interac Deposits
-- ====================================================================

-- 1. Accounts (organisations / vendor workspaces)
CREATE TABLE IF NOT EXISTS accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    timezone    TEXT NOT NULL DEFAULT 'America/Toronto',
    user_id     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Users (vendors / admins)
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    timezone            TEXT NOT NULL DEFAULT 'America/Toronto',
    password_hash       TEXT,
    role                TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    auth_provider       TEXT NOT NULL DEFAULT 'local' CHECK(auth_provider IN ('local', 'oidc')),
    oidc_subject        TEXT,
    enabled             INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    username            TEXT UNIQUE,
    booking_email       TEXT,
    title               TEXT,
    bio                 TEXT,
    avatar_path         TEXT,
    allow_dynamic_group INTEGER NOT NULL DEFAULT 1,
    language            TEXT NOT NULL DEFAULT 'en',

    -- Canadian Vendor Profile Fields
    business_name       TEXT,
    street_address      TEXT,
    province            TEXT, -- AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT
    postal_code         TEXT, -- Standard Canadian postal code: A1A 1A1
    phone               TEXT, -- Standard Canadian phone format: +1 ...
    tax_number          TEXT, -- Business GST/HST registration number
    prices_include_tax  INTEGER NOT NULL DEFAULT 0
);

-- Foreign key linking accounts to users
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- 3. Sessions (Cross-isolate session storage)
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 4. Auth Config (Singleton)
CREATE TABLE IF NOT EXISTS auth_config (
    id                      TEXT PRIMARY KEY DEFAULT 'singleton',
    registration_enabled    INTEGER NOT NULL DEFAULT 1,
    allowed_email_domains   TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO auth_config (id) VALUES ('singleton');

-- 5. Event Types (Service offerings)
CREATE TABLE IF NOT EXISTS event_types (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    slug                    TEXT NOT NULL,
    title                   TEXT NOT NULL,
    description             TEXT,
    duration_min            INTEGER NOT NULL DEFAULT 30,
    location_type           TEXT NOT NULL DEFAULT 'in_person', -- in_person, phone, link
    location_value          TEXT,
    buffer_before           INTEGER NOT NULL DEFAULT 0,
    buffer_after            INTEGER NOT NULL DEFAULT 0,
    min_notice_min          INTEGER NOT NULL DEFAULT 60,
    slot_interval_min       INTEGER,
    booking_horizon_days    INTEGER,
    first_slot_only         INTEGER NOT NULL DEFAULT 0,
    timezone                TEXT,
    enabled                 INTEGER NOT NULL DEFAULT 1,
    visibility              TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public', 'unlisted', 'private')),
    cancel_notice_min       INTEGER DEFAULT 0,
    reschedule_notice_min   INTEGER DEFAULT 0,
    requires_confirmation   INTEGER NOT NULL DEFAULT 0,
    created_by_user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),

    -- Canadian Interac e-Transfer & Policy Requirements
    deposit_amount          REAL, -- Amount in CAD (e.g. 25.00)
    deposit_recipient_email TEXT, -- e.g. payments@salon.ca
    cancellation_policy     TEXT, -- Canadian vendor cancellation terms

    UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_event_types_slug ON event_types(account_id, slug);

-- 6. Weekly Availability Rules (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
CREATE TABLE IF NOT EXISTS availability_rules (
    id              TEXT PRIMARY KEY,
    event_type_id   TEXT NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time      TEXT NOT NULL, -- HH:MM
    end_time        TEXT NOT NULL  -- HH:MM
);

CREATE INDEX IF NOT EXISTS idx_availability_rules_event ON availability_rules(event_type_id, day_of_week);

-- 7. Availability Overrides (Specific dates: blocked or custom hours)
CREATE TABLE IF NOT EXISTS availability_overrides (
    id              TEXT PRIMARY KEY,
    event_type_id   TEXT NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
    date            TEXT NOT NULL, -- YYYY-MM-DD
    start_time      TEXT,          -- HH:MM
    end_time        TEXT,          -- HH:MM
    is_blocked      INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_availability_overrides_event ON availability_overrides(event_type_id, date);

-- 8. Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id                  TEXT PRIMARY KEY,
    event_type_id       TEXT NOT NULL REFERENCES event_types(id),
    uid                 TEXT NOT NULL UNIQUE,
    guest_name          TEXT NOT NULL,
    guest_email         TEXT NOT NULL,
    guest_timezone      TEXT NOT NULL DEFAULT 'America/Toronto',
    notes               TEXT,
    start_at            TEXT NOT NULL, -- RFC3339 UTC: YYYY-MM-DDTHH:MM:SSZ
    end_at              TEXT NOT NULL, -- RFC3339 UTC: YYYY-MM-DDTHH:MM:SSZ
    status              TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'pending', 'cancelled')),
    cancel_token        TEXT NOT NULL UNIQUE,
    reschedule_token    TEXT NOT NULL UNIQUE,
    assigned_user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    guest_phone         TEXT,
    deposit_status      TEXT NOT NULL DEFAULT 'none' CHECK(deposit_status IN ('none', 'pending', 'received')),
    time_version        INTEGER NOT NULL DEFAULT 1 CHECK(time_version IN (0, 1)),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_type_id, status, start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_token ON bookings(cancel_token);
CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_token ON bookings(reschedule_token);

-- Enforce RFC3339 UTC timestamps on version 1 bookings (calrs migration 064)
CREATE TRIGGER IF NOT EXISTS booking_utc_insert BEFORE INSERT ON bookings
WHEN NEW.time_version = 1 AND
    (NEW.start_at NOT GLOB '????-??-??T??:??:??Z' OR NEW.end_at NOT GLOB '????-??-??T??:??:??Z')
BEGIN SELECT RAISE(ABORT, 'UTC bookings require UTC timestamps'); END;

CREATE TRIGGER IF NOT EXISTS booking_utc_update BEFORE UPDATE OF start_at, end_at, time_version ON bookings
WHEN NEW.time_version = 1 AND
    (NEW.start_at NOT GLOB '????-??-??T??:??:??Z' OR NEW.end_at NOT GLOB '????-??-??T??:??:??Z')
BEGIN SELECT RAISE(ABORT, 'UTC bookings require UTC timestamps'); END;

-- 9. Booking Frequency Limits
CREATE TABLE IF NOT EXISTS booking_frequency_limits (
    id              TEXT PRIMARY KEY,
    event_type_id   TEXT NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
    max_bookings    INTEGER NOT NULL,
    period          TEXT NOT NULL CHECK(period IN ('day', 'week', 'month', 'year')),
    per_member      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_frequency_limits ON booking_frequency_limits(event_type_id);
