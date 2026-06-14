'use client'

import { useState, type FormEvent } from 'react'
import { Mail, X } from 'lucide-react'

/**
 * Sign-in dialog shown when a guest submits a custom prompt.
 * @param props Modal visibility and auth callbacks.
 */
export function LoginPromptModal({
  open,
  onClose,
  onGoogleSignIn,
  onEmailSignIn,
}: {
  open: boolean
  onClose: () => void
  onGoogleSignIn: () => void | Promise<void>
  onEmailSignIn: (email: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!open) return null

  /**
   * Send a Supabase magic link for email sign-in.
   * @param event Email form submit event.
   */
  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanEmail = email.trim()
    if (!cleanEmail || pending) return

    setPending(true)
    setErrorMessage(null)
    try {
      await onEmailSignIn(cleanEmail)
      setEmailSent(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send sign-in link')
    } finally {
      setPending(false)
    }
  }

  /**
   * Start Google sign-in from the modal.
   */
  async function handleGoogleClick() {
    setPending(true)
    setErrorMessage(null)
    try {
      await onGoogleSignIn()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start Google sign-in')
      setPending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-prompt-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        aria-label="Close sign-in dialog"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[420px] rounded-2xl p-6"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 80px rgba(12,12,15,0.18)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 transition-colors hover:bg-black/5"
          aria-label="Close"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={18} />
        </button>

        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(214,51,108,0.1)' }}>
          <Mail size={20} style={{ color: 'var(--accent)' }} />
        </div>

        <h2 id="login-prompt-title" className="text-2xl font-extrabold tracking-[-0.03em]">
          Sign in to berry.
        </h2>

        {emailSent ? (
          <div
            className="mt-6 rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'rgba(15,168,134,0.1)', color: 'var(--leaf)' }}
            role="status"
          >
            Check your inbox for the sign-in link.
          </div>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={handleEmailSubmit}>
            <label className="block text-sm font-bold" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="builder@company.com"
              autoComplete="email"
              className="h-12 w-full rounded-xl px-4 text-base font-medium outline-none transition-colors"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              required
            />
            <button
              type="submit"
              disabled={pending || email.trim().length === 0}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
                boxShadow: '0 14px 32px rgba(214,51,108,0.22)',
              }}
            >
              {pending ? 'Sending link...' : 'Continue with email'}
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
            or
          </span>
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={pending}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Continue with Google
          </button>
        </div>

        {errorMessage && (
          <p
            className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  )
}
