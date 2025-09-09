export interface BulkVerificationJob {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  totalEmails: number
  processedEmails?: number
  successfulVerifications?: number
  failedVerifications?: number
  emailsData?: any[]
  errorMessage?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}