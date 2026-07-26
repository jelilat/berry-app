'use client'

import { Check, Copy, Globe2, Link2, Loader2, Lock, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { copyTextToClipboard } from '@/lib/clipboard'
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-browser'
import {
  loadCloudProjectShareState,
  setCloudProjectSharing,
} from '@/lib/projects/cloud-projects'

type ShareDialogStatus = 'loading' | 'ready' | 'saving' | 'error'

/**
 * Owner dialog for enabling, copying, and revoking a public project URL.
 * @param props Dialog state and project identity.
 */
export function ProjectShareDialog({
  open,
  projectId,
  projectName,
  onClose,
}: {
  open: boolean
  projectId: string | null
  projectName: string
  onClose: () => void
}) {
  const [status, setStatus] = useState<ShareDialogStatus>('loading')
  const [isShared, setIsShared] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const shareUrl =
    projectId && typeof window !== 'undefined'
      ? `${window.location.origin}/share/${encodeURIComponent(projectId)}`
      : ''

  useEffect(() => {
    if (!open || !projectId) return
    let mounted = true

    /**
     * Load the latest server-backed sharing state when the dialog opens.
     */
    async function loadShareState(): Promise<void> {
      setStatus('loading')
      setErrorMessage(null)
      try {
        const state = await loadCloudProjectShareState(
          createSupabaseBrowserClient(),
          projectId!,
        )
        if (!mounted) return
        setIsShared(state.isShared)
        setStatus('ready')
      } catch (error) {
        if (!mounted) return
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not load sharing settings',
        )
        setStatus('error')
      }
    }

    void loadShareState()
    return () => {
      mounted = false
    }
  }, [open, projectId])

  useEffect(() => {
    if (copyState === 'idle') return undefined
    const timeout = window.setTimeout(() => setCopyState('idle'), 1800)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  if (!open) return null

  /**
   * Enable or revoke public viewing for this project.
   */
  async function toggleSharing(): Promise<void> {
    if (!projectId || status === 'saving') return
    const nextShared = !isShared
    setStatus('saving')
    setErrorMessage(null)
    try {
      const state = await setCloudProjectSharing(
        createSupabaseBrowserClient(),
        projectId,
        nextShared,
      )
      setIsShared(state.isShared)
      setStatus('ready')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update sharing',
      )
      setStatus('error')
    }
  }

  /**
   * Copy the public project URL to the clipboard.
   */
  async function copyShareUrl(): Promise<void> {
    if (!shareUrl) return
    try {
      await copyTextToClipboard(shareUrl)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-project-title"
        className="w-full max-w-lg rounded-[24px] p-5"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <div
              className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
            >
              <Link2 size={19} />
            </div>
            <h2
              id="share-project-title"
              className="text-xl font-black tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Share project
            </h2>
            <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {projectName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </header>

        <div
          className="mt-5 flex items-center justify-between gap-4 rounded-2xl p-4"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: isShared ? 'rgba(15,168,134,0.1)' : 'var(--bg-overlay)',
                color: isShared ? 'var(--leaf)' : 'var(--text-muted)',
              }}
            >
              {isShared ? <Globe2 size={18} /> : <Lock size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                Anyone with the link
              </p>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {isShared ? 'Can view this project' : 'Access is restricted'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isShared}
            aria-label="Allow anyone with the link to view"
            onClick={() => void toggleSharing()}
            disabled={!projectId || status === 'loading' || status === 'saving'}
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
            style={{ background: isShared ? 'var(--leaf)' : 'var(--border-strong)' }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
              style={{ left: 4, transform: isShared ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>

        {isShared && (
          <div className="mt-4">
            <label
              htmlFor="project-share-url"
              className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em]"
              style={{ color: 'var(--text-muted)' }}
            >
              View-only project URL
            </label>
            <div className="flex gap-2">
              <input
                id="project-share-url"
                readOnly
                value={shareUrl}
                className="h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm font-semibold outline-none"
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => void copyShareUrl()}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-extrabold"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Try again' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {(status === 'loading' || status === 'saving') && (
          <p
            className="mt-4 flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--text-muted)' }}
            role="status"
          >
            <Loader2 size={15} className="animate-spin" />
            {status === 'loading' ? 'Checking access…' : 'Updating access…'}
          </p>
        )}

        {errorMessage && (
          <p
            className="mt-4 rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </section>
    </div>
  )
}
