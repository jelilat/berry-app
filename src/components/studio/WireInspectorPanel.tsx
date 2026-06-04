'use client'

import { useCallback, useMemo } from 'react'
import { Cable, GripVertical, X } from 'lucide-react'
import { parseBreadboardHoleLabel } from '@/lib/project/breadboard'
import type { BerryProject } from '@/lib/project/types'
import {
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
} from '@/lib/studio/constants'
import { useInspectorResizableWidth } from '@/lib/studio/use-resizable-width'
import {
  buildWireInspectorModel,
  type WireEndpointDisplay,
} from '@/lib/studio/wire-inspector'

/**
 * Right-side inspector for a selected jumper wire connection.
 */
export function WireInspectorPanel({
  project,
  wireId,
  onClose,
  onEndpointHoleChange,
  onResetRoute,
}: {
  project: BerryProject
  wireId: string
  onClose: () => void
  /** Move a breadboard end to a new main-grid hole (e.g. `a30`). */
  onEndpointHoleChange?: (end: 'from' | 'to', holeLabel: string) => void
  /** Restore automatic routing for breadboard jumpers. */
  onResetRoute?: () => void
}) {
  const model = useMemo(
    () => buildWireInspectorModel(project, wireId),
    [project, wireId],
  )
  const { width: panelWidth, onResizePointerDown } = useInspectorResizableWidth({
    min: INSPECTOR_WIDTH_MIN,
    max: INSPECTOR_WIDTH_MAX,
  })

  if (!model) return null

  return (
    <aside
      className="relative flex shrink-0 flex-col overflow-hidden rounded-2xl"
      style={{
        width: panelWidth,
        minWidth: INSPECTOR_WIDTH_MIN,
        maxWidth: INSPECTOR_WIDTH_MAX,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector panel"
        onPointerDown={onResizePointerDown}
        className="absolute left-0 top-0 z-20 flex h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center touch-none select-none"
        style={{ color: 'var(--text-muted)' }}
      >
        <span
          className="flex h-10 w-1.5 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
          style={{ background: 'var(--border-strong)' }}
        >
          <GripVertical size={10} className="-ml-px opacity-70" />
        </span>
      </div>

      <div
        className="flex items-start gap-2.5 border-b px-3 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: model.colorHex,
          }}
        >
          <Cable size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
          >
            Jumper
          </span>
          <p
            className="mt-1 truncate text-sm font-extrabold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {model.wireId}
          </p>
          <p className="truncate text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {model.netId}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close inspector"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        <section
          className="mb-3 space-y-2 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <WireRow label="Color">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: model.colorHex }}
              />
              {model.color}
            </span>
          </WireRow>
          {model.connectors && (
            <WireRow label="Ends">
              {model.connectors.start.toUpperCase()} → {model.connectors.end.toUpperCase()}
            </WireRow>
          )}
          {onResetRoute && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onResetRoute}
                className="w-full rounded-lg px-2 py-1.5 text-[11px] font-bold"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                Reset route
              </button>
              <p className="mt-1.5 text-[10px] font-medium leading-snug" style={{ color: 'var(--text-muted)' }}>
                Drag the pink handle on the bench to reshape this jumper. Endpoints stay
                locked to their holes.
              </p>
            </div>
          )}
        </section>

        <section className="mb-3">
          <p
            className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: 'var(--text-muted)' }}
          >
            Connection
          </p>
          <div
            className="space-y-2 rounded-xl px-3 py-2.5"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <EndpointCard
              title="From"
              endpoint={model.from}
              onHoleCommit={
                onEndpointHoleChange
                  ? (value) => onEndpointHoleChange('from', value)
                  : undefined
              }
            />
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <EndpointCard
              title="To"
              endpoint={model.to}
              onHoleCommit={
                onEndpointHoleChange
                  ? (value) => onEndpointHoleChange('to', value)
                  : undefined
              }
            />
          </div>
        </section>

        {model.netMembers.length > 0 && (
          <section>
            <p
              className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: 'var(--text-muted)' }}
            >
              Net Members
            </p>
            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <ul className="space-y-2">
                {model.netMembers.map((member, index) => (
                  <li key={`${member.label}-${index}`}>
                    <EndpointSummary endpoint={member} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}

/**
 * Compact label/value row for wire metadata.
 */
function WireRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
        {children}
      </span>
    </div>
  )
}

/**
 * Framed endpoint row for the selected wire's from/to pair.
 */
function EndpointCard({
  title,
  endpoint,
  onHoleCommit,
}: {
  title: string
  endpoint: WireEndpointDisplay
  onHoleCommit?: (holeLabel: string) => void
}) {
  const commitHole = useCallback(
    (value: string) => {
      if (!onHoleCommit) return
      parseBreadboardHoleLabel(value)
      onHoleCommit(value)
    },
    [onHoleCommit],
  )

  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      {endpoint.canEditHole && onHoleCommit ? (
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {endpoint.label.split(':')[0]}:
          </span>
          <input
            type="text"
            inputMode="text"
            defaultValue={endpoint.holeInput ?? ''}
            key={`${title}-${endpoint.holeInput ?? 'none'}`}
            onBlur={(e) => commitHole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitHole(e.currentTarget.value)
                e.currentTarget.blur()
              }
            }}
            className="w-14 rounded-md px-1 py-0.5 text-right font-mono text-[9px] font-semibold uppercase"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--leaf)',
            }}
            aria-label={`${title} breadboard hole`}
          />
        </div>
      ) : (
        <EndpointSummary endpoint={endpoint} />
      )}
    </div>
  )
}

/**
 * Single formatted endpoint summary.
 */
function EndpointSummary({ endpoint }: { endpoint: WireEndpointDisplay }) {
  return (
    <div className="min-w-0">
      <p
        className="truncate text-[12px] font-extrabold"
        style={{ color: endpoint.kind === 'breadboard' ? 'var(--leaf)' : 'var(--accent)' }}
      >
        {endpoint.label}
      </p>
      <p className="truncate text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {endpoint.detail}
      </p>
    </div>
  )
}
