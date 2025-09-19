const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function testCreditDeduction() {
  console.log('Testing credit deduction via RPC function...')
  
  try {
    // First, let's check if we have any users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, credits_find, credits_verify')
      .limit(1)
    
    if (usersError) {
      console.error('Error fetching users:', usersError)
      return
    }
    
    if (!users || users.length === 0) {
      console.log('No users found in profiles table')
      return
    }
    
    const user = users[0]
    console.log('Found user:', user)
    
    // Test the RPC function directly
    console.log('Testing RPC deduct_credits function...')
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('deduct_credits', {
        required: 1,
        operation: 'email_find',
        meta: { test: true }
      })
    
    if (rpcError) {
      console.error('RPC Error:', rpcError)
    } else {
      console.log('RPC Result:', rpcResult)
    }
    
    // Check if any transactions were recorded
    const { data: transactions, error: fetchError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (fetchError) {
      console.error('Error fetching transactions:', fetchError)
    } else {
      console.log('Recent transactions:', transactions)
    }
    
    // Check updated user credits
    const { data: updatedUser, error: userError } = await supabase
      .from('profiles')
      .select('id, email, credits_find, credits_verify')
      .eq('id', user.id)
      .single()
    
    if (userError) {
      console.error('Error fetching updated user:', userError)
    } else {
      console.log('Updated user credits:', updatedUser)
    }
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testCreditDeduction()