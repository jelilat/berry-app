'use client'

import { AlertTriangle, CheckSquare, Info, MessageSquare, X } from 'lucide-react'
import type { ValidationResult, ValidationSeverity, ValidationSubject } from '@/lib/validation'

const SEVERITY_META: Record<
  ValidationSeverity,
  { label: string; color: string; icon: typeof AlertTriangle }
> = {
  error: { label: 'Warning', color: '#f59e0b', icon: AlertTriangle },
  warning: { label: 'Warning', color: '#f59e0b', icon: AlertTriangle },
  info: { label: 'Note', color: 'var(--text-muted)', icon: Info },
}

/**
 * Floating pre-flight validation panel opened from the top warning pill.
 * @param props Validation findings, visibility, and selection callbacks.
 */
export function ValidationFlyout({
  open,
  results,
  onClose,
  onSelectSubject,
}: {
  open: boolean
  results: ValidationResult[]
  onClose: () => void
  onSelectSubject: (subject: ValidationSubject) => void
}) {
  if (!open) return null

  const warningCount = results.filter((result) => result.severity !== 'info').length

  return (
    <aside
      className="absolute right-[360px] top-3 z-30 flex max-h-[68vh] w-[460px] flex-col overflow-hidden rounded-xl shadow-2xl"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      aria-label="Pre-flight checks"
    >
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <CheckSquare size={16} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-xs font-extrabold uppercase tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>
          Pre-flight checks
        </p>
        <span className="ml-auto text-xs font-extrabold tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {results.length}/{results.length}
        </span>
        <button
          type="button"
          className="rounded-md p-1"
          style={{ color: 'var(--text-muted)' }}
          onClick={onClose}
          title="Close checks"
        >
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {results.length === 0 ? (
          <div className="rounded-xl px-3 py-6 text-center text-sm font-bold" style={{ color: 'var(--leaf)', background: 'rgba(15,168,134,0.08)' }}>
            No warnings. The bench is ready for build and simulation.
          </div>
        ) : (
          <ul className="space-y-4">
            {results.map((result, index) => (
              <ValidationFlyoutRow
                key={`${result.code}-${result.message}-${index}`}
                result={result}
                onSelectSubject={onSelectSubject}
              />
            ))}
          </ul>
        )}
      </div>
      {warningCount > 0 && (
        <div className="shrink-0 border-t px-4 py-2 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Click a warning to focus the related part, wire, or net.
        </div>
      )}
    </aside>
  )
}

/**
 * One pre-flight row.
 * @param props Validation finding and selection callback.
 */
function ValidationFlyoutRow({
  result,
  onSelectSubject,
}: {
  result: ValidationResult
  onSelectSubject: (subject: ValidationSubject) => void
}) {
  const meta = SEVERITY_META[result.severity]
  const Icon = meta.icon
  const clickable = Boolean(result.subject?.wireId || result.subject?.componentId || result.subject?.netId)

  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => {
          if (result.subject) onSelectSubject(result.subject)
        }}
        className="grid w-full grid-cols-[18px_1fr_18px] gap-3 rounded-lg px-2 py-1 text-left disabled:cursor-default"
      >
        <Icon size={16} className="mt-0.5" style={{ color: meta.color }} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug" style={{ color: meta.color }}>
            {result.message}
          </span>
          <span className="mt-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {meta.label} · {result.code}
          </span>
        </span>
        <MessageSquare size={14} className="mt-0.5" style={{ color: 'var(--text-muted)', opacity: clickable ? 1 : 0.35 }} />
      </button>
    </li>
  )
}
