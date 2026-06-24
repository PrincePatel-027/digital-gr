import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Missing auth header' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the caller
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch caller profile
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    const body = await req.json()
    const { email, password, full_name, role, school_id } = body

    // Permissions check
    if (callerProfile.role === 'school_admin') {
      if (school_id !== callerProfile.school_id) {
        return NextResponse.json({ error: 'Cannot create users for another school' }, { status: 403 })
      }
      if (role !== 'staff' && role !== 'principal') {
        return NextResponse.json({ error: 'School admin can only create staff or principal' }, { status: 403 })
      }
    } else if (callerProfile.role === 'super_admin') {
      if (role !== 'school_admin') {
        return NextResponse.json({ error: 'Super admin creates school admins' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // 1. Create Auth User
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // 2. Create Profile Row
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: newUser.user.id,
      school_id,
      role,
      full_name,
      is_active: true,
    })

    if (insertError) {
      // Rollback Auth user if profile fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId: newUser.user.id })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Missing auth header' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the caller
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch caller profile
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admins can deactivate users' }, { status: 403 })
    }

    const { userId, is_active } = await req.json()

    // Fetch target user profile to ensure they belong to the same school and are not a school admin
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (targetProfile.school_id !== callerProfile.school_id) {
      return NextResponse.json({ error: 'Cannot modify users from another school' }, { status: 403 })
    }
    if (targetProfile.role === 'school_admin') {
      return NextResponse.json({ error: 'Cannot deactivate another school admin' }, { status: 403 })
    }

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
