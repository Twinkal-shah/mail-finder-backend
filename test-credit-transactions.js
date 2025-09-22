// Test script to verify credit transactions are being recorded properly
// Run this with: node test-credit-transactions.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCreditTransactions() {
  console.log('🔍 Testing credit transactions...')
  
  try {
    // Check recent credit transactions
    const { data: transactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (transError) {
      console.error('❌ Error fetching credit transactions:', transError)
      return
    }
    
    console.log('📊 Recent credit transactions:')
    console.table(transactions)
    
    // Check for bulk transactions specifically
    const bulkTransactions = transactions.filter(t => 
      t.meta && typeof t.meta === 'object' && t.meta.bulk === true
    )
    
    console.log(`\n🔢 Found ${bulkTransactions.length} bulk transactions out of ${transactions.length} total`)
    
    if (bulkTransactions.length > 0) {
      console.log('✅ Bulk transactions are being recorded!')
      console.log('📋 Bulk transaction details:')
      bulkTransactions.forEach((t, i) => {
        console.log(`  ${i + 1}. Operation: ${t.operation}, Amount: ${t.amount}, Meta:`, t.meta)
      })
    } else {
      console.log('⚠️  No bulk transactions found. This might indicate the issue still exists.')
    }
    
    // Test the deduct_credits function
    console.log('\n🧪 Testing deduct_credits function...')
    const { data: functionResult, error: functionError } = await supabase.rpc('deduct_credits', {
      required: 1,
      operation: 'email_verify',
      meta: { test: true, bulk: true }
    })
    
    if (functionError) {
      console.error('❌ Error testing deduct_credits function:', functionError)
    } else {
      console.log('✅ deduct_credits function executed successfully:', functionResult)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testCreditTransactions()
  .then(() => {
    console.log('\n🏁 Test completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Test crashed:', error)
    process.exit(1)
  })