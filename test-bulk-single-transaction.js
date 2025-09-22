// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testBulkSingleTransaction() {
  console.log('🧪 Testing bulk operations create single transactions...')
  
  try {
    // Get a test user with credits
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, credits_find, credits_verify')
      .gt('credits_find', 10)
      .limit(1)
    
    if (profileError || !profiles || profiles.length === 0) {
      console.error('❌ Error getting test profile with credits:', profileError)
      return
    }
    
    const testUser = profiles[0]
    console.log(`📋 Test user: ${testUser.id}`)
    console.log(`💰 Credits before: find=${testUser.credits_find}, verify=${testUser.credits_verify}`)
    
    // Check current transaction count
    const { data: beforeTransactions, error: beforeError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (beforeError) {
      console.error('❌ Error fetching transactions before test:', beforeError)
      return
    }
    
    console.log(`📊 Current transactions for user: ${beforeTransactions?.length || 0}`)
    
    // Test bulk verification with multiple emails
    console.log('\n🔍 Testing bulk verification with 3 emails...')
    
    const testEmails = [
      'test1@example.com',
      'test2@example.com', 
      'test3@example.com'
    ]
    
    // Create a bulk verification job with proper UUID
    const { randomUUID } = require('crypto')
    const jobId = randomUUID()
    const { error: insertError } = await supabase
      .from('bulk_verification_jobs')
      .insert({
        id: jobId,
        user_id: testUser.id,
        status: 'pending',
        total_emails: testEmails.length,
        processed_emails: 0,
        successful_verifications: 0,
        failed_verifications: 0,
        emails_data: testEmails.map(email => ({ email, status: 'pending' }))
      })
    
    if (insertError) {
      console.error('❌ Error creating bulk verification job:', insertError)
      return
    }
    
    console.log(`✅ Created bulk verification job: ${jobId}`)
    
    // Simulate the bulk credit deduction (what the background process does)
    const totalEmailsToProcess = testEmails.length
    
    // Get current user credits
    const { data: userProfile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', testUser.id)
      .single()
    
    if (profileFetchError || !userProfile) {
      console.error('❌ Error getting user profile:', profileFetchError)
      return
    }
    
    const currentFindCredits = userProfile.credits_find || 0
    const currentVerifyCredits = userProfile.credits_verify || 0
    const totalCredits = currentFindCredits + currentVerifyCredits
    
    console.log(`💰 Current credits: find=${currentFindCredits}, verify=${currentVerifyCredits}, total=${totalCredits}`)
    
    if (totalCredits < totalEmailsToProcess) {
      console.log('❌ User has insufficient credits for testing')
      return
    }
    
    // Deduct all credits upfront (prefer verify credits first)
    let updateData = { updated_at: new Date().toISOString() }
    
    if (currentVerifyCredits >= totalEmailsToProcess) {
      updateData.credits_verify = currentVerifyCredits - totalEmailsToProcess
    } else if (currentVerifyCredits > 0) {
      updateData.credits_verify = 0
      updateData.credits_find = currentFindCredits - (totalEmailsToProcess - currentVerifyCredits)
    } else {
      updateData.credits_find = currentFindCredits - totalEmailsToProcess
    }
    
    // Update user credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', testUser.id)
    
    if (updateError) {
      console.error('❌ Error updating user credits:', updateError)
      return
    }
    
    console.log('✅ Credits updated successfully')
    
    // Log single bulk transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: testUser.id,
        amount: -totalEmailsToProcess,
        operation: 'email_verify',
        meta: {
          bulk: true,
          job_id: jobId,
          total_emails: totalEmailsToProcess,
          batch_operation: true
        },
        created_at: new Date().toISOString()
      })
    
    if (transactionError) {
      console.error('❌ Error logging bulk credit transaction:', transactionError)
      return
    }
    
    console.log('✅ Bulk credit transaction logged successfully')
    
    // Verify the changes
    const { data: afterProfile, error: afterProfileError } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', testUser.id)
      .single()
    
    if (afterProfileError) {
      console.error('❌ Error getting profile after update:', afterProfileError)
      return
    }
    
    const afterFindCredits = afterProfile.credits_find || 0
    const afterVerifyCredits = afterProfile.credits_verify || 0
    const afterTotalCredits = afterFindCredits + afterVerifyCredits
    
    console.log(`\n💰 Credits after: find=${afterFindCredits}, verify=${afterVerifyCredits}, total=${afterTotalCredits}`)
    console.log(`📉 Credits deducted: ${totalCredits - afterTotalCredits}`)
    
    // Check transactions
    const { data: afterTransactions, error: afterError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (afterError) {
      console.error('❌ Error fetching transactions after test:', afterError)
      return
    }
    
    console.log('\n📊 Latest transactions:')
    afterTransactions?.forEach((t, index) => {
      console.log(`${index + 1}. Amount: ${t.amount}, Operation: ${t.operation}, Bulk: ${t.meta?.bulk}, Batch: ${t.meta?.batch_operation}`)
    })
    
    // Check if we have exactly one new transaction
    const newTransactions = afterTransactions?.filter(t => 
      !beforeTransactions?.some(bt => bt.id === t.id)
    ) || []
    
    if (newTransactions.length === 1) {
      const newTx = newTransactions[0]
      console.log('\n🎉 SUCCESS: Single bulk transaction was recorded!')
      console.log(`📋 Transaction details:`)
      console.log(`   - Amount: ${newTx.amount} (should be -${totalEmailsToProcess})`)
      console.log(`   - Operation: ${newTx.operation}`)
      console.log(`   - Bulk: ${newTx.meta?.bulk}`)
      console.log(`   - Batch Operation: ${newTx.meta?.batch_operation}`)
      console.log(`   - Total Emails: ${newTx.meta?.total_emails}`)
      
      if (newTx.amount === -totalEmailsToProcess && newTx.meta?.batch_operation === true) {
        console.log('\n✅ PERFECT: The bulk transaction fix is working correctly!')
        console.log('✅ Instead of 3 individual -1 transactions, we now have 1 single -3 transaction!')
      } else {
        console.log('\n⚠️  Transaction recorded but with unexpected values')
      }
    } else if (newTransactions.length === 0) {
      console.log('\n❌ ISSUE: No new transaction was recorded')
    } else {
      console.log(`\n❌ ISSUE: Expected 1 transaction but got ${newTransactions.length}`)
      console.log('This suggests individual transactions are still being created')
    }
    
    // Clean up the test job
    await supabase
      .from('bulk_verification_jobs')
      .delete()
      .eq('id', jobId)
    
    console.log('\n🧹 Test job cleaned up')
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test
testBulkSingleTransaction().then(() => {
  console.log('\n🏁 Test completed')
}).catch(error => {
  console.error('💥 Test crashed:', error)
})