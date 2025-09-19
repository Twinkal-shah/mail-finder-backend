const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Create client with service role for testing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Create client with anon key to test actual app behavior
const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testCurrentFunction() {
  try {
    console.log('=== Testing Current Function Behavior ===')
    
    // Get a test user
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, credits_find, credits_verify')
      .limit(1)
    
    if (!profiles || profiles.length === 0) {
      console.log('No profiles found')
      return
    }
    
    const testUserId = profiles[0].id
    console.log('Test user ID:', testUserId)
    console.log('Initial credits:', { find: profiles[0].credits_find, verify: profiles[0].credits_verify })
    
    // Set known credit amounts
    await supabase
      .from('profiles')
      .update({ credits_find: 5, credits_verify: 5 })
      .eq('id', testUserId)
    
    console.log('\nSet credits to 5 find + 5 verify')
    
    // Clear existing test transactions
    await supabase
      .from('credit_transactions')
      .delete()
      .eq('user_id', testUserId)
      .eq('operation', 'email_find')
    
    console.log('Cleared existing test transactions')
    
    // Test 1: Check what function signatures exist
    console.log('\n=== Checking Available Functions ===')
    
    // Try to call with different signatures to see which one works
    console.log('\nTesting signature: (operation, amount)')
    const { data: result1, error: error1 } = await supabase
      .rpc('deduct_credits', ['email_find', 1])
    console.log('Result:', result1, 'Error:', error1?.message)
    
    console.log('\nTesting signature: { required, operation, meta }')
    const { data: result2, error: error2 } = await supabase
      .rpc('deduct_credits', {
        required: 1,
        operation: 'email_find',
        meta: { test: true }
      })
    console.log('Result:', result2, 'Error:', error2?.message)
    
    console.log('\nTesting signature: { operation, amount }')
    const { data: result3, error: error3 } = await supabase
      .rpc('deduct_credits', {
        operation: 'email_find',
        amount: 1
      })
    console.log('Result:', result3, 'Error:', error3?.message)
    
    // Check current state
    const { data: profileAfter } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', testUserId)
      .single()
    
    console.log('\nCredits after tests:', profileAfter)
    
    // Check transactions
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(5)
    
    console.log('\nRecent transactions:')
    transactions?.forEach((t, i) => {
      console.log(`  ${i + 1}. Amount: ${t.amount}, Operation: ${t.operation}, Meta: ${JSON.stringify(t.meta)}`)
    })
    
    // Test with authentication context
    console.log('\n=== Testing with Auth Context ===')
    
    // Sign in as the test user (if possible)
    const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
      email: 'test@test.com',
      password: 'testpassword'
    })
    
    if (authError) {
      console.log('Auth error (expected):', authError.message)
    } else {
      console.log('Authenticated as:', authData.user?.email)
      
      // Try the RPC call with authentication
      const { data: authResult, error: authRpcError } = await anonSupabase
        .rpc('deduct_credits', {
          required: 1,
          operation: 'email_find',
          meta: { test: true }
        })
      
      console.log('Authenticated RPC result:', authResult)
      if (authRpcError) {
        console.log('Authenticated RPC error:', authRpcError.message)
      }
    }
    
  } catch (error) {
    console.error('Test error:', error.message)
  }
}

testCurrentFunction()