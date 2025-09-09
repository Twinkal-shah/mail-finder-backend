const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUserCredits() {
  try {
    const userId = '92bda605-1499-4168-8341-9ced3750f10c'
    
    console.log('Checking credits for user:', userId)
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error fetching profile:', error)
      return
    }
    
    if (profile) {
      console.log('User profile:')
      console.log('- Email:', profile.email)
      console.log('- Plan:', profile.plan)
      console.log('- Credits (general):', profile.credits)
      console.log('- Credits Find:', profile.credits_find)
      console.log('- Credits Verify:', profile.credits_verify)
      console.log('- Plan Expiry:', profile.plan_expiry)
      console.log('- Updated At:', profile.updated_at)
    } else {
      console.log('No profile found for user')
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkUserCredits().then(() => {
  process.exit(0)
})