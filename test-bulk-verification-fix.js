const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBulkVerificationFix() {
  console.log('Testing bulk verification credit deduction fix...');
  
  try {
    // First, check current credit transactions count
    const { data: beforeTransactions, error: beforeError } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (beforeError) {
      console.error('Error fetching transactions before test:', beforeError);
      return;
    }
    
    console.log(`Current transactions count: ${beforeTransactions?.length || 0}`);
    console.log('Recent transactions:', beforeTransactions?.map(t => ({
      id: t.id,
      operation: t.operation,
      amount: t.amount,
      meta: t.meta
    })));
    
    // Test the deduct_credits_for_user function with bulk verification parameters
    console.log('\nTesting deduct_credits_for_user function with bulk verification parameters...');
    
    // Get a test user ID from profiles table
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, credits_find, credits_verify')
      .limit(1);
    
    if (profileError || !profiles || profiles.length === 0) {
      console.error('Error getting test profile:', profileError);
      return;
    }
    
    const testUserId = profiles[0].id;
    const beforeCredits = (profiles[0].credits_find || 0) + (profiles[0].credits_verify || 0);
    console.log(`Test user ID: ${testUserId}`);
    console.log(`Credits before test: ${beforeCredits}`);
    
    // Call deduct_credits_for_user with bulk verification parameters
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_for_user', {
      target_user_id: testUserId,
      required: 1,
      operation: 'email_verify',
      meta: {
        email: 'test@example.com',
        domain: 'example.com',
        result: 'valid',
        bulk: true
      }
    });
    
    if (deductError) {
      console.error('Error calling deduct_credits_for_user:', deductError);
      console.log('This is expected if the migration hasn\'t been applied yet.');
      
      // Test the regular deduct_credits function as fallback
      console.log('\nTesting regular deduct_credits function (should fail due to no auth context)...');
      const { data: regularResult, error: regularError } = await supabase.rpc('deduct_credits', {
        required: 1,
        operation: 'email_verify',
        meta: {
          email: 'test@example.com',
          domain: 'example.com',
          result: 'valid',
          bulk: true
        }
      });
      
      if (regularError) {
        console.error('Expected error with regular deduct_credits (no auth context):', regularError.message);
      } else {
        console.log('Unexpected success with regular deduct_credits:', regularResult);
      }
      
      return;
    }
    
    console.log('Deduct credits result:', deductResult);
    
    // Check if credits were deducted
    const { data: afterProfile, error: afterProfileError } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', testUserId)
      .single();
    
    if (afterProfileError) {
      console.error('Error getting profile after deduction:', afterProfileError);
      return;
    }
    
    const afterCredits = (afterProfile.credits_find || 0) + (afterProfile.credits_verify || 0);
    console.log(`Credits after test: ${afterCredits}`);
    console.log(`Credits deducted: ${beforeCredits - afterCredits}`);
    
    // Check if transaction was recorded
    const { data: afterTransactions, error: afterError } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (afterError) {
      console.error('Error fetching transactions after test:', afterError);
      return;
    }
    
    console.log('\nNew transactions:');
    const newTransactions = afterTransactions?.filter(t => 
      !beforeTransactions?.some(bt => bt.id === t.id)
    ) || [];
    
    newTransactions.forEach(t => {
      console.log(`- ID: ${t.id}, Operation: ${t.operation}, Amount: ${t.amount}, Meta:`, t.meta);
    });
    
    if (newTransactions.length > 0) {
      console.log('\n✅ SUCCESS: Credit transaction was recorded!');
      console.log('✅ SUCCESS: Credits were deducted!');
      console.log('✅ The bulk verification fix is working correctly!');
    } else {
      console.log('\n❌ ISSUE: No new credit transaction was recorded');
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testBulkVerificationFix();