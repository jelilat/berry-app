'use client'

import { ArrowUp, Sparkles, X } from 'lucide-react'
import { brand } from '@/lib/brand'

/**
 * Placeholder sign-in dialog shown when a guest submits a custom prompt.
 * @param props Modal visibility and auth callbacks.
 */
export function LoginPromptModal({
  open,
  onClose,
  onSignIn,
}: {
  open: boolean
  onClose: () => void
  onSignIn: () => void
}) {
  if (!open) return null

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
        className="relative w-full max-w-md rounded-[28px] p-6"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-soft)',
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

        <div
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em]"
          style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
        >
          <Sparkles size={14} />
          Sign in to continue
        </div>

        <h2 id="login-prompt-title" className="text-2xl font-extrabold tracking-[-0.04em]">
          Custom builds need a saved bench
        </h2>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          Starter benches stay open to everyone. When you want {brand.name} to follow your own wiring
          spec — parts, nets, firmware, the lot — sign in so the work lands in your project library.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
              boxShadow: '0 14px 32px rgba(214,51,108,0.24)',
            }}
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-black/[0.03]"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Browse starter benches
          </button>
        </div>

        <p className="mt-4 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
          Demo sign-in for now — this stores a local session until real auth is wired up.
        </p>
      </div>
    </div>
  )
}

export { ArrowUp }
