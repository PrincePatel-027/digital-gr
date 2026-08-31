-- ============================================================
-- Migration: Row Level Security policies
-- Date: 2026-06-24
-- Description: Enables and safely recreates tenant RLS on profiles and gr_records.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT school_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gr_records ENABLE ROW LEVEL SECURITY;

-- All application profile writes go through service-role API routes. Browser clients
-- only need SELECT, so table privileges provide a hard boundary even if a policy drifts.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_super_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_super_admin_select ON public.profiles;
CREATE POLICY profiles_super_admin_select
  ON public.profiles
  FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS profiles_select_own_school ON public.profiles;
CREATE POLICY profiles_select_own_school
  ON public.profiles
  FOR SELECT
  USING (
    school_id = public.get_my_school_id()
    OR id = auth.uid()
  );

-- These legacy policies exposed direct profile mutation to authenticated users.
-- Privileged API routes and provisioning scripts use service_role/postgres instead.
DROP POLICY IF EXISTS profiles_school_admin_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_school_admin_update ON public.profiles;
DROP POLICY IF EXISTS profiles_school_admin_delete ON public.profiles;

DROP POLICY IF EXISTS gr_records_super_admin_all ON public.gr_records;
CREATE POLICY gr_records_super_admin_all
  ON public.gr_records
  FOR ALL
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS gr_records_select_own_school ON public.gr_records;
CREATE POLICY gr_records_select_own_school
  ON public.gr_records
  FOR SELECT
  USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS gr_records_insert_own_school ON public.gr_records;
CREATE POLICY gr_records_insert_own_school
  ON public.gr_records
  FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('staff', 'school_admin')
    AND school_id = public.get_my_school_id()
  );

DROP POLICY IF EXISTS gr_records_update_own_school ON public.gr_records;
CREATE POLICY gr_records_update_own_school
  ON public.gr_records
  FOR UPDATE
  USING (
    public.get_my_role() IN ('staff', 'school_admin')
    AND school_id = public.get_my_school_id()
  )
  WITH CHECK (
    public.get_my_role() IN ('staff', 'school_admin')
    AND school_id = public.get_my_school_id()
  );

DROP POLICY IF EXISTS gr_records_delete_own_school ON public.gr_records;
CREATE POLICY gr_records_delete_own_school
  ON public.gr_records
  FOR DELETE
  USING (
    public.get_my_role() = 'school_admin'
    AND school_id = public.get_my_school_id()
  );
