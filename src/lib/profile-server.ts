import { createServerActionClient } from './supabase'
import { Database } from './supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

// Initialize user credits for new users (server-side only)
export async function initializeUserCredits(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerActionClient()
    
    const { error } = await supabase
      .from('profiles')
      .update({
        credits_find: 10,
        credits_verify: 5,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
    
    if (error) {
      console.error('Error initializing user credits:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error in initializeUserCredits:', error)
    return false
  }
}

// Update profile function for server-side operations
export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
  try {
    const supabase = await createServerActionClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating profile:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error in updateProfile:', error)
    return null
  }
}

// Get user credits breakdown (server-side)
export async function getUserCredits(userId: string): Promise<{
  total: number
  find: number
  verify: number
} | null> {
  try {
    const supabase = await createServerActionClient()
    
    // First check if plan has expired
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify, plan_expiry')
      .eq('id', userId)
      .single()
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return null
    }
    
    // Check if plan has expired
    const planExpiry = profile.plan_expiry ? new Date(profile.plan_expiry) : null
    const now = new Date()
    const planExpired = planExpiry && planExpiry < now
    
    if (planExpired) {
      // Reset credits to 0 for expired plan
      await supabase
        .from('profiles')
        .update({
          credits_find: 0,
          credits_verify: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      return {
        total: 0,
        find: 0,
        verify: 0
      }
    }
    
    return {
      total: (profile.credits_find || 0) + (profile.credits_verify || 0),
      find: profile.credits_find || 0,
      verify: profile.credits_verify || 0
    }
  } catch (error) {
    console.error('Error in getUserCredits:', error)
    return null
  }
}