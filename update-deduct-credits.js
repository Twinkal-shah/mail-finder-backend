require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Extract connection details from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Parse the Supabase URL to get database connection details
const url = new URL(supabaseUrl);
const projectRef = url.hostname.split('.')[0];

const pool = new Pool({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: serviceKey,
  ssl: { rejectUnauthorized: false }
});

const updateFunction = `
CREATE OR REPLACE FUNCTION deduct_credits(
    required INTEGER,
    operation TEXT,
    meta JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID;
    current_find_credits INTEGER;
    current_verify_credits INTEGER;
    total_credits INTEGER;
BEGIN
    -- Get the current user ID from auth.users
    user_id := auth.uid();
    
    -- If no user is authenticated, return false
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get user's current credits
    SELECT 
        COALESCE(credits_find, 0),
        COALESCE(credits_verify, 0)
    INTO current_find_credits, current_verify_credits
    FROM profiles
    WHERE id = user_id;
    
    -- Calculate total available credits
    total_credits := current_find_credits + current_verify_credits;
    
    -- Check if user has enough credits
    IF total_credits < required THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits based on operation type
    IF operation = 'email_find' THEN
        -- Deduct from find credits first, then verify credits if needed
        IF current_find_credits >= required THEN
            UPDATE profiles 
            SET credits_find = credits_find - required,
                updated_at = NOW()
            WHERE id = user_id;
        ELSE
            -- Use all find credits and remaining from verify credits
            UPDATE profiles 
            SET credits_find = 0,
                credits_verify = credits_verify - (required - current_find_credits),
                updated_at = NOW()
            WHERE id = user_id;
        END IF;
    ELSIF operation = 'email_verify' THEN
        -- Deduct from verify credits first, then find credits if needed
        IF current_verify_credits >= required THEN
            UPDATE profiles 
            SET credits_verify = credits_verify - required,
                updated_at = NOW()
            WHERE id = user_id;
        ELSE
            -- Use all verify credits and remaining from find credits
            UPDATE profiles 
            SET credits_verify = 0,
                credits_find = credits_find - (required - current_verify_credits),
                updated_at = NOW()
            WHERE id = user_id;
        END IF;
    ELSE
        -- Default: deduct from find credits first
        IF current_find_credits >= required THEN
            UPDATE profiles 
            SET credits_find = credits_find - required,
                updated_at = NOW()
            WHERE id = user_id;
        ELSE
            UPDATE profiles 
            SET credits_find = 0,
                credits_verify = credits_verify - (required - current_verify_credits),
                updated_at = NOW()
            WHERE id = user_id;
        END IF;
    END IF;
    
    -- Insert transaction record
    INSERT INTO credit_transactions (user_id, credits_used, operation, meta, created_at)
    VALUES (user_id, required, operation, meta, NOW());
    
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_credits(INTEGER, TEXT, JSONB) TO authenticated;
`;

async function updateDeductCreditsFunction() {
  const client = await pool.connect();
  
  try {
    console.log('Updating deduct_credits function...');
    
    const result = await client.query(updateFunction);
    
    console.log('Function updated successfully!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('Error updating function:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateDeductCreditsFunction();