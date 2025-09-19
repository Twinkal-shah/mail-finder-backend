// Test script to verify credit sync fixes
// This script tests the credit deduction functionality

const { createClient } = require('@supabase/supabase-js')

// Test configuration
const TEST_CONFIG = {
  // Add your Supabase URL and anon key here for testing
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

async function testCreditDeduction() {
  console.log('🧪 Testing Credit Deduction Fixes...')
  
  if (!TEST_CONFIG.supabaseUrl || !TEST_CONFIG.supabaseKey) {
    console.log('❌ Missing Supabase environment variables')
    console.log('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return
  }

  const supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey)

  try {
    console.log('\n1. Testing deduct_credits function signature...')
    
    // Test the function with new parameter structure
    const { data: testResult, error: testError } = await supabase
      .rpc('deduct_credits', {
        required: 1,
        operation: 'email_find',
        meta: { test: true, source: 'test_script' }
      })
    
    if (testError) {
      console.log('❌ Function call failed:', testError.message)
      if (testError.message.includes('function deduct_credits(integer, text, jsonb) does not exist')) {
        console.log('💡 The migration needs to be applied to fix the function signature')
      }
    } else {
      console.log('✅ Function call successful, result:', testResult)
    }

    console.log('\n2. Checking recent credit transactions...')
    
    // Check recent transactions to see the pattern
    const { data: transactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (transError) {
      console.log('❌ Failed to fetch transactions:', transError.message)
    } else {
      console.log('📊 Recent transactions:')
      transactions.forEach((tx, i) => {
        console.log(`  ${i + 1}. Amount: ${tx.amount}, Operation: ${tx.operation}, Meta: ${JSON.stringify(tx.meta)}`)
      })
      
      // Analyze for the -2 issue
      const negativeTwo = transactions.filter(tx => tx.amount === -2)
      if (negativeTwo.length > 0) {
        console.log(`\n⚠️  Found ${negativeTwo.length} transactions with -2 amount (this indicates the bug)`)
      } else {
        console.log('\n✅ No -2 transactions found in recent history')
      }
    }

    console.log('\n3. Testing bulk operation metadata...')
    
    // Check if bulk operations are properly marked
    const bulkTransactions = transactions?.filter(tx => 
      tx.meta && typeof tx.meta === 'object' && tx.meta.bulk === true
    ) || []
    
    console.log(`📈 Found ${bulkTransactions.length} bulk transactions`)
    bulkTransactions.forEach((tx, i) => {
      console.log(`  Bulk ${i + 1}: Amount: ${tx.amount}, Meta: ${JSON.stringify(tx.meta)}`)
    })

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testCreditDeduction().then(() => {
  console.log('\n🏁 Test completed')
}).catch(error => {
  console.error('💥 Test script error:', error)
})