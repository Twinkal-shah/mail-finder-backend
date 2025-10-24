import { NextRequest, NextResponse } from 'next/server'
import { getJobQueue } from '@/lib/job-queue'

export async function GET() {
  try {
    const jobQueue = getJobQueue()
    const status = await jobQueue.getQueueStatus()
    
    return NextResponse.json({ 
      success: true, 
      status,
      message: 'Job queue is running' 
    })
  } catch (error) {
    console.error('Error getting job queue status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get job queue status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, jobId } = body
    
    const jobQueue = getJobQueue()
    
    switch (action) {
      case 'recover':
        await jobQueue.recoverStuckJobs()
        return NextResponse.json({ 
          success: true, 
          message: 'Stuck jobs recovery initiated' 
        })
        
      case 'add':
        if (!jobId) {
          return NextResponse.json(
            { success: false, error: 'Job ID is required for add action' },
            { status: 400 }
          )
        }
        
        const success = await jobQueue.addJob(jobId)
        return NextResponse.json({ 
          success, 
          message: success ? 'Job added to queue' : 'Failed to add job to queue' 
        })
        
      case 'status':
        const status = await jobQueue.getQueueStatus()
        return NextResponse.json({ 
          success: true, 
          status 
        })
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in job queue API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}