import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/auth/supabase-server'

export const runtime = 'edge'

/**
 * GET /auth/callback exchanges a Google OAuth code for Supabase session cookies.
 * @param request OAuth callback request from Supabase.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const redirectUrl = new URL(next, requestUrl.origin)
  const response = NextResponse.redirect(redirectUrl)

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=missing_code', requestUrl.origin))
  }

  try {
    const supabase = createSupabaseRouteClient(request, response)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/?auth_error=exchange_failed', requestUrl.origin))
    }
    return response
  } catch {
    return NextResponse.redirect(new URL('/?auth_error=not_configured', requestUrl.origin))
  }
}
