'use client'

import { AlertCircle, CheckCircle2, Download, Hammer, Loader2 } from 'lucide-react'
import type { BuildDiagnostic, BuildResult } from '@/lib/build/types'
import { downloadFirmwareArtifact } from '@/lib/firmware/download'

/**
 * Compact build output panel for compile status and diagnostics.
 */
export function BuildOutputPanel({
  result,
  loading,
  onDismiss,
}: {
  result: BuildResult | null
  loading: boolean
  onDismiss: () => void
}) {
  if (!loading && !result) return null

  const success = result?.ok === true
  const accent = success ? 'var(--leaf)' : 'var(--accent)'
  const tint = success ? 'rgba(15,168,134,0.12)' : 'rgba(214,51,108,0.12)'

  return (
    <section
      className="rounded-xl px-4 py-3 text-sm"
      style={{ background: tint, border: `1px solid ${accent}` }}
      role="status"
      aria-live="polite"
      aria-label="Build output"
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
                  <Hammer size={14} className="mr-1 inline" />
                  Building firmware…
                </>
              ) : success ? (
                'Build succeeded'
              ) : (
                'Build failed'
              )}
            </p>
            {result && (
              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Backend: {result.backend}
                {result.artifact?.firmwareHash && (
                  <>
                    {' '}
                    · Hash{' '}
                    <code className="font-mono text-[11px]">
                      {result.artifact.firmwareHash.slice(0, 12)}…
                    </code>
                  </>
                )}
                {result.artifact?.binarySizeBytes !== undefined && (
                  <> · {result.artifact.binarySizeBytes} bytes</>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!loading && success && result?.artifact?.downloadUrl && result.artifact.filename && (
            <button
              type="button"
              onClick={() =>
                downloadFirmwareArtifact(result.artifact!.downloadUrl!, result.artifact!.filename!)
              }
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--leaf)',
              }}
            >
              <Download size={14} />
              Download
            </button>
          )}
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
      </div>

      {result && result.diagnostics.length > 0 && (
        <ul className="mt-3 space-y-2">
          {result.diagnostics.map((diagnostic, index) => (
            <DiagnosticRow key={`${diagnostic.message}-${index}`} diagnostic={diagnostic} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Render one compiler diagnostic line.
 * @param props Diagnostic row data.
 */
function DiagnosticRow({ diagnostic }: { diagnostic: BuildDiagnostic }) {
  const location =
    diagnostic.file && diagnostic.line
      ? `${diagnostic.file}:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}`
      : diagnostic.file

  return (
    <li
      className="rounded-lg px-3 py-2 text-xs font-semibold"
      style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
    >
      <span className="uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
        {diagnostic.severity}
      </span>
      {location && (
        <span className="ml-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {location}
        </span>
      )}
      <p className="mt-1">{diagnostic.message}</p>
    </li>
  )
}
