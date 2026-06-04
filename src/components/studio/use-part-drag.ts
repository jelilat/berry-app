'use client'

import { useCallback, useRef } from 'react'
import { useReactFlow, type Node } from '@xyflow/react'
import { SCENE_SCALE } from '@/lib/studio/constants'
import { flowToScenePosition } from '@/lib/studio/layout'

/**
 * Drag a bench part by its body (not pins) without using React Flow node dragging.
 * @param instanceId Component instance id matching the React Flow node id.
 * @param onDragEnd Called with new scene position when drag completes.
 * @param onDragMove Optional callback with live scene position while dragging.
 */
export function usePartDrag(
  instanceId: string,
  onDragEnd: (sceneX: number, sceneY: number) => void,
  onDragMove?: (sceneX: number, sceneY: number) => void,
) {
  const { getNode, setNodes, screenToFlowPosition } = useReactFlow()
  const dragRef = useRef<{
    pointerId: number
    startPointerFlow: { x: number; y: number }
    startFlow: { x: number; y: number }
  } | null>(null)

  const endDrag = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return

    const node = getNode(instanceId) as Node | undefined
    if (!node) return

    const { x, y } = flowToScenePosition(node.position.x, node.position.y, SCENE_SCALE)
    onDragEnd(x, y)
  }, [getNode, instanceId, onDragEnd])

  const onPartPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return
      if ((event.target as HTMLElement).closest('[data-pin-target="true"]')) return

      const node = getNode(instanceId) as Node | undefined
      if (!node) return

      event.stopPropagation()
      event.preventDefault()

      dragRef.current = {
        pointerId: event.pointerId,
        startPointerFlow: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        startFlow: { ...node.position },
      }

      const onMove = (e: PointerEvent) => {
        const drag = dragRef.current
        if (!drag || e.pointerId !== drag.pointerId) return

        const pointerFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const dx = pointerFlow.x - drag.startPointerFlow.x
        const dy = pointerFlow.y - drag.startPointerFlow.y
        const nextX = drag.startFlow.x + dx
        const nextY = drag.startFlow.y + dy
        const scene = flowToScenePosition(nextX, nextY, SCENE_SCALE)

        setNodes((nodes) =>
          nodes.map((n) =>
            n.id === instanceId ? { ...n, position: { x: nextX, y: nextY } } : n,
          ),
        )
        onDragMove?.(scene.x, scene.y)
      }

      const onUp = (e: PointerEvent) => {
        if (dragRef.current?.pointerId !== e.pointerId) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        endDrag()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [endDrag, getNode, instanceId, onDragMove, screenToFlowPosition, setNodes],
  )

  return { onPartPointerDown }
}
