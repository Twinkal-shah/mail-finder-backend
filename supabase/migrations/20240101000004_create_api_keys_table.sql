-- Create API keys table for user API access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    key_name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 characters for display
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    rate_limit_per_minute INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_api_key_idx ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS api_keys_active_idx ON api_keys(is_active);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
CREATE POLICY "Users can view own API keys" ON api_keys
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own API keys" ON api_keys;
CREATE POLICY "Users can insert own API keys" ON api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
CREATE POLICY "Users can update own API keys" ON api_keys
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;
CREATE POLICY "Users can delete own API keys" ON api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all API keys
DROP POLICY IF EXISTS "Service role can manage API keys" ON api_keys;
CREATE POLICY "Service role can manage API keys" ON api_keys
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    key_length INTEGER := 32;
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := 'sk_';
    i INTEGER;
BEGIN
    FOR i IN 1..key_length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create API key for user
CREATE OR REPLACE FUNCTION create_user_api_key(
    p_user_id UUID,
    p_key_name TEXT
)
RETURNS TABLE(
    api_key TEXT,
    key_prefix TEXT,
    key_id UUID
) AS $$
DECLARE
    new_api_key TEXT;
    new_key_prefix TEXT;
    new_key_id UUID;
    user_plan TEXT;
BEGIN
    -- Check if user has agency or lifetime plan
    SELECT plan INTO user_plan
    FROM profiles
    WHERE id = p_user_id;
    
    IF user_plan NOT IN ('agency', 'lifetime') THEN
        RAISE EXCEPTION 'API access is only available for Agency and Lifetime plan users';
    END IF;
    
    -- Check if user already has 5 API keys (limit)
    IF (SELECT COUNT(*) FROM api_keys WHERE user_id = p_user_id AND is_active = true) >= 5 THEN
        RAISE EXCEPTION 'Maximum of 5 API keys allowed per user';
    END IF;
    
    -- Generate unique API key
    LOOP
        new_api_key := generate_api_key();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM api_keys WHERE api_keys.api_key = new_api_key);
    END LOOP;
    
    new_key_prefix := substr(new_api_key, 1, 8) || '...';
    
    -- Insert the new API key
    INSERT INTO api_keys (user_id, key_name, api_key, key_prefix)
    VALUES (p_user_id, p_key_name, new_api_key, new_key_prefix)
    RETURNING id INTO new_key_id;
    
    RETURN QUERY SELECT new_api_key, new_key_prefix, new_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key and check plan
CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS TABLE(
    user_id UUID,
    plan TEXT,
    is_valid BOOLEAN,
    credits_find INTEGER,
    credits_verify INTEGER
) AS $$
DECLARE
    key_user_id UUID;
    user_plan TEXT;
    plan_expired BOOLEAN;
    user_credits_find INTEGER;
    user_credits_verify INTEGER;
BEGIN
    -- Get user info from API key
    SELECT ak.user_id INTO key_user_id
    FROM api_keys ak
    WHERE ak.api_key = p_api_key AND ak.is_active = true;
    
    IF key_user_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 0, 0;
        RETURN;
    END IF;
    
    -- Get user profile and check plan
    SELECT p.plan, p.credits_find, p.credits_verify,
           CASE 
               WHEN p.plan_expiry IS NULL THEN false  -- lifetime plan
               WHEN p.plan_expiry < NOW() THEN true
               ELSE false
           END
    INTO user_plan, user_credits_find, user_credits_verify, plan_expired
    FROM profiles p
    WHERE p.id = key_user_id;
    
    -- Check if plan allows API access and is not expired
    IF user_plan NOT IN ('agency', 'lifetime') OR plan_expired THEN
        RETURN QUERY SELECT key_user_id, user_plan, false, 0, 0;
        RETURN;
    END IF;
    
    -- Update last used timestamp and usage count
    UPDATE api_keys 
    SET last_used_at = NOW(), 
        usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE api_key = p_api_key;
    
    RETURN QUERY SELECT key_user_id, user_plan, true, user_credits_find, user_credits_verify;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate API key
CREATE OR REPLACE FUNCTION deactivate_api_key(p_key_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE api_keys 
    SET is_active = false, updated_at = NOW()
    WHERE id = p_key_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;