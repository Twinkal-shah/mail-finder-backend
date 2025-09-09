// Script to backfill missing lemonsqueezy_customer_id in profiles table
// Run this script to fix existing Pro users who can't access billing portal

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function backfillCustomerIds() {
  try {
    console.log('Starting customer ID backfill...')
    
    // Get all profiles that have a plan but no customer_id
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, plan')
      .in('plan', ['pro', 'agency', 'lifetime'])
      .is('lemonsqueezy_customer_id', null)
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return
    }
    
    console.log(`Found ${profiles.length} profiles missing customer IDs`)
    
    for (const profile of profiles) {
      console.log(`Processing user ${profile.email} (${profile.id})...`)
      
      // Find the most recent transaction for this user
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('user_id', profile.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (transError) {
        console.error(`Error fetching transactions for ${profile.email}:`, transError)
        continue
      }
      
      if (transactions.length === 0) {
        console.log(`No transactions found for ${profile.email}`)
        continue
      }
      
      const transaction = transactions[0]
      const customerId = transaction.metadata?.event_data?.customer_id
      
      if (!customerId) {
        console.log(`No customer_id found in transaction metadata for ${profile.email}`)
        continue
      }
      
      // Update the profile with the customer_id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ lemonsqueezy_customer_id: customerId })
        .eq('id', profile.id)
      
      if (updateError) {
        console.error(`Error updating profile for ${profile.email}:`, updateError)
        continue
      }
      
      console.log(`✅ Updated ${profile.email} with customer_id: ${customerId}`)
    }
    
    console.log('Customer ID backfill completed!')
    
  } catch (error) {
    console.error('Backfill script error:', error)
  }
}

// Run the script
backfillCustomerIds()
  .then(() => {
    console.log('Script finished')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })