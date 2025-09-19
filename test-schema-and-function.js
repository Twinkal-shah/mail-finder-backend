require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testSchemaAndFunction() {
  try {
    console.log('Testing schema and function...');
    
    // First, check the table structure
    console.log('\n1. Checking credit_transactions table structure:');
    const { data: tableData, error: tableError } = await supabase
      .from('credit_transactions')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('Table error:', tableError);
    } else {
      console.log('Table accessible, sample data:', tableData);
    }
    
    // Try to insert a test transaction
    console.log('\n2. Testing transaction insertion:');
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const { data: insertData, error: insertError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: testUserId,
        amount: -5,
        operation: 'email_find',
        meta: { test: true, timestamp: new Date().toISOString() }
      })
      .select();
    
    if (insertError) {
      console.log('Insert error:', insertError);
    } else {
      console.log('Insert successful:', insertData);
      
      // Clean up the test record
      await supabase
        .from('credit_transactions')
        .delete()
        .eq('user_id', testUserId);
      console.log('Test record cleaned up');
    }
    
    // Test the RPC function with service role
    console.log('\n3. Testing deduct_credits RPC function:');
    
    // First, create a test user profile if it doesn't exist
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: testUserId,
        email: 'test@example.com',
        credits: 100
      })
      .select();
    
    if (profileError) {
      console.log('Profile creation error:', profileError);
    } else {
      console.log('Test profile created/updated:', profileData);
    }
    
    // Now test the RPC function
    const { data: rpcResult, error: rpcError } = await supabase.rpc('deduct_credits', {
      required: 5,
      operation: 'email_find',
      meta: { test: true, timestamp: new Date().toISOString() }
    });
    
    if (rpcError) {
      console.log('RPC Error:', rpcError);
    } else {
      console.log('RPC Result:', rpcResult);
    }
    
    // Check if transaction was logged
    console.log('\n4. Checking for logged transactions:');
    const { data: transactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (transError) {
      console.log('Transaction fetch error:', transError);
    } else {
      console.log('Recent transactions:', transactions);
    }
    
    // Clean up test data
    await supabase.from('credit_transactions').delete().eq('user_id', testUserId);
    await supabase.from('profiles').delete().eq('id', testUserId);
    console.log('\nTest data cleaned up');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSchemaAndFunction();