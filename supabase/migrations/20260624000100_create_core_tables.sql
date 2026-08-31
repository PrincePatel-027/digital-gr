-- ============================================================
-- Migration: Create or adopt core tables for Digital GR System
-- Date: 2026-06-24
-- Description: Creates schools, profiles, and gr_records on a fresh database.
--              Existing objects from the legacy setup script are adopted safely.
--              RLS is enabled in the next migration.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the enum on a fresh database. If it already exists, require the exact
-- contract used by the application instead of silently accepting an incompatible type.
DO $$
DECLARE
  expected_labels CONSTANT TEXT[] := ARRAY[
    'super_admin',
    'school_admin',
    'staff',
    'principal'
  ];
  actual_kind TEXT;
  actual_labels TEXT[];
BEGIN
  SELECT
    type_row.typtype::TEXT,
    array_agg(enum_row.enumlabel::TEXT ORDER BY enum_row.enumsortorder)
      FILTER (WHERE enum_row.enumlabel IS NOT NULL)
  INTO actual_kind, actual_labels
  FROM pg_catalog.pg_type AS type_row
  JOIN pg_catalog.pg_namespace AS namespace_row
    ON namespace_row.oid = type_row.typnamespace
  LEFT JOIN pg_catalog.pg_enum AS enum_row
    ON enum_row.enumtypid = type_row.oid
  WHERE namespace_row.nspname = 'public'
    AND type_row.typname = 'user_role'
  GROUP BY type_row.oid, type_row.typtype;

  IF NOT FOUND THEN
    CREATE TYPE public.user_role AS ENUM (
      'super_admin',
      'school_admin',
      'staff',
      'principal'
    );
  ELSIF actual_kind IS DISTINCT FROM 'e'
    OR actual_labels IS DISTINCT FROM expected_labels THEN
    RAISE EXCEPTION
      'public.user_role is incompatible: kind %, labels %, expected enum labels %',
      actual_kind,
      actual_labels,
      expected_labels
      USING ERRCODE = '42804';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.schools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  address       TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schools IS
  'Each row represents one tenant (school) in the multi-tenant system.';

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  role       public.user_role NOT NULL DEFAULT 'staff',
  full_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active  BOOLEAN NOT NULL DEFAULT true
);

-- The legacy setup added this column separately. Keep the baseline compatible
-- with both that database and a fresh Supabase Preview database.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON TABLE public.profiles IS
  'Application-level user profile, linked 1:1 to Supabase auth.users.';
COMMENT ON COLUMN public.profiles.school_id IS
  'NULL only for super_admin users who operate across all schools.';
COMMENT ON COLUMN public.profiles.is_active IS
  'Whether this login is allowed to access the application.';

CREATE INDEX IF NOT EXISTS idx_profiles_school_id
  ON public.profiles(school_id);

CREATE TABLE IF NOT EXISTS public.gr_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
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
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gr_records IS
  'Digitized General Register entries — one row per student record.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_gr_records_school_gr_number
  ON public.gr_records(school_id, gr_number);
CREATE INDEX IF NOT EXISTS idx_gr_records_school_id
  ON public.gr_records(school_id);
CREATE INDEX IF NOT EXISTS idx_gr_records_student_name
  ON public.gr_records(school_id, student_name);
CREATE INDEX IF NOT EXISTS idx_gr_records_surname
  ON public.gr_records(school_id, surname);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gr_records_updated_at ON public.gr_records;
CREATE TRIGGER trg_gr_records_updated_at
  BEFORE UPDATE ON public.gr_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
