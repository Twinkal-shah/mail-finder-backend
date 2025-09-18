'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EnvVariable {
  name: string
  value: string | undefined
  required: boolean
  description: string
  category: 'supabase' | 'lemonsqueezy' | 'email' | 'app'
}

interface EnvStatus {
  name: string
  status: 'present' | 'missing' | 'invalid'
  required: boolean
  description: string
  category: string
}

export function EnvChecker() {
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const envVariables: EnvVariable[] = [
    // Supabase Configuration
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
      required: true,
      description: 'Your Supabase project URL',
      category: 'supabase'
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      required: true,
      description: 'Supabase anonymous key for client-side operations',
      category: 'supabase'
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      value: process.env.SUPABASE_SERVICE_ROLE_KEY,
      required: true,
      description: 'Supabase service role key for server-side operations',
      category: 'supabase'
    },
    // LemonSqueezy Configuration
    {
      name: 'LEMONSQUEEZY_API_KEY',
      value: process.env.LEMONSQUEEZY_API_KEY,
      required: true,
      description: 'LemonSqueezy API key for payment processing',
      category: 'lemonsqueezy'
    },
    {
      name: 'LEMONSQUEEZY_STORE_ID',
      value: process.env.LEMONSQUEEZY_STORE_ID,
      required: true,
      description: 'LemonSqueezy store ID',
      category: 'lemonsqueezy'
    },
    {
      name: 'LEMONSQUEEZY_WEBHOOK_SECRET',
      value: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
      required: true,
      description: 'LemonSqueezy webhook secret for secure webhook verification',
      category: 'lemonsqueezy'
    },
    {
      name: 'LEMONSQUEEZY_PRODUCT_ID',
      value: process.env.LEMONSQUEEZY_PRODUCT_ID,
      required: true,
      description: 'LemonSqueezy main product ID',
      category: 'lemonsqueezy'
    },
    {
      name: 'LEMONSQUEEZY_PRO_VARIANT_ID',
      value: process.env.LEMONSQUEEZY_PRO_VARIANT_ID,
      required: true,
      description: 'LemonSqueezy Pro plan variant ID',
      category: 'lemonsqueezy'
    },
    {
      name: 'LEMONSQUEEZY_AGENCY_VARIANT_ID',
      value: process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID,
      required: true,
      description: 'LemonSqueezy Agency plan variant ID',
      category: 'lemonsqueezy'
    },
    {
      name: 'LEMONSQUEEZY_LIFETIME_VARIANT_ID',
      value: process.env.LEMONSQUEEZY_LIFETIME_VARIANT_ID,
      required: true,
      description: 'LemonSqueezy Lifetime plan variant ID',
      category: 'lemonsqueezy'
    },
    // Email Service Configuration
    {
      name: 'EMAIL_FINDER_API_URL',
      value: process.env.EMAIL_FINDER_API_URL,
      required: false,
      description: 'Email finder API URL (optional - uses mock data if not provided)',
      category: 'email'
    },
    {
      name: 'EMAIL_FINDER_API_KEY',
      value: process.env.EMAIL_FINDER_API_KEY,
      required: false,
      description: 'Email finder API key',
      category: 'email'
    },
    {
      name: 'EMAIL_VERIFIER_API_URL',
      value: process.env.EMAIL_VERIFIER_API_URL,
      required: false,
      description: 'Email verifier API URL (optional - uses mock data if not provided)',
      category: 'email'
    },
    {
      name: 'EMAIL_VERIFIER_API_KEY',
      value: process.env.EMAIL_VERIFIER_API_KEY,
      required: false,
      description: 'Email verifier API key',
      category: 'email'
    },
    // App Configuration
    {
      name: 'NEXT_PUBLIC_APP_URL',
      value: process.env.NEXT_PUBLIC_APP_URL,
      required: false,
      description: 'Public app URL for redirects and links',
      category: 'app'
    },
    {
      name: 'NEXT_PUBLIC_MARKETING_URL',
      value: process.env.NEXT_PUBLIC_MARKETING_URL,
      required: false,
      description: 'Marketing website URL',
      category: 'app'
    }
  ]

  const checkEnvironmentVariables = () => {
    setIsLoading(true)
    
    const status: EnvStatus[] = envVariables.map(envVar => {
      let status: 'present' | 'missing' | 'invalid' = 'missing'
      
      if (envVar.value) {
        // Basic validation
        if (envVar.name.includes('URL') && !envVar.value.startsWith('http')) {
          status = 'invalid'
        } else if (envVar.name.includes('KEY') && envVar.value.length < 10) {
          status = 'invalid'
        } else {
          status = 'present'
        }
      }
      
      return {
        name: envVar.name,
        status,
        required: envVar.required,
        description: envVar.description,
        category: envVar.category
      }
    })
    
    setEnvStatus(status)
    setLastChecked(new Date())
    setIsLoading(false)
  }

  useEffect(() => {
    checkEnvironmentVariables()
  }, [])

  const getStatusIcon = (status: string, required: boolean) => {
    if (status === 'present') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else if (status === 'invalid') {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    } else if (required) {
      return <XCircle className="h-4 w-4 text-red-500" />
    } else {
      return <AlertTriangle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string, required: boolean) => {
    if (status === 'present') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Present</Badge>
    } else if (status === 'invalid') {
      return <Badge variant="destructive">Invalid</Badge>
    } else if (required) {
      return <Badge variant="destructive">Missing</Badge>
    } else {
      return <Badge variant="secondary">Optional</Badge>
    }
  }

  const categorizeStatus = (category: string) => {
    return envStatus.filter(env => env.category === category)
  }

  const criticalIssues = envStatus.filter(env => env.required && env.status !== 'present')
  const warnings = envStatus.filter(env => env.status === 'invalid')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Environment Debug
                {isLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <CardDescription>
                This page helps debug environment variable issues in production. Remove this page after fixing the issue.
              </CardDescription>
            </div>
            <Button onClick={checkEnvironmentVariables} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Recheck
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lastChecked && (
              <p className="text-sm text-muted-foreground">
                Last checked: {lastChecked.toLocaleString()}
              </p>
            )}
            
            {criticalIssues.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{criticalIssues.length} critical environment variable(s) missing:</strong>
                  <ul className="mt-2 list-disc list-inside">
                    {criticalIssues.map(issue => (
                      <li key={issue.name}>{issue.name}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            {warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{warnings.length} environment variable(s) have invalid values:</strong>
                  <ul className="mt-2 list-disc list-inside">
                    {warnings.map(warning => (
                      <li key={warning.name}>{warning.name}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Supabase Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Supabase Configuration</CardTitle>
          <CardDescription>
            Database and authentication configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categorizeStatus('supabase').map(env => (
              <div key={env.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(env.status, env.required)}
                  <div>
                    <p className="font-medium">{env.name}</p>
                    <p className="text-sm text-muted-foreground">{env.description}</p>
                  </div>
                </div>
                {getStatusBadge(env.status, env.required)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* LemonSqueezy Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>LemonSqueezy Configuration</CardTitle>
          <CardDescription>
            Payment processing and billing configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categorizeStatus('lemonsqueezy').map(env => (
              <div key={env.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(env.status, env.required)}
                  <div>
                    <p className="font-medium">{env.name}</p>
                    <p className="text-sm text-muted-foreground">{env.description}</p>
                  </div>
                </div>
                {getStatusBadge(env.status, env.required)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Services Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Email Services Configuration</CardTitle>
          <CardDescription>
            Email finder and verifier API configuration (optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categorizeStatus('email').map(env => (
              <div key={env.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(env.status, env.required)}
                  <div>
                    <p className="font-medium">{env.name}</p>
                    <p className="text-sm text-muted-foreground">{env.description}</p>
                  </div>
                </div>
                {getStatusBadge(env.status, env.required)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* App Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>App Configuration</CardTitle>
          <CardDescription>
            General application configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categorizeStatus('app').map(env => (
              <div key={env.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(env.status, env.required)}
                  <div>
                    <p className="font-medium">{env.name}</p>
                    <p className="text-sm text-muted-foreground">{env.description}</p>
                  </div>
                </div>
                {getStatusBadge(env.status, env.required)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Fix Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">For Local Development:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Create or update your <code>.env.local</code> file in the project root</li>
                <li>Add the missing environment variables</li>
                <li>Restart your development server</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2">For Production:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Add missing environment variables to your hosting platform (Vercel/Netlify/etc.)</li>
                <li>Redeploy your application</li>
                <li>Check this page again to verify the fix</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default EnvChecker