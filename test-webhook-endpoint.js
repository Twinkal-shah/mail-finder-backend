const https = require('https');
const crypto = require('crypto');

// Test webhook endpoint accessibility
const testWebhookEndpoint = () => {
  const webhookUrl = 'https://wbcfsffssphgvpnbrvve.supabase.co/functions/v1/lemon-squeezy-webhook';
  
  // Create test payload
  const testPayload = {
    meta: {
      event_name: 'order_created',
      custom_data: {
        user_id: '92bda605-1499-4168-8341-9ced3750f10c',
        plan_name: 'pro',
        find_credits: '100000',
        verify_credits: '0'
      }
    },
    data: {
      id: 'test-order-' + Date.now(),
      attributes: {
        user_email: 'twinkalshah719@gmail.com',
        status: 'paid',
        total: 2900,
        product_name: 'Pro Plan'
      }
    }
  };
  
  const payloadString = JSON.stringify(testPayload);
  
  // Create signature (using the webhook secret)
  const secret = 'mailsfinder123'; // From your .env.local
  const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature
    }
  };
  
  console.log('Testing webhook endpoint:', webhookUrl);
  console.log('Payload:', payloadString);
  console.log('Signature:', signature);
  
  const req = https.request(webhookUrl, options, (res) => {
    console.log('Response status:', res.statusCode);
    console.log('Response headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response body:', data);
    });
  });
  
  req.on('error', (error) => {
    console.error('Request error:', error);
  });
  
  req.write(payloadString);
  req.end();
};

// Test the endpoint
testWebhookEndpoint();