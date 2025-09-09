'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, Download, Play, Users, Clock, CheckCircle, XCircle, Pause } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { submitBulkFinderJob, getBulkFinderJobStatus, getUserBulkFinderJobs, stopBulkFinderJob } from './bulk-finder-actions'
import type { BulkFinderJob, BulkFindRequest } from './types'

interface BulkRow {
  id: string
  fullName: string
  domain: string
  role?: string
  email?: string
  confidence?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  catch_all?: boolean
  user_name?: string
  mx?: string
  error?: string
}

export default function BulkFinderPage() {
  const [rows, setRows] = useState<BulkRow[]>([])
  const [currentJob, setCurrentJob] = useState<BulkFinderJob | null>(null)
  const [jobHistory, setJobHistory] = useState<BulkFinderJob[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load user jobs on component mount
  useEffect(() => {
    loadUserJobs()
  }, [])

  // Poll current job status
  useEffect(() => {
    if (currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing')) {
      const interval = setInterval(async () => {
        const result = await getBulkFinderJobStatus(currentJob.jobId)
        if (result.success && result.job) {
          setCurrentJob(result.job)
          
          // Update rows with job data if available
            if (result.job.requestsData) {
              const updatedRows = result.job.requestsData.map((req: BulkFindRequest, index: number) => ({
               id: `row-${index}`,
               fullName: req.full_name,
               domain: req.domain,
               role: req.role,
               email: req.email,
               confidence: req.confidence,
               status: req.status || 'pending',
               catch_all: req.catch_all,
               user_name: req.user_name,
               mx: req.mx,
               error: req.error
             }))
            setRows(updatedRows)
          }
          
          // Stop polling if job is completed
          if (result.job.status === 'completed' || result.job.status === 'failed') {
            clearInterval(interval)
            loadUserJobs() // Refresh job history
            
            if (result.job.status === 'completed') {
              toast.success('Bulk finder job completed!')
            } else {
              toast.error('Bulk finder job failed')
            }
          }
        }
      }, 2000) // Poll every 2 seconds

      return () => clearInterval(interval)
    }
  }, [currentJob])

  const loadUserJobs = async () => {
    const result = await getUserBulkFinderJobs()
    if (result.success && result.jobs) {
      setJobHistory(result.jobs)
      
      // Check if there's an active job
      const activeJob = result.jobs.find(job => 
        job.status === 'pending' || job.status === 'processing'
      )
      if (activeJob) {
        setCurrentJob(activeJob)
      }
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
          const newRows: BulkRow[] = results.data
            .filter((row: any) => row['Full Name'] && row['Domain'])
            .map((row: any, index: number) => ({
              id: `row-${Date.now()}-${index}`,
              fullName: row['Full Name'] || '',
              domain: row['Domain'] || '',
              role: row['Role'] || '',
              status: 'pending' as const,
            }))
          
          setRows(newRows)
          toast.success(`Loaded ${newRows.length} rows from CSV`)
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
          
          const newRows: BulkRow[] = jsonData
            .filter((row: any) => row['Full Name'] && row['Domain'])
            .map((row: any, index: number) => ({
              id: `row-${Date.now()}-${index}`,
              fullName: row['Full Name'] || '',
              domain: row['Domain'] || '',
              role: row['Role'] || '',
              status: 'pending' as const,
            }))
          
          setRows(newRows)
          toast.success(`Loaded ${newRows.length} rows from Excel`)
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



  const submitJob = async () => {
    const validRows = rows.filter(row => row.fullName && row.domain)
    
    if (validRows.length === 0) {
      toast.error('Please add at least one valid row with Full Name and Domain')
      return
    }

    setIsSubmitting(true)

    try {
      const requests: BulkFindRequest[] = validRows.map(row => ({
        full_name: row.fullName,
        domain: row.domain,
        role: row.role
      }))

      const result = await submitBulkFinderJob(requests)
      
      if (result.success && result.jobId) {
        toast.success('Bulk finder job submitted successfully!')
        
        // Get the job details
        const jobResult = await getBulkFinderJobStatus(result.jobId)
        if (jobResult.success && jobResult.job) {
          setCurrentJob(jobResult.job)
        }
        
        // Clear the form
        setRows([])
      } else {
        toast.error(result.error || 'Failed to submit job')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const stopJob = async () => {
    if (!currentJob) return

    try {
      const result = await stopBulkFinderJob(currentJob.jobId)
      if (result.success) {
        toast.success('Job stopped successfully')
        setCurrentJob(null)
        loadUserJobs()
      } else {
        toast.error(result.error || 'Failed to stop job')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
    }
  }

  const downloadResults = (job: BulkFinderJob) => {
    if (!job.requestsData) return

    const csvData = job.requestsData.map(req => ({
      'Full Name': req.full_name,
      'Domain': req.domain,
      'Role': req.role || '',
      'Email': req.email || '',
      'Confidence': req.confidence || '',
      'Status': req.status || '',
      'Catch All': req.catch_all ? 'Yes' : 'No',
      'User Name': req.user_name || '',
      'MX': req.mx || '',
      'Error': req.error || ''
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk_finder_results_${job.jobId}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Results downloaded successfully!')
  }

  const isJobActive = currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing')
  const progressPercentage = currentJob ? 
    Math.round((currentJob.processedRequests || 0) / currentJob.totalRequests * 100) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bulk Email Finder</h1>
        <p className="text-gray-600 mt-2">
          Expected columns: Full Name and Domain. Optional: Role.
        </p>
      </div>

      {/* Current Job Status */}
      {currentJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentJob.status === 'processing' && <Clock className="h-5 w-5 animate-spin" />}
              {currentJob.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {currentJob.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
              {currentJob.status === 'pending' && <Clock className="h-5 w-5 text-yellow-600" />}
              Current Job Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Status: {currentJob.status}</span>
                <span className="text-sm text-gray-600">
                  {currentJob.processedRequests || 0} / {currentJob.totalRequests} processed
                </span>
              </div>
              
              {(currentJob.status === 'processing' || currentJob.status === 'pending') && (
                <Progress value={progressPercentage} className="w-full" />
              )}
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Successful: {currentJob.successfulFinds || 0} | Failed: {currentJob.failedFinds || 0}
                </div>
                <div className="flex gap-2">
                  {(currentJob.status === 'processing' || currentJob.status === 'pending') && (
                    <Button variant="outline" size="sm" onClick={stopJob}>
                      <Pause className="mr-2 h-4 w-4" />
                      Stop Job
                    </Button>
                  )}
                  {currentJob.status === 'completed' && (
                    <Button size="sm" onClick={() => downloadResults(currentJob)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Results
                    </Button>
                  )}
                </div>
              </div>
              
              {currentJob.errorMessage && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  Error: {currentJob.errorMessage}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Operations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div>
              <Label htmlFor="file-upload" className="sr-only">
                Upload CSV/XLSX
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
                disabled={isJobActive || isSubmitting}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV/XLSX
              </Button>
            </div>
            

            
            <Button
              onClick={submitJob}
              disabled={isJobActive || isSubmitting || rows.length === 0}
            >
              <Play className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Job'}
            </Button>
          </div>
        </CardContent>
      </Card>



      {/* Job History */}
      {jobHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>
              Your recent bulk finder jobs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobHistory.map((job) => (
                <div key={job.jobId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {job.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                    {job.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
                    {job.status === 'processing' && <Clock className="h-5 w-5 text-blue-600 animate-spin" />}
                    {job.status === 'pending' && <Clock className="h-5 w-5 text-yellow-600" />}
                    
                    <div>
                      <p className="font-medium">
                        {job.totalRequests} requests • {job.status}
                      </p>
                      <p className="text-sm text-gray-600">
                        {job.createdAt && new Date(job.createdAt).toLocaleString()}
                      </p>
                      {job.status === 'completed' && (
                        <p className="text-sm text-gray-600">
                          Found: {job.successfulFinds} • Failed: {job.failedFinds}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {job.status === 'completed' && (
                    <Button size="sm" onClick={() => downloadResults(job)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}