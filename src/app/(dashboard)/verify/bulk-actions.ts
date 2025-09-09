'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCurrentUser, isPlanExpired } from '@/lib/auth'
import type { BulkVerificationJob } from './types'

async function createSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

/**
 * Submit emails for bulk verification as a background job
 */
export async function submitBulkVerificationJob(emails: string[]): Promise<{
  success: boolean
  jobId?: string
  error?: string
}> {
  try {
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return {
        success: false,
        error: 'Invalid emails array'
      }
    }

    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    // Check if plan has expired
    const planExpired = await isPlanExpired()
    if (planExpired) {
      return {
        success: false,
        error: 'Your plan has expired. Please upgrade to Pro.'
      }
    }

    // Check if user has Verify Credits specifically
    const supabaseClient = await createSupabaseClient()
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('credits_verify')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return {
        success: false,
        error: 'Failed to check your credits. Please try again.'
      }
    }
    
    const availableCredits = profile.credits_verify || 0
    const requiredCredits = emails.length
    
    if (availableCredits === 0) {
      return {
        success: false,
        error: "You don't have any Verify Credits to perform this action. Please purchase more credits."
      }
    }
    
    if (availableCredits < requiredCredits) {
      return {
        success: false,
        error: `You need ${requiredCredits} Verify Credits but only have ${availableCredits}. Please purchase more credits.`
      }
    }

    const supabase = await createSupabaseClient()
     const jobId = crypto.randomUUID()

     // Insert job into database
     const { error: insertError } = await supabase
      .from('bulk_verification_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        status: 'pending',
        total_emails: emails.length,
        processed_emails: 0,
        successful_verifications: 0,
        failed_verifications: 0,
        emails_data: emails.map(email => ({ email, status: 'pending' }))
      })

    if (insertError) {
      console.error('Error creating bulk verification job:', insertError)
      return {
        success: false,
        error: 'Failed to create verification job'
      }
    }

    // Trigger background processing
    console.log('Triggering background processing for job:', jobId)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/bulk-verify/jobs?jobId=${jobId}`, {
      method: 'POST'
    }).then(response => {
      console.log('Background processing response:', response.status, response.statusText)
      if (!response.ok) {
        return response.text().then(text => {
          console.error('Background processing failed:', text)
        })
      }
      console.log('Background processing started successfully')
    }).catch(error => {
      console.error('Error triggering background processing:', error)
    })

    revalidatePath('/(dashboard)', 'layout')

    return {
      success: true,
      jobId
    }
  } catch (error) {
    console.error('Submit bulk verification job error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Get the status of a specific bulk verification job
 */
export async function getBulkVerificationJobStatus(jobId: string): Promise<{
  success: boolean
  job?: BulkVerificationJob
  error?: string
}> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    const supabase = await createSupabaseClient()
    
    const { data: jobData, error } = await supabase
      .from('bulk_verification_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching job:', error)
      return {
        success: false,
        error: 'Job not found'
      }
    }

    const job: BulkVerificationJob = {
      jobId: jobData.id,
      status: jobData.status,
      totalEmails: jobData.total_emails,
      processedEmails: jobData.processed_emails,
      successfulVerifications: jobData.successful_verifications,
      failedVerifications: jobData.failed_verifications,
      emailsData: jobData.emails_data,
      errorMessage: jobData.error_message,
      createdAt: jobData.created_at,
      updatedAt: jobData.updated_at,
      completedAt: jobData.completed_at
    }

    return {
      success: true,
      job
    }
  } catch (error) {
    console.error('Error getting job status:', error)
    return {
      success: false,
      error: 'Failed to get job status'
    }
  }
}

/**
 * Get all bulk verification jobs for the current user
 */
export async function getUserBulkVerificationJobs(): Promise<{
  success: boolean
  jobs?: BulkVerificationJob[]
  error?: string
}> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    const supabase = await createSupabaseClient()
    
    const { data: jobs, error } = await supabase
      .from('bulk_verification_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching user jobs:', error)
      return {
        success: false,
        error: 'Failed to fetch jobs'
      }
    }

    const formattedJobs: BulkVerificationJob[] = jobs.map(job => ({
      jobId: job.id,
      status: job.status,
      totalEmails: job.total_emails,
      processedEmails: job.processed_emails,
      successfulVerifications: job.successful_verifications,
      failedVerifications: job.failed_verifications,
      emailsData: job.emails_data,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at
    }))

    return {
      success: true,
      jobs: formattedJobs
    }
  } catch (error) {
    console.error('Error in getUserBulkVerificationJobs:', error)
    return {
      success: false,
      error: 'Internal server error'
    }
  }
}

/**
 * Stop a running bulk verification job
 */
export async function stopBulkVerificationJob(jobId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    const supabase = await createSupabaseClient()
    
    const { error } = await supabase
      .from('bulk_verification_jobs')
      .update({
        status: 'failed',
        error_message: 'Job manually stopped by user',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', user.id)
      .eq('status', 'processing')

    if (error) {
      console.error('Error stopping job:', error)
      return {
        success: false,
        error: 'Failed to stop job'
      }
    }

    revalidatePath('/verify')
    
    return {
      success: true
    }
  } catch (error) {
    console.error('Error in stopBulkVerificationJob:', error)
    return {
      success: false,
      error: 'Internal server error'
    }
  }
}