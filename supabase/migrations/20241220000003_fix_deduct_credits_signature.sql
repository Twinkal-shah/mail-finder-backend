-- Fix deduct_credits function signature to match application usage
-- The app calls: supabase.rpc('deduct_credits', { required, operation, meta })
-- But the function expects: deduct_credits(operation TEXT, amount INTEGER)

-- Drop the existing function
DROP FUNCTION IF EXISTS deduct_credits(TEXT, INTEGER);

-- Create the function with the correct signature that matches the app's usage
CREATE FUNCTION deduct_credits(
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
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get user's current credits and plan expiry
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

  -- Set deduction amount to the required amount
  deduction_amount := required;

  -- Determine how to deduct credits based on operation
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
    -- Unknown operation, deduct from total credits (find first)
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

  -- Log the transaction with the correct amount (negative for deduction)
  -- This should match exactly what was deducted from profiles
  INSERT INTO credit_transactions (user_id, amount, operation, meta)
  VALUES (auth.uid(), -deduction_amount, operation, meta);

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits(INTEGER, TEXT, JSONB) TO authenticated;