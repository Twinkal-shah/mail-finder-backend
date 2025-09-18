-- Add onboarding_completed column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to have onboarding_completed as false
UPDATE profiles 
SET onboarding_completed = FALSE 
WHERE onboarding_completed IS NULL;