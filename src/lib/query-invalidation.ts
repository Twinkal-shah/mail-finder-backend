'use client'

import { useQueryClient } from '@tanstack/react-query'

// Hook to get query invalidation functions
export function useQueryInvalidation() {
  const queryClient = useQueryClient()

  const invalidateCreditsData = () => {
    // Invalidate all credit-related queries for immediate updates
    queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    queryClient.invalidateQueries({ queryKey: ['creditUsageHistory'] })
    queryClient.invalidateQueries({ queryKey: ['transactionHistory'] })
  }

  const invalidateUserProfile = () => {
    queryClient.invalidateQueries({ queryKey: ['userProfile'] })
  }

  const invalidateCreditUsage = () => {
    queryClient.invalidateQueries({ queryKey: ['creditUsageHistory'] })
  }

  return {
    invalidateCreditsData,
    invalidateUserProfile,
    invalidateCreditUsage,
  }
}

// Utility function to invalidate queries from server actions
export function invalidateCreditsQueries() {
  // This will be used in server actions to trigger client-side invalidation
  // The actual invalidation will happen on the client side when the component re-renders
  return {
    shouldInvalidate: true,
    timestamp: Date.now()
  }
}