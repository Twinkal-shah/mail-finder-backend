import { EnvironmentChecker } from '@/components/env-checker'

export default function EnvironmentDebugPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Environment Debug</h1>
        <p className="text-gray-600">
          This page helps debug environment variable issues in production.
          Remove this page after fixing the issue.
        </p>
      </div>
      
      <EnvironmentChecker />
      
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="font-semibold text-blue-800 mb-2">Instructions:</h2>
        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
          <li>Deploy this to production and visit <code>app.mailsfinder.com/env-debug</code></li>
          <li>Check which environment variables are missing</li>
          <li>Add them to your hosting platform (Vercel dashboard)</li>
          <li>Redeploy and verify the fix</li>
          <li>Remove this debug page when done</li>
        </ol>
      </div>
    </div>
  )
}