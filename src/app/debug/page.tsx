'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugPage() {
  const { user, loading: authLoading, error: authError, refreshAuth } = useAuth()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
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
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
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
        await refreshAuth()
        await loadProfile()
      }
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
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
        await refreshAuth()
        await loadProfile()
      }
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Debug Authentication</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Authentication Status</CardTitle>
        </CardHeader>
        <CardContent>
          {authLoading && <p>Loading authentication...</p>}
          {authError && <p className="text-red-500">Auth Error: {authError}</p>}
          {error && <p className="text-red-500">Profile Error: {error}</p>}
          {user ? (
            <div>
              <p className="text-green-500">✓ Authenticated</p>
              <p>User ID: {user.id}</p>
              <p>Email: {user.email}</p>
            </div>
          ) : (
            <p className="text-red-500">✗ Not authenticated</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p>Loading profile...</p>}
          {profile ? (
            <div className="space-y-2">
              {Object.entries(profile).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-medium">{key}:</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          ) : user ? (
            <p>No profile data found</p>
          ) : (
            <p>Please authenticate to view profile</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Button onClick={() => { refreshAuth(); loadProfile(); }} disabled={loading || authLoading}>
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