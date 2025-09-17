import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create Supabase client with service role for API authentication
function createServiceClient() {
  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      get() { return undefined },
      set() {},
      remove() {},
    },
  })
}

export interface ApiAuthResult {
  success: boolean
  userId?: string
  plan?: string
  creditsFind?: number
  creditsVerify?: number
  error?: string
}

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid Authorization header. Use: Bearer sk_your_api_key'
      }
    }

    const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix
    if (!apiKey || !apiKey.startsWith('sk_')) {
      return {
        success: false,
        error: 'Invalid API key format. API keys must start with sk_'
      }
    }

    // Validate API key using Supabase function
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('validate_api_key', {
      p_api_key: apiKey
    })

    if (error) {
      console.error('Error validating API key:', error)
      return {
        success: false,
        error: 'Internal server error'
      }
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Invalid API key'
      }
    }

    const authData = data[0]
    if (!authData.is_valid) {
      return {
        success: false,
        error: 'API key is invalid or your plan does not support API access. API access is only available for Agency and Lifetime plans.'
      }
    }

    // Check rate limiting
    const rateLimitKey = `${authData.user_id}:${apiKey.substring(0, 8)}`
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window
    const maxRequests = 60 // 60 requests per minute

    let rateLimitData = rateLimitStore.get(rateLimitKey)
    if (!rateLimitData || now > rateLimitData.resetTime) {
      rateLimitData = { count: 0, resetTime: now + windowMs }
    }

    rateLimitData.count++
    rateLimitStore.set(rateLimitKey, rateLimitData)

    if (rateLimitData.count > maxRequests) {
      return {
        success: false,
        error: `Rate limit exceeded. Maximum ${maxRequests} requests per minute allowed.`
      }
    }

    return {
      success: true,
      userId: authData.user_id,
      plan: authData.plan,
      creditsFind: authData.credits_find,
      creditsVerify: authData.credits_verify
    }
  } catch (error) {
    console.error('API authentication error:', error)
    return {
      success: false,
      error: 'Internal server error'
    }
  }
}

// Helper function to check if user has sufficient credits
export function checkSufficientCredits(
  authResult: ApiAuthResult,
  requiredCredits: number,
  creditType: 'find' | 'verify'
): { sufficient: boolean; error?: string } {
  if (!authResult.success) {
    return { sufficient: false, error: authResult.error }
  }

  const availableCredits = creditType === 'find' 
    ? authResult.creditsFind || 0
    : authResult.creditsVerify || 0

  if (availableCredits < requiredCredits) {
    return {
      sufficient: false,
      error: `Insufficient ${creditType} credits. Required: ${requiredCredits}, Available: ${availableCredits}`
    }
  }

  return { sufficient: true }
}

// Helper function to deduct credits after successful API call
export async function deductApiCredits(
  userId: string,
  amount: number,
  creditType: 'find' | 'verify'
): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    
    const { error } = await supabase.rpc('deduct_credits', {
      user_id: userId,
      amount: amount,
      operation: creditType === 'find' ? 'email_finding' : 'email_verification'
    })

    if (error) {
      console.error('Error deducting API credits:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deductApiCredits:', error)
    return false
  }
}

// Standard API error responses
export function createApiErrorResponse(message: string, status: number = 400) {
  return Response.json(
    {
      error: {
        message,
        code: status
      }
    },
    { status }
  )
}

export function createApiSuccessResponse(data: unknown, status: number = 200) {
  return Response.json(
    {
      success: true,
      data
    },
    { status }
  )
}