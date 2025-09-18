import { createServiceRoleClient } from '@/lib/supabase'
import crypto from 'crypto'
import { SupabaseClient } from '@supabase/supabase-js'

// Environment variable validation
function validateLemonSqueezyConfig() {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  
  const missing = []
  if (!apiKey) missing.push('LEMONSQUEEZY_API_KEY')
  if (!storeId) missing.push('LEMONSQUEEZY_STORE_ID')
  if (!webhookSecret) missing.push('LEMONSQUEEZY_WEBHOOK_SECRET')
  
  if (missing.length > 0) {
    throw new Error(`Missing LemonSqueezy environment variables: ${missing.join(', ')}`)
  }
  
  return { apiKey, storeId, webhookSecret }
}

export interface LemonSqueezyCheckoutData {
  productId: string
  variantId: string
  customPrice?: number
  customData?: Record<string, unknown>
}

export interface LemonSqueezyCheckoutResponse {
  url: string
  checkoutId: string
}

export interface LemonSqueezyPortalResponse {
  url: string
}

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string
    [key: string]: unknown
  }
  data: {
    id: string
    attributes: {
      user_email?: string
      customer_id?: string
      status?: string
      total?: number
      product_name?: string
      ends_at?: string
      custom_data?: {
        user_id?: string
        credits?: number
        [key: string]: unknown
      }
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

// Create LemonSqueezy checkout session
export async function createLemonSqueezyCheckout(
  data: LemonSqueezyCheckoutData,
  userId: string
): Promise<LemonSqueezyCheckoutResponse> {
  try {
    // Validate environment variables
    const { apiKey, storeId } = validateLemonSqueezyConfig()

    // Create checkout session with LemonSqueezy API
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            ...(data.customPrice && {
              custom_price: data.customPrice * 100, // Convert to cents
            }),
            product_options: {
              enabled_variants: [parseInt(data.variantId, 10)],
              redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/thank-you?success=true&plan=${encodeURIComponent(String(data.customData?.plan_name || 'Unknown'))}&credits=${encodeURIComponent(String((Number(data.customData?.find_credits || 0) + Number(data.customData?.verify_credits || 0))))}&amount=${data.customPrice || 0}`,
              receipt_link_url: `${process.env.NEXT_PUBLIC_APP_URL}/thank-you?success=true`,
              receipt_thank_you_note: 'Thank you for your purchase! Your credits have been added to your account.',
            },
            checkout_options: {
              embed: false,
              media: true,
              logo: true,
            },
            checkout_data: {
              custom: {
                user_id: userId,
                ...(data.customData && Object.fromEntries(
                  Object.entries(data.customData).map(([key, value]) => [
                    key,
                    typeof value === 'number' ? value.toString() : value
                  ])
                )),
              },
            },
            preview: false,
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: storeId,
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: data.variantId,
              },
            },
          },
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('LemonSqueezy checkout error:', {
        status: response.status,
        statusText: response.statusText,
        errorData: JSON.stringify(errorData, null, 2)
      })
      throw new Error(`Failed to create checkout session: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    return {
      url: result.data.attributes.url,
      checkoutId: result.data.id,
    }
  } catch (error) {
    console.error('LemonSqueezy checkout error:', error)
    throw new Error('Failed to create checkout session')
  }
}

// Create LemonSqueezy customer portal session
export async function createLemonSqueezyPortal(
  customerId: string
): Promise<LemonSqueezyPortalResponse> {
  try {
    // First, try to get stored portal URL from user profile
    const supabase = createServiceRoleClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('lemonsqueezy_portal_url')
      .eq('lemonsqueezy_customer_id', customerId)
      .single()
    
    if (profile?.lemonsqueezy_portal_url) {
      console.log('Using stored portal URL for customer:', customerId)
      return {
        url: profile.lemonsqueezy_portal_url
      }
    }
    
    console.log('No stored portal URL found, fetching from LemonSqueezy API for customer:', customerId)
    
    // Validate environment variables
    const { apiKey } = validateLemonSqueezyConfig()

    // First try to get customer data directly
    const customerResponse = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    
    if (customerResponse.ok) {
      const customerData = await customerResponse.json()
      const customerPortalUrl = customerData.data?.attributes?.urls?.customer_portal
      
      if (customerPortalUrl) {
        console.log('Found customer portal URL in customer data:', customerPortalUrl)
        
        // Store the portal URL for future use
        await supabase
          .from('profiles')
          .update({ lemonsqueezy_portal_url: customerPortalUrl })
          .eq('lemonsqueezy_customer_id', customerId)
        
        return {
          url: customerPortalUrl
        }
      }
    }

    // If no portal URL in customer data, try getting subscriptions
    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions?filter[customer_id]=${customerId}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('LemonSqueezy API error:', response.status, errorData)
      throw new Error('Failed to get customer information')
    }

    const subscriptions = await response.json()
    
    if (subscriptions.data.length === 0) {
      throw new Error('No active subscriptions found for customer')
    }

    // Get the first subscription's customer portal URL
    const subscription = subscriptions.data[0]
    const customerPortalUrl = subscription.attributes?.urls?.customer_portal
    
    if (!customerPortalUrl) {
      throw new Error('Customer portal URL not available')
    }

    console.log('Found customer portal URL in subscription data:', customerPortalUrl)
    
    // Store the portal URL for future use
    await supabase
      .from('profiles')
      .update({ lemonsqueezy_portal_url: customerPortalUrl })
      .eq('lemonsqueezy_customer_id', customerId)

    // Return the actual LemonSqueezy customer portal URL
    return {
      url: customerPortalUrl,
    }
  } catch (error) {
    console.error('LemonSqueezy portal error:', error)
    throw new Error('Failed to create portal session')
  }
}

// Helper function to get customer portal URL from webhook data or API
async function getCustomerPortalUrl(customerId: string, eventData: Record<string, unknown>): Promise<string | null> {
  try {
    // First try to extract from webhook data
    const urls = (eventData as Record<string, unknown>).urls as Record<string, unknown> | undefined
    const portalUrl = urls?.customer_portal as string | undefined
    if (portalUrl) {
      console.log('Found customer portal URL in webhook data:', portalUrl)
      return portalUrl
    }

    // If not in webhook data, fetch from LemonSqueezy API
    const apiKey = process.env.LEMONSQUEEZY_API_KEY
    if (!apiKey) {
      console.warn('LemonSqueezy API key not available, cannot fetch portal URL')
      return null
    }

    console.log('Fetching customer portal URL from API for customer:', customerId)
    
    // Try to get customer data first
    const customerResponse = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    
    if (customerResponse.ok) {
      const customerData = await customerResponse.json()
      const customerPortalUrl = customerData.data?.attributes?.urls?.customer_portal
      
      if (customerPortalUrl) {
        console.log('Found customer portal URL in customer data:', customerPortalUrl)
        return customerPortalUrl
      }
    }

    // If no portal URL in customer data, try getting subscriptions
    const subscriptionsResponse = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions?filter[customer_id]=${customerId}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (subscriptionsResponse.ok) {
      const subscriptions = await subscriptionsResponse.json()
      if (subscriptions.data.length > 0) {
        const subscriptionPortalUrl = subscriptions.data[0].attributes?.urls?.customer_portal
        if (subscriptionPortalUrl) {
          console.log('Found customer portal URL in subscription data:', subscriptionPortalUrl)
          return subscriptionPortalUrl
        }
      }
    }

    console.warn('Could not find customer portal URL for customer:', customerId)
    return null
  } catch (error) {
    console.error('Error fetching customer portal URL:', error)
    return null
  }
}

// Verify LemonSqueezy webhook signature
export function verifyLemonSqueezyWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const digest = hmac.digest('hex')
    
    // Remove any prefix like 'sha256=' if present
    const cleanSignature = signature.replace(/^sha256=/, '')
    
    // Ensure both buffers have the same length
    if (cleanSignature.length !== digest.length) {
      console.error('Signature length mismatch:', { signatureLength: cleanSignature.length, digestLength: digest.length })
      return false
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(digest, 'hex')
    )
  } catch (error) {
    console.error('Webhook verification error:', error)
    return false
  }
}

// Handle LemonSqueezy webhook events
export async function handleLemonSqueezyWebhook(event: LemonSqueezyWebhookEvent) {
  const supabase = createServiceRoleClient()
  
  try {
    const userId = event.data.attributes.custom_data?.user_id
    if (!userId) {
      console.error('No user_id found in webhook event')
      return
    }

    // Create transaction record first
    const transactionData = {
      user_id: userId,
      lemonsqueezy_order_id: event.data.id,
      lemonsqueezy_subscription_id: event.data.attributes.subscription_id || null,
      product_name: event.data.attributes.product_name || 'Unknown Product',
      product_type: determineProductType(event.meta.event_name, event.data.attributes),
      amount: (event.data.attributes.total || 0) / 100, // Convert from cents
      credits_find_added: event.data.attributes.custom_data?.find_credits || 0,
      credits_verify_added: event.data.attributes.custom_data?.verify_credits || 0,
      status: determineTransactionStatus(event.meta.event_name),
      webhook_event: event.meta.event_name,
      metadata: {
        event_data: event.data.attributes,
        processed_at: new Date().toISOString()
      }
    }

    // Insert transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single()

    if (transactionError) {
      console.error('Error creating transaction record:', transactionError)
      throw transactionError
    }

    console.log('Transaction recorded:', transaction.id)

    switch (event.meta.event_name) {
      case 'subscription_created':
      case 'subscription_updated':
        await handleSubscriptionEvent(supabase, event, transaction)
        break
        
      case 'subscription_cancelled':
      case 'subscription_expired':
        await handleSubscriptionCancellation(supabase, event, transaction)
        break
        
      case 'order_created':
        await handleOrderCreated(supabase, event, transaction)
        break
        
      case 'subscription_payment_success':
        await handleSubscriptionPayment(supabase, event, transaction)
        break
        
      case 'subscription_payment_failed':
        await handlePaymentFailure(supabase, event, transaction)
        break
        
      default:
        console.log('Unhandled LemonSqueezy event:', event.meta.event_name)
        // Update transaction status to completed for unhandled events
        await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('id', transaction.id)
    }
  } catch (error) {
    console.error('Error handling LemonSqueezy webhook:', error)
    throw error
  }
}

// Helper function to determine product type
function determineProductType(eventName: string, attributes: Record<string, unknown>): string {
  if (eventName.includes('subscription')) {
    return 'subscription'
  }
  const customData = attributes.custom_data as Record<string, unknown> | undefined;
  if (customData?.product_type === 'lifetime') {
    return 'lifetime'
  }
  if (customData?.find_credits || customData?.verify_credits) {
    return 'credit_pack'
  }
  return 'credit_pack' // Default fallback
}

// Helper function to determine transaction status
function determineTransactionStatus(eventName: string): string {
  switch (eventName) {
    case 'order_created':
    case 'subscription_created':
    case 'subscription_payment_success':
      return 'completed'
    case 'subscription_payment_failed':
      return 'failed'
    case 'order_refunded':
      return 'refunded'
    default:
      return 'pending'
  }
}

// Handle subscription events (created/updated)
interface TransactionData {
  id: string;
  credits_find_added?: number;
  credits_verify_added?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

async function handleSubscriptionEvent(supabase: SupabaseClient, event: LemonSqueezyWebhookEvent, transaction: TransactionData) {
  const userId = event.data.attributes.custom_data?.user_id
  const subscriptionData = event.data.attributes
  
  // Determine plan name from product
  let planName = 'pro'
  if (subscriptionData.product_name?.toLowerCase().includes('agency')) {
    planName = 'agency'
  } else if (subscriptionData.product_name?.toLowerCase().includes('lifetime')) {
    planName = 'lifetime'
  }

  // Get current profile to add credits
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_find, credits_verify')
    .eq('id', userId)
    .single()

  const currentFindCredits = profile?.credits_find || 0
  const currentVerifyCredits = profile?.credits_verify || 0
  const newFindCredits = currentFindCredits + (transaction.credits_find_added ?? 0)
  const newVerifyCredits = currentVerifyCredits + (transaction.credits_verify_added ?? 0)

  // Extract customer_id from multiple possible locations
  const customerId = (subscriptionData as Record<string, unknown>).customer_id as string | undefined || 
                    ((subscriptionData as Record<string, unknown>).event_data as Record<string, unknown> | undefined)?.customer_id as string | undefined || 
                    ((transaction.metadata as Record<string, unknown> | undefined)?.event_data as Record<string, unknown> | undefined)?.customer_id as string | undefined

  // Extract customer portal URL from webhook data or fetch it
  const customerPortalUrl = customerId ? await getCustomerPortalUrl(customerId, subscriptionData) : null

  // Update user profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      plan: planName,
      plan_expiry: subscriptionData.ends_at,
      credits_find: newFindCredits,
      credits_verify: newVerifyCredits,
      lemonsqueezy_customer_id: customerId,
      lemonsqueezy_portal_url: customerPortalUrl, // Store the portal URL directly
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileError) {
    console.error('Error updating profile for subscription:', profileError)
    throw profileError
  }

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ status: 'completed' })
    .eq('id', transaction.id)

  console.log(`Subscription ${event.meta.event_name} processed for user ${userId}`, {
    customer_id: subscriptionData.customer_id,
    portal_url: customerPortalUrl ? 'saved' : 'not_available'
  })
}

// Handle subscription cancellation/expiration
async function handleSubscriptionCancellation(supabase: SupabaseClient, event: LemonSqueezyWebhookEvent, transaction: TransactionData) {
  const userId = event.data.attributes.custom_data?.user_id
  
  // Downgrade user to free plan
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      plan: 'free',
      plan_expiry: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileError) {
    console.error('Error updating profile for cancellation:', profileError)
    throw profileError
  }

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ status: 'completed' })
    .eq('id', transaction.id)

  console.log(`Subscription cancelled/expired for user ${userId}`)
}

// Handle one-time order creation
async function handleOrderCreated(supabase: SupabaseClient, event: LemonSqueezyWebhookEvent, transaction: TransactionData) {
  const userId = event.data.attributes.custom_data?.user_id
  const orderData = event.data.attributes
  
  // Get current profile credits
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_find, credits_verify, plan, plan_expiry')
    .eq('id', userId)
    .single()

  const currentFindCredits = profile?.credits_find || 0
  const currentVerifyCredits = profile?.credits_verify || 0
  const newFindCredits = currentFindCredits + (transaction.credits_find_added ?? 0)
  const newVerifyCredits = currentVerifyCredits + (transaction.credits_verify_added ?? 0)

  // Extract customer_id from multiple possible locations
  const customerId = (orderData as Record<string, unknown>).customer_id as string | undefined || 
                    ((orderData as Record<string, unknown>).event_data as Record<string, unknown> | undefined)?.customer_id as string | undefined || 
                    ((transaction.metadata as Record<string, unknown> | undefined)?.event_data as Record<string, unknown> | undefined)?.customer_id as string | undefined

  // Extract customer portal URL from webhook data or fetch it
  const customerPortalUrl = customerId ? await getCustomerPortalUrl(customerId, orderData) : null

  const updateData: Record<string, unknown> = {
    credits_find: newFindCredits,
    credits_verify: newVerifyCredits,
    lemonsqueezy_customer_id: customerId,
    lemonsqueezy_portal_url: customerPortalUrl,
    updated_at: new Date().toISOString(),
  }

  // Handle plan upgrades based on plan_name from custom_data
  const planName = event.data.attributes.custom_data?.plan_name
  if (planName && typeof planName === 'string') {
    const planNameLower = planName.toLowerCase()
    
    if (planNameLower === 'lifetime') {
      updateData.plan = 'lifetime'
      updateData.plan_expiry = null // Lifetime has no expiry
    } else if (planNameLower === 'pro') {
      updateData.plan = 'pro'
      // Set expiry to 1 month from now for monthly plans
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + 1)
      updateData.plan_expiry = expiry.toISOString()
    } else if (planNameLower === 'agency') {
      updateData.plan = 'agency'
      // Set expiry to 1 month from now for monthly plans
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + 1)
      updateData.plan_expiry = expiry.toISOString()
    }
  }

  // Update user profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)

  if (profileError) {
    console.error('Error updating profile for order:', profileError)
    throw profileError
  }

  // Log credit transaction in the old table for compatibility
  if ((transaction.credits_find_added ?? 0) > 0 || (transaction.credits_verify_added ?? 0) > 0) {
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: (transaction.credits_find_added ?? 0) + (transaction.credits_verify_added ?? 0),
        operation: 'purchase',
        meta: {
          transaction_id: transaction.id,
          order_id: event.data.id,
          product_name: orderData.product_name,
          find_credits: transaction.credits_find_added,
          verify_credits: transaction.credits_verify_added,
        },
      })
  }

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ status: 'completed' })
    .eq('id', transaction.id)

  console.log(`Order processed for user ${userId}: +${transaction.credits_find_added ?? 0} find credits, +${transaction.credits_verify_added ?? 0} verify credits`)
}

// Handle subscription payment success
async function handleSubscriptionPayment(supabase: SupabaseClient, event: LemonSqueezyWebhookEvent, transaction: TransactionData) {
  // For recurring payments, we might want to add credits or extend plan
  await handleSubscriptionEvent(supabase, event, transaction)
}

// Handle payment failures
async function handlePaymentFailure(supabase: SupabaseClient, event: LemonSqueezyWebhookEvent, transaction: TransactionData) {
  const userId = event.data.attributes.custom_data?.user_id
  
  // Update transaction status to failed
  await supabase
    .from('transactions')
    .update({ 
      status: 'failed',
      metadata: {
        ...transaction.metadata,
        failure_reason: event.data.attributes.status_reason || 'Payment failed'
      }
    })
    .eq('id', transaction.id)

  console.log(`Payment failed for user ${userId}, transaction ${transaction.id}`)
}