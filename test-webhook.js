require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const fetch = require('node-fetch');

const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const webhookUrl = 'https://wbcfsffssphgvpnbrvve.supabase.co/functions/v1/lemon-squeezy-webhook';

if (!webhookSecret) {
  console.error('LEMONSQUEEZY_WEBHOOK_SECRET not found in environment');
  console.error('Please add LEMONSQUEEZY_WEBHOOK_SECRET to your .env.local file');
  process.exit(1);
}

// Create a test webhook payload
const testPayload = {
  meta: {
    event_name: 'order_created',
    custom_data: {
      user_id: '92bda605-1499-4168-8341-9ced3750f10c',
      find_credits: '1000',
      verify_credits: '500',
      plan_name: 'pro'
    }
  },
  data: {
    id: 'test-order-123',
    attributes: {
      total: 2900, // $29.00 in cents
      product_name: 'Pro Plan'
    }
  }
};

const payloadString = JSON.stringify(testPayload);

// Generate signature (with sha256= prefix as expected by Lemon Squeezy)
const signature = 'sha256=' + crypto
  .createHmac('sha256', webhookSecret)
  .update(payloadString)
  .digest('hex');

console.log('Testing webhook with:');
console.log('URL:', webhookUrl);
console.log('Payload:', payloadString);
console.log('Signature:', signature);

async function testWebhook() {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      },
      body: payloadString
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed');
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
  }
}

testWebhook();