import { NextRequest } from 'next/server'
import { authenticateApiRequest, checkSufficientCredits, deductApiCredits, createApiErrorResponse, createApiSuccessResponse } from '@/lib/api-auth'
import { findEmail, type EmailFinderRequest } from '@/lib/services/email-finder'

interface FindEmailApiRequest {
  full_name: string
  domain: string
  role?: string
}

interface FindEmailApiResponse {
  email: string | null
  confidence: number
  status: 'found' | 'not_found' | 'error'
  credits_remaining: {
    find: number
    verify: number
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate API request
    const authResult = await authenticateApiRequest(request)
    if (!authResult.success) {
      return createApiErrorResponse(authResult.error || 'Authentication failed', 401)
    }

    // Parse request body
    let body: FindEmailApiRequest
    try {
      body = await request.json()
    } catch (error) {
      console.error('Error parsing request body:', error)
      return createApiErrorResponse('Invalid JSON in request body', 400)
    }

    // Validate required fields
    if (!body.full_name || typeof body.full_name !== 'string') {
      return createApiErrorResponse('full_name is required and must be a string', 400)
    }

    if (!body.domain || typeof body.domain !== 'string') {
      return createApiErrorResponse('domain is required and must be a string', 400)
    }

    // Validate optional fields
    if (body.role && typeof body.role !== 'string') {
      return createApiErrorResponse('role must be a string if provided', 400)
    }

    // Check if user has sufficient credits
    const creditCheck = checkSufficientCredits(authResult, 1, 'find')
    if (!creditCheck.sufficient) {
      return createApiErrorResponse(creditCheck.error || 'Insufficient credits', 402)
    }

    // Prepare email finder request
    const emailRequest: EmailFinderRequest = {
      full_name: body.full_name.trim(),
      domain: body.domain.trim(),
      role: body.role?.trim()
    }

    // Call email finder service
    const serviceResult = await findEmail(emailRequest)

    // Deduct credits after successful API call
    const creditsDeducted = await deductApiCredits(authResult.userId!, 1, 'find')
    if (!creditsDeducted) {
      console.error('Failed to deduct credits for user:', authResult.userId)
      // Continue with response but log the error
    }

    // Calculate remaining credits (subtract 1 if deduction was successful)
    const remainingFindCredits = creditsDeducted 
      ? (authResult.creditsFind || 0) - 1
      : (authResult.creditsFind || 0)

    // Map service result to API response format
    const apiResponse: FindEmailApiResponse = {
      email: serviceResult.email || null,
      confidence: serviceResult.confidence || 0,
      status: serviceResult.email ? 'found' : 'not_found',
      credits_remaining: {
        find: remainingFindCredits,
        verify: authResult.creditsVerify || 0
      }
    }

    return createApiSuccessResponse(apiResponse)

  } catch (error) {
    console.error('API find email error:', error)
    return createApiErrorResponse('Internal server error', 500)
  }
}

// Handle unsupported methods
export async function GET() {
  return createApiErrorResponse('Method not allowed. Use POST to find emails.', 405)
}

export async function PUT() {
  return createApiErrorResponse('Method not allowed. Use POST to find emails.', 405)
}

export async function DELETE() {
  return createApiErrorResponse('Method not allowed. Use POST to find emails.', 405)
}

export async function PATCH() {
  return createApiErrorResponse('Method not allowed. Use POST to find emails.', 405)
}