import { NextRequest, NextResponse } from 'next/server'
import { verifyLemonSqueezyWebhook, handleLemonSqueezyWebhook } from '@/lib/services/lemonsqueezy'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-signature')
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

    if (!signature || !secret) {
      console.error('Missing webhook signature or secret')
      return NextResponse.json(
        { error: 'Missing webhook signature or secret' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    const isValid = verifyLemonSqueezyWebhook(body, signature, secret)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    // Parse webhook event
    const event = JSON.parse(body)
    
    // Handle the webhook event
    await handleLemonSqueezyWebhook(event)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// Handle GET requests (for webhook verification)
export async function GET() {
  return NextResponse.json({ message: 'Lemon Squeezy webhook endpoint' })
}