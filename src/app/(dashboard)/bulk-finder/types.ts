export interface BulkFindRequest {
  full_name: string
  domain: string
  role?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  email?: string
  confidence?: number
  catch_all?: boolean
  user_name?: string
  mx?: string
  error?: string
  [key: string]: unknown // Allow additional fields from original CSV
}

export interface BulkFinderJob {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  totalRequests: number
  processedRequests?: number
  successfulFinds?: number
  failedFinds?: number
  requestsData?: BulkFindRequest[]
  errorMessage?: string
  filename?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}