export type UserRole = 'super_admin' | 'school_admin' | 'staff' | 'principal'

export interface Profile {
  id: string
  school_id: string | null
  role: UserRole
  full_name: string
  created_at: string
}
