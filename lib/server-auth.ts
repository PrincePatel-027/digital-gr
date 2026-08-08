import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export type AppRole = 'super_admin' | 'school_admin' | 'staff' | 'principal'

export class RequestAuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'RequestAuthError'
  }
}

export async function authorizeRequest(
  req: NextRequest,
  allowedRoles: ReadonlySet<AppRole>
) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new RequestAuthError('Authentication required.', 401)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new RequestAuthError('Server authentication is not configured.', 500)
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) throw new RequestAuthError('Invalid or expired session.', 401)

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('school_id, role, is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !profile.is_active) {
    throw new RequestAuthError('An active school profile is required.', 403)
  }
  if (!allowedRoles.has(profile.role as AppRole)) {
    throw new RequestAuthError('You do not have permission to process register scans.', 403)
  }

  return {
    admin,
    userId: user.id,
    role: profile.role as AppRole,
    schoolId: profile.school_id as string | null,
  }
}
