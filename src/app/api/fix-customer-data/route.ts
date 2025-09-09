import { createServiceRoleClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { createLemonSqueezyPortal } from '@/lib/services/lemonsqueezy'

export async function POST() {
  try {
    const supabase = createServiceRoleClient()
    
    // Find profiles with missing customer data
    const { data: profilesWithNulls } = await supabase
      .from('profiles')
      .select('id, email')
      .or('lemonsqueezy_customer_id.is.null,lemonsqueezy_portal_url.is.null')
    
    if (!profilesWithNulls || profilesWithNulls.length === 0) {
      return NextResponse.json({ message: 'No profiles need fixing' })
    }
    
    const results = []
    
    for (const profile of profilesWithNulls) {
      // Find transactions for this user with customer data
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, metadata')
        .eq('user_id', profile.id)
        .not('metadata', 'is', null)
        .order('created_at', { ascending: false })
      
      if (transactions && transactions.length > 0) {
        for (const transaction of transactions) {
          const customerId = transaction.metadata?.event_data?.customer_id || 
                            transaction.metadata?.customer_id
          
          if (customerId) {
            try {
              // Fetch customer portal URL
              let customerPortalUrl = null
              try {
                const portalResponse = await createLemonSqueezyPortal(customerId)
                customerPortalUrl = portalResponse.url
              } catch (portalError) {
                console.log('Could not fetch portal URL:', portalError)
              }
              
              // Update profile
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  lemonsqueezy_customer_id: customerId,
                  lemonsqueezy_portal_url: customerPortalUrl,
                  updated_at: new Date().toISOString()
                })
                .eq('id', profile.id)
              
              if (updateError) {
                results.push({
                  email: profile.email,
                  status: 'error',
                  error: updateError.message
                })
              } else {
                results.push({
                  email: profile.email,
                  status: 'fixed',
                  customerId,
                  portalUrl: customerPortalUrl ? 'fetched' : 'not_available'
                })
              }
              break // Stop after first successful update
            } catch (error) {
              console.error(`Error fixing ${profile.email}:`, error)
              results.push({
                email: profile.email,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }
        }
      } else {
        results.push({
          email: profile.email,
          status: 'no_transaction_data',
          error: 'No transactions with customer data found'
        })
      }
    }
    
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error fixing customer data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}