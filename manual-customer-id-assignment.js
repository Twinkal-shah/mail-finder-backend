// Script to manually assign LemonSqueezy customer IDs to users
// This is useful for test users or users who need manual customer ID assignment

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Manual customer ID assignments for test users
// Add entries here in the format: 'user_email': 'lemonsqueezy_customer_id'
const MANUAL_ASSIGNMENTS = {
  // Example: 'test@example.com': 'cus_123456789'
  // Add actual customer IDs from LemonSqueezy dashboard here
}

async function assignManualCustomerIds() {
  try {
    console.log('Starting manual customer ID assignment...')
    
    for (const [email, customerId] of Object.entries(MANUAL_ASSIGNMENTS)) {
      console.log(`Processing ${email}...`)
      
      // Find the user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, plan, lemonsqueezy_customer_id')
        .eq('email', email)
        .single()
      
      if (profileError) {
        console.error(`Error finding user ${email}:`, profileError)
        continue
      }
      
      if (!profile) {
        console.log(`User ${email} not found`)
        continue
      }
      
      if (profile.lemonsqueezy_customer_id) {
        console.log(`User ${email} already has customer ID: ${profile.lemonsqueezy_customer_id}`)
        continue
      }
      
      // Update the profile with the customer ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          lemonsqueezy_customer_id: customerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)
      
      if (updateError) {
        console.error(`Error updating ${email}:`, updateError)
        continue
      }
      
      console.log(`✅ Assigned customer ID ${customerId} to ${email}`)
    }
    
    console.log('Manual customer ID assignment completed!')
    
  } catch (error) {
    console.error('Manual assignment script error:', error)
  }
}

// Function to check current status of users missing customer IDs
async function checkMissingCustomerIds() {
  try {
    console.log('Checking users missing customer IDs...')
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, plan, lemonsqueezy_customer_id')
      .in('plan', ['pro', 'agency', 'lifetime'])
      .is('lemonsqueezy_customer_id', null)
    
    if (error) {
      console.error('Error fetching profiles:', error)
      return
    }
    
    console.log(`\nFound ${profiles.length} users missing customer IDs:`)
    profiles.forEach(profile => {
      console.log(`- ${profile.email} (${profile.plan} plan)`)
    })
    
    if (profiles.length > 0) {
      console.log('\nTo fix these users:')
      console.log('1. Get their customer IDs from LemonSqueezy dashboard')
      console.log('2. Add them to MANUAL_ASSIGNMENTS in this script')
      console.log('3. Run: node manual-customer-id-assignment.js assign')
    }
    
  } catch (error) {
    console.error('Check script error:', error)
  }
}

// Run based on command line argument
const command = process.argv[2]

if (command === 'assign') {
  assignManualCustomerIds()
    .then(() => {
      console.log('Assignment script finished')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Assignment script failed:', error)
      process.exit(1)
    })
} else {
  checkMissingCustomerIds()
    .then(() => {
      console.log('Check script finished')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Check script failed:', error)
      process.exit(1)
    })
}