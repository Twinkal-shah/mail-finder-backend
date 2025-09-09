'use server'

import { revalidatePath } from 'next/cache'
import { deductCredits, getCurrentUser, isPlanExpired } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import { verifyEmail, type EmailVerifierRequest } from '@/lib/services/email-verifier'

interface VerifyResult {
  status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error'
  reason?: string
  success?: boolean
  error?: string
  catch_all?: boolean
  domain?: string
  mx?: string
  user_name?: string
  email?: string
}



export async function verifySingleEmail(email: string): Promise<VerifyResult> {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return {
        status: 'error',
        success: false,
        error: 'You must be logged in to perform this action.'
      }
    }
    
    // Check if plan has expired
    const planExpired = await isPlanExpired()
    if (planExpired) {
      return {
        status: 'error',
        success: false,
        error: "Your plan has expired. Please upgrade to Pro."
      }
    }

    // Check if user has Verify Credits specifically
    const supabase = await createServerActionClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_verify')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return {
        status: 'error',
        success: false,
        error: 'Failed to check your credits. Please try again.'
      }
    }
    
    if ((profile.credits_verify || 0) === 0) {
      return {
        status: 'error',
        success: false,
        error: "You don't have enough Verify Credits to perform this action. Please purchase more credits."
      }
    }

    // Call email verifier service
    const request: EmailVerifierRequest = { email }
    const verifierResult = await verifyEmail(request)
    
    // Deduct credits for any verification attempt (including errors)
    // User should be charged for every verification attempt made
    const deducted = await deductCredits(1, 'email_verify', {
      email: email,
      result: verifierResult.status
    })
    
    // Log credit deduction failure but don't treat it as verification error
    if (!deducted) {
      console.error(`Failed to deduct credit for email: ${email} - Plan may be expired or insufficient credits`)
      // Still return the verification result, but note the credit issue
    }
    
    // Revalidate to update credits display
    revalidatePath('/(dashboard)', 'layout')
    
    return {
      status: verifierResult.status,
      reason: verifierResult.reason,
      success: true
    }
  } catch (error) {
    console.error('Email verification error:', error)
    return {
      status: 'error',
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function processBulkVerify(emails: string[]): Promise<VerifyResult[]> {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return emails.map(() => ({
        status: 'error' as const,
        success: false,
        error: 'You must be logged in to perform this action.'
      }))
    }
    
    // Check if plan has expired
    const planExpired = await isPlanExpired()
    if (planExpired) {
      return emails.map(() => ({
        status: 'error' as const,
        success: false,
        error: "Your plan has expired. Please upgrade to Pro."
      }))
    }

    // Check if user has Verify Credits specifically
    const supabase = await createServerActionClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_verify')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return emails.map(() => ({
        status: 'error' as const,
        success: false,
        error: 'Failed to check your credits. Please try again.'
      }))
    }
    
    const availableCredits = profile.credits_verify || 0
    const requiredCredits = emails.length
    
    if (availableCredits === 0) {
      return emails.map(() => ({
        status: 'error' as const,
        success: false,
        error: "You don't have any Verify Credits to perform this action. Please purchase more credits."
      }))
    }
    
    if (availableCredits < requiredCredits) {
      return emails.map(() => ({
        status: 'error' as const,
        success: false,
        error: `You need ${requiredCredits} Verify Credits but only have ${availableCredits}. Please purchase more credits.`
      }))
    }
    
    const results: VerifyResult[] = []
    
    // Process each email
    for (const email of emails) {
      // Call email verifier service
      const request: EmailVerifierRequest = { email }
      const verifierResult = await verifyEmail(request)
      
      const result: VerifyResult = {
        status: verifierResult.status,
        reason: verifierResult.reason,
        success: verifierResult.status !== 'error',
        catch_all: verifierResult.catch_all,
        domain: verifierResult.domain,
        mx: verifierResult.mx,
        user_name: verifierResult.user_name
      }
      
      results.push(result)
      
      // Count successful verifications (non-error status)
      if (result.status !== 'error') {
        // Verification successful - no action needed
      }
      
      // Deduct 1 credit for each verification attempt (including errors)
      // User should be charged for every verification attempt made
      const deducted = await deductCredits(1, 'email_verify', {
        email: email,
        result: verifierResult.status,
        bulk: true
      })
      
      // Log credit deduction failure but don't treat it as verification error
      if (!deducted) {
        console.error(`Failed to deduct credit for email: ${email} - Plan may be expired or insufficient credits`)
        // Still keep the verification result, but note the credit issue
      }
    }
    
    // Revalidate to update credits display
    revalidatePath('/(dashboard)', 'layout')
    
    return results
  } catch (error) {
    console.error('Bulk verify error:', error)
    return emails.map(() => ({
      status: 'error' as const,
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    }))
  }
}

export async function exportVerifyResults(rows: VerifyResult[]): Promise<string> {
  // Convert rows to CSV format
  const headers = ['Email', 'Status', 'Reason']
  const csvRows = [headers.join(',')]
  
  rows.forEach(row => {
    const csvRow = [
      `"${row.email || ''}"`,
      row.status || 'pending',
      `"${row.reason || ''}"`
    ]
    csvRows.push(csvRow.join(','))
  })
  
  return csvRows.join('\n')
}