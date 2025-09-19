-- RPC Functions for Credits Management
-- These functions need to be executed in your Supabase SQL editor

-- Function to check available credits for a user
CREATE OR REPLACE FUNCTION check_credits(required INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID;
    available_credits INTEGER;
    plan_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the current user ID from auth.users
    user_id := auth.uid();
    
    -- If no user is authenticated, return 0
    IF user_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Get user's available credits and plan expiry from profiles table
    SELECT 
        COALESCE(credits_find, 0) + COALESCE(credits_verify, 0),
        plan_expiry
    INTO available_credits, plan_expiry
    FROM profiles
    WHERE id = user_id;
    
    -- If no profile found, return 0
    IF available_credits IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Check if plan has expired
    IF plan_expiry IS NOT NULL AND plan_expiry < NOW() THEN
        -- Reset credits to 0 for expired plan
        UPDATE profiles 
        SET 
            credits_find = 0,
            credits_verify = 0,
            updated_at = NOW()
        WHERE id = user_id;
        
        RETURN 0;
    END IF;
    
    RETURN available_credits;
END;
$$;

-- Function to deduct credits from user account
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
                credits_verify = credits_verify - (required - current_find_credits),
                updated_at = NOW()
            WHERE id = user_id;
        END IF;
    END IF;
    
    -- Insert transaction record
    INSERT INTO credit_transactions (user_id, amount, operation, meta, created_at)
    VALUES (user_id, -required, operation, meta, NOW());
    
    RETURN TRUE;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_credits(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_credits(INTEGER, TEXT, JSONB) TO authenticated;

-- Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for profiles table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view and update own profile'
    ) THEN
        CREATE POLICY "Users can view and update own profile" ON profiles
            FOR ALL USING (auth.uid() = id);
    END IF;
END
$$;