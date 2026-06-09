'use client'

import { useMemo } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ValidationResult, ValidationSeverity, ValidationSubject } from '@/lib/validation'
import {
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
} from '@/lib/studio/constants'

const SEVERITY_ORDER: ValidationSeverity[] = ['error', 'warning', 'info']

const SEVERITY_META: Record<
  ValidationSeverity,
  { label: string; icon: typeof AlertCircle; accent: string; tint: string }
> = {
  error: {
    label: 'Errors',
    icon: AlertCircle,
    accent: 'var(--accent)',
    tint: 'rgba(214, 51, 108, 0.1)',
  },
  warning: {
    label: 'Warnings',
    icon: AlertTriangle,
    accent: '#d97706',
    tint: 'rgba(217, 119, 6, 0.12)',
  },
  info: {
    label: 'Info',
    icon: Info,
    accent: 'var(--leaf)',
    tint: 'rgba(15, 168, 134, 0.1)',
  },
}

/**
 * Right-rail panel listing validation findings grouped by severity.
 */
export function ValidationPanel({
  results,
  onSelectSubject,
}: {
  results: ValidationResult[]
  onSelectSubject: (subject: ValidationSubject) => void
}) {
  const grouped = useMemo(() => groupResultsBySeverity(results), [results])
  const hasIssues = results.length > 0

  return (
    <aside
      className="flex max-h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl"
      style={{
        minWidth: INSPECTOR_WIDTH_MIN,
        maxWidth: INSPECTOR_WIDTH_MAX,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
      aria-label="Wiring validation"
    >
      <div
        className="shrink-0 border-b px-3 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Validation
        </p>
        <p className="mt-0.5 text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Wiring check
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {!hasIssues ? (
          <EmptyValidationState />
        ) : (
          <div className="space-y-3">
            {SEVERITY_ORDER.map((severity) => {
              const items = grouped[severity]
              if (items.length === 0) return null
              return (
                <SeveritySection
                  key={severity}
                  severity={severity}
                  items={items}
                  onSelectSubject={onSelectSubject}
                />
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

/**
 * Group findings by severity for section rendering.
 *
 * @param results Full validation output.
 */
function groupResultsBySeverity(results: ValidationResult[]): Record<ValidationSeverity, ValidationResult[]> {
  const grouped: Record<ValidationSeverity, ValidationResult[]> = {
    error: [],
    warning: [],
    info: [],
  }
  for (const result of results) {
    grouped[result.severity].push(result)
  }
  return grouped
}

/**
 * Empty bench state when validate returns no findings.
 */
function EmptyValidationState() {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl px-4 py-6 text-center"
      style={{ background: 'rgba(15, 168, 134, 0.08)', border: '1px solid rgba(15, 168, 134, 0.2)' }}
    >
      <CheckCircle2 size={28} style={{ color: 'var(--leaf)' }} aria-hidden />
      <p className="text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        Wiring looks good
      </p>
      <p className="text-[11px] font-medium leading-snug" style={{ color: 'var(--text-muted)' }}>
        No errors, warnings, or notes on this bench yet.
      </p>
    </div>
  )
}

/**
 * Collapsible severity block with clickable issue rows.
 */
function SeveritySection({
  severity,
  items,
  onSelectSubject,
}: {
  severity: ValidationSeverity
  items: ValidationResult[]
  onSelectSubject: (subject: ValidationSubject) => void
}) {
  const meta = SEVERITY_META[severity]
  const Icon = meta.icon

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
        <Icon size={12} style={{ color: meta.accent }} aria-hidden />
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: meta.accent }}
        >
          {meta.label}
        </p>
        <span
          className="rounded px-1 py-0.5 text-[9px] font-bold tabular-nums"
          style={{ background: meta.tint, color: meta.accent }}
        >
          {items.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <ValidationIssueRow
            key={`${item.code}-${item.message}-${subjectKey(item.subject)}`}
            item={item}
            severity={severity}
            onSelectSubject={onSelectSubject}
          />
        ))}
      </ul>
    </section>
  )
}

/**
 * Stable key fragment for list items when subject ids are present.
 *
 * @param subject Optional graph anchor from the finding.
 */
function subjectKey(subject: ValidationSubject | undefined): string {
  if (!subject) return 'none'
  return [subject.netId, subject.wireId, subject.componentId, subject.terminalId]
    .filter(Boolean)
    .join(':')
}

/**
 * Single clickable validation row.
 */
function ValidationIssueRow({
  item,
  severity,
  onSelectSubject,
}: {
  item: ValidationResult
  severity: ValidationSeverity
  onSelectSubject: (subject: ValidationSubject) => void
}) {
  const meta = SEVERITY_META[severity]
  const clickable = hasSelectableSubject(item.subject)

  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => {
          if (item.subject) onSelectSubject(item.subject)
        }}
        className="w-full rounded-xl px-3 py-2 text-left transition-opacity disabled:cursor-default"
        style={{
          background: meta.tint,
          border: `1px solid ${severity === 'error' ? 'rgba(214, 51, 108, 0.2)' : severity === 'warning' ? 'rgba(217, 119, 6, 0.22)' : 'rgba(15, 168, 134, 0.2)'}`,
          opacity: clickable ? 1 : 0.92,
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: meta.accent }}>
          {item.code}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {item.message}
        </p>
        {item.subject && (
          <p className="mt-1 truncate text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {formatSubjectHint(item.subject)}
          </p>
        )}
      </button>
    </li>
  )
}

/**
 * Whether a finding includes at least one Studio-selectable id.
 *
 * @param subject Optional graph anchor.
 */
function hasSelectableSubject(subject: ValidationSubject | undefined): boolean {
  if (!subject) return false
  return !!(subject.wireId || subject.componentId)
}

/**
 * Short hint for which graph element will be focused on click.
 *
 * @param subject Graph anchor from the finding.
 */
function formatSubjectHint(subject: ValidationSubject): string {
  const parts: string[] = []
  if (subject.componentId) parts.push(`Part ${subject.componentId}`)
  if (subject.terminalId) parts.push(`Pin ${subject.terminalId}`)
  if (subject.wireId) parts.push(`Wire ${subject.wireId}`)
  if (subject.netId) parts.push(`Net ${subject.netId}`)
  return parts.join(' · ')
}
