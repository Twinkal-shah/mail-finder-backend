-- Create the profiles table 
CREATE TABLE IF NOT EXISTS profiles ( 
    id UUID REFERENCES auth.users(id) PRIMARY KEY, 
    email TEXT UNIQUE NOT NULL, 
    full_name TEXT, 
    company TEXT, 
    plan TEXT DEFAULT 'free', 
    plan_expiry TIMESTAMPTZ, 
    credits INTEGER DEFAULT 25, 
    credits_find INTEGER DEFAULT 25, 
    credits_verify INTEGER DEFAULT 25, 
    created_at TIMESTAMPTZ DEFAULT NOW(), 
    updated_at TIMESTAMPTZ DEFAULT NOW() 
); 

-- Create indexes for better performance 
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email); 
CREATE INDEX IF NOT EXISTS profiles_plan_idx ON profiles(plan); 

-- Drop existing policies if they exist 
DROP POLICY IF EXISTS "Users can view own profile" ON profiles; 
DROP POLICY IF EXISTS "Users can update own profile" ON profiles; 
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles; 
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles; 
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles; 
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles; 

-- Create proper RLS policies 
CREATE POLICY "Users can insert own profile" ON profiles 
    FOR INSERT WITH CHECK (auth.uid() = id); 

CREATE POLICY "Users can view own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id); 

CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id); 

-- Create policy for service role to manage all profiles (for admin operations and webhooks) 
-- Note: This policy is only effective when using the service_role key; anon/auth keys will not satisfy this 
CREATE POLICY "Service role can manage profiles" ON profiles 
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role'); 

-- Enable RLS on the profiles table 
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; 

-- Create function to handle new user signup with automatic profile creation 
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$ 
BEGIN 
    INSERT INTO public.profiles ( 
        id, email, full_name, company, plan, plan_expiry, 
        credits, credits_find, credits_verify, created_at, updated_at 
    ) 
    VALUES ( 
        NEW.id, 
        NEW.email, 
        COALESCE( 
            NEW.raw_user_meta_data->>'full_name', 
            CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name') 
        ), 
        NEW.raw_user_meta_data->>'company', 
        'free', 
        NOW() + INTERVAL '3 days',  -- Automatically set plan_expiry to 3 days from now 
        25, 
        25, 
        25, 
        NOW(), 
        NOW() 
    ) 
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email, 
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name), 
        company = COALESCE(EXCLUDED.company, profiles.company), 
        plan_expiry = COALESCE(profiles.plan_expiry, NOW() + INTERVAL '3 days'), 
        updated_at = NOW(); 
    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER; 

-- Create trigger to automatically create profiles when users sign up 
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; 
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users 
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 

-- Fix existing profiles with NULL plan_expiry 
UPDATE profiles 
SET plan_expiry = created_at + INTERVAL '3 days' 
WHERE plan_expiry IS NULL AND plan = 'free';