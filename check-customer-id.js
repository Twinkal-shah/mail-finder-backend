// Check if customer_id was saved for the user
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkCustomerId() {
  try {
    console.log('Checking customer_id for twinkalshah719@gmail.com...')
    
    const { data, error } = await supabase
      .from('profiles')
      .select('email, lemonsqueezy_customer_id, plan, created_at, updated_at')
      .eq('email', 'twinkalshah719@gmail.com')
      .single()
    
    if (error) {
      console.error('Error:', error)
      return
    }
    
    console.log('Profile data:')
    console.log(JSON.stringify(data, null, 2))
    
    if (data.lemonsqueezy_customer_id) {
      console.log('\n✅ Customer ID found:', data.lemonsqueezy_customer_id)
    } else {
      console.log('\n❌ No customer ID found')
    }
    
    // Also check transactions for this user
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_email', 'twinkalshah719@gmail.com')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (txError) {
      console.error('Transaction error:', txError)
    } else {
      console.log('\nRecent transactions:')
      console.log(JSON.stringify(transactions, null, 2))
    }
    
  } catch (error) {
    console.error('Script error:', error)
  }
}

checkCustomerId()