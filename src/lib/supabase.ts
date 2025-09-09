import { createBrowserClient } from '@supabase/ssr'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client (for use in client components)
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server-side Supabase client for server components
export async function createServerComponentClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(_name: string, _value: string, _options: CookieOptions) {
        // Read-only in server components
      },
      remove(_name: string, _options: CookieOptions) {
        // Read-only in server components
      },
    },
  })
}

// Server-side Supabase client for server actions
export async function createServerActionClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set(name, value, options)
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set(name, '', { ...options, maxAge: 0 })
      },
    },
  })
}

// Service role client for webhook operations (bypasses RLS)
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createBrowserClient(supabaseUrl, serviceRoleKey)
}

// Middleware Supabase client
export function createMiddlewareClient(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({
          name,
          value,
          ...options,
          domain: '.mailsfinder.com',
          sameSite: 'lax',
        })
      },
      remove(name: string, options: any) {
        response.cookies.set({
          name,
          value: '',
          ...options,
          domain: '.mailsfinder.com',
          maxAge: 0,
        })
      },
    },
  })

  return { supabase, response }
}

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company: string | null
          plan: string
          plan_expiry: string | null
          credits: number
          credits_find: number
          credits_verify: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          company?: string | null
          plan?: string
          plan_expiry?: string | null
          credits?: number
          credits_find?: number
          credits_verify?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company?: string | null
          plan?: string
          plan_expiry?: string | null
          credits?: number
          credits_find?: number
          credits_verify?: number
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          lemonsqueezy_order_id: string | null
          product_type: string
          amount: number
          credits_find_added: number
          status: string
          metadata: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lemonsqueezy_order_id?: string | null
          product_type: string
          amount: number
          credits_find_added: number
          status: string
          metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lemonsqueezy_order_id?: string | null
          product_type?: string
          amount?: number
          credits_find_added?: number
          status?: string
          metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      searches: {
        Row: {
          id: string
          user_id: string
          type: string
          payload: Record<string, unknown>
          result: Record<string, unknown>
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          payload: Record<string, unknown>
          result?: Record<string, unknown>
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          payload?: Record<string, unknown>
          result?: Record<string, unknown>
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      bulk_verification_jobs: {
        Row: {
          id: string
          user_id: string
          status: string
          total_emails: number
          processed_emails: number
          successful_verifications: number
          failed_verifications: number
          emails_data: Record<string, unknown>
          current_index: number
          error_message: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          total_emails: number
          processed_emails?: number
          successful_verifications?: number
          failed_verifications?: number
          emails_data: Record<string, unknown>
          current_index?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          total_emails?: number
          processed_emails?: number
          successful_verifications?: number
          failed_verifications?: number
          emails_data?: Record<string, unknown>
          current_index?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
      bulk_finder_jobs: {
        Row: {
          id: string
          user_id: string
          status: string
          total_requests: number
          processed_requests: number
          successful_finds: number
          failed_finds: number
          requests_data: Record<string, unknown>
          current_index: number
          error_message: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          total_requests: number
          processed_requests?: number
          successful_finds?: number
          failed_finds?: number
          requests_data: Record<string, unknown>
          current_index?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          total_requests?: number
          processed_requests?: number
          successful_finds?: number
          failed_finds?: number
          requests_data?: Record<string, unknown>
          current_index?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
    }
    Functions: {
      check_credits: {
        Args: {
          required: number
        }
        Returns: number
      }
      deduct_credits: {
        Args: {
          required: number
          operation: string
          meta: Record<string, unknown>
        }
        Returns: boolean
      }
    }
  }
}