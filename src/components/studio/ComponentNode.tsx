'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ComponentNodeData } from '@/lib/studio/flow-map'
import { WOKWI_SELECTION_OUTLINE } from '@/lib/studio/wokwi-connect-ui'
import { getWokwiVisual } from '@/lib/studio/wokwi-map'
import { usePartDrag } from './use-part-drag'
import { FallbackPartArt } from './FallbackPartArt'
import { WokwiPart } from './WokwiPart'

/** Invisible hit target (px) centered on the Wokwi SVG pin. */
const PIN_HIT_DEFAULT = 24
const PIN_HIT_BOARD = 14

type PinVisualState = 'idle' | 'hover' | 'source' | 'target' | 'connected'

/**
 * Resolve the compact pin color state.
 * @param connected Whether this pin already belongs to a net.
 * @param highlight Active wire source/target highlight, if any.
 * @param hovered Whether the pointer is over this pin.
 */
function pinVisualState(
  connected: boolean,
  highlight: 'source' | 'target' | null,
  hovered: boolean,
): PinVisualState {
  if (connected) return 'connected'
  if (highlight === 'source') return 'source'
  if (highlight === 'target') return 'target'
  if (hovered) return 'hover'
  return 'idle'
}

/**
 * React Flow node for one placed catalog component with Wokwi skin.
 * Drag the part body; drag from pin pads to wire (Wokwi-style).
 */
function ComponentNodeComponent({ data, selected }: NodeProps) {
  const d = data as ComponentNodeData
  const {
    terminals,
    terminalLayout,
    connectedTerminalIds,
    width,
    height,
    baseWidth,
    baseHeight,
    rotationZ,
    onPinWireStart,
    onPinWireTarget,
    onVisualPinLayout,
    onPartDragEnd,
    typeId,
  } = d

  const visual = getWokwiVisual(typeId)
  const { onPartPointerDown } = usePartDrag(d.instanceId, onPartDragEnd ?? (() => {}))

  const [wokwiPinLayout, setWokwiPinLayout] = useState<Record<string, { x: number; y: number }> | null>(
    null,
  )
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)

  const handlePinLayout = useCallback(
    (layout: Record<string, { x: number; y: number }>) => {
      if (Object.keys(layout).length === 0) return
      setWokwiPinLayout((prev) => ({ ...terminalLayout, ...prev, ...layout }))
      onVisualPinLayout?.(d.instanceId, layout)
    },
    [d.instanceId, onVisualPinLayout, terminalLayout],
  )

  const layout = useMemo(
    () => ({ ...terminalLayout, ...(wokwiPinLayout ?? {}) }),
    [terminalLayout, wokwiPinLayout],
  )

  const rot = rotationZ ?? 0
  const connectedTerminals = useMemo(
    () => new Set(connectedTerminalIds),
    [connectedTerminalIds],
  )
  const isBreadboard = typeId === 'breadboard-full'
  const isBoard = typeId === 'esp32-devkit-v1' || typeId === 'arduino-uno'
  const pinHit = isBoard ? PIN_HIT_BOARD : PIN_HIT_DEFAULT

  const selectionRing =
    selected && !visual && !isBreadboard
      ? '0 0 0 2px rgba(214,51,108,0.35)'
      : selected && isBreadboard
        ? 'inset 0 0 0 2px rgba(214,51,108,0.45)'
        : undefined

  return (
    <div
      className="relative"
      style={{
        width,
        height,
        boxShadow: selectionRing,
        borderRadius: visual ? 0 : isBreadboard ? 6 : 12,
      }}
    >
      <div
        className="berry-part-drag absolute left-1/2 top-1/2"
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
          outline: visual && selected ? WOKWI_SELECTION_OUTLINE : undefined,
          outlineOffset: visual && selected ? 2 : undefined,
        }}
        onPointerDown={onPartPointerDown}
      >
        {visual ? (
          <WokwiPart
            type={typeId}
            width={baseWidth}
            height={baseHeight}
            fit
            onPinLayout={handlePinLayout}
          />
        ) : (
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              borderRadius: isBreadboard ? 6 : 12,
              boxShadow:
                selected && !isBreadboard
                  ? '0 0 0 2px rgba(214,51,108,0.45)'
                  : isBreadboard
                    ? '0 2px 8px rgba(28,25,23,0.12)'
                    : undefined,
              border:
                isBreadboard
                  ? '1px solid #c4baa8'
                  : selected
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border-strong)',
              background: isBreadboard ? 'transparent' : 'var(--bg-elevated)',
            }}
          >
            <FallbackPartArt
              type={typeId}
              width={baseWidth}
              height={baseHeight}
              size={Math.min(baseWidth, baseHeight) * 0.85}
              variant={isBreadboard ? 'canvas' : 'tray'}
            />
            {typeId !== 'breadboard-full' && (
              <span
                className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                {d.label}
              </span>
            )}
          </div>
        )}

        {terminals.map((term) => {
          const rel = layout[term.id]
          if (!rel) return null
          const left = rel.x * baseWidth
          const top = rel.y * baseHeight
          const connected = connectedTerminals.has(term.id)
          const pinState = pinVisualState(connected, null, hoveredPin === term.id)

          return (
            <div key={term.id}>
              <Handle
                type="source"
                position={Position.Top}
                id={term.id}
                aria-label={`${term.label} pin`}
                className="pin-state-marker nopan nodrag"
                isConnectable={!connected}
                isConnectableStart={!connected}
                isConnectableEnd={!connected}
                style={{
                  left,
                  top,
                  width: pinHit,
                  height: pinHit,
                  transform: 'translate(-50%, -50%)',
                  cursor: connected ? 'not-allowed' : 'crosshair',
                  touchAction: 'none',
                }}
                data-pin-target="true"
                data-pin-state={pinState}
                data-terminal={term.id}
                data-component={d.instanceId}
                onPointerEnter={() => setHoveredPin(term.id)}
                onPointerLeave={() =>
                  setHoveredPin((id) => (id === term.id ? null : id))
                }
              />
              <Handle
                type="target"
                position={Position.Top}
                id={term.id}
                aria-hidden
                className="pin-flow-target"
                isConnectable={!connected}
                style={{
                  left,
                  top,
                  width: pinHit,
                  height: pinHit,
                  transform: 'translate(-50%, -50%)',
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const ComponentNode = memo(ComponentNodeComponent)
