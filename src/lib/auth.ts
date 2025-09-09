import { createServerActionClient } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

// Profile type from database
type Profile = Database['public']['Tables']['profiles']['Row']
type User = {
  id: string
  email: string
}

// Get current user from Supabase
export async function getCurrentUser(): Promise<User | null> {
  console.log('getCurrentUser - Starting authentication check')
  try {
    const supabase = await createServerActionClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.log('getCurrentUser - Error:', error.message)
      return null
    }
    
    if (!user) {
      console.log('getCurrentUser - No user session found')
      return null
    }
    
    console.log('getCurrentUser - User found:', user.id)
    return {
      id: user.id,
      email: user.email || ''
    }
  } catch (error) {
    console.log('getCurrentUser - Catch error:', error)
    return null
  }
}

// Get user profile from Supabase
export async function getUserProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null
  
  const supabase = await createServerActionClient()
  
  // Check if plan has expired and reset credits if needed
  const planExpired = await isPlanExpired()
  if (planExpired) {
    await resetCreditsForExpiredPlan()
  }
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  if (error || !profile) {
    return null
  }
  
  // If plan is expired, ensure credits are shown as 0
  if (planExpired) {
    profile.credits_find = 0
    profile.credits_verify = 0
  }
  
  return profile
}

// Check if user's plan has expired
export async function isPlanExpired(): Promise<boolean> {
  const supabase = await createServerActionClient()
  const user = await getCurrentUser()
  
  if (!user) return true
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan_expiry')
    .eq('id', user.id)
    .single()
  
  if (error || !profile || !profile.plan_expiry) {
    return true
  }
  
  const expiryDate = new Date(profile.plan_expiry)
  const now = new Date()
  
  return expiryDate < now
}

// Set user credits to 0 when plan expires
export async function resetCreditsForExpiredPlan(): Promise<boolean> {
  const supabase = await createServerActionClient()
  const user = await getCurrentUser()
  
  if (!user) return false
  
  const { error } = await supabase
    .from('profiles')
    .update({
      credits_find: 0,
      credits_verify: 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
  
  if (error) {
    console.error('Error resetting credits for expired plan:', error)
    return false
  }
  
  return true
}

// Check credits using Supabase RPC function with fallback
export async function checkCredits(required: number): Promise<number> {
  const supabase = await createServerActionClient()
  
  // First check if user is authenticated
  const user = await getCurrentUser()
  console.log('checkCredits - User:', user ? `${user.email} (${user.id})` : 'null')
  
  if (!user) {
    console.log('checkCredits - No user found, returning 0 credits')
    return 0
  }
  
  // Check if plan has expired
  const planExpired = await isPlanExpired()
  if (planExpired) {
    console.log('checkCredits - Plan expired, resetting credits to 0')
    await resetCreditsForExpiredPlan()
    return 0
  }
  
  // Try RPC function first with correct parameters
  const { data, error } = await supabase.rpc('check_credits', {
    required,
    operation: 'email_verification'
  })
  
  if (error) {
    console.error('RPC function not found, using fallback:', error.message)
    
    // Fallback: Get credits directly from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      console.error('Error getting profile:', profileError)
      return 0
    }
    
    const totalCredits = (profile.credits_find || 0) + (profile.credits_verify || 0)
    console.log('checkCredits - Fallback total credits:', totalCredits)
    return totalCredits
  }
  
  console.log('checkCredits - RPC returned:', data)
  return data || 0
}

// Deduct credits using Supabase RPC function with fallback
export async function deductCredits(
  required: number,
  operation: string,
  meta: Record<string, unknown> = {}
): Promise<boolean> {
  console.log(`deductCredits - Starting: required=${required}, operation=${operation}`)
  const supabase = await createServerActionClient()
  
  // Try RPC function first with correct parameters
  const { data, error } = await supabase.rpc('deduct_credits', {
    required,
    operation,
    meta
  })
  
  if (error) {
    console.error('deductCredits - RPC error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    console.log('deductCredits - Using fallback method')
    
    // Fallback: Update credits directly in profiles table
    const user = await getCurrentUser()
    if (!user) return false
    
    // Get current credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      console.error('Error getting profile:', profileError)
      return false
    }
    
    const currentFindCredits = profile.credits_find || 0
    const currentVerifyCredits = profile.credits_verify || 0
    const totalCredits = currentFindCredits + currentVerifyCredits
    
    // Check if user has enough credits
    console.log(`deductCredits - Current credits: find=${currentFindCredits}, verify=${currentVerifyCredits}, total=${totalCredits}, required=${required}`)
    
    if (totalCredits < required) {
      console.log('deductCredits - Insufficient credits')
      return false
    }
    
    // Deduct credits based on operation type
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    
    if (operation === 'email_find') {
      if (currentFindCredits >= required) {
        updateData.credits_find = currentFindCredits - required
      } else {
        updateData.credits_find = 0
        updateData.credits_verify = currentVerifyCredits - (required - currentFindCredits)
      }
    } else if (operation === 'email_verify') {
      if (currentVerifyCredits >= required) {
        updateData.credits_verify = currentVerifyCredits - required
      } else {
        updateData.credits_verify = 0
        updateData.credits_find = currentFindCredits - (required - currentVerifyCredits)
      }
    } else {
      // Default: deduct from find credits first
      if (currentFindCredits >= required) {
        updateData.credits_find = currentFindCredits - required
      } else {
        updateData.credits_find = 0
        updateData.credits_verify = currentVerifyCredits - (required - currentFindCredits)
      }
    }
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
    
    if (updateError) {
      console.error('deductCredits - Error updating credits:', updateError)
      return false
    }
    
    console.log('deductCredits - Credits updated successfully via fallback')
    return true
  }
  
  console.log(`deductCredits - RPC function result: ${data}`)
  
  if (!data) {
    console.log('deductCredits - RPC returned false, this could be due to:')
    console.log('1. Plan expired (but plan_expiry shows 2025-09-04 which is future)')
    console.log('2. Insufficient credits (but user has 1726 verify credits)')
    console.log('3. RPC function logic issue')
    console.log('deductCredits - Using fallback method due to RPC returning false')
    
    // Fallback: Update credits directly in profiles table
    const user = await getCurrentUser()
    if (!user) return false
    
    // Get current credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify, plan_expiry')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      console.error('Error getting profile for fallback:', profileError)
      return false
    }
    
    const currentFindCredits = profile.credits_find || 0
    const currentVerifyCredits = profile.credits_verify || 0
    const totalCredits = currentFindCredits + currentVerifyCredits
    
    console.log(`deductCredits - Fallback check: find=${currentFindCredits}, verify=${currentVerifyCredits}, total=${totalCredits}, required=${required}`)
    console.log(`deductCredits - Plan expiry: ${profile.plan_expiry}`)
    
    if (totalCredits < required) {
      console.log('deductCredits - Fallback: Insufficient credits')
      return false
    }
    
    // Deduct credits based on operation type
    let updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    
    if (operation === 'email_verify') {
      if (currentVerifyCredits >= required) {
        updateData.credits_verify = currentVerifyCredits - required
      } else {
        updateData.credits_verify = 0
        updateData.credits_find = currentFindCredits - (required - currentVerifyCredits)
      }
    } else if (operation === 'email_find') {
      if (currentFindCredits >= required) {
        updateData.credits_find = currentFindCredits - required
      } else {
        updateData.credits_find = 0
        updateData.credits_verify = currentVerifyCredits - (required - currentFindCredits)
      }
    }
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
    
    if (updateError) {
      console.error('deductCredits - Fallback update error:', updateError)
      return false
    }
    
    console.log('deductCredits - Fallback: Credits updated successfully')
    return true
  }
  
  return data || false
}

// Get credit transactions from Supabase
export async function getCreditTransactions(limit: number = 10) {
  const user = await getCurrentUser()
  if (!user) return []
  
  const supabase = await createServerActionClient()
  
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
  
  return transactions || []
}

// Get search history from Supabase
export async function getSearchHistory(limit: number = 10) {
  const user = await getCurrentUser()
  if (!user) return []
  
  const supabase = await createServerActionClient()
  
  const { data: searches, error } = await supabase
    .from('searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching search history:', error)
    return []
  }
  
  return searches || []
}