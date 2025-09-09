import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyEmail } from '@/lib/services/email-verifier'
import { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create Supabase client with service role for background processing
function createServiceClient() {
  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      get() { return undefined },
      set() {},
      remove() {},
    },
  })
}

// POST: Process a specific bulk verification job in the background
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/bulk-verify/process called')
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    console.log('Processing job ID:', jobId)

    if (!jobId) {
      console.error('No job ID provided')
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Start processing in the background (don't await)
    console.log('Starting background processing for job:', jobId)
    processJobInBackground(jobId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error starting background processing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processJobInBackground(jobId: string) {
  console.log('processJobInBackground called for job:', jobId)
  // Use setTimeout to ensure this runs in the background
  setTimeout(() => {
    console.log('Starting processJob for:', jobId)
    processJob(jobId).catch(error => {
      console.error('Error in processJob:', error)
    })
  }, 100)
}

async function processJob(jobId: string) {
  console.log('processJob started for job:', jobId)
  const supabase = createServiceClient()
  
  try {
    console.log('Fetching job details for:', jobId)
    // Get the job details
    const { data: job, error: jobError } = await supabase
      .from('bulk_verification_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('Job not found:', jobError)
      return
    }

    console.log('Job found:', job.id, 'Status:', job.status, 'Total emails:', job.total_emails)

    // Update job status to processing
    console.log('Updating job status to processing')
    await updateJobProgress(supabase, jobId, {
      status: 'processing',
      updated_at: new Date().toISOString()
    })

    const emails = job.emails_data || []
    let processedCount = job.processed_emails || 0
    let successfulCount = job.successful_verifications || 0
    let failedCount = job.failed_verifications || 0
    const updatedEmailsData = [...emails]

    // Process emails one by one
    for (let i = processedCount; i < emails.length; i++) {
      const emailData = emails[i]
      
      try {
        // Check credits before processing each email
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('credits_find, credits_verify')
          .eq('id', job.user_id)
          .single()
        
        if (profileError || !profile) {
          console.error(`Failed to get profile for credit check: ${emailData.email || emailData}`, profileError)
          // Mark job as failed due to profile access error
          await updateJobProgress(supabase, jobId, {
            status: 'failed',
            error_message: 'Failed to access user profile for credit verification',
            updated_at: new Date().toISOString()
          })
          return
        }
        
        const currentFindCredits = profile.credits_find || 0
        const currentVerifyCredits = profile.credits_verify || 0
        const totalCredits = currentFindCredits + currentVerifyCredits
        
        // Stop processing if no credits available
        if (totalCredits < 1) {
          console.log(`Stopping bulk verification - insufficient credits (${totalCredits} available)`)
          // Mark job as failed with specific insufficient credits message
          await updateJobProgress(supabase, jobId, {
            status: 'failed',
            error_message: 'You don\'t have enough credits to continue verification. Please purchase additional credits or upgrade your plan to proceed.',
            processed_emails: processedCount,
            successful_verifications: successfulCount,
            failed_verifications: failedCount,
            emails_data: updatedEmailsData,
            updated_at: new Date().toISOString()
          })
          return
        }
        
        // Verify the email - handle both emailData.email and emailData directly
        const emailToVerify = emailData.email || emailData
        const result = await verifyEmail({ email: emailToVerify })
        
        // Update email data with result
        updatedEmailsData[i] = {
          ...emailData,
          status: result.status,
          catch_all: result.catch_all,
          domain: result.domain,
          mx: result.mx,
          user_name: result.user_name
        }

        // Deduct credits for any verification attempt (including errors)
         // User should be charged for every verification attempt made
         try {
           // Deduct from verify credits first, then find credits if needed
           const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
           
           if (currentVerifyCredits >= 1) {
             updateData.credits_verify = currentVerifyCredits - 1
           } else {
             updateData.credits_verify = 0
             updateData.credits_find = currentFindCredits - 1
           }
           
           const { error: updateError } = await supabase
             .from('profiles')
             .update(updateData)
             .eq('id', job.user_id)
           
           if (updateError) {
             console.error(`Failed to deduct credit for email: ${emailToVerify}`, updateError)
           } else {
             console.log(`Successfully deducted 1 credit for email: ${emailToVerify}`)
             
             // Log the transaction
             await supabase
               .from('transactions')
               .insert({
                 user_id: job.user_id,
                 product_type: 'email_verify',
                 amount: 0, // No monetary amount for credit usage
                 credits_find_added: -1, // Negative for credit deduction
                 status: 'completed',
                 metadata: {
                   email: emailToVerify,
                   domain: result.domain,
                   result: result.status,
                   bulk: true
                 }
               })
           }
         } catch (creditError) {
           console.error(`Error deducting credit for email ${emailToVerify}:`, creditError)
         }
        
        // Count results based on verification status
        if (result.status === 'valid') {
          successfulCount++
        } else {
          failedCount++
        }

        processedCount++

        // Update progress every 10 emails or at the end
        if (processedCount % 10 === 0 || processedCount === emails.length) {
          await updateJobProgress(supabase, jobId, {
            processed_emails: processedCount,
            successful_verifications: successfulCount,
            failed_verifications: failedCount,
            emails_data: updatedEmailsData,
            updated_at: new Date().toISOString()
          })
        }

        // Add a small delay to prevent overwhelming the verification service
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error verifying email ${emailData.email}:`, error)
        
        // Mark email as error
        updatedEmailsData[i] = {
          ...emailData,
          status: 'error'
        }
        failedCount++
        processedCount++
      }
    }

    // Credits are already deducted individually for each verified email above

    // Mark job as completed
    await updateJobProgress(supabase, jobId, {
      status: 'completed',
      processed_emails: processedCount,
      successful_verifications: successfulCount,
      failed_verifications: failedCount,
      emails_data: updatedEmailsData,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    console.log(`Bulk verification job ${jobId} completed successfully`)

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error)
    
    // Mark job as failed
    await updateJobProgress(supabase, jobId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error occurred',
      updated_at: new Date().toISOString()
    })
  }
}

async function updateJobProgress(supabase: SupabaseClient, jobId: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from('bulk_verification_jobs')
    .update(updates)
    .eq('id', jobId)

  if (error) {
    console.error('Error updating job progress:', error)
  }
}