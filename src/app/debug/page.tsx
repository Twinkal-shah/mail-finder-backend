'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        setError(`User error: ${userError.message}`)
        return
      }
      
      setUser(user)
      
      if (user) {
        // Get profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profileError) {
          setError(`Profile error: ${profileError.message}`)
        } else {
          setProfile(profile)
        }
      }
    } catch (err) {
      setError(`Unexpected error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const createTestUser = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'testpassword123',
        options: {
          data: {
            full_name: 'Test User',
            company: 'Test Company',
          },
        },
      })
      
      if (error) {
        setError(`Sign up error: ${error.message}`)
      } else {
        console.log('Test user created:', data)
        await checkUser()
      }
    } catch (err) {
      setError(`Unexpected error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const signInTestUser = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      })
      
      if (error) {
        setError(`Sign in error: ${error.message}`)
      } else {
        console.log('Test user signed in:', data)
        await checkUser()
      }
    } catch (err) {
      setError(`Unexpected error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Debug Authentication</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Current User Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">Error: {error}</p>}
          
          <div>
            <h3 className="font-semibold">User:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
              {user ? JSON.stringify(user, null, 2) : 'No user'}
            </pre>
          </div>
          
          <div>
            <h3 className="font-semibold">Profile:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
              {profile ? JSON.stringify(profile, null, 2) : 'No profile'}
            </pre>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={checkUser} disabled={loading}>
              Refresh
            </Button>
            <Button onClick={createTestUser} disabled={loading}>
              Create Test User
            </Button>
            <Button onClick={signInTestUser} disabled={loading}>
              Sign In Test User
            </Button>
            {user && (
              <Button onClick={signOut} variant="outline" disabled={loading}>
                Sign Out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}