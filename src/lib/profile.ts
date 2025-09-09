import { Database } from './supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

// Client-side function to get profile data
export async function getProfileDataClient(): Promise<Profile | null> {
  const { createClient } = await import('./supabase')
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  // Check if plan has expired and reset credits
  const planExpiry = profile.plan_expiry ? new Date(profile.plan_expiry) : null
  const now = new Date()
  const planExpired = planExpiry && planExpiry < now
  
  // Date comparison logic for plan expiry
  
  if (planExpired) {
    // Reset credits to 0 for expired plan
    await supabase
      .from('profiles')
      .update({
        credits_find: 0,
        credits_verify: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
    
    // Update the profile object to reflect the reset
    profile.credits_find = 0
    profile.credits_verify = 0
  }

  return profile
}

// Server-side function to get profile data
export async function getProfileData(userId: string): Promise<Profile | null> {
  console.log('getProfileData - Starting for user:', userId)
  
  try {
    const { createServerComponentClient } = await import('./supabase')
    const supabase = await createServerComponentClient()
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('getProfileData - Error fetching profile:', error)
      return null
    }
    
    // Check if plan has expired and reset credits
    const planExpiry = profile.plan_expiry ? new Date(profile.plan_expiry) : null
    const now = new Date()
    const planExpired = planExpiry && planExpiry < now
    
    // Date comparison logic for plan expiry
    
    if (planExpired) {
      console.log('getProfileData - Plan expired, resetting credits')
      // Reset credits to 0 for expired plan
      await supabase
        .from('profiles')
        .update({
          credits_find: 0,
          credits_verify: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      // Update the profile object to reflect the reset
      profile.credits_find = 0
      profile.credits_verify = 0
    }
    
    console.log('getProfileData - Profile found:', profile)
    return profile
  } catch (error) {
    console.error('getProfileData - Unexpected error:', error)
    return null
  }
}

// Client-side update profile function
export async function updateProfileClient(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
  try {
    const { createClient } = await import('./supabase')
    const supabase = createClient()
    
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

// Client-side function to update profile
export async function updateProfile(updates: Partial<Profile>) {
  const { createClient } = await import('./supabase')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

// Client-side function to get profile
export async function getProfile() {
  const { createClient } = await import('./supabase')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

// Client-side function to create profile
export async function createProfile(profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) {
  const { createClient } = await import('./supabase')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      ...profileData,
      id: user.id,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

// Client-side get user credits breakdown
export async function getUserCreditsClient(userId: string): Promise<{
  total: number
  find: number
  verify: number
} | null> {
  try {
    const { createClient } = await import('./supabase')
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('credits_find, credits_verify, plan_expiry')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error fetching user credits:', error)
      return null
    }
    
    // Check if plan has expired
    const planExpiry = data.plan_expiry ? new Date(data.plan_expiry) : null
    const now = new Date()
    const planExpired = planExpiry && planExpiry < now
    
    // Date comparison logic for plan expiry
    
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
      total: (data.credits_find || 0) + (data.credits_verify || 0),
      find: data.credits_find || 0,
      verify: data.credits_verify || 0
    }
  } catch (error) {
    console.error('Error in getUserCredits:', error)
    return null
  }
}

export type { Profile }