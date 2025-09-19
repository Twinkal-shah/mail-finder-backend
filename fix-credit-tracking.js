const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const fixSQL = `
-- Update the deduct_credits function to log transactions
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
    plan_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the current user ID from auth.users
    user_id := auth.uid();
    
    -- If no user is authenticated, return false
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get user's current credits and plan expiry
    SELECT 
        COALESCE(credits_find, 0),
        COALESCE(credits_verify, 0),
        plan_expiry
    INTO current_find_credits, current_verify_credits, plan_expiry
    FROM profiles
    WHERE id = user_id;
    
    -- Check if plan has expired
    IF plan_expiry IS NOT NULL AND plan_expiry < NOW() THEN
        -- Reset credits to 0 for expired plan
        UPDATE profiles 
        SET 
            credits_find = 0,
            credits_verify = 0,
            updated_at = NOW()
        WHERE id = user_id;
        
        RETURN FALSE;
    END IF;
    
    -- Calculate total available credits
    total_credits := current_find_credits + current_verify_credits;
    
    -- Check if user has enough credits
    IF total_credits < required THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits based on operation type
    IF operation = 'email_find' THEN
        IF current_find_credits >= required THEN
            UPDATE profiles 
            SET credits_find = credits_find - required,
                updated_at = NOW()
            WHERE id = user_id;
        ELSE
            -- Deduct remaining from find credits and rest from verify credits
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
            -- Deduct remaining from verify credits and rest from find credits
            UPDATE profiles 
            SET credits_verify = 0,
                credits_find = credits_find - (required - current_verify_credits),
                updated_at = NOW()
            WHERE id = user_id;
        END IF;
    ELSE
        -- For unknown operations, deduct from find credits first
        IF current_find_credits >= required THEN
            UPDATE profiles 
            SET credits_find = credits_find - required,
                updated_at = NOW()
            WHERE id = user_id;
        ELSE
            UPDATE profiles 
            SET credits_find = 0,
                credits_verify = credits_verify - (required - current_find_credits),
                updated_at = NOW()
            WHERE id = user_id;
        END IF;
    END IF;
    
    -- Log the transaction in credit_transactions table
    INSERT INTO credit_transactions (
        user_id,
        amount,
        operation,
        meta,
        created_at
    ) VALUES (
        user_id,
        -required, -- Negative amount for deduction
        operation,
        meta,
        NOW()
    );
    
    RETURN TRUE;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits(INTEGER, TEXT, JSONB) TO authenticated;
`

async function applyFix() {
  console.log('Applying credit tracking fix...')
  
  try {
    const { data, error } = await supabase.rpc('exec', {
      sql: fixSQL
    })
    
    if (error) {
      console.error('Error applying fix:', error)
      
      // Try alternative approach using raw SQL
      console.log('Trying alternative approach...')
      const { data: altData, error: altError } = await supabase
        .from('_sql')
        .select('*')
        .eq('query', fixSQL)
      
      if (altError) {
        console.error('Alternative approach failed:', altError)
        console.log('\nPlease manually apply the SQL from APPLY_CREDIT_TRACKING_FIX.sql in your Supabase SQL Editor.')
        process.exit(1)
      }
    }
    
    console.log('✅ Credit tracking fix applied successfully!')
    console.log('\nThe deduct_credits function now includes transaction logging.')
    console.log('Credit usage charts should now update properly.')
    
  } catch (err) {
    console.error('Unexpected error:', err)
    console.log('\nPlease manually apply the SQL from APPLY_CREDIT_TRACKING_FIX.sql in your Supabase SQL Editor.')
    process.exit(1)
  }
}

applyFix()