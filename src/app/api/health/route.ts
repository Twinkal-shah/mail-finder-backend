import { NextResponse } from 'next/server'

// Health check endpoint to verify environment variables
export async function GET() {
  try {
    // Check critical environment variables
    const envCheck = {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      
      // LemonSqueezy (Critical for checkout)
      LEMONSQUEEZY_API_KEY: !!process.env.LEMONSQUEEZY_API_KEY,
      LEMONSQUEEZY_STORE_ID: !!process.env.LEMONSQUEEZY_STORE_ID,
      LEMONSQUEEZY_WEBHOOK_SECRET: !!process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
      
      // LemonSqueezy Product IDs
      LEMONSQUEEZY_PRODUCT_ID: !!process.env.LEMONSQUEEZY_PRODUCT_ID,
      LEMONSQUEEZY_PRO_VARIANT_ID: !!process.env.LEMONSQUEEZY_PRO_VARIANT_ID,
      LEMONSQUEEZY_AGENCY_VARIANT_ID: !!process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID,
      LEMONSQUEEZY_LIFETIME_VARIANT_ID: !!process.env.LEMONSQUEEZY_LIFETIME_VARIANT_ID,
      
      // LemonSqueezy Credit Package IDs
      LEMONSQUEEZY_CREDITS_PRODUCT_ID: !!process.env.LEMONSQUEEZY_CREDITS_PRODUCT_ID,
      LEMONSQUEEZY_CREDITS_100K_VARIANT_ID: !!process.env.LEMONSQUEEZY_CREDITS_100K_VARIANT_ID,
      LEMONSQUEEZY_CREDITS_50K_VARIANT_ID: !!process.env.LEMONSQUEEZY_CREDITS_50K_VARIANT_ID,
      LEMONSQUEEZY_CREDITS_25K_VARIANT_ID: !!process.env.LEMONSQUEEZY_CREDITS_25K_VARIANT_ID,
      LEMONSQUEEZY_CREDITS_10K_VARIANT_ID: !!process.env.LEMONSQUEEZY_CREDITS_10K_VARIANT_ID,
      
      // App URLs
      NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_MARKETING_URL: !!process.env.NEXT_PUBLIC_MARKETING_URL,
      
      // Email APIs (Optional)
      EMAIL_FINDER_API_URL: !!process.env.EMAIL_FINDER_API_URL,
      EMAIL_FINDER_API_KEY: !!process.env.EMAIL_FINDER_API_KEY,
      EMAIL_VERIFIER_API_URL: !!process.env.EMAIL_VERIFIER_API_URL,
      EMAIL_VERIFIER_API_KEY: !!process.env.EMAIL_VERIFIER_API_KEY,
    }
    
    // Check if critical variables for checkout are present
    const criticalVars = [
      'LEMONSQUEEZY_API_KEY',
      'LEMONSQUEEZY_STORE_ID',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]
    
    const missingCritical = criticalVars.filter(varName => !process.env[varName])
    const checkoutReady = missingCritical.length === 0
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      checkoutReady,
      missingCriticalVars: missingCritical,
      environmentVariables: envCheck,
      message: checkoutReady 
        ? 'All critical environment variables are configured. Checkout should work.' 
        : `Missing critical environment variables: ${missingCritical.join(', ')}. Checkout will fail.`
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        checkoutReady: false
      },
      { status: 500 }
    )
  }
}