interface EmailVerifierResult {
  email: string
  status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error'
  confidence: number
  reason?: string
  deliverable?: boolean
  disposable?: boolean
  role_account?: boolean
  catch_all?: boolean
  domain?: string
  mx?: string
  user_name?: string
}

interface EmailVerifierRequest {
  email: string
}

// Mock verification results for demo purposes
const mockVerificationResults: Record<string, Omit<EmailVerifierResult, 'email'>> = {
  'john.doe@gmail.com': {
    status: 'valid',
    confidence: 95,
    deliverable: true,
    disposable: false,
    role_account: false
  },
  'test@10minutemail.com': {
    status: 'risky',
    confidence: 70,
    deliverable: true,
    disposable: true,
    role_account: false,
    reason: 'Disposable email provider'
  },
  'admin@company.com': {
    status: 'risky',
    confidence: 80,
    deliverable: true,
    disposable: false,
    role_account: true,
    reason: 'Role-based email account'
  },
  'invalid@nonexistentdomain12345.com': {
    status: 'invalid',
    confidence: 95,
    deliverable: false,
    disposable: false,
    role_account: false,
    reason: 'Domain does not exist'
  }
}

/**
 * Mock email verifier function for demo purposes
 */
export async function verifyEmailMock(request: EmailVerifierRequest): Promise<EmailVerifierResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800))
  
  // Handle undefined or null email
  if (!request || !request.email) {
    return {
      email: request?.email || 'unknown',
      status: 'error',
      confidence: 0,
      deliverable: false,
      disposable: false,
      role_account: false,
      reason: 'Invalid email address'
    }
  }
  
  const email = request.email.toLowerCase()
  
  // Check for specific mock results
  if (mockVerificationResults[email]) {
    return {
      email: request.email,
      ...mockVerificationResults[email]
    }
  }
  
  // Generate random result for unknown emails
  const randomStatus = Math.random()
  let status: EmailVerifierResult['status']
  let confidence: number
  let deliverable: boolean
  let reason: string | undefined
  
  if (randomStatus > 0.7) {
    status = 'valid'
    confidence = Math.floor(Math.random() * 20) + 80
    deliverable = true
  } else if (randomStatus > 0.5) {
    status = 'risky'
    confidence = Math.floor(Math.random() * 30) + 50
    deliverable = true
    reason = 'Catch-all domain'
  } else if (randomStatus > 0.3) {
    status = 'invalid'
    confidence = Math.floor(Math.random() * 20) + 80
    deliverable = false
    reason = 'Mailbox does not exist'
  } else {
    status = 'unknown'
    confidence = Math.floor(Math.random() * 40) + 30
    deliverable = false
    reason = 'Unable to verify'
  }
  
  return {
    email: request.email,
    status,
    confidence,
    deliverable,
    disposable: email.includes('temp') || email.includes('10minute'),
    role_account: /^(admin|info|support|contact|sales|marketing)@/.test(email),
    reason
  }
}

/**
 * Real email verifier function using external API
 */
export async function verifyEmailReal(request: EmailVerifierRequest): Promise<EmailVerifierResult> {
  const apiUrl = 'http://173.249.7.231:8500'
  
  // Add rate limiting - wait 1 second between requests to prevent API overload
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  try {
    // Create AbortController for timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    const response = await fetch(`${apiUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: request.email
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    // Parse the API response structure - status is nested in 'valid' object
    const validData = data.valid || {}
    const status = validData.status || 'unknown'
    
    return {
      email: request.email,
      status: status as EmailVerifierResult['status'],
      confidence: validData.connections ? validData.connections * 20 : 0, // Convert connections to confidence percentage
      deliverable: status === 'valid',
      disposable: validData.disposable || false,
      role_account: validData.role_account || false,
      reason: validData.message || undefined,
      catch_all: validData.catch_all || false,
      domain: validData.domain || undefined,
      mx: validData.mx || undefined,
      user_name: validData.user_name || undefined
    }
  } catch (error) {
    console.error('Email verifier API error:', error)
    return {
      email: request.email,
      status: 'error',
      confidence: 0,
      deliverable: false,
      disposable: false,
      role_account: false,
      reason: 'Failed to verify email due to API error'
    }
  }
}

/**
 * Main email verifier function that uses the real API
 * Uses the external API to verify emails
 */
export async function verifyEmail(request: EmailVerifierRequest): Promise<EmailVerifierResult> {
  // Use real API for production
  return verifyEmailReal(request)
}

export type { EmailVerifierResult, EmailVerifierRequest }