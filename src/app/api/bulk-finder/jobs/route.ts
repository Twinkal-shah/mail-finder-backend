import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { findEmail } from '@/lib/services/email-finder'
import type { BulkFindRequest } from '@/app/(dashboard)/bulk-finder/types'

async function createSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

// GET endpoint to fetch user bulk finder jobs
export async function GET() {
  try {
    // Import getCurrentUser here to avoid import issues
    const { getCurrentUser } = await import('@/lib/auth')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseClient()
    
    const { data: jobs, error } = await supabase
      .from('bulk_finder_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching bulk finder jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('GET bulk finder jobs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST endpoint for background processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobId } = body
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Start background processing with proper error handling
    processJobInBackground(jobId).catch(async (error) => {
      console.error('Background processing failed for job:', jobId, error)
      
      // Update job status to failed if background processing fails
      try {
        const supabase = await createSupabaseClient()
        await supabase
          .from('bulk_finder_jobs')
          .update({ 
            status: 'failed',
            error_message: error.message || 'Background processing failed'
          })
          .eq('id', jobId)
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError)
      }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST bulk finder job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Background processing function
export async function processJobInBackground(jobId: string) {
  const supabase = await createSupabaseClient()
  
  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('bulk_finder_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('Job not found:', jobError)
      throw new Error(`Job not found: ${jobError?.message || 'Unknown error'}`)
    }



    // Update job status to processing
    const { error: updateError } = await supabase
      .from('bulk_finder_jobs')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      
    if (updateError) {
      throw new Error(`Failed to update job status to processing: ${updateError.message}`)
    }

    const requests: BulkFindRequest[] = job.requests_data as BulkFindRequest[]
    let processedCount = job.processed_requests || 0
    let successCount = job.successful_finds || 0
    let failedCount = job.failed_finds || 0
    const startIndex = job.current_index || 0

    // Track total processed requests for final transaction
    let totalProcessedRequests = 0

    // Process each request starting from current_index (credits already deducted)
    for (let i = startIndex; i < requests.length; i++) {
      try {
        // Check if job was paused/stopped
        const { data: currentJob } = await supabase
          .from('bulk_finder_jobs')
          .select('status')
          .eq('id', jobId)
          .single()

        if (currentJob?.status === 'failed' || currentJob?.status === 'paused') {
          break
        }

        const request = requests[i]
        request.status = 'processing'

        // Update progress
        await supabase
          .from('bulk_finder_jobs')
          .update({
            current_index: i,
            requests_data: requests,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)

        // Check if user has credits before processing
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('credits_find, credits_verify')
          .eq('id', job.user_id)
          .single()
        
        if (profileError || !userProfile) {
          console.error('Error getting user profile:', profileError)
          request.status = 'failed'
          request.error = 'Failed to access user profile'
          failedCount++
          continue
        }
        
        const currentFindCredits = userProfile.credits_find || 0
        const currentVerifyCredits = userProfile.credits_verify || 0
        const totalCredits = currentFindCredits + currentVerifyCredits
        
        if (totalCredits < 1) {
          console.log('User has insufficient credits')
          request.status = 'failed'
          request.error = 'Insufficient credits'
          failedCount++
          continue
        }
        
        // Deduct 1 credit (prefer find credits first)
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        
        if (currentFindCredits > 0) {
          updateData.credits_find = currentFindCredits - 1
        } else {
          updateData.credits_verify = currentVerifyCredits - 1
        }
        
        // Update user credits
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', job.user_id)
        
        if (updateError) {
          console.error('Error deducting credit:', updateError)
          request.status = 'failed'
          request.error = 'Failed to deduct credit'
          failedCount++
          continue
        }
        
        totalProcessedRequests++

        // Find email
        const result = await findEmail({
          full_name: request.full_name,
          domain: request.domain,
          role: request.role
        })

        if (result.status === 'valid' && result.email) {
          request.status = 'completed'
          request.email = result.email
          request.confidence = result.confidence
          request.catch_all = result.catch_all
          request.user_name = result.user_name
          request.mx = result.mx
          successCount++
        } else {
          request.status = 'failed'
          request.error = result.message || 'Email not found'
          failedCount++
        }

        console.log(`Processing request ${i + 1}/${requests.length}: ${request.full_name}@${request.domain}`)

        processedCount++

        // Update progress in database
        const { error: progressError } = await supabase
          .from('bulk_finder_jobs')
          .update({
            processed_requests: processedCount,
            successful_finds: successCount,
            failed_finds: failedCount,
            requests_data: requests,
            current_index: i + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)
          
        if (progressError) {
          console.error(`Error updating progress for job ${jobId}:`, progressError)
        }

        // Add small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error processing request ${i}:`, error)
        requests[i].status = 'failed'
        requests[i].error = 'Processing error'
        failedCount++
        processedCount++

        const { error: errorUpdateError } = await supabase
          .from('bulk_finder_jobs')
          .update({
            processed_requests: processedCount,
            failed_finds: failedCount,
            requests_data: requests,
            current_index: i + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)
          
        if (errorUpdateError) {
          console.error(`Error updating job after processing error for job ${jobId}:`, errorUpdateError)
        }
      }
    }

    // Log single bulk transaction for all processed requests
    if (totalProcessedRequests > 0) {
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: job.user_id,
          amount: -totalProcessedRequests,
          operation: 'email_find',
          meta: {
            bulk: true,
            job_id: jobId,
            total_requests: totalProcessedRequests,
            batch_operation: true
          },
          created_at: new Date().toISOString()
        })
      
      if (transactionError) {
        console.error('Error logging bulk credit transaction:', transactionError)
        // Continue even if transaction logging fails
      } else {
        console.log(`Logged bulk credit transaction for ${totalProcessedRequests} credits`)
      }
    }

    // Mark job as completed
    const { error: completionError } = await supabase
      .from('bulk_finder_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      
    if (completionError) {
      console.error(`Error marking job ${jobId} as completed:`, completionError)
      throw new Error(`Failed to mark job as completed: ${completionError.message}`)
    }

    console.log(`Bulk finder job ${jobId} completed successfully`)

  } catch (error) {
    console.error(`Error processing bulk finder job ${jobId}:`, error)
    
    // Mark job as failed
    const { error: failureUpdateError } = await supabase
      .from('bulk_finder_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      
    if (failureUpdateError) {
      console.error(`Error marking job ${jobId} as failed:`, failureUpdateError)
    }
  }
}