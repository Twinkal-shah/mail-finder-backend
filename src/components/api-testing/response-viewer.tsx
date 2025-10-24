'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Check, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApiResponse } from '@/types/api-testing'

interface ResponseViewerProps {
  response: ApiResponse | null
  className?: string
}

export function ResponseViewer({ response, className }: ResponseViewerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadResponse = () => {
    if (!response) return

    const dataStr = JSON.stringify(response, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `api-response-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-500'
    if (status >= 300 && status < 400) return 'bg-yellow-500'
    if (status >= 400 && status < 500) return 'bg-orange-500'
    if (status >= 500) return 'bg-red-500'
    return 'bg-gray-500'
  }

  const formatJson = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  if (!response) {
    return (
      <Card className={cn("h-full", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No response yet. Send a request to see the response here.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Response</CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn("text-white", getStatusColor(response.status))}
            >
              {response.status} {response.statusText}
            </Badge>
            <Badge variant="outline">
              {response.duration}ms
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadResponse}
              className="h-8"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="body" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="body">Response Body</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="body" className="space-y-2">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(formatJson(response.data), 'body')}
                className="h-8"
              >
                {copiedField === 'body' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span className="ml-1">Copy</span>
              </Button>
            </div>
            <div className="bg-muted rounded-md p-4 max-h-96 overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {formatJson(response.data)}
              </pre>
            </div>
          </TabsContent>
          
          <TabsContent value="headers" className="space-y-2">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(formatJson(response.headers), 'headers')}
                className="h-8"
              >
                {copiedField === 'headers' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span className="ml-1">Copy</span>
              </Button>
            </div>
            <div className="bg-muted rounded-md p-4 max-h-96 overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {formatJson(response.headers)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}