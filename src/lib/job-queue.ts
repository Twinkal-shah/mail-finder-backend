import { createClient } from '@supabase/supabase-js'
import { processJobInBackground } from './bulk-finder-processor'

// Job queue for managing background processing
class JobQueue {
  private static instance: JobQueue
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  private constructor() {
    this.startProcessing()
  }

  public static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue()
    }
    return JobQueue.instance
  }

  /**
   * Start the job queue processing loop
   */
  private startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }

    // Check for pending jobs every 10 seconds
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processPendingJobs()
      }
    }, 10000)

    // Process immediately on startup
    this.processPendingJobs()
  }

  /**
   * Process all pending jobs in the queue
   */
  private async processPendingJobs() {
    if (this.isProcessing) return

    this.isProcessing = true
    
    try {
      console.log('Job queue: Checking for pending jobs...')
      
      // Get all pending jobs ordered by creation time
      const { data: pendingJobs, error } = await this.supabase
        .from('bulk_finder_jobs')
        .select('id, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(5) // Process max 5 jobs at once

      if (error) {
        console.error('Job queue: Error fetching pending jobs:', error)
        return
      }

      if (pendingJobs && pendingJobs.length > 0) {
        console.log(`Job queue: Found ${pendingJobs.length} pending jobs`)
        
        // Process each job
        for (const job of pendingJobs) {
          try {
            console.log(`Job queue: Starting job ${job.id}`)
            
            // Start processing without waiting for completion
            processJobInBackground(job.id).catch(error => {
              console.error(`Job queue: Error processing job ${job.id}:`, error)
            })
            
            // Small delay between starting jobs
            await new Promise(resolve => setTimeout(resolve, 1000))
            
          } catch (error) {
            console.error(`Job queue: Error starting job ${job.id}:`, error)
          }
        }
      }
      
    } catch (error) {
      console.error('Job queue: Error in processPendingJobs:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Add a job to the queue
   */
  public async addJob(jobId: string) {
    console.log(`Job queue: Adding job ${jobId} to queue`)
    
    try {
      // Update job status to pending if it's not already
      const { error } = await this.supabase
        .from('bulk_finder_jobs')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .in('status', ['pending', 'failed']) // Only update if pending or failed

      if (error) {
        console.error(`Job queue: Error adding job ${jobId}:`, error)
        return false
      }

      // Trigger immediate processing check
      setTimeout(() => this.processPendingJobs(), 100)
      
      return true
    } catch (error) {
      console.error(`Job queue: Error adding job ${jobId}:`, error)
      return false
    }
  }

  /**
   * Recover stuck jobs (jobs that have been processing for too long)
   */
  public async recoverStuckJobs() {
    console.log('Job queue: Recovering stuck jobs...')
    
    try {
      // Find jobs that have been processing for more than 5 minutes without heartbeat
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data: stuckJobs, error } = await this.supabase
        .from('bulk_finder_jobs')
        .select('*')
        .eq('status', 'processing')
        .lt('updated_at', fiveMinutesAgo)

      if (error) {
        console.error('Job queue: Error finding stuck jobs:', error)
        return
      }

      if (stuckJobs && stuckJobs.length > 0) {
        console.log(`Job queue: Found ${stuckJobs.length} stuck jobs, recovering...`)
        
        for (const job of stuckJobs) {
          // Check if job has partial progress
          const currentIndex = job.current_index || 0
          const totalRequests = job.requests?.length || 0
          
          if (currentIndex > 0 && currentIndex < totalRequests) {
            console.log(`Job queue: Resuming job ${job.id} from index ${currentIndex}`)
            // Resume from where it left off
            await this.supabase
              .from('bulk_finder_jobs')
              .update({ 
                status: 'pending',
                updated_at: new Date().toISOString()
              })
              .eq('id', job.id)
          } else {
            console.log(`Job queue: Resetting job ${job.id} to start from beginning`)
            // Reset job to pending status
            await this.supabase
              .from('bulk_finder_jobs')
              .update({ 
                status: 'pending',
                current_index: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', job.id)
          }
        }
        
        // Process the recovered jobs
        setTimeout(() => this.processPendingJobs(), 100)
      } else {
        console.log('Job queue: No stuck jobs found')
      }
    } catch (error) {
      console.error('Job queue: Error in recoverStuckJobs:', error)
    }
  }

  /**
   * Stop the job queue
   */
  public stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    this.isProcessing = false
    console.log('Job queue: Stopped')
  }

  /**
   * Get queue status
   */
  public async getQueueStatus() {
    try {
      const { data: pendingJobs, error: pendingError } = await this.supabase
        .from('bulk_finder_jobs')
        .select('id')
        .eq('status', 'pending')

      const { data: processingJobs, error: processingError } = await this.supabase
        .from('bulk_finder_jobs')
        .select('id')
        .eq('status', 'processing')

      if (pendingError || processingError) {
        console.error('Job queue: Error getting queue status:', pendingError || processingError)
        return null
      }

      return {
        pending: pendingJobs?.length || 0,
        processing: processingJobs?.length || 0,
        isActive: this.processingInterval !== null
      }
    } catch (error) {
      console.error('Job queue: Error getting queue status:', error)
      return null
    }
  }
}

// Initialize the job queue singleton
let jobQueue: JobQueue | null = null

export function getJobQueue(): JobQueue {
  if (!jobQueue) {
    jobQueue = JobQueue.getInstance()
  }
  return jobQueue
}

// Auto-start job queue and recovery on module load
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const queue = getJobQueue()
  
  // Recover stuck jobs on startup
  setTimeout(() => {
    queue.recoverStuckJobs()
  }, 5000) // Wait 5 seconds after startup
  
  // Set up periodic stuck job recovery (every 5 minutes)
  setInterval(() => {
    queue.recoverStuckJobs()
  }, 5 * 60 * 1000)
}

export default JobQueue