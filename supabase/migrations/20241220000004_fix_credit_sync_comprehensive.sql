-- Comprehensive fix for credit sync issues
-- This migration addresses:
-- 1. Parameter name mismatch (required vs amount)
-- 2. Bulk deduction causing -2 transactions
-- 3. Ensures consistent credit tracking

-- Drop existing function to recreate with correct signature
DROP FUNCTION IF EXISTS public.deduct_credits(INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.deduct_credits(TEXT, INTEGER);

-- Create the function with 'required' parameter to match application calls
CREATE OR REPLACE FUNCTION public.deduct_credits(
  required INTEGER,
  operation TEXT,
  meta JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_credits_find INTEGER;
  user_credits_verify INTEGER;
  user_plan_expiry TIMESTAMP WITH TIME ZONE;
  total_credits INTEGER;
  deduction_amount INTEGER;
BEGIN
  -- Get current user's credits and plan expiry
  SELECT p.credits_find, p.credits_verify, p.plan_expiry
  INTO user_credits_find, user_credits_verify, user_plan_expiry
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Check if plan has expired
  IF user_plan_expiry IS NOT NULL AND user_plan_expiry < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Calculate total available credits
  total_credits := COALESCE(user_credits_find, 0) + COALESCE(user_credits_verify, 0);

  -- Check if user has enough credits
  IF total_credits < required THEN
    RETURN FALSE;
  END IF;

  -- Set deduction amount (always equals required for proper tracking)
  deduction_amount := required;

  -- Determine deduction strategy based on operation
  IF operation = 'email_find' THEN
    -- Deduct from find credits first, then verify credits
    IF user_credits_find >= required THEN
      UPDATE profiles 
      SET credits_find = credits_find - required
      WHERE id = auth.uid();
    ELSE
      -- Use all find credits and remaining from verify credits
      UPDATE profiles 
      SET credits_find = 0,
          credits_verify = credits_verify - (required - user_credits_find)
      WHERE id = auth.uid();
    END IF;
    
  ELSIF operation = 'email_verify' THEN
    -- Deduct from verify credits first, then find credits
    IF user_credits_verify >= required THEN
      UPDATE profiles 
      SET credits_verify = credits_verify - required
      WHERE id = auth.uid();
    ELSE
      -- Use all verify credits and remaining from find credits
      UPDATE profiles 
      SET credits_verify = 0,
          credits_find = credits_find - (required - user_credits_verify)
      WHERE id = auth.uid();
    END IF;
    
  ELSE
    -- Unknown operation, deduct from find credits first
    IF user_credits_find >= required THEN
      UPDATE profiles 
      SET credits_find = credits_find - required
      WHERE id = auth.uid();
    ELSE
      UPDATE profiles 
      SET credits_find = 0,
          credits_verify = credits_verify - (required - user_credits_find)
      WHERE id = auth.uid();
    END IF;
  END IF;

  -- Log the transaction with negative amount for deduction
  INSERT INTO credit_transactions (user_id, amount, operation, meta, created_at)
  VALUES (auth.uid(), -deduction_amount, operation, meta, NOW());

  RETURN TRUE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.deduct_credits(INTEGER, TEXT, JSONB) TO authenticated;

-- Create a helper function to check if bulk operations should deduct per-row
CREATE OR REPLACE FUNCTION public.deduct_credits_bulk_safe(
  required INTEGER,
  operation TEXT,
  meta JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For bulk operations, ensure we only deduct 1 credit at a time
  -- This prevents the -2 transaction issue
  IF (meta->>'bulk')::boolean = true THEN
    -- Force deduction to be 1 credit for bulk operations
    RETURN public.deduct_credits(1, operation, meta);
  ELSE
    -- Normal deduction for non-bulk operations
    RETURN public.deduct_credits(required, operation, meta);
  END IF;
END;
$$;

-- Grant permissions for bulk safe function
GRANT EXECUTE ON FUNCTION public.deduct_credits_bulk_safe(INTEGER, TEXT, JSONB) TO authenticated;

-- Add a comment explaining the fix
COMMENT ON FUNCTION public.deduct_credits(INTEGER, TEXT, JSONB) IS 
'Fixed credit deduction function that matches application parameter names (required) and ensures proper transaction logging';

COMMENT ON FUNCTION public.deduct_credits_bulk_safe(INTEGER, TEXT, JSONB) IS 
'Bulk-safe credit deduction that prevents multiple credit deductions in a single transaction';

-- Create an index on credit_transactions for better performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_operation 
ON credit_transactions(user_id, operation, created_at DESC);

-- Add constraint to prevent excessive negative amounts (safety measure)
-- Drop existing constraint if it exists, then recreate
ALTER TABLE credit_transactions 
DROP CONSTRAINT IF EXISTS check_reasonable_deduction;

ALTER TABLE credit_transactions 
ADD CONSTRAINT check_reasonable_deduction 
CHECK (amount >= -10 OR amount > 0);