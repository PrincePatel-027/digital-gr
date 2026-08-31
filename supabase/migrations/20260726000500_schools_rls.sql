-- ============================================================
-- Migration: Row Level Security for the `schools` table
-- Date: 2026-07-26
-- Description:
--   Migration 002 enabled RLS on `profiles` and `gr_records` but NOT on
--   `schools`, so any authenticated user could list every school in the system
--   (names, addresses, contact phone/email). Verified in practice: a School B
--   admin could read all 3 school rows.
--
--   After this migration:
--     - super_admin            → full access to all schools (needs it to manage tenants)
--     - every other role       → can read ONLY their own school
--     - nobody but super_admin → can create/modify/delete schools
--
--   Note: school creation from the UI goes through /api/admin/schools, which uses
--   the service role key and therefore bypasses RLS — provisioning still works.
-- ============================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Idempotent: drop before create so this migration can be re-run safely.
DROP POLICY IF EXISTS schools_super_admin_all ON public.schools;
DROP POLICY IF EXISTS schools_select_own      ON public.schools;

-- 1. super_admin: full access to every school
CREATE POLICY schools_super_admin_all
  ON public.schools
  FOR ALL
  USING      (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- 2. Everyone else: read only the school they belong to.
--    This is what the dashboard header/profile join relies on.
CREATE POLICY schools_select_own
  ON public.schools
  FOR SELECT
  USING (id = public.get_my_school_id());
