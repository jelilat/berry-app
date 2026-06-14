import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Read the public Supabase configuration required by browser auth.
 * @throws When either required public Supabase env var is missing.
 */
function readSupabaseBrowserConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return { url, anonKey }
}

/**
 * Create or reuse the browser Supabase client for Google OAuth.
 * @throws When Supabase public env vars are not configured.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient
  const { url, anonKey } = readSupabaseBrowserConfig()
  browserClient = createBrowserClient(url, anonKey)
  return browserClient
}
