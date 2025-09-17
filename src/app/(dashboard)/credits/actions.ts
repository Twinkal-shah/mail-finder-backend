'use server'

import { getCurrentUser } from '@/lib/auth'
import { getUserCredits } from '@/lib/profile-server'
import { getCreditTransactions } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import { LemonSqueezyWebhookEvent } from '@/lib/services/lemonsqueezy'

interface CreditUsage {
  date: string
  credits_used: number
}

interface CreditTransaction {
  created_at: string
  amount: number
}

interface UserMetadata {
  full_name?: string
}

// Get user profile with credits breakdown
export async function getUserProfileWithCredits() {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }

  const creditsData = await getUserCredits(user.id)
  if (!creditsData) {
    return null
  }

  // Get additional profile data including plan from profiles table
  const { getProfileData } = await import('@/lib/profile')
  const profileData = await getProfileData(user.id)

  return {
    id: user.id,
    email: user.email || '',
    full_name: profileData?.full_name || (user as { user_metadata?: UserMetadata }).user_metadata?.full_name || null,
    plan: profileData?.plan || 'free',
    credits_find: creditsData.find,
    credits_verify: creditsData.verify,
    total_credits: creditsData.total
  }
}

export async function getCreditUsageHistory(): Promise<CreditUsage[]> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return []
    }

    const supabase = await createServerActionClient()
    
    // Get credit usage from the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // Query credit_transactions table for actual credit usage (negative amounts)
    try {
      const { data: creditTransactions, error } = await supabase
        .from('credit_transactions')
        .select('created_at, amount, operation')
        .eq('user_id', user.id)
        .lt('amount', 0) // Only get credit deductions (negative amounts)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (!error && creditTransactions) {
        // Group transactions by date and sum the usage (convert negative amounts to positive)
        const usageByDate: { [key: string]: number } = {}
        
        creditTransactions.forEach((transaction: CreditTransaction) => {
          const date = new Date(transaction.created_at).toISOString().split('T')[0]
          const creditsUsed = Math.abs(transaction.amount) // Convert negative to positive
          usageByDate[date] = (usageByDate[date] || 0) + creditsUsed
        })

        // Convert to array format and fill missing dates with 0
        const result: CreditUsage[] = []
        const currentDate = new Date(thirtyDaysAgo)
        const today = new Date()
        
        while (currentDate <= today) {
          const dateStr = currentDate.toISOString().split('T')[0]
          result.push({
            date: dateStr,
            credits_used: usageByDate[dateStr] || 0
          })
          currentDate.setDate(currentDate.getDate() + 1)
        }

        return result
      } else if (error) {
        console.error('Error querying credit_transactions:', error)
      }
    } catch (dbError) {
      console.error('Database error when querying credit_transactions:', dbError)
    }

    // Fallback: Return mock data if credit_transactions table doesn't exist yet
    // This will be used until the database setup in SETUP_CREDIT_TRACKING.md is completed
    const result: CreditUsage[] = []
    const currentDate = new Date(thirtyDaysAgo)
    const today = new Date()
    
    // Generate mock usage data for demonstration
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0]
      // Generate some realistic mock usage (0-50 credits per day)
      const mockUsage = Math.floor(Math.random() * 51)
      result.push({
        date: dateStr,
        credits_used: mockUsage
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return result
  } catch (error) {
    console.error('Error in getCreditUsageHistory:', error)
    return []
  }
}

export async function createLemonSqueezyCheckout(planData: {
  name: string
  price: number
  period: string
  findCredits: number
  verifyCredits: number
}) {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }
  
  // Validate plan data
  const validPlans = {
    'Pro': { price: 49, period: 'month', findCredits: 5000, verifyCredits: 5000 },
    'Agency': { price: 99, period: 'month', findCredits: 50000, verifyCredits: 50000 },
    'Lifetime': { price: 249, period: 'lifetime', findCredits: 150000, verifyCredits: 150000 }
  }
  
  const validPlan = validPlans[planData.name as keyof typeof validPlans]
  if (!validPlan || validPlan.price !== planData.price) {
    throw new Error('Invalid subscription plan')
  }
  
  try {
    const { createLemonSqueezyCheckout: createCheckout } = await import('@/lib/services/lemonsqueezy')
    
    // Map plan names to LemonSqueezy variant IDs (these would be configured in your LemonSqueezy dashboard)
    const variantIds = {
      'Pro': process.env.LEMONSQUEEZY_PRO_VARIANT_ID || 'pro-variant-id',
      'Agency': process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID || 'agency-variant-id',
      'Lifetime': process.env.LEMONSQUEEZY_LIFETIME_VARIANT_ID || 'lifetime-variant-id'
    }
    
    const variantId = variantIds[planData.name as keyof typeof variantIds]
    if (!variantId) {
      throw new Error('Invalid plan selected')
    }
    
    const checkoutData = {
      productId: process.env.LEMONSQUEEZY_PRODUCT_ID || 'product-id',
      variantId,
      customData: {
        plan_name: planData.name,
        find_credits: planData.findCredits,
        verify_credits: planData.verifyCredits,
      },
    }
    
    const result = await createCheckout(checkoutData, user.id)
    
    return { url: result.url }
  } catch (error) {
    console.error('LemonSqueezy checkout error:', error)
    throw new Error('Failed to create checkout session')
  }
}

export async function createCustomCreditCheckout(creditData: {
  credits: number
  price: number
}) {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }
  
  // Validate credit package data
  const validPackages = {
    100000: 35,
    50000: 20,
    25000: 12,
    10000: 9
  }
  
  const validPrice = validPackages[creditData.credits as keyof typeof validPackages]
  if (!validPrice || validPrice !== creditData.price) {
    throw new Error('Invalid credit package')
  }
  
  try {
    const { createLemonSqueezyCheckout: createCheckout } = await import('@/lib/services/lemonsqueezy')
    
    // Map credit amounts to LemonSqueezy variant IDs
    const creditVariantIds = {
      100000: process.env.LEMONSQUEEZY_CREDITS_100K_VARIANT_ID || 'credits-100k-variant-id',
      50000: process.env.LEMONSQUEEZY_CREDITS_50K_VARIANT_ID || 'credits-50k-variant-id',
      25000: process.env.LEMONSQUEEZY_CREDITS_25K_VARIANT_ID || 'credits-25k-variant-id',
      10000: process.env.LEMONSQUEEZY_CREDITS_10K_VARIANT_ID || 'credits-10k-variant-id'
    }
    
    const variantId = creditVariantIds[creditData.credits as keyof typeof creditVariantIds]
    if (!variantId) {
      throw new Error('Invalid credit package selected')
    }
    
    const result = await createCheckout(
      {
        productId: process.env.LEMONSQUEEZY_CREDITS_PRODUCT_ID || 'credits-product-id',
        variantId,
        customData: {
          credits: creditData.credits,
          package_type: 'credits',
        },
      },
      user.id
    )
    
    return { url: result.url }
  } catch (error) {
    console.error('Mock checkout error:', error)
    throw new Error('Failed to create checkout session')
  }
}

export async function createLemonSqueezyPortal() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }
  
  // Get user's customer ID from the database
  const supabase = await createServerActionClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('lemonsqueezy_customer_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.lemonsqueezy_customer_id) {
    // User hasn't made any purchases yet, return URL to pricing tab
    return { url: '/credits?tab=plans' }
  }
  
  try {
    const { createLemonSqueezyPortal: createLSPortal } = await import('@/lib/services/lemonsqueezy')
    
    // Get the actual LemonSqueezy customer portal URL
    const portalResponse = await createLSPortal(profile.lemonsqueezy_customer_id)
    return portalResponse
  } catch (error) {
    console.error('LemonSqueezy portal error:', error)
    throw new Error('Failed to create billing portal session')
  }
}

// Mock transaction history for demo
export async function getTransactionHistory(limit: number = 10) {
  try {
    // Use the existing getCreditTransactions function to fetch real data from Supabase
    const transactions = await getCreditTransactions(limit)
    return transactions
  } catch (error) {
    console.error('Get transactions error:', error)
    return []
  }
}

// LemonSqueezy webhook handler
export async function handleLemonSqueezyWebhook(event: LemonSqueezyWebhookEvent) {
  try {
    const { handleLemonSqueezyWebhook: handleWebhook } = await import('@/lib/services/lemonsqueezy')
    await handleWebhook(event)
  } catch (error) {
    console.error('LemonSqueezy webhook error:', error)
    throw error
  }
}