'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, Download, Play, Shield, AlertCircle, CheckCircle, Clock, Pause } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { verifySingleEmail, exportVerifyResults } from './actions'
import { submitBulkVerificationJob, getBulkVerificationJobStatus, getUserBulkVerificationJobs, stopBulkVerificationJob } from './bulk-actions'
import type { BulkVerificationJob } from './types'

interface VerifyRow {
  id: number
  email: string
  status: 'pending' | 'processing' | 'valid' | 'invalid' | 'risky' | 'error'
  catch_all?: boolean
  domain?: string
  mx?: string
  user_name?: string
}

export default function VerifyPage() {
  const [singleEmail, setSingleEmail] = useState('')
  const [singleResult, setSingleResult] = useState<any>(null)
  const [isVerifyingSingle, setIsVerifyingSingle] = useState(false)
  
  const [rows, setRows] = useState<VerifyRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Background job tracking
  const [currentJob, setCurrentJob] = useState<BulkVerificationJob | null>(null)
  const [allJobs, setAllJobs] = useState<BulkVerificationJob[]>([])
  const [isSubmittingJob, setIsSubmittingJob] = useState(false)

  // Poll job status every 3 seconds
  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const result = await getBulkVerificationJobStatus(jobId)
        
        if (result.success && result.job) {
          const job = result.job
          setCurrentJob(job)
          
          // Update progress
          if (job.totalEmails > 0) {
            const progressPercent = (job.processedEmails || 0) / job.totalEmails * 100
            setProgress(progressPercent)
            setProcessedCount(job.processedEmails || 0)
          }
          
          // Update rows with results if available
          if (job.emailsData && Array.isArray(job.emailsData)) {
            setRows(prevRows => {
              return prevRows.map(row => {
                const emailResult = job.emailsData?.find((result: any) => result.email === row.email)
                if (emailResult) {
                  return {
                    ...row,
                    status: emailResult.status || 'pending',
                    catch_all: emailResult.catch_all,
                    domain: emailResult.domain,
                    mx: emailResult.mx,
                    user_name: emailResult.user_name
                  }
                }
                return row
              })
            })
          }
          
          // Check if job is completed
          if (job.status === 'completed') {
            setIsProcessing(false)
            toast.success(`Bulk verification completed! ${job.successfulVerifications || 0} emails verified successfully.`)
            loadUserJobs() // Refresh job list
          } else if (job.status === 'failed') {
            setIsProcessing(false)
            toast.error(`Bulk verification failed: ${job.errorMessage || 'Unknown error'}`)
            loadUserJobs() // Refresh job list
          } else if (job.status === 'processing' || job.status === 'pending') {
            // Continue polling
            setTimeout(poll, 3000)
          }
        } else {
          console.error('Failed to get job status:', result.error)
          setTimeout(poll, 3000) // Retry after 3 seconds
        }
      } catch (error) {
        console.error('Error polling job status:', error)
        setTimeout(poll, 3000) // Retry after 3 seconds
      }
    }
    
    poll()
  }

  // Load user's bulk verification jobs
  const loadUserJobs = async () => {
    try {
      const result = await getUserBulkVerificationJobs()
      if (result.success && result.jobs) {
        setAllJobs(result.jobs)
        
        // Check if there's an active job
        const activeJob = result.jobs.find(job => job.status === 'processing' || job.status === 'pending')
        if (activeJob && !currentJob) {
          setCurrentJob(activeJob)
          setIsProcessing(true)
          pollJobStatus(activeJob.jobId)
        }
      }
    } catch (error) {
      console.error('Error loading user jobs:', error)
    }
  }

  // Load jobs on component mount
  useEffect(() => {
    loadUserJobs()
  }, [])

  // Update progress when current job changes
  useEffect(() => {
    if (currentJob && currentJob.totalEmails > 0) {
      const progressPercent = (currentJob.processedEmails || 0) / currentJob.totalEmails * 100
      setProgress(progressPercent)
      setProcessedCount(currentJob.processedEmails || 0)
    }
  }, [currentJob])

  const handleSingleVerify = async () => {
    if (!singleEmail) {
      toast.error('Please enter an email address')
      return
    }

    setIsVerifyingSingle(true)
    setSingleResult(null)

    try {
      const result = await verifySingleEmail(singleEmail)
      setSingleResult({ result })
      
      if (result.status === 'valid') {
        toast.success('Email is valid!')
      } else if (result.status === 'invalid') {
        toast.error('Email is invalid')
      } else if (result.status === 'risky') {
        toast.warning('Email is risky')
      } else if (result.status === 'error') {
        toast.error(result.error || 'Failed to verify email')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify email')
    } finally {
      setIsVerifyingSingle(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const newRows: VerifyRow[] = results.data
            .filter((row: any) => row['Email'] || row['email'])
            .map((row: any, index: number) => ({
              id: index,
              email: row['Email'] || row['email'] || '',
              status: 'pending' as const,
            }))
          
          setRows(newRows)
          toast.success(`Loaded ${newRows.length} emails from CSV`)
        },
        error: (error) => {
          toast.error('Failed to parse CSV file')
          console.error(error)
        }
      })
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          
          const newRows: VerifyRow[] = jsonData
            .filter((row: any) => row['Email'] || row['email'])
            .map((row: any, index: number) => ({
              id: index,
              email: row['Email'] || row['email'] || '',
              status: 'pending' as const,
            }))
          
          setRows(newRows)
          toast.success(`Loaded ${newRows.length} emails from Excel`)
        } catch (error) {
          toast.error('Failed to parse Excel file')
          console.error(error)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      toast.error('Please upload a CSV or Excel file')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const runBulkVerify = async () => {
    const validRows = rows.filter(row => row.email)
    
    if (validRows.length === 0) {
      toast.error('Please add at least one valid email address')
      return
    }

    setIsSubmittingJob(true)

    try {
      const emails = validRows.map(row => row.email)
      const result = await submitBulkVerificationJob(emails)
      
      if (result.success && result.jobId) {
        toast.success('Bulk verification job submitted! Processing in background...')
        
        // Create a new job object for tracking
        const newJob: BulkVerificationJob = {
          jobId: result.jobId,
          status: 'pending',
          totalEmails: emails.length,
          processedEmails: 0,
          successfulVerifications: 0,
          failedVerifications: 0
        }
        
        setCurrentJob(newJob)
        setIsProcessing(true)
        
        // Start polling for job status
        pollJobStatus(result.jobId)
      } else {
        toast.error(result.error || 'Failed to submit bulk verification job')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit bulk verification job')
    } finally {
      setIsSubmittingJob(false)
    }
  }

  const exportToCsv = async () => {
    try {
      await exportVerifyResults(rows)
      const csvData = Papa.unparse(rows)
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `email-verification-results-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Results exported to CSV')
    } catch (error) {
      toast.error('Failed to export results')
    }
  }

  const completedRows = rows.filter(row => row.status === 'valid' || row.status === 'invalid' || row.status === 'risky').length

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Verify</h1>
        <p className="text-gray-600 mt-2">
          Verify email addresses for deliverability and validity.
        </p>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <p className="text-blue-800">
              Emails found by Email Finder are already verified. You only need to use the Verifier for emails found elsewhere.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Single Email Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Single Email Verification
          </CardTitle>
          <CardDescription>
            Verify a single email address for deliverability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="single-email">Email Address</Label>
              <Input
                id="single-email"
                type="email"
                placeholder="Enter email address"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
                disabled={isVerifyingSingle}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSingleVerify}
                disabled={isVerifyingSingle || !singleEmail}
              >
                <Shield className="mr-2 h-4 w-4" />
                Verify Email
              </Button>
            </div>
          </div>
          
          {singleResult && (
            <Card className={`border-2 ${
              singleResult.result.status === 'valid' ? 'border-green-200 bg-green-50' :
              singleResult.result.status === 'invalid' ? 'border-red-200 bg-red-50' :
              singleResult.result.status === 'risky' ? 'border-yellow-200 bg-yellow-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {singleResult.result.status === 'valid' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {singleResult.result.status === 'invalid' && <AlertCircle className="h-5 w-5 text-red-600" />}
                  {singleResult.result.status === 'risky' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                  <div>
                    <p className="font-medium">
                      Status: <span className="capitalize">{singleResult.result.status === 'valid' ? 'Valid' : singleResult.result.status}</span>
                    </p>
                    {singleResult.result.reason && (
                      <p className="text-sm text-gray-600">
                        Reason: {singleResult.result.reason}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Bulk Email Verification */}
      <Card>
        <CardHeader>
          <CardTitle>Verify Your List</CardTitle>
          <CardDescription>
            Upload a CSV or Excel file with email addresses to verify in bulk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div>
              <Label htmlFor="file-upload" className="sr-only">
                Choose file
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose file
              </Button>
            </div>
            
            <Button
              onClick={runBulkVerify}
              disabled={isProcessing || rows.length === 0}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Bulk Verify
            </Button>
            

          </div>
        </CardContent>
      </Card>

      {/* Progress and Status */}
      {rows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            {isProcessing ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Verifying emails...</span>
                  <span className="text-sm text-gray-600">{processedCount} / {rows.length} completed</span>
                </div>
                <Progress value={progress} className="w-full h-3" />
                <div className="text-center text-sm text-gray-500">
                  {Math.round(progress)}% complete
                </div>
              </div>
            ) : completedRows > 0 ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-medium text-green-600">Verification Complete!</span>
                </div>
                <p className="text-sm text-gray-600">
                  Successfully verified {completedRows} out of {rows.length} emails
                </p>
                <Button
                  onClick={exportToCsv}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Results to CSV
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {rows.length} emails loaded and ready for verification
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Job Status */}
      {currentJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentJob.status === 'processing' ? (
                <Clock className="h-5 w-5 text-blue-600" />
              ) : currentJob.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Current Job Status
            </CardTitle>
            <CardDescription>
              Job ID: {currentJob.jobId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">
                  Status: <span className="capitalize">{currentJob.status}</span>
                </span>
                <span className="text-sm text-gray-600">
                  {currentJob.processedEmails || 0} / {currentJob.totalEmails} emails processed
                </span>
              </div>
              
              {currentJob.totalEmails > 0 && (
                <Progress 
                  value={((currentJob.processedEmails || 0) / currentJob.totalEmails) * 100} 
                  className="w-full h-3" 
                />
              )}
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{currentJob.successfulVerifications || 0}</p>
                  <p className="text-sm text-gray-600">Valid</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{currentJob.failedVerifications || 0}</p>
                  <p className="text-sm text-gray-600">Invalid</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{currentJob.totalEmails - (currentJob.processedEmails || 0)}</p>
                  <p className="text-sm text-gray-600">Remaining</p>
                </div>
              </div>
              
              {currentJob.status === 'processing' && (
                <div className="text-center">
                  <Button
                    onClick={async () => {
                      const result = await stopBulkVerificationJob(currentJob.jobId)
                      if (result.success) {
                        toast.success('Job stopped successfully')
                        setCurrentJob(null)
                        setIsProcessing(false)
                      } else {
                        toast.error(result.error || 'Failed to stop job')
                      }
                    }}
                    variant="destructive"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Stop Job
                  </Button>
                </div>
              )}
              
              {currentJob.status === 'completed' && currentJob.emailsData && (
                <div className="text-center">
                  <Button
                    onClick={() => {
                       const csvContent = Papa.unparse(currentJob.emailsData || [])
                       const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                       const link = document.createElement('a')
                       const url = URL.createObjectURL(blob)
                       link.setAttribute('href', url)
                       link.setAttribute('download', `bulk_verification_results_${currentJob.jobId}.csv`)
                       link.style.visibility = 'hidden'
                       document.body.appendChild(link)
                       link.click()
                       document.body.removeChild(link)
                     }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Results
                  </Button>
                </div>
              )}
              
              {currentJob.status === 'failed' && currentJob.emailsData && (currentJob.processedEmails || 0) > 0 && (
                <div className="text-center">
                  <Button
                    onClick={() => {
                       const csvContent = Papa.unparse(currentJob.emailsData || [])
                       const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                       const link = document.createElement('a')
                       const url = URL.createObjectURL(blob)
                       link.setAttribute('href', url)
                       link.setAttribute('download', `partial_verification_results_${currentJob.jobId}.csv`)
                       link.style.visibility = 'hidden'
                       document.body.appendChild(link)
                       link.click()
                       document.body.removeChild(link)
                     }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Partial Results
                  </Button>
                </div>
              )}
              
              {currentJob.errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">
                    Error: {currentJob.errorMessage}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      {allJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Job History</CardTitle>
            <CardDescription>
              Your recent bulk verification jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allJobs.map((job) => (
                 <div key={job.jobId} className="flex items-center justify-between p-3 border rounded-lg">
                   <div className="flex items-center gap-3">
                     {job.status === 'processing' ? (
                       <Clock className="h-4 w-4 text-blue-600" />
                     ) : job.status === 'completed' ? (
                       <CheckCircle className="h-4 w-4 text-green-600" />
                     ) : (
                       <AlertCircle className="h-4 w-4 text-red-600" />
                     )}
                     <div>
                       <p className="font-medium">Job {job.jobId}</p>
                       <p className="text-sm text-gray-600">
                         {job.processedEmails || 0} / {job.totalEmails} emails • {job.status}
                       </p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="text-sm text-gray-600">
                       {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'N/A'}
                     </p>
                     {job.status === 'completed' && job.emailsData && (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => {
                           const csvContent = Papa.unparse(job.emailsData || [])
                           const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                           const link = document.createElement('a')
                           const url = URL.createObjectURL(blob)
                           link.setAttribute('href', url)
                           link.setAttribute('download', `bulk_verification_results_${job.jobId}.csv`)
                           link.style.visibility = 'hidden'
                           document.body.appendChild(link)
                           link.click()
                           document.body.removeChild(link)
                         }}
                         className="mt-1"
                       >
                         <Download className="h-3 w-3" />
                       </Button>
                     )}
                   </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}