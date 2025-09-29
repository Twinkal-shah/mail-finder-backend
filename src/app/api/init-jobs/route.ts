import { NextResponse } from 'next/server'
import { initializeJobPersistence } from '@/lib/job-persistence'

export async function POST() {
  try {
    await initializeJobPersistence()
    return NextResponse.json({ success: true, message: 'Job persistence initialized' })
  } catch (error) {
    console.error('Error initializing job persistence:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to initialize job persistence' },
      { status: 500 }
    )
  }
}