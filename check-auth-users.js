const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkAuthUsers() {
  try {
    console.log('Checking auth.users table...')
    
    // Query auth.users table using service role
    const { data: users, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.error('Error fetching users:', error)
      return
    }
    
    console.log(`Found ${users.users.length} users in auth.users table:`)
    users.users.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Created: ${user.created_at}`)
    })
    
    if (users.users.length > 0) {
      console.log('\nUsing first user ID for testing:', users.users[0].id)
      return users.users[0].id
    } else {
      console.log('\nNo users found in auth.users table')
      return null
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkAuthUsers().then(userId => {
  if (userId) {
    console.log('\nYou can use this user ID in your webhook tests:', userId)
  }
  process.exit(0)
})