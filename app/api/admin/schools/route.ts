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
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can create schools' }, { status: 403 })
    }

    const { name, address, contact_phone, contact_email } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'School name is required' }, { status: 400 })
    }

    // Insert School
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .insert({
        name,
        address,
        contact_phone,
        contact_email
      })
      .select('id')
      .single()

    if (schoolError || !schoolData) {
      return NextResponse.json({ error: schoolError?.message || 'Failed to create school' }, { status: 400 })
    }

    return NextResponse.json({ success: true, schoolId: schoolData.id })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
