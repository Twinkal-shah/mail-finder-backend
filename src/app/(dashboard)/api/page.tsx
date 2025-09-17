'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Eye, EyeOff, Key, Plus, Trash2, AlertCircle, Code, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
// Removed getCurrentUser import - using client-side auth instead

interface ApiKey {
  id: string
  name: string
  key_preview: string
  created_at: string
  last_used_at?: string
  is_active: boolean
}

interface UserProfile {
  plan: string
  credits_find: number
  credits_verify: number
}

export default function ApiPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKey, setShowNewKey] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState('')
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Get current user from client-side Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        toast.error('Please log in to access API features')
        return
      }

      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan, credits_find, credits_verify')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile error:', profileError)
        toast.error('Failed to load user profile')
        return
      }

      setUserProfile(profile)

      // Check if user has access to API (agency or lifetime plans only)
      if (profile.plan !== 'agency' && profile.plan !== 'lifetime') {
        return // Don't load API keys for non-eligible users
      }

      // Load API keys
      const { data: keys, error: keysError } = await supabase
        .from('api_keys')
        .select('id, key_name, key_prefix, created_at, last_used_at, is_active')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (keysError) {
        console.error('API keys error:', keysError)
        toast.error('Failed to load API keys')
        return
      }

      // Map database columns to interface
      const mappedKeys = (keys || []).map(key => ({
        id: key.id,
        name: key.key_name,
        key_preview: key.key_prefix,
        created_at: key.created_at,
        last_used_at: key.last_used_at,
        is_active: key.is_active
      }))
      setApiKeys(mappedKeys)
    } catch (error) {
      console.error('Load data error:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for your API key')
      return
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Please log in to create API keys')
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await supabase.rpc('create_api_key', {
        p_user_id: user.id,
        p_name: newKeyName.trim()
      })

      if (error) {
        console.error('Create API key error:', error)
        toast.error(error.message || 'Failed to create API key')
        return
      }

      if (data) {
        setNewKeyValue(data)
        setShowNewKey(true)
        setNewKeyName('')
        await loadData() // Reload the list
        toast.success('API key created successfully!')
      }
    } catch (error) {
      console.error('Create API key error:', error)
      toast.error('Failed to create API key')
    } finally {
      setIsCreating(false)
    }
  }

  const deactivateApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase.rpc('deactivate_api_key', {
        p_key_id: keyId
      })

      if (error) {
        console.error('Deactivate API key error:', error)
        toast.error('Failed to deactivate API key')
        return
      }

      await loadData() // Reload the list
      toast.success('API key deactivated successfully')
    } catch (error) {
      console.error('Deactivate API key error:', error)
      toast.error('Failed to deactivate API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys)
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId)
    } else {
      newVisible.add(keyId)
    }
    setVisibleKeys(newVisible)
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  // Check if user has access to API features
  const hasApiAccess = userProfile?.plan === 'agency' || userProfile?.plan === 'lifetime'

  if (!hasApiAccess) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Access</h1>
          <p className="text-gray-600 mt-2">
            Programmatic access to email finding and verification services.
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            API access is only available for Agency and Lifetime plan users. 
            Your current plan: <Badge variant="outline">{userProfile?.plan || 'Unknown'}</Badge>
            <br />
            Please upgrade to an Agency or Lifetime plan to access API features.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">API Access</h1>
        <p className="text-gray-600 mt-2">
          Programmatic access to email finding and verification services.
        </p>
      </div>

      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-6">
          {/* Credits Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Credits Overview</CardTitle>
              <CardDescription>
                Your current credit balance for API usage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{userProfile?.credits_find || 0}</div>
                  <div className="text-sm text-blue-600">Find Credits</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{userProfile?.credits_verify || 0}</div>
                  <div className="text-sm text-green-600">Verify Credits</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create New API Key */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New API Key
              </CardTitle>
              <CardDescription>
                Generate a new API key for accessing our services. You can have up to 5 active keys.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="key-name">API Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g., Production App, Development"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={createApiKey}
                    disabled={isCreating || !newKeyName.trim() || apiKeys.length >= 5}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    {isCreating ? 'Creating...' : 'Create Key'}
                  </Button>
                </div>
              </div>
              
              {apiKeys.length >= 5 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You have reached the maximum limit of 5 API keys. Please deactivate an existing key to create a new one.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Show New Key */}
          {showNewKey && newKeyValue && (
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Your new API key has been created!</p>
                  <p className="text-sm text-gray-600">
                    Please copy and store this key securely. You won't be able to see it again.
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-gray-100 rounded font-mono text-sm">
                    <code className="flex-1">{newKeyValue}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(newKeyValue)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewKey(false)}
                  >
                    I've saved my key
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* API Keys List */}
          <Card>
            <CardHeader>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                Manage your existing API keys.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys created yet.</p>
                  <p className="text-sm">Create your first API key to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{key.name}</h3>
                          <Badge variant={key.is_active ? 'default' : 'secondary'}>
                            {key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm text-gray-600 font-mono">
                            {visibleKeys.has(key.id) ? key.key_preview : '••••••••••••••••'}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleKeyVisibility(key.id)}
                          >
                            {visibleKeys.has(key.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(key.key_preview)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(key.created_at).toLocaleDateString()}
                          {key.last_used_at && (
                            <> • Last used: {new Date(key.last_used_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {key.is_active && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deactivateApiKey(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          {/* API Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                API Documentation
              </CardTitle>
              <CardDescription>
                Learn how to integrate our email services into your applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Base URL */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Base URL</h3>
                <div className="p-3 bg-gray-100 rounded font-mono text-sm">
                  https://yourdomain.com/api/v1
                </div>
              </div>

              {/* Authentication */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Authentication</h3>
                <p className="text-gray-600 mb-3">
                  Include your API key in the Authorization header:
                </p>
                <div className="p-3 bg-gray-100 rounded font-mono text-sm">
                  Authorization: Bearer YOUR_API_KEY
                </div>
              </div>

              {/* Rate Limits */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Rate Limits</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• 100 requests per minute</li>
                  <li>• 1000 requests per hour</li>
                  <li>• Each request consumes 1 credit of the respective type</li>
                </ul>
              </div>

              {/* Find Email Endpoint */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Find Email</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-100 rounded">
                    <div className="font-mono text-sm">
                      <span className="text-blue-600 font-semibold">POST</span> /find
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Request Body:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`{
  "full_name": "John Doe",
  "domain": "company.com",
  "role": "CEO" // optional
}`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Response:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`{
  "email": "john.doe@company.com",
  "confidence": 95,
  "status": "found",
  "credits_remaining": {
    "find": 99,
    "verify": 50
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Verify Email Endpoint */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Verify Email</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-100 rounded">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">POST</span> /verify
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Request Body:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`{
  "email": "john.doe@company.com"
}`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Response:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`{
  "email": "john.doe@company.com",
  "status": "valid",
  "deliverable": true,
  "reason": "Valid email address",
  "credits_remaining": {
    "find": 100,
    "verify": 49
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Error Responses */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Error Responses</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2">401 Unauthorized:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`{
  "error": "Invalid API key",
  "code": "UNAUTHORIZED"
}`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">402 Payment Required:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`{
  "error": "Insufficient credits",
  "code": "INSUFFICIENT_CREDITS"
}`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">429 Too Many Requests:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Code Examples */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Code Examples</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">JavaScript/Node.js:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`const response = await fetch('https://yourdomain.com/api/v1/find', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    full_name: 'John Doe',
    domain: 'company.com'
  })
});

const data = await response.json();
console.log(data);`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Python:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`import requests

response = requests.post(
    'https://yourdomain.com/api/v1/find',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'full_name': 'John Doe',
        'domain': 'company.com'
    }
)

data = response.json()
print(data)`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">cURL:</h4>
                    <pre className="p-3 bg-gray-100 rounded text-sm overflow-x-auto">
{`curl -X POST https://yourdomain.com/api/v1/find \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "domain": "company.com"
  }'`}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}