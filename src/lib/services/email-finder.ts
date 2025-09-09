interface EmailFinderResult {
  email?: string | null
  confidence?: number
  status: 'valid' | 'invalid' | 'error'
  message?: string
  catch_all?: boolean
  domain?: string
  mx?: string
  time_exec?: number
  user_name?: string
  connections?: number
  ver_ops?: number
}

interface EmailFinderRequest {
  full_name: string
  domain: string
  role?: string
}

// Mock data for demo purposes
const mockEmailResults: EmailFinderResult[] = [
  {
    email: 'john.doe@example.com',
    confidence: 95,
    status: 'valid',
    message: 'Email found and verified',
    catch_all: false,
    user_name: 'John',
    mx: 'mx1.example.com'
  },
  {
    email: 'jane.smith@company.com',
    confidence: 88,
    status: 'valid',
    message: 'Email found with high confidence',
    catch_all: true,
    user_name: 'Jane',
    mx: 'alt1.aspmx.l.google.com'
  },
  {
    email: null,
    confidence: 0,
    status: 'invalid',
    message: 'No email found for this person',
    catch_all: false,
    user_name: '',
    mx: ''
  }
]

/**
 * Mock email finder function for demo purposes
 */
export async function findEmailMock(request: EmailFinderRequest): Promise<EmailFinderResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  // Generate a potential email based on name and domain
  const firstName = request.full_name.split(' ')[0]?.toLowerCase()
  const lastName = request.full_name.split(' ').slice(1).join(' ').toLowerCase().replace(/\s+/g, '')
  const potentialEmail = `${firstName}.${lastName}@${request.domain}`
  
  // Return mock result based on potential email or default
  const foundResult = mockEmailResults.find(result => result.email === potentialEmail)
  return foundResult || mockEmailResults[2] // Return the third item (invalid result) as default
}

/**
 * Real email finder function using external API
 */
export async function findEmailReal(request: EmailFinderRequest): Promise<EmailFinderResult> {
  const apiUrl = 'http://173.249.7.231:8500'
  
  try {
    const response = await fetch(`${apiUrl}/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        names: [request.full_name],
        domain: request.domain
      })
    })
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Map API response to our interface
    // API returns: { email, status, message, connections, domain, mx, etc. }
    return {
      email: data.email || null,
      confidence: data.confidence || (data.status === 'valid' ? 95 : 0),
      status: data.status || 'invalid',
      message: data.message || 'Email search completed',
      catch_all: data.catch_all, // Use actual API value, don't default to false
      connections: data.connections,
      domain: data.domain,
      mx: data.mx,
      time_exec: data.time_exec,
      user_name: data.user_name,
      ver_ops: data.ver_ops
    }
  } catch (error) {
    console.error('Email finder API error:', error)
    return {
      email: null,
      confidence: 0,
      status: 'error',
      message: 'Failed to find email due to API error'
    }
  }
}

/**
 * Main email finder function that uses the real API
 * Uses the external API to find emails
 */
export async function findEmail(request: EmailFinderRequest): Promise<EmailFinderResult> {
  // Use real API for email finding
  return findEmailReal(request)
}

export type { EmailFinderResult, EmailFinderRequest }