-- ============================================================
-- Migration: Expand gr_records for Manekrao Prathmik Shala fields
-- Date: 2026-06-28
-- Description: Adds 8 new columns matching the actual register
--              layout (left page: મુખ્ય વિગતો, right page:
--              શૈક્ષણિક વિગતો). All new columns are nullable
--              so existing data is preserved.
-- ============================================================

-- ── Left Page (પત્રક ૪ — મુખ્ય વિગતો) ──────────────────────

-- ધર્મ (Religion)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  religion TEXT;
COMMENT ON COLUMN gr_records.religion IS 'ધર્મ — Religion of the student.';

-- જન્મ તારીખ શબ્દોમાં (Date of birth written in words)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  dob_in_words TEXT;
COMMENT ON COLUMN gr_records.dob_in_words IS 'જન્મ તારીખ શબ્દોમાં — Date of birth spelled out in words (Gujarati).';

-- જન્મ સ્થળ (Birth place)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  birth_place TEXT;
COMMENT ON COLUMN gr_records.birth_place IS 'જન્મ સ્થળ — Place where the student was born.';

-- ── Right Page (પત્રક ૫ — શૈક્ષણિક વિગતો) ─────────────────

-- કયા ધોરણમાં દાખલ થયા (Standard at admission)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  admission_standard TEXT;
COMMENT ON COLUMN gr_records.admission_standard IS 'દાખલ થયા ત્યારે ધોરણ — Standard/class at the time of admission.';

-- પ્રગતિ અને વર્તન (Progress and conduct)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  progress_and_conduct TEXT;
COMMENT ON COLUMN gr_records.progress_and_conduct IS 'પ્રગતિ અને વર્તન — Progress and conduct remarks during schooling.';

-- શાળા છોડ્યા તારીખ (Date of leaving)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  leaving_date DATE;
COMMENT ON COLUMN gr_records.leaving_date IS 'શાળા છોડ્યા તારીખ — Date the student left the school.';

-- શાળા છોડવાનું કારણ (Reason for leaving)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  leaving_reason TEXT;
COMMENT ON COLUMN gr_records.leaving_reason IS 'શાળા છોડવાનું કારણ — Reason the student left (e.g. transfer, completed).';

-- શાળા છોડતી વખતે ધોરણ (Standard at leaving)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  leaving_standard TEXT;
COMMENT ON COLUMN gr_records.leaving_standard IS 'છોડતી વખતે ધોરણ — Standard/class the student was in when leaving.';

-- રીમાર્ક્સ / શેરો (Remarks)
ALTER TABLE gr_records ADD COLUMN IF NOT EXISTS
  remarks TEXT;
COMMENT ON COLUMN gr_records.remarks IS 'રીમાર્ક્સ / શેરો — Any additional notes, signatures, or stamps.';
