-- Fix credit_transactions table constraint issue
-- Drop the problematic constraint and ensure the table works properly

-- Drop the existing constraint if it exists
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_operation_check;

-- Add a proper constraint that allows the operations we need
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_operation_check 
  CHECK (operation IN ('email_find', 'email_verify', 'credit_purchase', 'credit_bonus', 'refund'));

-- Ensure the meta column exists (add if missing)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'credit_transactions' AND column_name = 'meta') THEN
        ALTER TABLE credit_transactions ADD COLUMN meta JSONB DEFAULT '{}';
    END IF;
END $$;

-- Drop existing function and recreate with proper signature
DROP FUNCTION IF EXISTS deduct_credits(TEXT, INTEGER);
DROP FUNCTION IF EXISTS deduct_credits(TEXT);

-- Update the deduct_credits function to work properly
CREATE FUNCTION deduct_credits(
  operation TEXT,
  amount INTEGER DEFAULT 1
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
  IF total_credits < amount THEN
    RETURN FALSE;
  END IF;

  -- Determine deduction amount and update credits
  IF operation = 'email_find' THEN
    deduction_amount := amount;
    
    -- Deduct from find credits first, then verify credits
    IF user_credits_find >= amount THEN
      UPDATE profiles 
      SET credits_find = credits_find - amount
      WHERE id = auth.uid();
    ELSE
      -- Use all find credits and remaining from verify credits
      UPDATE profiles 
      SET credits_find = 0,
          credits_verify = credits_verify - (amount - user_credits_find)
      WHERE id = auth.uid();
    END IF;
    
  ELSIF operation = 'email_verify' THEN
    deduction_amount := amount;
    
    -- Deduct from verify credits first, then find credits
    IF user_credits_verify >= amount THEN
      UPDATE profiles 
      SET credits_verify = credits_verify - amount
      WHERE id = auth.uid();
    ELSE
      -- Use all verify credits and remaining from find credits
      UPDATE profiles 
      SET credits_verify = 0,
          credits_find = credits_find - (amount - user_credits_verify)
      WHERE id = auth.uid();
    END IF;
    
  ELSE
    -- Unknown operation, deduct from total credits (find first)
    deduction_amount := amount;
    IF user_credits_find >= amount THEN
      UPDATE profiles 
      SET credits_find = credits_find - amount
      WHERE id = auth.uid();
    ELSE
      UPDATE profiles 
      SET credits_find = 0,
          credits_verify = credits_verify - (amount - user_credits_find)
      WHERE id = auth.uid();
    END IF;
  END IF;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, operation, meta)
  VALUES (auth.uid(), -deduction_amount, operation, '{"deducted_amount": ' || deduction_amount || '}');

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits(TEXT, INTEGER) TO authenticated;