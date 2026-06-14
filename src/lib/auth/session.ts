import type { User } from '@supabase/supabase-js'

/** Minimal user record used by the Berry UI. */
export interface BerryUser {
  id: string
  name: string
  email: string
}

/** Auth session shape consumed by the home and sidebar UI. */
export interface AuthSession {
  user: BerryUser
  signedInAt: string
}

/**
 * Convert a Supabase auth user into the UI's compact session shape.
 * @param user Supabase user returned by the auth client.
 */
export function authSessionFromUser(user: User): AuthSession {
  return {
    user: {
      id: user.id,
      name: displayNameForUser(user),
      email: user.email ?? '',
    },
    signedInAt: user.last_sign_in_at ?? user.created_at ?? new Date().toISOString(),
  }
}

/**
 * Pick a friendly display name from Google/Supabase user metadata.
 * @param user Supabase user returned by the auth client.
 */
function displayNameForUser(user: User): string {
  const metadata = user.user_metadata
  const fullName = metadata.full_name
  const name = metadata.name
  if (typeof fullName === 'string' && fullName.trim()) return fullName
  if (typeof name === 'string' && name.trim()) return name
  if (user.email) return user.email.split('@')[0] ?? 'Berry Builder'
  return 'Berry Builder'
}
