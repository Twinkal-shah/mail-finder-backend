# Fix Automatic Credit Reset for Expired Plans

## Issue
The automatic credit reset functionality is not working because the Supabase RPC functions need to be updated to check for plan expiry.

## Solution
You need to run the SQL commands in your Supabase database to update the RPC functions.

## Steps to Fix

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Run the SQL Update**
   - Copy the entire content from `UPDATE_SUPABASE_RPC.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the SQL

4. **Verify the Fix**
   - After running the SQL, refresh your application
   - The credits should now automatically show 0 for expired plans
   - Both `credits_find` and `credits_verify` will be reset to 0 in the database

## What This Fix Does

- Updates the `check_credits()` RPC function to automatically reset credits to 0 when plan expires
- Updates the `deduct_credits()` RPC function to prevent credit deduction for expired plans
- Ensures consistency between your app and Supabase database
- Maintains all existing functionality while adding automatic credit reset

## Test the Fix

After running the SQL:
1. Check your current user profile (plan_expiry: '2025-08-31T11:25:42+00:00' is already expired)
2. Try to find or verify an email
3. You should see "Your plan has expired. Please upgrade to Pro." message
4. Credits should show 0 in both the app and database

**Note**: The fix will take effect immediately after running the SQL in Supabase.