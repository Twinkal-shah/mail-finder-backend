// Test script to verify the duplicate transaction fix
// This script tests if we still get duplicate transactions after the fix

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testDuplicateTransactionFix() {
  console.log('🧪 Testing Duplicate Transaction Fix...')
  
  try {
    // Get a test user (using the first available user)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, credits_find, credits_verify')
      .limit(1)
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ Error getting test user:', usersError)
      return
    }
    
    const testUser = users[0]
    console.log(`📋 Test user: ${testUser.id}`)
    console.log(`💰 Initial credits: find=${testUser.credits_find}, verify=${testUser.credits_verify}`)
    
    // Ensure user has enough credits for testing
    if ((testUser.credits_find || 0) < 2) {
      console.log('🔧 Setting up test credits...')
      const { error: setupError } = await supabase
        .from('profiles')
        .update({ credits_find: 5, credits_verify: 5 })
        .eq('id', testUser.id)
      
      if (setupError) {
        console.error('❌ Error setting up test credits:', setupError)
        return
      }
      console.log('✅ Test credits set to 5 find + 5 verify')
    }
    
    // Get transaction count before test
    const { data: beforeTransactions, error: beforeError } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', testUser.id)
      .eq('operation', 'email_find')
    
    if (beforeError) {
      console.error('❌ Error getting before transactions:', beforeError)
      return
    }
    
    const beforeCount = beforeTransactions?.length || 0
    console.log(`📊 Transaction count before test: ${beforeCount}`)
    
    // Test the deduct_credits RPC function
    console.log('\n🔬 Testing deduct_credits RPC function...')
    const { data: rpcResult, error: rpcError } = await supabase.rpc('deduct_credits', {
      required: 1,
      operation: 'email_find',
      meta: { test: 'duplicate_transaction_fix' }
    })
    
    console.log(`RPC Result: ${rpcResult}, Error: ${rpcError?.message || 'none'}`)
    
    // Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Get transaction count after test
    const { data: afterTransactions, error: afterError } = await supabase
      .from('credit_transactions')
      .select('id, amount, operation, meta, created_at')
      .eq('user_id', testUser.id)
      .eq('operation', 'email_find')
      .order('created_at', { ascending: false })
    
    if (afterError) {
      console.error('❌ Error getting after transactions:', afterError)
      return
    }
    
    const afterCount = afterTransactions?.length || 0
    const newTransactions = afterCount - beforeCount
    
    console.log(`📊 Transaction count after test: ${afterCount}`)
    console.log(`📈 New transactions created: ${newTransactions}`)
    
    // Check the most recent transactions
    if (afterTransactions && afterTransactions.length > 0) {
      console.log('\n📋 Recent transactions:')
      afterTransactions.slice(0, 3).forEach((tx, index) => {
        console.log(`  ${index + 1}. Amount: ${tx.amount}, Meta: ${JSON.stringify(tx.meta)}, Created: ${tx.created_at}`)
      })
    }
    
    // Verify the fix
    if (rpcResult && newTransactions === 1) {
      console.log('\n✅ SUCCESS: Fix is working correctly!')
      console.log('   - RPC function succeeded')
      console.log('   - Only 1 new transaction was created')
      console.log('   - No duplicate transactions detected')
    } else if (rpcResult && newTransactions > 1) {
      console.log('\n❌ ISSUE: Duplicate transactions still occurring!')
      console.log(`   - RPC function succeeded but ${newTransactions} transactions were created`)
      console.log('   - This indicates the fix may not be complete')
    } else if (!rpcResult) {
      console.log('\n⚠️  WARNING: RPC function failed')
      console.log('   - This might be due to insufficient credits or other issues')
      console.log('   - Check the database function and user credits')
    } else {
      console.log('\n❓ UNCLEAR: Unexpected result')
      console.log(`   - RPC result: ${rpcResult}`)
      console.log(`   - New transactions: ${newTransactions}`)
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test
testDuplicateTransactionFix().then(() => {
  console.log('\n🏁 Test completed')
  process.exit(0)
}).catch(error => {
  console.error('💥 Test crashed:', error)
  process.exit(1)
})