-- Add a function to deduct credits for a specific user (for background processing)
-- This is needed because the regular deduct_credits function uses auth.uid() which is null in background context

CREATE OR REPLACE FUNCTION public.deduct_credits_for_user(
  target_user_id UUID,
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
  -- Validate input
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get user's current credits and plan expiry
  SELECT p.credits_find, p.credits_verify, p.plan_expiry
  INTO user_credits_find, user_credits_verify, user_plan_expiry
  FROM profiles p
  WHERE p.id = target_user_id;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

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

  -- Set deduction amount
  deduction_amount := required;

  -- Deduct credits based on operation type
  IF operation = 'email_find' THEN
    -- Deduct from find credits first, then verify credits
    IF user_credits_find >= required THEN
      UPDATE profiles 
      SET credits_find = credits_find - required,
          updated_at = NOW()
      WHERE id = target_user_id;
    ELSE
      -- Use all find credits and remaining from verify credits
      UPDATE profiles 
      SET credits_find = 0,
          credits_verify = credits_verify - (required - user_credits_find),
          updated_at = NOW()
      WHERE id = target_user_id;
    END IF;
    
  ELSIF operation = 'email_verify' THEN
    -- Deduct from verify credits first, then find credits
    IF user_credits_verify >= required THEN
      UPDATE profiles 
      SET credits_verify = credits_verify - required,
          updated_at = NOW()
      WHERE id = target_user_id;
    ELSE
      -- Use all verify credits and remaining from find credits
      UPDATE profiles 
      SET credits_verify = 0,
          credits_find = credits_find - (required - user_credits_verify),
          updated_at = NOW()
      WHERE id = target_user_id;
    END IF;
    
  ELSE
    -- Unknown operation, deduct from find credits first
    IF user_credits_find >= required THEN
      UPDATE profiles 
      SET credits_find = credits_find - required,
          updated_at = NOW()
      WHERE id = target_user_id;
    ELSE
      UPDATE profiles 
      SET credits_find = 0,
          credits_verify = credits_verify - (required - user_credits_find),
          updated_at = NOW()
      WHERE id = target_user_id;
    END IF;
  END IF;

  -- Log the transaction with negative amount for deduction
  INSERT INTO credit_transactions (user_id, amount, operation, meta, created_at)
  VALUES (target_user_id, -deduction_amount, operation, meta, NOW());

  RETURN TRUE;
END;
$$;

-- Grant execute permission to service role (for background processing)
GRANT EXECUTE ON FUNCTION public.deduct_credits_for_user(UUID, INTEGER, TEXT, JSONB) TO service_role;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.deduct_credits_for_user(UUID, INTEGER, TEXT, JSONB) IS 
'Deduct credits for a specific user ID - used for background processing where auth.uid() is not available';