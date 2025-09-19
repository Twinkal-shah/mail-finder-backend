-- Create transactions table for tracking LemonSqueezy purchases
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lemonsqueezy_order_id VARCHAR(255),
  lemonsqueezy_subscription_id VARCHAR(255),
  product_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('subscription', 'credit_pack', 'lifetime')),
  amount DECIMAL(10,2) NOT NULL,
  credits_find_added INTEGER DEFAULT 0,
  credits_verify_added INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  webhook_event VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_lemonsqueezy_order_id ON transactions(lemonsqueezy_order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_lemonsqueezy_subscription_id ON transactions(lemonsqueezy_subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (user_id = auth.uid());

-- Create policy for service role to insert/update transactions (for webhooks)
DROP POLICY IF EXISTS "Service role can manage transactions" ON transactions;
CREATE POLICY "Service role can manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON transactions TO authenticated;
GRANT ALL ON transactions TO service_role;