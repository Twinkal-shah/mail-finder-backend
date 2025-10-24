import { createClient } from '@supabase/supabase-js'
import { findEmail } from './services/email-finder'
import { registerActiveJob, unregisterActiveJob } from './job-persistence'
import type { BulkFindRequest } from '@/app/(dashboard)/bulk-finder/types'

function createSupabaseClient() {
  // Use service role key for background processing to avoid session dependency
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

/**
 * Recovers stuck jobs that have been processing for more than 30 minutes
 */
export async function recoverStuckJobs() {
  const supabase = createSupabaseClient()
  
  try {
    // Find jobs that have been processing for more than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: stuckJobs, error } = await supabase
      .from('bulk_finder_jobs')
      .select('id, user_id, processed_requests, total_requests')
      .eq('status', 'processing')
      .lt('updated_at', thirtyMinutesAgo)
    
    if (error) {
      console.error('Error finding stuck jobs:', error)
      return
    }
    
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`Found ${stuckJobs.length} stuck jobs, attempting recovery...`)
      
      for (const job of stuckJobs) {
        console.log(`Recovering stuck job ${job.id}`)
        
        // Reset job status to allow reprocessing from where it left off
        const { error: updateError } = await supabase
          .from('bulk_finder_jobs')
          .update({
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id)
        
        if (updateError) {
          console.error(`Error recovering job ${job.id}:`, updateError)
        } else {
          // Restart the job processing
          processJobInBackground(job.id).catch(error => {
            console.error(`Error restarting job ${job.id}:`, error)
          })
        }
      }
    }
  } catch (error) {
    console.error('Error in recoverStuckJobs:', error)
  }
}

export async function processJobInBackground(jobId: string) {
  console.log(`Starting background processing for job ${jobId}`)
  
  // Register this job as active for persistence tracking
  registerActiveJob(jobId)
  
  const supabase = createSupabaseClient()

  // Set up heartbeat to update job timestamp every 30 seconds
  const heartbeatInterval = setInterval(async () => {
    try {
      await supabase
        .from('bulk_finder_jobs')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', jobId)
    } catch (error) {
      console.error(`Heartbeat failed for job ${jobId}:`, error)
    }
  }, 30000) // 30 seconds
  
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
    const BATCH_SIZE = 5
    const totalBatches = Math.ceil((requests.length - startIndex) / BATCH_SIZE)
    
    console.log(`Starting processing from index ${startIndex} (${requests.length - startIndex} remaining)`)

    // Process requests in batches of 5
    for (let batchStart = startIndex; batchStart < requests.length; batchStart += BATCH_SIZE) {
      // Check if job was paused/stopped before processing each batch
      const { data: currentJob, error: statusError } = await supabase
        .from('bulk_finder_jobs')
        .select('status')
        .eq('id', jobId)
        .single()

      if (statusError) {
        console.error(`Error checking job status for ${jobId}:`, statusError)
        // Continue processing if we can't check status
      }

      if (currentJob?.status === 'failed' || currentJob?.status === 'paused') {
        console.log(`Job ${jobId} was ${currentJob.status}, stopping processing`)
        break
      }

      const batchEnd = Math.min(batchStart + BATCH_SIZE, requests.length)
      const batch = requests.slice(batchStart, batchEnd)
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${totalBatches}: requests ${batchStart + 1}-${batchEnd} of ${requests.length}`)

      // Save current progress before processing batch
      await supabase
        .from('bulk_finder_jobs')
        .update({
          current_index: batchStart,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      // Process batch concurrently
      const batchPromises = batch.map(async (request, batchIndex) => {
        const globalIndex = batchStart + batchIndex
        
        try {
          request.status = 'processing'
          console.log(`Processing request ${globalIndex + 1}/${requests.length}: ${request.full_name} @ ${request.domain}`)

          // Check if user has credits before processing
          const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('credits_find, credits_verify')
            .eq('id', job.user_id)
            .single()
          
          if (profileError || !userProfile) {
            console.error(`Error getting user profile for request ${globalIndex + 1}:`, profileError)
            request.status = 'failed'
            request.error = 'Failed to access user profile'
            return { success: false, index: globalIndex }
          }
          
          const currentFindCredits = userProfile.credits_find || 0
          const currentVerifyCredits = userProfile.credits_verify || 0
          const totalCredits = currentFindCredits + currentVerifyCredits
          
          if (totalCredits < 1) {
            console.log('User has insufficient credits')
            request.status = 'failed'
            request.error = 'Insufficient credits'
            return { success: false, index: globalIndex }
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
            return { success: false, index: globalIndex }
          }

          // Find email
          console.log(`Calling email finder API for request ${globalIndex + 1}`)
          const result = await findEmail({
            full_name: request.full_name,
            domain: request.domain,
            role: request.role
          })

          console.log(`Email finder API response for request ${globalIndex + 1}:`, {
            status: result.status,
            email: result.email ? 'found' : 'not found',
            message: result.message
          })

          // Handle different result statuses
          if (result.status === 'valid' && result.email) {
            // Email found and verified - count as success for UI
            console.log(`✅ Success ${globalIndex + 1}: Found email for ${request.full_name}`)
            request.status = 'completed'
            request.email = result.email
            request.confidence = result.confidence
            request.catch_all = result.catch_all
            request.user_name = result.user_name
            request.mx = result.mx
            return { success: true, index: globalIndex }
          } else if (result.status === 'invalid') {
            // No email found - completed processing but not a "success" for UI count
            console.log(`❌ No email found for request ${globalIndex + 1}: ${request.full_name}`)
            request.status = 'completed'
            request.email = undefined
            request.confidence = result.confidence || 0
            request.catch_all = result.catch_all
            request.user_name = result.user_name
            request.mx = result.mx
            request.error = result.message || 'No email found for this person'
            return { success: false, index: globalIndex }
          } else {
            // API error or other failure
            console.error(`🚨 API Error for request ${globalIndex + 1}:`, {
              name: request.full_name,
              domain: request.domain,
              status: result.status,
              message: result.message
            })
            request.status = 'failed'
            request.error = result.message || 'Email finding service error'
            return { success: false, index: globalIndex }
          }

        } catch (error) {
          console.error(`💥 Unexpected error processing request ${globalIndex + 1} (${request.full_name} @ ${request.domain}):`, error)
          request.status = 'failed'
          request.error = error instanceof Error ? error.message : 'Processing error'
          return { success: false, index: globalIndex }
        }
      })

      // Wait for all requests in the batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Update counters based on batch results
      batchResults.forEach(result => {
        processedCount++
        totalProcessedRequests++
        if (result.success) {
          successCount++
        } else {
          failedCount++
        }
      })

      // Update progress in database after each batch
      const { error: progressError } = await supabase
        .from('bulk_finder_jobs')
        .update({
          processed_requests: processedCount,
          successful_finds: successCount,
          failed_finds: failedCount,
          requests_data: requests,
          current_index: batchEnd,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        
      if (progressError) {
        console.error(`Error updating progress for job ${jobId}:`, progressError)
      }

      const successfulInBatch = batchResults.filter(r => r.success).length
      const failedInBatch = batchResults.length - successfulInBatch
      console.log(`📊 Batch completed: ${successfulInBatch}/${batchResults.length} successful, ${failedInBatch} failed`)
      console.log(`📈 Total progress: ${successCount} successful, ${failedCount} failed out of ${processedCount} processed`)
      
      // Add delay between batches to prevent overwhelming the API
      // Increase delay if we're seeing failures to give the API time to recover
      if (batchEnd < requests.length) {
        const delayMs = failedInBatch > 0 ? 1000 : 500 // Longer delay if there were failures
        console.log(`⏱️ Waiting ${delayMs}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
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
  } finally {
    // Clean up heartbeat interval
    clearInterval(heartbeatInterval)
    console.log(`Heartbeat stopped for job ${jobId}`)
    
    // Unregister job from active tracking
    unregisterActiveJob(jobId)
  }
}