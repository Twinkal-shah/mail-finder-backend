require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTransactions() {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }
    
    console.log('Recent transactions count:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('Recent transactions:');
      data.forEach((tx, i) => {
        console.log(`${i + 1}. Order: ${tx.lemonsqueezy_order_id}, User: ${tx.user_id}, Amount: $${tx.amount}, Status: ${tx.status}, Created: ${tx.created_at}`);
      });
    } else {
      console.log('No transactions found in the database.');
    }
  } catch (err) {
    console.error('Script error:', err);
  }
}

checkTransactions();