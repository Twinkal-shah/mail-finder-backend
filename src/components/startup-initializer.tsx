'use client'

import { useEffect } from 'react'

export function StartupInitializer() {
  useEffect(() => {
    // Initialize job queue on client side
    const initializeJobQueue = async () => {
      try {
        const response = await fetch('/api/job-queue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'recover' }),
        })
        
        if (response.ok) {
          console.log('Job queue initialized successfully')
        } else {
          console.warn('Failed to initialize job queue:', response.statusText)
        }
      } catch (error) {
        console.warn('Error initializing job queue:', error)
      }
    }

    // Initialize after a short delay to ensure the app is ready
    const timer = setTimeout(initializeJobQueue, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  return null // This component doesn't render anything
}