export type AuthMode = 'disabled' | 'optional' | 'required'

/**
 * Read the configured auth mode for this deployment.
 */
export function getAuthMode(): AuthMode {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE
  if (mode === 'optional' || mode === 'required') return mode
  return 'disabled'
}

/**
 * Whether this deployment should expose Supabase sign-in controls.
 */
export function isAuthEnabled(): boolean {
  return getAuthMode() !== 'disabled'
}

/**
 * Whether this deployment should require sign-in before custom cloud-backed work.
 */
export function isAuthRequired(): boolean {
  return getAuthMode() === 'required'
}

/**
 * Whether the public Supabase env vars needed by auth/cloud sync are present.
 */
export function hasSupabaseBrowserConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
