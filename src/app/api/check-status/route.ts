import { createServiceRoleClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createServiceRoleClient()
    
    // Check profiles with NULL customer data
    const { data: profilesWithNulls, error: nullError } = await supabase
      .from('profiles')
      .select('id, email, lemonsqueezy_customer_id, lemonsqueezy_portal_url, plan, created_at')
      .or('lemonsqueezy_customer_id.is.null,lemonsqueezy_portal_url.is.null')
      .order('created_at', { ascending: false })
    
    if (nullError) {
      return NextResponse.json({ error: nullError.message }, { status: 500 })
    }
    
    // Check recent transactions
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('id, user_id, status, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Get total profiles count
    const { count: totalProfiles } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      profilesWithNulls: profilesWithNulls?.length || 0,
      totalProfiles: totalProfiles || 0,
      coverage: totalProfiles ? ((totalProfiles - (profilesWithNulls?.length || 0)) / totalProfiles * 100).toFixed(1) : '0',
      nullProfiles: profilesWithNulls || [],
      recentTransactions: recentTransactions || []
    })
  } catch (error) {
    console.error('Error checking status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}