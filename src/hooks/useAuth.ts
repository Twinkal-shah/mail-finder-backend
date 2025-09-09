'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

// Global state to prevent multiple simultaneous auth checks
let authCheckInProgress = false
let lastAuthCheck = 0
const AUTH_CHECK_COOLDOWN = 2000 // 2 seconds

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  })

  const checkAuth = useCallback(async () => {
    // Prevent multiple simultaneous auth checks
    const now = Date.now()
    if (authCheckInProgress || (now - lastAuthCheck < AUTH_CHECK_COOLDOWN)) {
      return
    }

    authCheckInProgress = true
    lastAuthCheck = now

    try {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('Auth check error:', error.message)
        setAuthState({ user: null, loading: false, error: error.message })
      } else {
        setAuthState({ user, loading: false, error: null })
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setAuthState({ 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      })
    } finally {
      authCheckInProgress = false
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    
    // Initial auth check
    checkAuth()

    // Listen for auth changes with debouncing
    let timeoutId: NodeJS.Timeout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event)
        
        // Debounce auth state changes to prevent rapid updates
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          if (session?.user) {
            setAuthState({ user: session.user, loading: false, error: null })
          } else {
            setAuthState({ user: null, loading: false, error: null })
          }
        }, 500)
      }
    )

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [checkAuth])

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setAuthState({ user: null, loading: false, error: null })
    } catch (error) {
      console.error('Sign out error:', error)
      setAuthState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Sign out failed' 
      }))
    }
  }, [])

  return {
    ...authState,
    signOut,
    refreshAuth: checkAuth
  }
}

// Singleton pattern for auth state to prevent multiple instances
let globalAuthState: AuthState | null = null
let authStateListeners: ((state: AuthState) => void)[] = []

export function useGlobalAuth() {
  const [authState, setAuthState] = useState<AuthState>(
    globalAuthState || { user: null, loading: true, error: null }
  )

  useEffect(() => {
    // Subscribe to global auth state changes
    const listener = (state: AuthState) => {
      setAuthState(state)
    }
    authStateListeners.push(listener)

    // Initialize if not already done
    if (!globalAuthState) {
      const initAuth = async () => {
        try {
          const supabase = createClient()
          const { data: { user }, error } = await supabase.auth.getUser()
          
          const newState = {
            user: error ? null : user,
            loading: false,
            error: error?.message || null
          }
          
          globalAuthState = newState
          authStateListeners.forEach(l => l(newState))
        } catch (error) {
          const errorState = {
            user: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Authentication failed'
          }
          globalAuthState = errorState
          authStateListeners.forEach(l => l(errorState))
        }
      }
      initAuth()
    }

    return () => {
      authStateListeners = authStateListeners.filter(l => l !== listener)
    }
  }, [])

  return authState
}