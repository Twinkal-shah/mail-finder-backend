-- Manual script to add onboarding_completed column to profiles table
-- Run this in your Supabase SQL editor or when local database is available

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to have onboarding_completed as false
UPDATE profiles 
SET onboarding_completed = FALSE 
WHERE onboarding_completed IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'onboarding_completed';