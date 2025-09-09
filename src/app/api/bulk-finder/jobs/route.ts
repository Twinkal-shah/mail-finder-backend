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
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = await createSupabaseClient()
    
    const { data: jobs, error } = await supabase
      .from('bulk_finder_jobs')
      .select('*')
      .eq('user_id', userId)
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
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Start background processing
    processJobInBackground(jobId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST bulk finder job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Background processing function
async function processJobInBackground(jobId: string) {
  console.log(`🚀 Starting background processing for job: ${jobId}`)
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
      return
    }

    // Update job status to processing
    await supabase
      .from('bulk_finder_jobs')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    const requests: BulkFindRequest[] = job.requests_data as BulkFindRequest[]
    let processedCount = job.processed_requests || 0
    let successCount = job.successful_finds || 0
    let failedCount = job.failed_finds || 0
    const startIndex = job.current_index || 0

    // Process each request starting from current_index
    for (let i = startIndex; i < requests.length; i++) {
      try {
        // Check if job was paused/stopped
        const { data: currentJob } = await supabase
          .from('bulk_finder_jobs')
          .select('status')
          .eq('id', jobId)
          .single()

        if (currentJob?.status === 'failed' || currentJob?.status === 'paused') {
          console.log(`Job ${jobId} was stopped/paused`)
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

        // Deduct 1 credit for this processed row directly from database
        try {
          // First get current credits
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('credits_find')
            .eq('id', job.user_id)
            .single()
          
          if (!fetchError && profile && profile.credits_find > 0) {
            const { error: creditError } = await supabase
              .from('profiles')
              .update({
                credits_find: profile.credits_find - 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', job.user_id)
            
            if (creditError) {
              console.error(`Failed to deduct credit for row ${i}:`, creditError)
            } else {
              console.log(`✅ Deducted 1 credit for row ${i}, user: ${job.user_id}, remaining: ${profile.credits_find - 1}`)
            }
          } else {
            console.log(`⚠️ No credits to deduct for row ${i}, user: ${job.user_id}`)
          }
        } catch (error) {
          console.error(`Failed to deduct credit for row ${i}:`, error)
          // Continue processing even if credit deduction fails
        }

        processedCount++

        // Update progress in database
        await supabase
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

        // Add small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error processing request ${i}:`, error)
        requests[i].status = 'failed'
        requests[i].error = 'Processing error'
        failedCount++
        processedCount++

        await supabase
          .from('bulk_finder_jobs')
          .update({
            processed_requests: processedCount,
            failed_finds: failedCount,
            requests_data: requests,
            current_index: i + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)
      }
    }

    // Mark job as completed
    await supabase
      .from('bulk_finder_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    console.log(`Bulk finder job ${jobId} completed successfully`)

  } catch (error) {
    console.error(`Error processing bulk finder job ${jobId}:`, error)
    
    // Mark job as failed
    await supabase
      .from('bulk_finder_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
  }
}