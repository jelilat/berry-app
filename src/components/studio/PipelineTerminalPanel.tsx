'use client'

import {
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Terminal,
} from 'lucide-react'
import type { BuildDiagnostic, BuildResult } from '@/lib/build/types'
import { downloadFirmwareArtifact } from '@/lib/firmware/download'
import type { SimulationDiagnostic, SimulationResult } from '@/lib/simulation'

/**
 * Collapsible CLI-style drawer for build, simulation, and serial logs.
 */
export function PipelineTerminalPanel({
  buildResult,
  buildLoading,
  simulationResult,
  simulationLoading,
  open,
  onOpenChange,
  onClearBuild,
  onClearSimulation,
}: {
  buildResult: BuildResult | null
  buildLoading: boolean
  simulationResult: SimulationResult | null
  simulationLoading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onClearBuild: () => void
  onClearSimulation: () => void
}) {
  const hasActivity = buildLoading || simulationLoading || buildResult || simulationResult
  const buildOk = buildResult?.ok === true
  const simOk = simulationResult?.status === 'passed'
  const statusColor = buildLoading || simulationLoading
    ? 'var(--text-secondary)'
    : buildOk || simOk
      ? 'var(--leaf)'
      : hasActivity
        ? 'var(--accent)'
        : 'var(--text-muted)'

  return (
    <section
      className="shrink-0 border-t"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
      aria-label="Build terminal"
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex h-11 w-full items-center gap-3 px-4 text-left"
      >
        <Terminal size={16} style={{ color: statusColor }} />
        <span className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
          Terminal
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          {terminalSummary(buildResult, buildLoading, simulationResult, simulationLoading)}
        </span>
        {open ? (
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {open && (
        <div className="h-[220px] overflow-hidden border-t p-2" style={{ borderColor: 'var(--border)' }}>
          <div className="grid h-full min-h-0 grid-cols-1 gap-2 lg:grid-cols-2">
          <TerminalPane
            title="build"
            loading={buildLoading}
            emptyText="No build run yet."
            onClear={onClearBuild}
            action={
              buildResult?.ok && buildResult.artifact?.downloadUrl && buildResult.artifact.filename ? (
                <button
                  type="button"
                  onClick={() =>
                    downloadFirmwareArtifact(
                      buildResult.artifact!.downloadUrl!,
                      buildResult.artifact!.filename!,
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold"
                  style={{ background: 'var(--bg-surface)', color: 'var(--leaf)' }}
                >
                  <Download size={13} />
                  Download
                </button>
              ) : null
            }
          >
            {buildResult && <BuildLog result={buildResult} />}
          </TerminalPane>

          <TerminalPane
            title="simulation"
            loading={simulationLoading}
            emptyText="No simulation run yet."
            onClear={onClearSimulation}
          >
            {simulationResult && <SimulationLog result={simulationResult} />}
          </TerminalPane>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Build one-line summary for the collapsed terminal bar.
 */
function terminalSummary(
  buildResult: BuildResult | null,
  buildLoading: boolean,
  simulationResult: SimulationResult | null,
  simulationLoading: boolean,
): string {
  if (buildLoading) return 'building firmware...'
  if (simulationLoading) return 'running mock simulation...'
  if (simulationResult) return `simulation ${simulationResult.status} · hash ${simulationResult.firmwareHash.slice(0, 12)}...`
  if (buildResult?.ok && buildResult.artifact) {
    return `build ok · ${buildResult.backend} · hash ${buildResult.artifact.firmwareHash.slice(0, 12)}...`
  }
  if (buildResult && !buildResult.ok) return `build failed · ${buildResult.diagnostics.length} diagnostics`
  return 'build and simulation logs will appear here'
}

/**
 * Shared terminal pane chrome.
 */
function TerminalPane({
  title,
  loading,
  emptyText,
  children,
  action,
  onClear,
}: {
  title: string
  loading: boolean
  emptyText: string
  children?: React.ReactNode
  action?: React.ReactNode
  onClear: () => void
}) {
  const hasContent = Boolean(children)
  return (
    <div
      className="flex min-h-0 overflow-hidden rounded-xl border font-mono text-xs"
      style={{ background: '#0f1115', borderColor: 'rgba(255,255,255,0.08)', color: '#d8dee9' }}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b px-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {loading ? (
          <Loader2 size={14} className="animate-spin" style={{ color: '#8bd5ca' }} />
        ) : (
          <Terminal size={14} style={{ color: '#8bd5ca' }} />
        )}
        <span className="font-bold uppercase tracking-[0.12em]" style={{ color: '#8bd5ca' }}>
          {title}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {action}
          {hasContent && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-bold underline"
              style={{ color: '#9aa4b2' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && <TerminalLine prefix="$" text={`${title} in progress...`} tone="muted" />}
        {!loading && !hasContent && <TerminalLine prefix="$" text={emptyText} tone="muted" />}
        {children}
      </div>
      </div>
    </div>
  )
}

/**
 * Render build result as terminal lines.
 */
function BuildLog({ result }: { result: BuildResult }) {
  return (
    <div>
      <TerminalLine
        prefix={result.ok ? '✓' : '!'}
        text={result.ok ? 'Build succeeded' : 'Build failed'}
        tone={result.ok ? 'success' : 'error'}
      />
      <TerminalLine prefix=">" text={`backend: ${result.backend}`} />
      {result.artifact && (
        <>
          <TerminalLine prefix=">" text={`hash: ${result.artifact.firmwareHash}`} />
          <TerminalLine prefix=">" text={`artifact: ${result.artifact.binaryPath ?? result.artifact.filename ?? 'firmware'}`} />
          {result.artifact.binarySizeBytes !== undefined && (
            <TerminalLine prefix=">" text={`size: ${result.artifact.binarySizeBytes} bytes`} />
          )}
        </>
      )}
      {result.diagnostics.map((diagnostic, index) => (
        <DiagnosticLine key={`${diagnostic.message}-${index}`} diagnostic={diagnostic} />
      ))}
    </div>
  )
}

/**
 * Render simulation result as terminal lines.
 */
function SimulationLog({ result }: { result: SimulationResult }) {
  return (
    <div>
      <TerminalLine
        prefix={result.status === 'passed' ? '✓' : '!'}
        text={`Simulation ${result.status}`}
        tone={result.status === 'passed' ? 'success' : 'error'}
      />
      <TerminalLine prefix=">" text={`hash: ${result.firmwareHash}`} />
      {result.errors.map((diagnostic, index) => (
        <SimulationDiagnosticLine key={`${diagnostic.code}-${index}`} diagnostic={diagnostic} />
      ))}
      {result.logs.length > 0 && (
        <>
          <TerminalLine prefix="$" text="serial monitor --mock" tone="accent" />
          {result.logs.map((line, index) => (
            <TerminalLine
              key={`${line.offsetMs}-${index}`}
              prefix="+"
              text={`${String(line.offsetMs).padStart(5, ' ')}ms [${line.source}] ${line.text}`}
            />
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Render one build diagnostic line.
 */
function DiagnosticLine({ diagnostic }: { diagnostic: BuildDiagnostic }) {
  const location =
    diagnostic.file && diagnostic.line
      ? `${diagnostic.file}:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}`
      : diagnostic.file
  return (
    <TerminalLine
      prefix={diagnostic.severity === 'error' ? '!' : '*'}
      text={`${diagnostic.severity}${location ? ` ${location}` : ''}: ${diagnostic.message}`}
      tone={diagnostic.severity === 'error' ? 'error' : 'warning'}
    />
  )
}

/**
 * Render one simulation diagnostic line.
 */
function SimulationDiagnosticLine({ diagnostic }: { diagnostic: SimulationDiagnostic }) {
  return (
    <TerminalLine
      prefix={diagnostic.severity === 'error' ? '!' : '*'}
      text={`${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`}
      tone={diagnostic.severity === 'error' ? 'error' : diagnostic.severity === 'warning' ? 'warning' : 'success'}
    />
  )
}

/**
 * Render one terminal output line.
 */
function TerminalLine({
  prefix,
  text,
  tone = 'default',
}: {
  prefix: string
  text: string
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'error' | 'accent'
}) {
  return (
    <div className="grid grid-cols-[26px_1fr] gap-2 leading-6">
      <span style={{ color: terminalToneColor(tone), opacity: tone === 'default' ? 0.72 : 1 }}>
        {prefix}
      </span>
      <span className="whitespace-pre-wrap" style={{ color: terminalToneColor(tone) }}>
        {text}
      </span>
    </div>
  )
}

/**
 * Resolve terminal line color by tone.
 */
function terminalToneColor(tone: 'default' | 'muted' | 'success' | 'warning' | 'error' | 'accent'): string {
  if (tone === 'muted') return '#7f8896'
  if (tone === 'success') return '#8bd5ca'
  if (tone === 'warning') return '#f6c177'
  if (tone === 'error') return '#eb6f92'
  if (tone === 'accent') return '#c4a7e7'
  return '#d8dee9'
}
