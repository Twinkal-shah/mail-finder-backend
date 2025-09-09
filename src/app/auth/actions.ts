'use server'

import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase'

// Server action to initialize user credits
export async function initializeUserCreditsAction(userId: string): Promise<boolean> {
  try {
    const supabase = createServerActionClient<Database>({ cookies })
    
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