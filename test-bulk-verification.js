const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBulkVerification() {
  console.log('🧪 Testing bulk email verification...');
  
  try {
    // Test submitting a bulk verification job
    const testEmails = [
      'test1@example.com',
      'test2@example.com',
      'test3@example.com'
    ];
    
    console.log('📧 Submitting bulk verification job with', testEmails.length, 'emails');
    
    // Call the bulk verification API endpoint
    const response = await fetch('http://localhost:3000/api/bulk-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emails: testEmails
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Bulk verification job submitted:', result);
      
      // Wait a moment for processing
      console.log('⏳ Waiting 5 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check credit transactions
      console.log('🔍 Checking recent credit transactions...');
      const { data: transactions, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('❌ Error fetching transactions:', error);
      } else {
        console.log('📊 Recent transactions:');
        console.table(transactions);
        
        const bulkTransactions = transactions.filter(t => 
          t.operation === 'email_verify' && 
          t.meta && 
          (t.meta.bulk === true || t.meta.type === 'bulk')
        );
        
        console.log('🔢 Found', bulkTransactions.length, 'bulk verification transactions');
        
        if (bulkTransactions.length > 0) {
          console.log('✅ Bulk verification is recording transactions correctly!');
        } else {
          console.log('⚠️  No bulk verification transactions found');
        }
      }
    } else {
      console.error('❌ Failed to submit bulk verification:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBulkVerification().then(() => {
  console.log('🏁 Test completed');
}).catch(error => {
  console.error('💥 Test crashed:', error);
});