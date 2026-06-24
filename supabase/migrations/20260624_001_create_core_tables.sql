-- ============================================================
-- Migration: Create core tables for Digital GR System
-- Date: 2026-06-24
-- Description: Creates schools, profiles, and gr_records tables
--              with proper FK constraints and UUID primary keys.
--              RLS is NOT enabled here — that's a separate migration.
-- ============================================================

-- Enable uuid generation (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------
-- 1. ENUM: user roles
-- ----------------------------------------
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'school_admin',
  'staff',
  'principal'
);

-- ----------------------------------------
-- 2. TABLE: schools
-- ----------------------------------------
CREATE TABLE schools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  address       TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schools IS 'Each row represents one tenant (school) in the multi-tenant system.';

-- ----------------------------------------
-- 3. TABLE: profiles
--    id matches auth.users.id (1:1)
-- ----------------------------------------
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  UUID REFERENCES schools(id) ON DELETE SET NULL,  -- NULL for super_admin
  role       user_role NOT NULL DEFAULT 'staff',
  full_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Application-level user profile, linked 1:1 to Supabase auth.users.';
COMMENT ON COLUMN profiles.school_id IS 'NULL only for super_admin users who operate across all schools.';

-- Index for fast lookups by school
CREATE INDEX idx_profiles_school_id ON profiles(school_id);

-- ----------------------------------------
-- 4. TABLE: gr_records
-- ----------------------------------------
CREATE TABLE gr_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gr_number       TEXT NOT NULL,
  student_name    TEXT NOT NULL,
  fathers_name    TEXT NOT NULL,
  mothers_name    TEXT,
  surname         TEXT NOT NULL,
  date_of_birth   DATE NOT NULL,
  admission_date  DATE NOT NULL,
  address         TEXT,
  caste_category  TEXT,
  previous_school TEXT,
  image_url       TEXT,
  ocr_raw_text    TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gr_records IS 'Digitized General Register entries — one row per student record.';

-- GR number should be unique within a school
CREATE UNIQUE INDEX idx_gr_records_school_gr_number
  ON gr_records(school_id, gr_number);

-- Index for common search patterns
CREATE INDEX idx_gr_records_school_id ON gr_records(school_id);
CREATE INDEX idx_gr_records_student_name ON gr_records(school_id, student_name);
CREATE INDEX idx_gr_records_surname ON gr_records(school_id, surname);

-- ----------------------------------------
-- 5. Auto-update updated_at on gr_records
-- ----------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gr_records_updated_at
  BEFORE UPDATE ON gr_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
