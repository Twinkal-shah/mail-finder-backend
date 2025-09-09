require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  try {
    // Check if test user exists (using a valid UUID)
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking user:', error);
      return;
    }

    if (user) {
      console.log('User found:', user);
    } else {
      console.log('User not found. Creating test user...');
      
      // Create test user
      const { data: newUser, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: testUserId,
          email: 'test@example.com',
          credits_find: 25,
        credits_verify: 25,
        plan: 'free'
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
      } else {
        console.log('Test user created:', newUser);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUser();