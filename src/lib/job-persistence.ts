import { createClient } from '@supabase/supabase-js'

// Store for tracking active job processes
const activeJobs = new Map<string, NodeJS.Timeout>()

export function createSupabaseClient() {
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
 * Initialize job persistence on application startup
 * This will resume any jobs that were running when the application was shut down
 */
export async function initializeJobPersistence() {
  console.log('Initializing job persistence...')
  
  const supabase = createSupabaseClient()
  
  try {
    // Find all jobs that are currently in 'processing' state
    const { data: processingJobs, error } = await supabase
      .from('bulk_finder_jobs')
      .select('id, updated_at')
      .eq('status', 'processing')
    
    if (error) {
      console.error('Error fetching processing jobs:', error)
      return
    }
    
    if (processingJobs && processingJobs.length > 0) {
      console.log(`Found ${processingJobs.length} jobs to resume`)
      
      for (const job of processingJobs) {
        const lastUpdate = new Date(job.updated_at)
        const now = new Date()
        const timeDiff = now.getTime() - lastUpdate.getTime()
        
        // If job hasn't been updated in the last 2 minutes, consider it stuck
        if (timeDiff > 2 * 60 * 1000) {
          console.log(`Resetting stuck job ${job.id} to pending status`)
          
          // Reset job to pending - it will be picked up by normal job processing
          await supabase
            .from('bulk_finder_jobs')
            .update({ 
              status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id)
        } else {
          console.log(`Job ${job.id} appears to be running normally`)
        }
      }
    } else {
      console.log('No processing jobs found to resume')
    }

    // Now process all pending jobs
    await processPendingJobs()
  } catch (error) {
    console.error('Error initializing job persistence:', error)
  }
}

/**
 * Process all pending jobs
 */
export async function processPendingJobs() {
  console.log('Checking for pending jobs to process...')
  
  const supabase = createSupabaseClient()
  
  try {
    // Find all jobs that are in 'pending' state
    const { data: pendingJobs, error } = await supabase
      .from('bulk_finder_jobs')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }) // Process oldest jobs first
    
    if (error) {
      console.error('Error fetching pending jobs:', error)
      return
    }
    
    if (pendingJobs && pendingJobs.length > 0) {
      console.log(`Found ${pendingJobs.length} pending jobs to process`)
      
      // Import the processing function dynamically to avoid circular imports
      const { processJobInBackground } = await import('./bulk-finder-processor')
      
      for (const job of pendingJobs) {
        console.log(`Starting processing for pending job ${job.id}`)
        
        // Start background processing without waiting for it to complete
        processJobInBackground(job.id).catch(error => {
          console.error(`Error processing pending job ${job.id}:`, error)
        })
        
        // Add a small delay between starting jobs to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } else {
      console.log('No pending jobs found to process')
    }
  } catch (error) {
    console.error('Error processing pending jobs:', error)
  }
}

/**
 * Register a job as active in the current process
 */
export function registerActiveJob(jobId: string) {
  console.log(`Registering active job: ${jobId}`)
  activeJobs.set(jobId, setTimeout(() => {}, 0)) // Placeholder timeout
}

/**
 * Unregister a job when it completes
 */
export function unregisterActiveJob(jobId: string) {
  console.log(`Unregistering active job: ${jobId}`)
  const timeout = activeJobs.get(jobId)
  if (timeout) {
    clearTimeout(timeout)
    activeJobs.delete(jobId)
  }
}

/**
 * Get list of currently active jobs in this process
 */
export function getActiveJobs(): string[] {
  return Array.from(activeJobs.keys())
}

/**
 * Graceful shutdown handler to mark jobs as pending for restart
 */
export async function gracefulShutdown() {
  console.log('Performing graceful shutdown...')
  
  const supabase = createSupabaseClient()
  const activeJobIds = getActiveJobs()
  
  if (activeJobIds.length > 0) {
    console.log(`Marking ${activeJobIds.length} active jobs as pending for restart`)
    
    try {
      await supabase
        .from('bulk_finder_jobs')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .in('id', activeJobIds)
        .eq('status', 'processing')
      
      console.log('Jobs marked for restart successfully')
    } catch (error) {
      console.error('Error marking jobs for restart:', error)
    }
  }
  
  // Clear all active job tracking
  activeJobs.clear()
}

// Set up process event handlers for graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
  process.on('beforeExit', gracefulShutdown)
}