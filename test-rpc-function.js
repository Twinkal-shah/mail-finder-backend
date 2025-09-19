require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPCFunction() {
  try {
    console.log('Testing deduct_credits RPC function...');
    
    // First, authenticate a user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123'
    });
    
    if (authError) {
      console.log('Auth error:', authError.message);
      console.log('Testing with manual transaction insertion...');
      
      // Test manual transaction insertion with correct column name
      const { data: insertData, error: insertError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
          amount: -5,
          operation: 'email_find',
          meta: { test: true }
        });
      
      if (insertError) {
        console.log('Manual insert error:', insertError);
      } else {
        console.log('Manual insert successful:', insertData);
      }
      return;
    }
    
    const userId = authData.user.id;
    console.log('Authenticated user ID:', userId);
    
    // Check user credits before
    const { data: userBefore, error: userBeforeError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    
    if (userBeforeError) {
      console.log('Error fetching user before:', userBeforeError);
      return;
    }
    
    console.log('User credits before:', userBefore.credits);
    
    // Call the RPC function
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
    
    // Check user credits after
    const { data: userAfter, error: userAfterError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    
    if (userAfterError) {
      console.log('Error fetching user after:', userAfterError);
    } else {
      console.log('User credits after:', userAfter.credits);
    }
    
    // Check recent transactions
    const { data: transactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (transError) {
      console.log('Error fetching transactions:', transError);
    } else {
      console.log('Recent transactions:', transactions);
    }
    
    // Sign out
    await supabase.auth.signOut();
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testRPCFunction();