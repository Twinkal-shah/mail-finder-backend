'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface HealthCheckResponse {
  status: string
  timestamp: string
  environment: string
  checkoutReady: boolean
  missingCriticalVars: string[]
  environmentVariables: Record<string, boolean>
  message: string
}

export function EnvironmentChecker() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const data = await response.json()
        setHealthData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check environment')
      } finally {
        setLoading(false)
      }
    }

    checkHealth()
  }, [])

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Environment Status</CardTitle>
          <CardDescription>Checking environment variables...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-red-600">Environment Check Failed</CardTitle>
          <CardDescription>Unable to verify environment configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!healthData) return null

  const getStatusIcon = (isPresent: boolean) => {
    return isPresent ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    )
  }

  const getStatusBadge = (isPresent: boolean) => {
    return (
      <Badge variant={isPresent ? 'default' : 'destructive'}>
        {isPresent ? 'Present' : 'Missing'}
      </Badge>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {healthData.checkoutReady ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <AlertCircle className="h-6 w-6 text-red-600" />
          )}
          Environment Status
        </CardTitle>
        <CardDescription>
          Environment: {healthData.environment} | Last checked: {new Date(healthData.timestamp).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Status */}
        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Checkout Functionality</h3>
            <Badge variant={healthData.checkoutReady ? 'default' : 'destructive'}>
              {healthData.checkoutReady ? 'Ready' : 'Not Ready'}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mt-2">{healthData.message}</p>
          {healthData.missingCriticalVars.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-600">Missing Critical Variables:</p>
              <ul className="list-disc list-inside text-sm text-red-600 mt-1">
                {healthData.missingCriticalVars.map((varName) => (
                  <li key={varName}>{varName}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Environment Variables */}
        <div>
          <h3 className="font-semibold mb-3">Environment Variables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(healthData.environmentVariables).map(([varName, isPresent]) => (
              <div key={varName} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(isPresent)}
                  <span className="text-sm font-mono">{varName}</span>
                </div>
                {getStatusBadge(isPresent)}
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {!healthData.checkoutReady && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">Next Steps:</h4>
            <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
              <li>Add missing environment variables to your hosting platform (Vercel/Netlify/etc.)</li>
              <li>Redeploy your application</li>
              <li>Refresh this page to verify the fix</li>
            </ol>
            <p className="text-sm text-yellow-700 mt-2">
              See <code>PRODUCTION_ENVIRONMENT_SETUP.md</code> for detailed instructions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}