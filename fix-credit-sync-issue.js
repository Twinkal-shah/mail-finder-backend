const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixCreditSyncIssue() {
  console.log('🔍 Analyzing credit sync issue...')
  
  try {
    // 1. Check for problematic transactions (bulk deductions with negative amounts > -1)
    console.log('\n1. Checking for problematic bulk transactions...')
    const { data: problemTransactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .lt('amount', -1)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (transError) {
      console.error('Error fetching transactions:', transError)
      return
    }
    
    console.log(`Found ${problemTransactions?.length || 0} transactions with amount < -1:`)
    problemTransactions?.forEach(t => {
      console.log(`  - ID: ${t.id}, Amount: ${t.amount}, Operation: ${t.operation}, Created: ${t.created_at}`)
      console.log(`    Meta:`, JSON.stringify(t.meta, null, 2))
    })
    
    // 2. Check current function signature in database
    console.log('\n2. Checking current deduct_credits function signature...')
    const { data: functions, error: funcError } = await supabase
      .rpc('execute_sql', {
        query: `
          SELECT 
            p.proname as function_name,
            pg_get_function_arguments(p.oid) as arguments,
            pg_get_function_result(p.oid) as return_type
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE p.proname = 'deduct_credits'
          AND n.nspname = 'public';
        `
      })
    
    if (funcError) {
      console.error('Error checking function signature:', funcError)
    } else {
      console.log('Current function signatures:')
      functions?.forEach(f => {
        console.log(`  - ${f.function_name}(${f.arguments}) -> ${f.return_type}`)
      })
    }
    
    // 3. Test current function behavior
    console.log('\n3. Testing current function behavior...')
    
    // Test with amount parameter (new signature)
    const testResult1 = await supabase.rpc('deduct_credits', {
      amount: 1,
      operation: 'email_find',
      meta: { test: 'signature_test_amount' }
    })
    console.log('Test with amount=1:', testResult1)
    
    // Test with required parameter (old signature)
    const testResult2 = await supabase.rpc('deduct_credits', {
      required: 1,
      operation: 'email_find', 
      meta: { test: 'signature_test_required' }
    })
    console.log('Test with required=1:', testResult2)
    
    // 4. Identify the issue
    console.log('\n4. Issue Analysis:')
    console.log('The problem is likely one of these scenarios:')
    console.log('a) Function expects "amount" but app calls with "required"')
    console.log('b) Bulk finder deducts multiple credits at once (e.g., 2 credits for 2 rows)')
    console.log('c) RPC fails and fallback logic in auth.ts runs with wrong amount')
    
    // 5. Check which bulk finder implementation is being used
    console.log('\n5. Checking recent bulk operations...')
    const { data: bulkTransactions, error: bulkError } = await supabase
      .from('credit_transactions')
      .select('*')
      .contains('meta', { bulk: true })
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (bulkError) {
      console.error('Error fetching bulk transactions:', bulkError)
    } else {
      console.log(`Found ${bulkTransactions?.length || 0} recent bulk transactions:`)
      bulkTransactions?.forEach(t => {
        console.log(`  - Amount: ${t.amount}, Meta:`, JSON.stringify(t.meta, null, 2))
      })
    }
    
    console.log('\n✅ Analysis complete!')
    console.log('\nRecommended fixes:')
    console.log('1. Update function signature to match app calls (required -> amount)')
    console.log('2. Fix bulk finder to deduct 1 credit per row, not all upfront')
    console.log('3. Ensure consistent parameter naming across codebase')
    
  } catch (error) {
    console.error('Error during analysis:', error)
  }
}

fixCreditSyncIssue()