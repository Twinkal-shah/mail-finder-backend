'use client'

import { useQuery } from '@tanstack/react-query'
import { getUserProfileWithCredits, getTransactionHistory, getCreditUsageHistory } from '@/app/(dashboard)/credits/actions'

// Hook for user profile with credits
export function useUserProfile() {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: getUserProfileWithCredits,
    staleTime: 30 * 1000, // 30 seconds for more real-time updates
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    refetchInterval: 60 * 1000, // Auto-refetch every minute for real-time updates
    refetchIntervalInBackground: true, // Continue refetching even when tab is not active
  })
}

// Hook for transaction history
export function useTransactionHistory(limit: number = 10) {
  return useQuery({
    queryKey: ['transactionHistory', limit],
    queryFn: () => getTransactionHistory(limit),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
    retry: 2,
  })
}

// Hook for credit usage history
export function useCreditUsageHistory() {
  return useQuery({
    queryKey: ['creditUsageHistory'],
    queryFn: getCreditUsageHistory,
    staleTime: 30 * 1000, // 30 seconds for more real-time updates
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    refetchInterval: 60 * 1000, // Auto-refetch every minute for real-time updates
    refetchIntervalInBackground: true, // Continue refetching even when tab is not active
  })
}

// Combined hook for all credits data
export function useCreditsData() {
  const profileQuery = useUserProfile()
  const transactionsQuery = useTransactionHistory()
  const usageQuery = useCreditUsageHistory()

  return {
    profile: profileQuery.data,
    transactions: transactionsQuery.data || [],
    creditUsage: usageQuery.data || [],
    isLoading: profileQuery.isLoading || transactionsQuery.isLoading || usageQuery.isLoading,
    isError: profileQuery.isError || transactionsQuery.isError || usageQuery.isError,
    error: profileQuery.error || transactionsQuery.error || usageQuery.error,
    refetch: () => {
      profileQuery.refetch()
      transactionsQuery.refetch()
      usageQuery.refetch()
    }
  }
}