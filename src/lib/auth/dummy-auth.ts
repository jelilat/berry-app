/** localStorage key for dummy auth session. */
export const AUTH_SESSION_KEY = 'berry-auth-session'

/** Minimal user record for the placeholder auth flow. */
export interface BerryUser {
  id: string
  name: string
  email: string
}

/** Dummy session persisted in the browser until real auth ships. */
export interface AuthSession {
  user: BerryUser
  signedInAt: string
}

/**
 * Read the current dummy auth session from localStorage.
 */
export function loadAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Persist a dummy auth session after the placeholder sign-in flow.
 * @param user Signed-in user record.
 */
export function saveAuthSession(user: BerryUser): AuthSession {
  const session: AuthSession = {
    user,
    signedInAt: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  }
  return session
}

/**
 * Clear the dummy auth session.
 */
export function clearAuthSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_SESSION_KEY)
}

/**
 * Create a placeholder user for the demo sign-in button.
 */
export function createDummyUser(): BerryUser {
  return {
    id: 'demo-user',
    name: 'Berry Builder',
    email: 'builder@berry.studio',
  }
}
