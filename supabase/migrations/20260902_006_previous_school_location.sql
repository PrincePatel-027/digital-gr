-- Add canonical previous-school location keys and optional English-script metadata.
-- All columns remain nullable so existing OCR-created records continue to be valid.

ALTER TABLE public.gr_records
  ADD COLUMN IF NOT EXISTS previous_school_district TEXT,
  ADD COLUMN IF NOT EXISTS previous_school_subdistrict TEXT,
  ADD COLUMN IF NOT EXISTS fields_en JSONB;

COMMENT ON COLUMN public.gr_records.previous_school_district IS
  'Canonical district key for the pupil''s previous school.';
COMMENT ON COLUMN public.gr_records.previous_school_subdistrict IS
  'Canonical sub-district/taluka key for the pupil''s previous school.';
COMMENT ON COLUMN public.gr_records.fields_en IS
  'English-script field values keyed by GR field, each with value and source metadata.';
