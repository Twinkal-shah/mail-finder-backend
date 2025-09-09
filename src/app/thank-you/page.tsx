'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Coins, CreditCard, ArrowRight, Home, Gift } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

function ThankYouContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [paymentDetails, setPaymentDetails] = useState<{
    success: boolean
    amount?: string
    credits?: string
    plan?: string
  }>({ success: false })

  useEffect(() => {
    // Check for success parameter and other payment details
    const success = searchParams.get('success')
    const amount = searchParams.get('amount')
    const credits = searchParams.get('credits')
    const plan = searchParams.get('plan')
    
    if (success === 'true') {
      setPaymentDetails({
        success: true,
        amount: amount || undefined,
        credits: credits || undefined,
        plan: plan || undefined
      })
      
      // Show success toast
      toast.success('Payment successful! Your credits have been added to your account.')
    } else {
      // If no success parameter, redirect to credits page
      router.push('/credits')
      return
    }
    
    setIsLoading(false)
  }, [searchParams, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!paymentDetails.success) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Success Icon and Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Thank You!
            </h1>
            <p className="text-xl text-gray-600">
              Your payment has been processed successfully
            </p>
          </div>
        </div>

        {/* Payment Details Card */}
        <Card className="border-green-200 shadow-lg">
          <CardHeader className="bg-green-50 border-b border-green-200">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Gift className="h-5 w-5" />
              Payment Confirmation
            </CardTitle>
            <CardDescription className="text-green-700">
              Your purchase has been completed and credits have been added to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentDetails.amount && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Amount Paid</p>
                    <p className="font-semibold text-gray-900">${paymentDetails.amount}</p>
                  </div>
                </div>
              )}
              
              {paymentDetails.credits && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Coins className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Credits Added</p>
                    <p className="font-semibold text-gray-900">{paymentDetails.credits} credits</p>
                  </div>
                </div>
              )}
              
              {paymentDetails.plan && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg md:col-span-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Plan Activated</p>
                    <p className="font-semibold text-gray-900">{paymentDetails.plan} Plan</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* What's Next Section */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">What&apos;s Next?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>&bull; Your credits are now available in your account</li>
                <li>&bull; Start finding and verifying email addresses</li>
                <li>&bull; Check your credit balance anytime in the Credits page</li>
                <li>&bull; A receipt has been sent to your email address</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Link href="/find" className="flex items-center gap-2">
              Start Finding Emails
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg">
            <Link href="/credits" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              View Credits
            </Link>
          </Button>
          
          <Button asChild variant="ghost" size="lg">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        {/* Support Section */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            Need help? Contact our support team at{' '}
            <a href="mailto:support@mailsfinder.com" className="text-blue-600 hover:underline">
              support@mailsfinder.com
            </a>
          </p>
          <p>
            Transaction ID: {new Date().getTime()}-{Math.random().toString(36).substr(2, 9)}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ThankYouContent />
    </Suspense>
  )
}