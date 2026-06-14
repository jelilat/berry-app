import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest, NextResponse } from 'next/server'

/**
 * Read the public Supabase configuration required by server auth routes.
 * @throws When either required public Supabase env var is missing.
 */
function readSupabaseServerConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return { url, anonKey }
}

/**
 * Create a per-request Supabase server client backed by Next response cookies.
 * @param request Incoming Next request with auth cookies.
 * @param response Mutable Next response that receives refreshed auth cookies.
 * @throws When Supabase public env vars are not configured.
 */
export function createSupabaseRouteClient(
  request: NextRequest,
  response: NextResponse,
): SupabaseClient {
  const { url, anonKey } = readSupabaseServerConfig()
  return createServerClient(url, anonKey, {
    cookies: {
      /**
       * Read all request cookies so Supabase can find the current auth tokens.
       */
      getAll() {
        return request.cookies.getAll()
      },
      /**
       * Write refreshed auth cookies and cache-control headers onto the response.
       * @param cookiesToSet Supabase auth cookies that need to be persisted.
       * @param headers Response headers that keep auth responses private.
       */
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      },
    },
  })
}
