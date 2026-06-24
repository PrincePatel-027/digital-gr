-- ============================================================
-- Task 2.2 — Seed data: 2 test schools + 7 test users
-- ============================================================
-- INSTRUCTIONS:
--   1. Run this in the Supabase SQL Editor AFTER running the
--      two migration files (core tables + RLS policies).
--   2. BEFORE running this, you must create 7 auth users in
--      the Supabase Dashboard → Authentication → Users → Add User.
--      Use these emails (passwords can be anything you choose):
--
--        super@test.com          (super_admin, no school)
--        admin-a@test.com        (school_admin, School A)
--        staff-a@test.com        (staff, School A)
--        principal-a@test.com    (principal, School A)
--        admin-b@test.com        (school_admin, School B)
--        staff-b@test.com        (staff, School B)
--        principal-b@test.com    (principal, School B)
--
--   3. After creating those 7 auth users, copy each user's UUID
--      from the Authentication dashboard and paste it into the
--      matching INSERT below (replace the placeholder UUIDs).
--
--   4. Then run this SQL.
-- ============================================================

-- 1. Create two test schools
INSERT INTO schools (id, name, address, contact_phone, contact_email)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Test School A', '123 Main St, City A', '9876543210', 'schoola@test.com'),
  ('b0000000-0000-0000-0000-000000000002', 'Test School B', '456 Oak Ave, City B', '9876543211', 'schoolb@test.com');

-- 2. Create profiles for each test user
--    ⚠️ REPLACE the UUIDs below with the real auth.users IDs
--    from your Supabase Authentication dashboard!

-- Super Admin (no school)
INSERT INTO profiles (id, school_id, role, full_name) VALUES
  ('REPLACE_WITH_SUPER_ADMIN_AUTH_UID', NULL, 'super_admin', 'Super Admin');

-- School A users
INSERT INTO profiles (id, school_id, role, full_name) VALUES
  ('REPLACE_WITH_ADMIN_A_AUTH_UID',     'a0000000-0000-0000-0000-000000000001', 'school_admin', 'Admin School A'),
  ('REPLACE_WITH_STAFF_A_AUTH_UID',     'a0000000-0000-0000-0000-000000000001', 'staff',        'Staff School A'),
  ('REPLACE_WITH_PRINCIPAL_A_AUTH_UID', 'a0000000-0000-0000-0000-000000000001', 'principal',    'Principal School A');

-- School B users
INSERT INTO profiles (id, school_id, role, full_name) VALUES
  ('REPLACE_WITH_ADMIN_B_AUTH_UID',     'b0000000-0000-0000-0000-000000000002', 'school_admin', 'Admin School B'),
  ('REPLACE_WITH_STAFF_B_AUTH_UID',     'b0000000-0000-0000-0000-000000000002', 'staff',        'Staff School B'),
  ('REPLACE_WITH_PRINCIPAL_B_AUTH_UID', 'b0000000-0000-0000-0000-000000000002', 'principal',    'Principal School B');

-- 3. Create a sample GR record in each school (for RLS testing)
INSERT INTO gr_records (school_id, gr_number, student_name, fathers_name, surname, date_of_birth, admission_date, created_by)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'GR-001', 'Rahul', 'Suresh', 'Patel', '2015-03-15', '2021-06-01', 'REPLACE_WITH_STAFF_A_AUTH_UID'),
  ('b0000000-0000-0000-0000-000000000002', 'GR-001', 'Priya', 'Rajesh', 'Sharma', '2014-07-22', '2020-06-01', 'REPLACE_WITH_STAFF_B_AUTH_UID');
