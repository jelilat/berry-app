'use client'

import { AlertCircle, CheckCircle2, Cpu, Loader2, Terminal } from 'lucide-react'
import type { SimulationDiagnostic, SimulationResult } from '@/lib/simulation'

/**
 * Compact simulation output panel for mock run status, serial logs, and diagnostics.
 */
export function SimulationOutputPanel({
  result,
  loading,
  onDismiss,
}: {
  result: SimulationResult | null
  loading: boolean
  onDismiss: () => void
}) {
  if (!loading && !result) return null

  const status = result?.status ?? 'failed'
  const success = status === 'passed'
  const unsupported = status === 'unsupported'
  const accent = success ? 'var(--leaf)' : unsupported ? 'var(--text-muted)' : 'var(--accent)'
  const tint = success
    ? 'rgba(15,168,134,0.12)'
    : unsupported
      ? 'rgba(235,231,223,0.5)'
      : 'rgba(214,51,108,0.12)'

  const statusLabel = loading
    ? 'Simulating firmware…'
    : success
      ? 'Simulation passed'
      : unsupported
        ? 'Circuit not supported'
        : 'Simulation failed'

  return (
    <section
      className="rounded-xl px-4 py-3 text-sm"
      style={{ background: tint, border: `1px solid ${accent}` }}
      role="status"
      aria-live="polite"
      aria-label="Simulation output"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {loading ? (
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" style={{ color: accent }} />
          ) : success ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: accent }} />
          ) : (
            <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: accent }} />
          )}
          <div className="min-w-0">
            <p className="font-extrabold" style={{ color: accent }}>
              {loading ? (
                <>
                  <Cpu size={14} className="mr-1 inline" />
                  {statusLabel}
                </>
              ) : (
                statusLabel
              )}
            </p>
            {result && (
              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Status: {result.status}
                {' · '}
                Hash{' '}
                <code className="font-mono text-[11px]">
                  {result.firmwareHash.slice(0, 12)}…
                </code>
                {result.traces && result.traces.length > 0 && (
                  <> · {result.traces.length} GPIO trace{result.traces.length === 1 ? '' : 's'}</>
                )}
              </p>
            )}
          </div>
        </div>
        {!loading && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs font-bold underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Dismiss
          </button>
        )}
      </div>

      {result && result.errors.length > 0 && (
        <ul className="mt-3 space-y-2">
          {result.errors.map((diagnostic, index) => (
            <DiagnosticRow key={`${diagnostic.code}-${index}`} diagnostic={diagnostic} />
          ))}
        </ul>
      )}

      {result && result.logs.length > 0 && (
        <div
          className="mt-3 overflow-x-auto rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <div
            className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--leaf)' }}
          >
            <Terminal size={12} />
            Serial monitor (mock)
          </div>
          {result.logs.map((line, index) => (
            <div key={`${line.offsetMs}-${index}`} className="whitespace-pre-wrap">
              <span style={{ color: 'var(--text-muted)' }}>
                +{String(line.offsetMs).padStart(5, ' ')}ms
              </span>{' '}
              <span style={{ color: line.source === 'sim' ? 'var(--accent)' : 'inherit' }}>
                [{line.source}]
              </span>{' '}
              {line.text}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Render one simulation diagnostic line.
 * @param props Diagnostic row data.
 */
function DiagnosticRow({ diagnostic }: { diagnostic: SimulationDiagnostic }) {
  const color =
    diagnostic.severity === 'error'
      ? 'var(--accent)'
      : diagnostic.severity === 'warning'
        ? '#c27d1a'
        : 'var(--leaf)'

  return (
    <li
      className="rounded-lg px-3 py-2 text-xs font-semibold"
      style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
    >
      <span className="uppercase tracking-wide" style={{ color }}>
        {diagnostic.severity}
      </span>
      <span className="ml-2 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {diagnostic.code}
      </span>
      <p className="mt-1">{diagnostic.message}</p>
    </li>
  )
}
