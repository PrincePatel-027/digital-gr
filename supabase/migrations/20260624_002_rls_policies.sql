-- ============================================================
-- Migration: Row Level Security policies
-- Date: 2026-06-24
-- Description: Enables RLS on profiles and gr_records.
--   - super_admin: full access to everything
--   - school_admin/staff/principal: scoped to own school_id
--   - Within a school:
--       staff & school_admin → INSERT, UPDATE on gr_records
--       principal → SELECT only
--       school_admin only → DELETE on gr_records
--   - school_admin can manage profiles in their school
--     (but cannot change their own role or school_id)
--
-- Assumes: auth.uid() returns the current user's UUID,
--          which matches profiles.id.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns the role for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the school_id for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gr_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- 1. super_admin: full access to all profiles
CREATE POLICY profiles_super_admin_all
  ON profiles
  FOR ALL
  USING  (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- 2. Any non-super user can read profiles in their own school
CREATE POLICY profiles_select_own_school
  ON profiles
  FOR SELECT
  USING (
    school_id = get_my_school_id()
    OR id = auth.uid()  -- always allow reading own profile
  );

-- 3. school_admin can INSERT profiles in their own school
CREATE POLICY profiles_school_admin_insert
  ON profiles
  FOR INSERT
  WITH CHECK (
    get_my_role() = 'school_admin'
    AND school_id = get_my_school_id()
    AND school_id IS NOT NULL
  );

-- 4. school_admin can UPDATE profiles in their school,
--    but CANNOT change their own role or school_id
CREATE POLICY profiles_school_admin_update
  ON profiles
  FOR UPDATE
  USING (
    get_my_role() = 'school_admin'
    AND school_id = get_my_school_id()
  )
  WITH CHECK (
    get_my_role() = 'school_admin'
    AND school_id = get_my_school_id()
    -- Prevent self-promotion: cannot change own row's role or school_id
    AND (
      id != auth.uid()
      OR (
        role = (SELECT role FROM profiles WHERE id = auth.uid())
        AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
      )
    )
  );

-- 5. school_admin can DELETE profiles in their own school
--    (but not their own profile)
CREATE POLICY profiles_school_admin_delete
  ON profiles
  FOR DELETE
  USING (
    get_my_role() = 'school_admin'
    AND school_id = get_my_school_id()
    AND id != auth.uid()  -- cannot delete yourself
  );

-- ============================================================
-- GR_RECORDS POLICIES
-- ============================================================

-- 1. super_admin: full access to all gr_records
CREATE POLICY gr_records_super_admin_all
  ON gr_records
  FOR ALL
  USING  (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- 2. All school roles can SELECT gr_records in their own school
CREATE POLICY gr_records_select_own_school
  ON gr_records
  FOR SELECT
  USING (
    school_id = get_my_school_id()
  );

-- 3. staff and school_admin can INSERT gr_records in their school
CREATE POLICY gr_records_insert_own_school
  ON gr_records
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('staff', 'school_admin')
    AND school_id = get_my_school_id()
  );

-- 4. staff and school_admin can UPDATE gr_records in their school
CREATE POLICY gr_records_update_own_school
  ON gr_records
  FOR UPDATE
  USING (
    get_my_role() IN ('staff', 'school_admin')
    AND school_id = get_my_school_id()
  )
  WITH CHECK (
    get_my_role() IN ('staff', 'school_admin')
    AND school_id = get_my_school_id()
  );

-- 5. Only school_admin can DELETE gr_records in their school
CREATE POLICY gr_records_delete_own_school
  ON gr_records
  FOR DELETE
  USING (
    get_my_role() = 'school_admin'
    AND school_id = get_my_school_id()
  );
