'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, GripVertical, RotateCcw, RotateCw, X } from 'lucide-react'
import {
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
} from '@/lib/studio/constants'
import { useInspectorResizableWidth } from '@/lib/studio/use-resizable-width'
import { getComponentDefinition } from '@/lib/project/catalog'
import type { BerryProject } from '@/lib/project/types'
import {
  buildComponentInspectorModel,
  formatCanvasCoordinate,
  formatSceneCoordinate,
} from '@/lib/studio/component-inspector'
import { hasWokwiVisual } from '@/lib/studio/wokwi-map'
import { FallbackPartArt } from './FallbackPartArt'
import { WokwiPart } from './WokwiPart'

/**
 * Right-side inspector for the selected bench component: physical props, rotation, pin nets.
 */
export function ComponentInspectorPanel({
  project,
  componentId,
  onClose,
  onRotate,
  onPositionChange,
}: {
  project: BerryProject
  componentId: string
  onClose: () => void
  onRotate: (deltaDegrees: number) => void
  onPositionChange: (x: number, y: number) => void
}) {
  const model = useMemo(
    () => buildComponentInspectorModel(project, componentId),
    [project, componentId],
  )

  const [physicalOpen, setPhysicalOpen] = useState(true)
  const [pinsOpen, setPinsOpen] = useState(true)
  const [posX, setPosX] = useState('')
  const [posY, setPosY] = useState('')
  const { width: panelWidth, onResizePointerDown } = useInspectorResizableWidth({
    min: INSPECTOR_WIDTH_MIN,
    max: INSPECTOR_WIDTH_MAX,
  })

  if (!model) return null

  const sceneXCm = formatSceneCoordinate(model.positionScene.x)
  const sceneYCm = formatSceneCoordinate(model.positionScene.y)
  const canvasX = formatCanvasCoordinate(model.positionCanvasPx.x)
  const canvasY = formatCanvasCoordinate(model.positionCanvasPx.y)

  const commitPosition = () => {
    const xCm = Number.parseFloat(posX)
    const yCm = Number.parseFloat(posY)
    if (Number.isFinite(xCm) && Number.isFinite(yCm)) {
      onPositionChange(xCm / 100, yCm / 100)
    }
  }

  const startEditPosition = () => {
    setPosX(sceneXCm)
    setPosY(sceneYCm)
  }

  const hasWokwi = hasWokwiVisual(model.typeId)
  const def = getComponentDefinition(model.typeId)

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
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{
            background: 'linear-gradient(180deg, #faf9f7 0%, #f0ede8 100%)',
            border: '1px solid var(--border)',
          }}
        >
          {hasWokwi ? (
            <WokwiPart type={model.typeId} width={52} height={40} fit />
          ) : (
            <FallbackPartArt type={model.typeId} size={44} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(234,88,12,0.12)', color: '#c2410c' }}
          >
            {model.groupBadge}
          </span>
          <p
            className="mt-1 truncate text-sm font-extrabold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {model.instanceId}
          </p>
          <p className="truncate text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {def.name}
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
        <InspectorSection
          title="Physical"
          open={physicalOpen}
          onToggle={() => setPhysicalOpen((o) => !o)}
        >
          <InspectorRow label="Size">
            {model.physicalMm.width.toFixed(1)} × {model.physicalMm.height.toFixed(1)} ×{' '}
            {model.physicalMm.depth} mm
          </InspectorRow>
          <InspectorRow label="Bench (cm)">
            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="inspector-pos-x">
                X position cm
              </label>
              <input
                id="inspector-pos-x"
                type="number"
                step="0.1"
                defaultValue={sceneXCm}
                key={`x-${sceneXCm}-${model.rotationZ}`}
                onFocus={startEditPosition}
                onChange={(e) => setPosX(e.target.value)}
                onBlur={commitPosition}
                onKeyDown={(e) => e.key === 'Enter' && commitPosition()}
                className="w-[4.5rem] rounded-md px-1.5 py-0.5 text-right text-[11px] font-semibold tabular-nums"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <span style={{ color: 'var(--text-muted)' }}>,</span>
              <label className="sr-only" htmlFor="inspector-pos-y">
                Y position cm
              </label>
              <input
                id="inspector-pos-y"
                type="number"
                step="0.1"
                defaultValue={sceneYCm}
                key={`y-${sceneYCm}-${model.rotationZ}`}
                onFocus={startEditPosition}
                onChange={(e) => setPosY(e.target.value)}
                onBlur={commitPosition}
                onKeyDown={(e) => e.key === 'Enter' && commitPosition()}
                className="w-[4.5rem] rounded-md px-1.5 py-0.5 text-right text-[11px] font-semibold tabular-nums"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </InspectorRow>
          <InspectorRow label="Canvas (px)">
            ({canvasX}, {canvasY})
          </InspectorRow>
          <InspectorRow label="Rotation">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tabular-nums">{model.rotationZ}°</span>
              <button
                type="button"
                onClick={() => onRotate(-90)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-overlay)]"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                title="Rotate counter-clockwise 90°"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                onClick={() => onRotate(90)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-overlay)]"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                title="Rotate clockwise 90°"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </InspectorRow>
          {model.parentId && (
            <InspectorRow label="Parent">{model.parentId}</InspectorRow>
          )}
        </InspectorSection>

        {model.pins.length > 0 && (
          <InspectorSection
            title="Pins"
            open={pinsOpen}
            onToggle={() => setPinsOpen((o) => !o)}
            badge={`${model.connectedPinCount}/${model.pins.length}`}
          >
            <div
              className="max-h-[min(320px,45vh)] overflow-auto rounded-lg"
              style={{ border: '1px solid var(--border)' }}
            >
              <table className="min-w-[28rem] w-full text-left text-[10px]">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                    <th className="whitespace-nowrap px-2 py-1.5 font-bold">ID</th>
                    <th className="whitespace-nowrap px-2 py-1.5 font-bold">HOLE</th>
                    <th className="whitespace-nowrap px-2 py-1.5 font-bold">TYPE</th>
                    <th className="whitespace-nowrap px-2 py-1.5 font-bold">NET</th>
                    <th className="min-w-[9rem] whitespace-nowrap px-2 py-1.5 font-bold">
                      CONNECTED
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.pins.map((pin) => (
                    <tr
                      key={pin.terminalId}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: pin.netId ? 'rgba(15,168,134,0.04)' : undefined,
                      }}
                    >
                      <td
                        className="whitespace-nowrap px-2 py-1.5 font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {pin.label}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[9px]">
                        {pin.hole ? (
                          <span style={{ color: 'var(--text-primary)' }}>{pin.hole}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-2 py-1.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {pin.displayKind}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {pin.netId ? (
                          <span className="font-semibold" style={{ color: 'var(--leaf)' }}>
                            {pin.netId}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td
                        className="min-w-[9rem] px-2 py-1.5 align-top"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {pin.peers.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {pin.peers.map((peer) => (
                              <li key={`${peer.componentId}:${peer.terminalId}`}>
                                <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                                  {peer.componentName}
                                </span>
                                :{peer.terminalLabel}
                              </li>
                            ))}
                          </ul>
                        )}
                        {pin.wireIds.length > 0 && (
                          <p className="mt-0.5 text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            wires: {pin.wireIds.join(', ')}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InspectorSection>
        )}

        {model.pins.length === 0 && (
          <p className="px-1 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            This part has no electrical pins in the catalog.
          </p>
        )}
      </div>
    </aside>
  )
}

/**
 * Collapsible inspector section with title and optional count badge.
 */
function InspectorSection({
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  badge?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 flex w-full items-center justify-between px-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-1">
          <ChevronDown
            size={12}
            className="transition-transform"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
          {title}
        </span>
        {badge && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal"
            style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          className="space-y-2 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          {children}
        </div>
      )}
    </section>
  )
}

/**
 * Single label/value row in the physical section.
 */
function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
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
