const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Use service role to simulate the actual behavior
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testCreditSync() {
  try {
    console.log('=== Investigating Credit Sync Issue ===')
    
    // First, let's check if there are ANY transactions in the system
    const { data: allTransactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (transError) {
      console.log('Error fetching transactions:', transError.message)
      return
    }
    
    console.log('\n=== Recent Transactions (All Operations) ===')
    if (allTransactions && allTransactions.length > 0) {
      allTransactions.forEach((t, i) => {
        console.log(`  ${i + 1}. User: ${t.user_id.substring(0, 8)}..., Amount: ${t.amount}, Operation: ${t.operation}, Created: ${t.created_at}`)
      })
      
      // Check for the specific issue: -2 amounts
      const problemTransactions = allTransactions.filter(t => t.amount === -2 && t.operation === 'email_find')
      if (problemTransactions.length > 0) {
        console.log('\n🚨 FOUND PROBLEM TRANSACTIONS:')
        problemTransactions.forEach((t, i) => {
          console.log(`  ${i + 1}. Amount: ${t.amount}, Operation: ${t.operation}, Meta: ${JSON.stringify(t.meta)}`)
        })
      }
    } else {
      console.log('No transactions found in the system')
    }
    
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
    console.log('\nTest user ID:', testUserId)
    
    // Set test credits
    await supabase
      .from('profiles')
      .update({ credits_find: 5, credits_verify: 5 })
      .eq('id', testUserId)
    
    console.log('Set test credits to 5 find + 5 verify')
    
    // Clear test transactions
    await supabase
      .from('credit_transactions')
      .delete()
      .eq('user_id', testUserId)
      .like('meta', '%test%')
    
    console.log('\n=== Simulating the Bug Scenario ===')
    
    const { data: beforeBug } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', testUserId)
      .single()
    
    console.log('Before bug simulation:', beforeBug)
    
    // Simulate what might be happening:
    // 1. Deduct 1 credit from profile (correct)
    await supabase
      .from('profiles')
      .update({ credits_find: beforeBug.credits_find - 1 })
      .eq('id', testUserId)
    
    // 2. But log 2 credits in transaction (the bug)
    const { data: insertResult, error: insertError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: testUserId,
        amount: -2,  // This is the bug - should be -1
        operation: 'email_find',
        meta: { test: true, bug_simulation: true }
      })
      .select()
    
    if (insertError) {
      console.log('Error inserting transaction:', insertError.message)
      console.log('This might indicate a constraint or permission issue')
      
      // Let's check the table structure
      const { data: tableInfo, error: tableError } = await supabase
        .from('credit_transactions')
        .select('*')
        .limit(0)
      
      if (tableError) {
        console.log('Table access error:', tableError.message)
        console.log('This confirms there might be RLS policies blocking inserts')
      }
      
      return
    }
    
    const { data: afterBug } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', testUserId)
      .single()
    
    const { data: bugTransaction } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', testUserId)
      .like('meta', '%bug_simulation%')
      .single()
    
    console.log('\nAfter bug simulation:')
    console.log('Profile credits:', afterBug)
    console.log('Transaction logged:', bugTransaction)
    
    if (bugTransaction) {
      const actualDeduction = beforeBug.credits_find - afterBug.credits_find
      const loggedAmount = Math.abs(bugTransaction.amount)
      
      console.log('\n=== Bug Analysis ===')
      console.log('Actual credits deducted from profile:', actualDeduction)
      console.log('Amount logged in transaction:', loggedAmount)
      
      if (actualDeduction !== loggedAmount) {
        console.log('🚨 BUG CONFIRMED: Mismatch between profile deduction and transaction log!')
        console.log('This is exactly the issue described by the user.')
        
        console.log('\n=== Possible Causes ===')
        console.log('1. Function is being called with amount=2 instead of amount=1')
        console.log('2. Function has a bug where it deducts 1 but logs 2')
        console.log('3. Function is called twice but only the second call succeeds in deducting')
        console.log('4. There are multiple versions of the function with different logic')
      } else {
        console.log('✅ No mismatch in this simulation')
      }
    }
    
    // Now let's test the actual deduct_credits function
    console.log('\n=== Testing Actual deduct_credits Function ===')
    
    // Reset credits for function test
    await supabase
      .from('profiles')
      .update({ credits_find: 10, credits_verify: 10 })
      .eq('id', testUserId)
    
    console.log('Reset credits to 10 find + 10 verify for function test')
    
    // Try different function signatures to see which one works
    const testCases = [
      { name: 'Legacy signature (operation, amount)', params: { operation: 'email_find', amount: 1 } },
      { name: 'New signature (required, operation, meta)', params: { required: 1, operation: 'email_find', meta: {} } },
      { name: 'Amount only', params: { amount: 1 } }
    ]
    
    for (const testCase of testCases) {
      console.log(`\nTesting: ${testCase.name}`)
      
      const { data: beforeTest } = await supabase
        .from('profiles')
        .select('credits_find')
        .eq('id', testUserId)
        .single()
      
      try {
        const { data: result, error } = await supabase.rpc('deduct_credits', testCase.params)
        
        const { data: afterTest } = await supabase
          .from('profiles')
          .select('credits_find')
          .eq('id', testUserId)
          .single()
        
        console.log(`  Result: ${result}, Error: ${error?.message || 'none'}`)
        console.log(`  Credits before: ${beforeTest.credits_find}, after: ${afterTest.credits_find}`)
        
        if (result === true) {
          // Check what transaction was logged
          const { data: newTransaction } = await supabase
            .from('credit_transactions')
            .select('*')
            .eq('user_id', testUserId)
            .eq('operation', 'email_find')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          
          if (newTransaction) {
            console.log(`  Transaction logged: amount=${newTransaction.amount}`)
            const actualDeduction = beforeTest.credits_find - afterTest.credits_find
            const loggedAmount = Math.abs(newTransaction.amount)
            
            if (actualDeduction !== loggedAmount) {
              console.log(`  🚨 MISMATCH: Deducted ${actualDeduction} but logged ${loggedAmount}!`)
            } else {
              console.log(`  ✅ MATCH: Both deducted and logged ${actualDeduction}`)
            }
          }
          break // Stop testing once we find a working signature
        }
      } catch (funcError) {
        console.log(`  Function error: ${funcError.message}`)
      }
    }
    
    // Clean up
    await supabase
      .from('credit_transactions')
      .delete()
      .eq('user_id', testUserId)
      .like('meta', '%test%')
    
  } catch (error) {
    console.error('Test error:', error.message)
  }
}

testCreditSync()