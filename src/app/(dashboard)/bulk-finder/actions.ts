'use server'

import { revalidatePath } from 'next/cache'
import { deductCredits, getCurrentUser, isPlanExpired } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import { findEmail, type EmailFinderRequest } from '@/lib/services/email-finder'

interface BulkFindRequest {
  full_name: string
  domain: string
  role?: string
}

interface BulkFindResult {
  email?: string | null
  confidence?: number
  status: 'valid' | 'invalid' | 'error'
  success?: boolean
  error?: string
  catch_all?: boolean
  user_name?: string
  mx?: string
  domain?: string
}

interface ExportRow {
  catch_all?: boolean
  user_name?: string
  domain?: string
  email?: string
  status?: string
  mx?: string
}



export async function processBulkFind(requests: BulkFindRequest[]): Promise<BulkFindResult[]> {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return requests.map(() => ({
        status: 'error' as const,
        success: false,
        error: 'You must be logged in to perform this action.'
      }))
    }
    
    // Check if plan has expired
    const planExpired = await isPlanExpired()
    if (planExpired) {
      return requests.map(() => ({
        status: 'error' as const,
        success: false,
        error: "Your plan has expired. Please upgrade to Pro."
      }))
    }

    // Check if user has Find Credits specifically
    const supabase = await createServerActionClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_find')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return requests.map(() => ({
        status: 'error' as const,
        success: false,
        error: 'Failed to check your credits. Please try again.'
      }))
    }
    
    if ((profile.credits_find || 0) === 0) {
      return requests.map(() => ({
        status: 'error' as const,
        success: false,
        error: "You don't have enough Find Credits to perform this action. Please purchase more credits."
      }))
    }

    // Check if user has enough Find Credits for all requests
    const requiredCredits = requests.length
    if ((profile.credits_find || 0) < requiredCredits) {
      return requests.map(() => ({
        status: 'error' as const,
        success: false,
        error: `You need ${requiredCredits} Find Credits but only have ${profile.credits_find || 0}. Please purchase more credits.`
      }))
    }
    
    // Deduct credits upfront for all rows submitted (regardless of processing outcome)
    const deducted = await deductCredits(requiredCredits, 'email_find', {
      total_rows: requests.length,
      bulk: true,
      deduction_type: 'upfront_per_row'
    })
    
    if (!deducted) {
      return requests.map(() => ({
        status: 'error' as const,
        success: false,
        error: 'Failed to process payment for bulk search.'
      }))
    }
    
    const results: BulkFindResult[] = []
    
    // Process each request
    for (const request of requests) {
      // Call email finder service
      const emailRequest: EmailFinderRequest = {
        full_name: request.full_name,
        domain: request.domain,
        role: request.role
      }
      const emailResult = await findEmail(emailRequest)
      
      const result: BulkFindResult = {
        email: emailResult.email,
        confidence: emailResult.confidence,
        status: emailResult.status,
        success: emailResult.status !== 'error',
        catch_all: emailResult.catch_all, // Use actual API value
        user_name: emailResult.user_name || emailResult.email?.split('@')[0] || '',
        mx: emailResult.mx || '', // Use mx string value from API
        domain: emailResult.domain || request.domain
      }
      
      results.push(result)
    }
    
    // Revalidate to update credits display
    revalidatePath('/(dashboard)', 'layout')
    
    return results
  } catch (error) {
    console.error('Bulk find error:', error)
    return requests.map(() => ({
      status: 'error' as const,
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    }))
  }
}

export async function exportResults(rows: ExportRow[]): Promise<string> {
  // Convert rows to CSV format with new columns
  const headers = ['Catch All', 'User Name', 'Domain', 'Email', 'Status', 'MX']
  const csvRows = [headers.join(',')]
  
  rows.forEach(row => {
    const csvRow = [
      row.catch_all ? 'Yes' : 'No',
      `"${row.user_name || ''}"`,
      `"${row.domain || ''}"`,
      `"${row.email || ''}"`,
      row.status || 'pending',
      `"${row.mx || ''}"`
    ]
    csvRows.push(csvRow.join(','))
  })
  
  return csvRows.join('\n')
}