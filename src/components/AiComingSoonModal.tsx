'use client'

import { Construction, X } from 'lucide-react'
import {
  AI_COMING_SOON_MESSAGE,
  AI_COMING_SOON_TITLE,
} from '@/lib/studio/ai-availability'

/**
 * Render the temporary custom-AI availability notice.
 * @param props Open state and close callback.
 */
export function AiComingSoonModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-coming-soon-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        aria-label="Close coming soon dialog"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[380px] rounded-2xl px-7 py-6 text-left sm:px-8 sm:py-7"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 80px rgba(12,12,15,0.18)',
        }}
      >
        <BuildingFeatureBadge />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 transition-colors hover:bg-black/5"
          aria-label="Close"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={17} />
        </button>

        <p
          id="ai-coming-soon-title"
          className="pr-8 text-xl font-extrabold leading-tight tracking-[-0.02em]"
          style={{ color: 'var(--text-primary)' }}
        >
          {AI_COMING_SOON_TITLE}
        </p>
        <p
          className="mt-2 text-sm font-medium leading-5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {AI_COMING_SOON_MESSAGE}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
            boxShadow: '0 14px 32px rgba(214,51,108,0.22)',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

/**
 * Animated badge that suggests active feature construction.
 */
function BuildingFeatureBadge() {
  return (
    <div
      className="brand-build-badge relative mb-4 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
      style={{ background: 'rgba(214,51,108,0.1)' }}
      aria-hidden="true"
    >
      <div className="brand-build-scan" />
      <div className="absolute inset-x-0 bottom-1 flex items-end justify-center gap-0.5 px-1.5">
        <span className="brand-build-block h-1.5" style={{ animationDelay: '0s' }} />
        <span className="brand-build-block h-2.5" style={{ animationDelay: '0.18s' }} />
        <span className="brand-build-block h-2" style={{ animationDelay: '0.36s' }} />
      </div>
      <Construction
        size={18}
        className="brand-build-icon relative z-[1]"
        style={{ color: 'var(--accent)' }}
      />
    </div>
  )
}
