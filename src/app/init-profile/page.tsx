'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function InitProfilePage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const initializeProfile = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        setMessage('Error: Not authenticated. Please log in first.')
        return
      }

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (existingProfile) {
        setMessage('Profile already exists! Redirecting to credits page...')
        setTimeout(() => router.push('/credits'), 2000)
        return
      }

      // Create the profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || 'User',
          company: user.user_metadata?.company || null,
          plan: 'free',
          plan_expiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
          credits: 25,
          credits_find: 25,
          credits_verify: 25,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error creating profile:', insertError)
        setMessage(`Error creating profile: ${insertError.message}`)
        return
      }

      setMessage('Profile created successfully! Redirecting to credits page...')
      setTimeout(() => router.push('/credits'), 2000)
      
    } catch (error) {
      console.error('Error:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Initialize Profile
          </h2>
          <p className="text-gray-600 mb-6">
            It looks like your profile needs to be set up. Click the button below to initialize your account with 25 free credits.
          </p>
          
          <button
            onClick={initializeProfile}
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Profile...' : 'Initialize Profile'}
          </button>
          
          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm ${
              message.includes('Error') 
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}