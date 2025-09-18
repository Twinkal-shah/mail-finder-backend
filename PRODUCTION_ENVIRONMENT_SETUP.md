# Production Environment Variables Setup

## Issue Description

The application works correctly on `localhost:3000` but fails on production (`app.mailsfinder.com`) with the error:
**"Failed to create checkout session"**

## Root Cause

The issue occurs because environment variables from `.env.local` are not available in production. The `.env.local` file is excluded from version control (listed in `.gitignore`) and therefore not deployed to production.

When users click subscription buttons, the LemonSqueezy API integration fails because these required environment variables are missing:
- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STORE_ID`
- And other LemonSqueezy-related variables

## Solution

You need to configure environment variables in your production hosting platform. Based on your setup, this appears to be **Vercel**.

### Step 1: Access Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Navigate to your project (`mails-dashboard` or similar)
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Environment Variables

Add the following environment variables from your `.env.local` file:

#### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://wbcfsffssphgvpnbrvve.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiY2ZzZmZzc3BoZ3ZwbmJydnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzM3NTQsImV4cCI6MjA3MDc0OTc1NH0.3GV4dQm0Aqm8kbNzPJYOCFLnvhyNqxCJCtwfmUAw29Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiY2ZzZmZzc3BoZ3ZwbmJydnZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE3Mzc1NCwiZXhwIjoyMDcwNzQ5NzU0fQ.dnXUMNFUw0amsJsLL8PHMjHRpda8w07KbwDIpo3O2vE
```

#### LemonSqueezy Configuration (CRITICAL - These are missing in production)
```
LEMONSQUEEZY_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiJiZTZhZjhhNDk2N2IwMTE2MzA2ZmQ1MDBmYmM3OTU1NzA1YTAyYzQxZTg2YTQ0NTRkZTU4Mjg1ZjllNDcyODNmMDVkNGYxZWNmYWE5ZDAxMyIsImlhdCI6MTc1NzA5MTMwNi4yNjE3NzMsIm5iZiI6MTc1NzA5MTMwNi4yNjE3NzYsImV4cCI6MjA3MjYyNDEwNi4yNDM2ODcsInN1YiI6IjI0MzQyMDkiLCJzY29wZXMiOltdfQ.bsTRHzJsz9zX2dzs7j0WTOb7WTC5R-4Y_OhfWf_F_-wcC4DKii8uII4UO8qaRW3W7dwgUcNboAWuAJ5FFoHhwUGoN518UWBK79FEmYTKehRLIVfXCZN_yGTFXDV9Shei08PP2NJHGeRPuhbDTh8aYNsr_3-yqIjledMU1WjYuusTIrIqbKD03PPTYwHmyw9urrK0cNgDEPVzEcDEihyghoB2ID4ZAFZdK7viXLr4TkJdSoN5jR5wDtCWm5BvvjhBFDkPltZDz25ojRRnat2IRCuBUC6WXQ_k_i9khBo1Cfl5roARXkZOKfMK-Q60yCs3t9vy-QZON3c46rIR_aB0ohGtVGMZzKLAe7y5nhhLllzIldNyOTjuazp-PLylhaBFmimqPmIpsfeiyguY9oupmgYMkrrUdAL1WuA0PT0mbJBoyE88e53QHEi1b_LjQvFII_MAQHMmlFLdNk8ukctYcI6YdXJthPwwUgDbfd0SpBjIxaLLwJVUamDY9gT8joED
LEMONSQUEEZY_STORE_ID=192616
LEMONSQUEEZY_WEBHOOK_SECRET=mailsfinder123
```

#### LemonSqueezy Product & Variant IDs
```
LEMONSQUEEZY_PRODUCT_ID=628486
LEMONSQUEEZY_PRO_VARIANT_ID=985018
LEMONSQUEEZY_AGENCY_VARIANT_ID=985038
LEMONSQUEEZY_LIFETIME_VARIANT_ID=985051
LEMONSQUEEZY_CREDITS_PRODUCT_ID=628486
LEMONSQUEEZY_CREDITS_100K_VARIANT_ID=985057
LEMONSQUEEZY_CREDITS_50K_VARIANT_ID=985120
LEMONSQUEEZY_CREDITS_25K_VARIANT_ID=985121
LEMONSQUEEZY_CREDITS_10K_VARIANT_ID=985126
```

#### Email API Configuration
```
EMAIL_FINDER_API_URL=http://173.249.7.231:8500/
EMAIL_FINDER_API_KEY=your_email_finder_api_key_here
EMAIL_VERIFIER_API_URL=http://173.249.7.231:8500/
EMAIL_VERIFIER_API_KEY=your_email_verifier_api_key_here
```

#### App Configuration
```
NEXT_PUBLIC_APP_URL=https://app.mailsfinder.com
NEXT_PUBLIC_MARKETING_URL=https://mailsfinder.com
```

### Step 3: Deploy Changes

After adding all environment variables:
1. **Redeploy** your application in Vercel
2. Or trigger a new deployment by pushing a commit to your GitHub repository

### Step 4: Verify the Fix

1. Wait for deployment to complete
2. Visit `https://app.mailsfinder.com/credits`
3. Click on any subscription plan button
4. You should now be redirected to LemonSqueezy payment page instead of seeing "Failed to create checkout session"

## Important Notes

### Security
- **Never commit API keys to your repository**
- Environment variables in Vercel are secure and encrypted
- The `.env.local` file should remain in `.gitignore`

### Environment Variable Types in Vercel
- Set all variables for **Production** environment
- Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- Other variables are server-side only

### Troubleshooting

If the issue persists after adding environment variables:

1. **Check Vercel Deployment Logs**:
   - Go to your Vercel project → Deployments
   - Click on the latest deployment
   - Check the build and runtime logs for errors

2. **Verify Environment Variables**:
   - In Vercel Settings → Environment Variables
   - Ensure all required variables are present
   - Check for typos in variable names

3. **Test API Endpoints**:
   - Check if `https://app.mailsfinder.com/api/health` responds
   - Monitor browser console for JavaScript errors

4. **LemonSqueezy Webhook**:
   - Ensure webhook URL is configured in LemonSqueezy dashboard
   - URL should be: `https://app.mailsfinder.com/api/webhooks/lemonsqueezy`

## Alternative Hosting Platforms

If you're using a different hosting platform:

- **Netlify**: Add variables in Site Settings → Environment Variables
- **Railway**: Add variables in Project Settings → Variables
- **DigitalOcean App Platform**: Add variables in App Settings → Environment
- **AWS Amplify**: Add variables in App Settings → Environment Variables

The process is similar across all platforms - you need to add the same environment variables from your `.env.local` file.