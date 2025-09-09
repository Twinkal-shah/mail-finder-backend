-- Create credit_transactions table for tracking credit usage/deductions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Negative for deductions, positive for additions
  operation VARCHAR(50) NOT NULL, -- 'email_find', 'email_verify', etc.
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_operation ON credit_transactions(operation);

-- Enable RLS
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own credit transactions
CREATE POLICY "Users can view own credit transactions" ON credit_transactions
    FOR SELECT USING (user_id = auth.uid());

-- Create policy for service role to insert credit transactions
CREATE POLICY "Service role can manage credit transactions" ON credit_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON credit_transactions TO authenticated;
GRANT ALL ON credit_transactions TO service_role;