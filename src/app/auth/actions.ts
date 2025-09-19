'use server'

import { createServerActionClient } from '@/lib/supabase'

// Server action to initialize user credits
export async function initializeUserCreditsAction(userId: string): Promise<boolean> {
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