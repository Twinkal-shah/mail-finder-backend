export interface EmailData {
  email: string
  status?: 'pending' | 'processing' | 'valid' | 'invalid' | 'unknown' | 'error' | 'risky'
  confidence?: number
  [key: string]: unknown
}

export interface BulkVerificationJob {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  totalEmails: number
  processedEmails?: number
  successfulVerifications?: number
  failedVerifications?: number
  emailsData?: EmailData[]
  errorMessage?: string
  filename?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}