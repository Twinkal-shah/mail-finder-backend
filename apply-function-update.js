require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { URL } = require('url');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Parse the Supabase URL to get database connection details
const url = new URL(supabaseUrl);
const host = url.hostname.replace('https://', '').replace('http://', '');
const database = 'postgres';

const pool = new Pool({
  host: `db.${host.split('.')[0]}.supabase.co`,
  port: 5432,
  database: database,
  user: 'postgres',
  password: serviceKey.split('.')[2] // This won't work, we need the actual DB password
});

const functionSQL = `
CREATE OR REPLACE FUNCTION deduct_credits(
    required INTEGER,
    operation VARCHAR(50),
    meta JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID;
    current_credits INTEGER;
    total_credits INTEGER;
BEGIN
    -- Get the authenticated user ID
    user_id := auth.uid();
    
    -- Check if user is authenticated
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get current credits
    SELECT credits INTO current_credits
    FROM profiles
    WHERE id = user_id;
    
    -- Calculate total credits needed
    total_credits := required;
    
    -- Check operation type and adjust credits needed
    IF operation = 'email_find' THEN
        total_credits := required;
    ELSIF operation = 'email_verify' THEN
        total_credits := required;
    ELSE
        total_credits := required;
    END IF;
    
    -- Check if user has enough credits
    IF current_credits < total_credits THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits
    UPDATE profiles
    SET credits = credits - total_credits
    WHERE id = user_id;
    
    -- Insert transaction record
    INSERT INTO credit_transactions (user_id, amount, operation, meta, created_at)
    VALUES (user_id, -required, operation, meta, NOW());
    
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_credits(INTEGER, VARCHAR(50), JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_credits(INTEGER, VARCHAR(50), JSONB) TO anon;
`;

async function applyFunction() {
  try {
    console.log('This script requires direct database access which we don\'t have.');
    console.log('Please apply the function manually in the Supabase SQL editor:');
    console.log('\n' + functionSQL);
    console.log('\nOr run: supabase db reset to apply all migrations including the updated function.');
  } catch (error) {
    console.error('Error:', error);
  }
}

applyFunction();