# Checkout Issue Solution

## Problem
When pushing changes to GitHub and opening `app.mailsfinder.com/credits`, clicking on any subscription plan button shows the error: **"Failed to create checkout session."** However, on `localhost:3000/credits`, the same functionality works correctly.

## Root Cause
The issue occurs because **environment variables are missing in production**. Your `.env.local` file contains all the necessary LemonSqueezy API credentials, but this file is ignored by Git (as specified in `.gitignore`) and therefore not deployed to production.

## Required Environment Variables
The following LemonSqueezy environment variables are required for checkout functionality:

- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_WEBHOOK_SECRET`
- `LEMONSQUEEZY_PRODUCT_ID`
- `LEMONSQUEEZY_PRO_VARIANT_ID`
- `LEMONSQUEEZY_AGENCY_VARIANT_ID`
- `LEMONSQUEEZY_LIFETIME_VARIANT_ID`
- `LEMONSQUEEZY_CREDITS_PRODUCT_ID`
- `LEMONSQUEEZY_CREDITS_100K_VARIANT_ID`
- `LEMONSQUEEZY_CREDITS_50K_VARIANT_ID`
- `LEMONSQUEEZY_CREDITS_25K_VARIANT_ID`
- `LEMONSQUEEZY_CREDITS_10K_VARIANT_ID`

## Solution Steps

### Step 1: Debug Production Environment
1. Deploy your current changes (including the new debug tools)
2. Visit `app.mailsfinder.com/env-debug` to see which variables are missing
3. The page will show a detailed report of all environment variables

### Step 2: Add Environment Variables to Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`mails-dashboard`)
3. Go to **Settings** → **Environment Variables**
4. Add each missing variable from your `.env.local` file:
   - Variable Name: `LEMONSQUEEZY_API_KEY`
   - Value: `[copy from .env.local]`
   - Environment: **Production** (and optionally Preview)
   - Click **Save**
5. Repeat for all missing LemonSqueezy variables

### Step 3: Redeploy
1. After adding all environment variables, trigger a new deployment:
   - Either push a new commit to GitHub
   - Or go to Vercel Dashboard → Deployments → Redeploy

### Step 4: Verify the Fix
1. Visit `app.mailsfinder.com/env-debug` again
2. Confirm all variables show as "Present"
3. Test the checkout functionality on `app.mailsfinder.com/credits`
4. Remove the debug page after confirming everything works

### Step 5: Clean Up (After Fix)
1. Delete the temporary debug files:
   ```bash
   rm src/app/env-debug/page.tsx
   rm src/components/env-checker.tsx
   rm src/app/api/health/route.ts
   rm CHECKOUT_ISSUE_SOLUTION.md
   rm PRODUCTION_ENVIRONMENT_SETUP.md
   ```

## Health Check Endpoint
A health check endpoint has been created at `/api/health` that:
- Verifies all critical environment variables are present
- Returns detailed status information
- Can be used for monitoring production health

## Why This Happens
- **Local Development**: Uses `.env.local` file (contains all secrets)
- **Production**: Only has environment variables explicitly configured in hosting platform
- **Git**: Ignores `.env*` files for security (prevents committing secrets)
- **Solution**: Manually configure environment variables in hosting platform

This is the standard and secure way to handle environment variables in production deployments.