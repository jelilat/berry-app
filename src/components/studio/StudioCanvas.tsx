'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type Connection,
  type Edge,
  type OnNodesChange,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { orthogonalWireRoute } from '@/lib/project/wire-route'
import { position2d } from '@/lib/project/vec3'
import { moveComponent, removeComponent } from '@/lib/project/mutations'
import type { BerryProject } from '@/lib/project/types'
import type { ComponentTypeId } from '@/lib/project/types'
import { COMPONENT_NODE_TYPE, SCENE_SCALE } from '@/lib/studio/constants'
import type { ComponentNodeData, TerminalSelection } from '@/lib/studio/flow-map'
import { projectToFlowNodes } from '@/lib/studio/flow-map'
import {
  projectToLiveWireOverlay,
  rerouteWiresVisual,
  scenePositionOverridesFromNodes,
} from '@/lib/studio/wire-routing'
import { PinLayoutRegistry } from '@/lib/studio/pin-layout-registry'
import {
  catalogTerminalLayout,
  terminalCanvasPosition,
} from '@/lib/studio/studio-terminal-layout'
import { wireStrokeHex } from '@/lib/studio/wire-colors'
import {
  connectedTerminalKeys,
  isTerminalConnected,
} from '@/lib/studio/connect-pins'
import {
  sameTerminal,
  terminalFromPinElement,
  type WireDraftState,
} from '@/lib/studio/wire-draft'
import { nearestWireTarget } from '@/lib/studio/wire-target'
import { getWireTemplate } from '@/lib/project/catalog'
import { componentDropScenePosition } from '@/lib/studio/drop-position'
import { BreadboardHoleOverlay } from './BreadboardHoleOverlay'
import { ComponentNode } from './ComponentNode'
import { WireOverlay } from './WireOverlay'

const nodeTypes = { [COMPONENT_NODE_TYPE]: ComponentNode }
const WIRE_DRAG_THRESHOLD_PX = 6

/**
 * React Flow bench canvas synced to {@link BerryProject}.
 */
export function StudioCanvas({
  project,
  activeWireType,
  selectedNodeId,
  selectedWireId,
  onProjectChange,
  onPartDrop,
  onWireConnect,
  onSelectionChange,
  onWireSelectionChange,
}: {
  project: BerryProject
  activeWireType: ComponentTypeId
  selectedNodeId: string | null
  selectedWireId: string | null
  onProjectChange: (next: BerryProject) => void
  onPartDrop: (type: ComponentTypeId, x: number, y: number) => void
  onWireConnect: (
    from: TerminalSelection,
    to: TerminalSelection,
    points: { x: number; y: number; z: number }[],
  ) => void
  onSelectionChange: (nodeId: string | null) => void
  onWireSelectionChange: (wireId: string | null) => void
}) {
  return (
    <ReactFlowProvider>
      <StudioCanvasInner
        project={project}
        activeWireType={activeWireType}
        selectedNodeId={selectedNodeId}
        selectedWireId={selectedWireId}
        onProjectChange={onProjectChange}
        onPartDrop={onPartDrop}
        onWireConnect={onWireConnect}
        onSelectionChange={onSelectionChange}
        onWireSelectionChange={onWireSelectionChange}
      />
    </ReactFlowProvider>
  )
}

/**
 * Canvas implementation with React Flow hooks for wire drag coordinates.
 */
function StudioCanvasInner({
  project,
  activeWireType,
  selectedNodeId,
  selectedWireId,
  onProjectChange,
  onPartDrop,
  onWireConnect,
  onSelectionChange,
  onWireSelectionChange,
}: {
  project: BerryProject
  activeWireType: ComponentTypeId
  selectedNodeId: string | null
  selectedWireId: string | null
  onProjectChange: (next: BerryProject) => void
  onPartDrop: (type: ComponentTypeId, x: number, y: number) => void
  onWireConnect: (
    from: TerminalSelection,
    to: TerminalSelection,
    points: { x: number; y: number; z: number }[],
  ) => void
  onSelectionChange: (nodeId: string | null) => void
  onWireSelectionChange: (wireId: string | null) => void
}) {
  const { screenToFlowPosition } = useReactFlow()
  const projectRef = useRef(project)
  projectRef.current = project
  const pinLayoutsRef = useRef(new PinLayoutRegistry())
  const connectedTerminalsRef = useRef(new Set<string>())
  connectedTerminalsRef.current = connectedTerminalKeys(project)
  const onWireConnectRef = useRef(onWireConnect)
  onWireConnectRef.current = onWireConnect
  const onPartDropRef = useRef(onPartDrop)
  onPartDropRef.current = onPartDrop

  const [pinLayoutVersion, setPinLayoutVersion] = useState(0)
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null)
  const [wireDraft, setWireDraft] = useState<WireDraftState | null>(null)
  const wireDraftRef = useRef(wireDraft)
  wireDraftRef.current = wireDraft
  const wireListenersRef = useRef<{
    move: (e: PointerEvent) => void
    up: (e: PointerEvent) => void
    cancel: () => void
  } | null>(null)

  const wirePreviewColor = wireStrokeHex(getWireTemplate(activeWireType).defaultColor)

  useEffect(() => {
    for (const inst of project.components) {
      pinLayoutsRef.current.mergeCatalogBaseline(
        inst.id,
        catalogTerminalLayout(inst),
      )
    }
  }, [project.components])

  useEffect(() => {
    return () => wireListenersRef.current?.cancel()
  }, [])

  useEffect(() => {
    if (!wireDraft) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        wireListenersRef.current?.cancel()
        wireListenersRef.current = null
        setWireDraft(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [wireDraft])

  const handleVisualPinLayout = useCallback(
    (instanceId: string, layout: Record<string, { x: number; y: number }>) => {
      if (!pinLayoutsRef.current.mergeChanged(instanceId, layout)) return
      setPinLayoutVersion((v) => v + 1)
    },
    [],
  )

  const clearWireListeners = useCallback(() => {
    wireListenersRef.current?.cancel()
    wireListenersRef.current = null
  }, [])

  const cancelWireDraft = useCallback(() => {
    clearWireListeners()
    setWireDraft(null)
  }, [clearWireListeners])

  const resolveHoverTarget = useCallback((clientX: number, clientY: number) => {
    const draft = wireDraftRef.current
    if (!draft) return { hoverTarget: null, hoverTargetPx: null }

    const cursorPx = screenToFlowPosition({ x: clientX, y: clientY })
    const nearest = nearestWireTarget(
      projectRef.current,
      cursorPx,
      SCENE_SCALE,
      pinLayoutsRef.current,
      {
        ignore: draft.from,
        ignoreComponentId: draft.from.componentId,
        ignoreTerminalKeys: connectedTerminalsRef.current,
      },
    )
    if (nearest) {
      return {
        hoverTarget: nearest.target,
        hoverTargetPx: nearest.positionPx,
      }
    }

    const elements = document.elementsFromPoint(clientX, clientY)
    let target: TerminalSelection | null = null
    for (const el of elements) {
      target = terminalFromPinElement(el)
      if (
        target &&
        !sameTerminal(draft.from, target) &&
        target.componentId !== draft.from.componentId &&
        !isTerminalConnected(
          connectedTerminalsRef.current,
          target.componentId,
          target.terminalId,
        )
      ) {
        break
      }
      target = null
    }

    if (target) {
      const px = terminalCanvasPosition(
        projectRef.current,
        target.componentId,
        target.terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
      return { hoverTarget: target, hoverTargetPx: px }
    }

    return {
      hoverTarget: null,
      hoverTargetPx: null,
    }
  }, [screenToFlowPosition])

  const finishWireDrag = useCallback(
    (clientX: number, clientY: number) => {
      clearWireListeners()

      const draft = wireDraftRef.current
      if (!draft) return

      const { hoverTarget } = resolveHoverTarget(clientX, clientY)
      if (hoverTarget && !sameTerminal(draft.from, hoverTarget)) {
        const fromBench = terminalCanvasPosition(
          projectRef.current,
          draft.from.componentId,
          draft.from.terminalId,
          SCENE_SCALE,
          pinLayoutsRef.current,
        )
        const toBench = terminalCanvasPosition(
          projectRef.current,
          hoverTarget.componentId,
          hoverTarget.terminalId,
          SCENE_SCALE,
          pinLayoutsRef.current,
        )
        if (fromBench && toBench) {
          const route = orthogonalWireRoute(fromBench, toBench)
          onWireConnectRef.current(
            draft.from,
            hoverTarget,
            route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
          )
        }
      }
      setWireDraft(null)
    },
    [clearWireListeners, resolveHoverTarget],
  )

  const isValidReactFlowConnection = useCallback((connection: Connection | Edge): boolean => {
    const { source, target } = connection
    const sourceHandle = connection.sourceHandle ?? null
    const targetHandle = connection.targetHandle ?? null
    if (!source || !target || !sourceHandle || !targetHandle) return false
    if (source === target) return false
    if (isTerminalConnected(connectedTerminalsRef.current, source, sourceHandle)) {
      return false
    }
    if (isTerminalConnected(connectedTerminalsRef.current, target, targetHandle)) {
      return false
    }
    return true
  }, [])

  const handleReactFlowConnect = useCallback(
    (connection: Connection) => {
      if (!isValidReactFlowConnection(connection)) return
      const { source, target, sourceHandle, targetHandle } = connection
      if (!source || !target || !sourceHandle || !targetHandle) return

      const from = { componentId: source, terminalId: sourceHandle }
      const to = { componentId: target, terminalId: targetHandle }
      const fromBench = terminalCanvasPosition(
        projectRef.current,
        from.componentId,
        from.terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
      const toBench = terminalCanvasPosition(
        projectRef.current,
        to.componentId,
        to.terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
      if (!fromBench || !toBench) return

      const route = orthogonalWireRoute(fromBench, toBench)
      onWireConnectRef.current(
        from,
        to,
        route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
      )
    },
    [isValidReactFlowConnection],
  )

  const handlePinWireTarget = useCallback(
    (componentId: string, terminalId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      event.preventDefault()

      const draft = wireDraftRef.current
      if (!draft) return

      const target = { componentId, terminalId }
      if (
        sameTerminal(draft.from, target) ||
        target.componentId === draft.from.componentId ||
        isTerminalConnected(connectedTerminalsRef.current, componentId, terminalId)
      ) {
        return
      }

      clearWireListeners()

      const fromBench = terminalCanvasPosition(
        projectRef.current,
        draft.from.componentId,
        draft.from.terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
      const toBench = terminalCanvasPosition(
        projectRef.current,
        target.componentId,
        target.terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
      if (fromBench && toBench) {
        const route = orthogonalWireRoute(fromBench, toBench)
        onWireConnectRef.current(
          draft.from,
          target,
          route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
        )
      }
      setWireDraft(null)
    },
    [clearWireListeners],
  )

  const handlePinWireStart = useCallback(
    (componentId: string, terminalId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      event.preventDefault()

      clearWireListeners()
      if (
        isTerminalConnected(connectedTerminalsRef.current, componentId, terminalId)
      ) {
        setWireDraft(null)
        return
      }

      const startPx = terminalCanvasPosition(
        projectRef.current,
        componentId,
        terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
      if (!startPx) return

      const pointerId = event.pointerId
      const pointerStart = { x: event.clientX, y: event.clientY }
      let dragged = false

      const onMove = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return
        const cursorPx = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const distance = Math.hypot(
          e.clientX - pointerStart.x,
          e.clientY - pointerStart.y,
        )
        dragged = dragged || distance >= WIRE_DRAG_THRESHOLD_PX
        const { hoverTarget, hoverTargetPx } = resolveHoverTarget(e.clientX, e.clientY)
        setWireDraft((draft) =>
          draft
            ? {
                ...draft,
                cursorPx,
                mode: dragged ? 'dragging' : 'armed',
                hoverTarget: dragged ? hoverTarget : null,
                hoverTargetPx: dragged ? hoverTargetPx : null,
              }
            : {
                from: { componentId, terminalId },
                startPx,
                cursorPx,
                mode: dragged ? 'dragging' : 'armed',
                hoverTarget: dragged ? hoverTarget : null,
                hoverTargetPx: dragged ? hoverTargetPx : null,
              },
        )
      }

      const onUp = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return
        if (dragged) {
          finishWireDrag(e.clientX, e.clientY)
          return
        }
        clearWireListeners()
        setWireDraft((draft) =>
          draft
            ? {
                ...draft,
                cursorPx: draft.startPx,
                mode: 'armed',
                hoverTarget: null,
                hoverTargetPx: null,
              }
            : null,
        )
      }

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cancelWireDraft()
        }
      }

      const cancel = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('keydown', onKeyDown)
      }

      wireListenersRef.current = { move: onMove, up: onUp, cancel }

      setWireDraft({
        from: { componentId, terminalId },
        startPx,
        cursorPx: startPx,
        mode: 'armed',
        hoverTarget: null,
        hoverTargetPx: null,
      })

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('keydown', onKeyDown)
    },
    [
      cancelWireDraft,
      clearWireListeners,
      finishWireDrag,
      resolveHoverTarget,
      screenToFlowPosition,
    ],
  )

  const handlePartDragEnd = useCallback(
    (instanceId: string, sceneX: number, sceneY: number) => {
      try {
        const moved = moveComponent(projectRef.current, instanceId, sceneX, sceneY, {
          snap: false,
        })
        onProjectChange(
          rerouteWiresVisual(moved, instanceId, pinLayoutsRef.current, SCENE_SCALE),
        )
      } catch {
        /* ignore invalid move */
      }
    },
    [onProjectChange],
  )

  const buildNodes = useCallback(
    (): Node<ComponentNodeData>[] =>
      projectToFlowNodes(projectRef.current, selectedNodeId).map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
        data: {
          ...n.data,
          onPinWireStart: handlePinWireStart,
          onPinWireTarget: handlePinWireTarget,
          onVisualPinLayout: handleVisualPinLayout,
          onPartDragEnd: (sceneX: number, sceneY: number) =>
            handlePartDragEnd(n.id, sceneX, sceneY),
        },
      })),
    [
      selectedNodeId,
      handlePinWireStart,
      handlePinWireTarget,
      handleVisualPinLayout,
      handlePartDragEnd,
    ],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes())
  const wires = useMemo(() => {
    const overrides = scenePositionOverridesFromNodes(project, nodes, SCENE_SCALE)
    return projectToLiveWireOverlay(
      project,
      pinLayoutsRef.current,
      SCENE_SCALE,
      overrides.size > 0 ? overrides : undefined,
    )
  }, [project, nodes, pinLayoutVersion])

  useEffect(() => {
    setNodes(buildNodes())
  }, [project, buildNodes, setNodes])

  const handleNodesChange: OnNodesChange<Node<ComponentNodeData>> = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds))
      for (const change of changes) {
        if (change.type === 'select' && change.selected) {
          onSelectionChange(change.id)
          onWireSelectionChange(null)
        }
        if (change.type === 'select' && !change.selected) {
          onSelectionChange(null)
        }
        if (change.type === 'remove') {
          pinLayoutsRef.current.delete(change.id)
          try {
            onProjectChange(removeComponent(projectRef.current, change.id))
          } catch {
            /* ignore */
          }
        }
      }
    },
    [setNodes, onProjectChange, onSelectionChange, onWireSelectionChange],
  )

  const onPaneClick = useCallback(() => {
    if (wireDraftRef.current) {
      cancelWireDraft()
      return
    }
    onSelectionChange(null)
    onWireSelectionChange(null)
    setHoveredWireId(null)
  }, [cancelWireDraft, onSelectionChange, onWireSelectionChange])

  const handleWireSelect = useCallback(
    (wireId: string) => {
      onWireSelectionChange(wireId)
      onSelectionChange(null)
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
    },
    [onWireSelectionChange, onSelectionChange, setNodes],
  )

  const handleCanvasDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('application/x-berry-component')) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const type = event.dataTransfer.getData('application/x-berry-component') as ComponentTypeId
      if (!type) return

      event.preventDefault()
      const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const scenePosition = componentDropScenePosition(type, flowPoint, SCENE_SCALE)
      onPartDropRef.current(type, scenePosition.x, scenePosition.y)
    },
    [screenToFlowPosition],
  )

  return (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden rounded-2xl"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onConnect={handleReactFlowConnect}
        isValidConnection={isValidReactFlowConnection}
        onPaneClick={onPaneClick}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Step}
        connectionLineStyle={{
          stroke: wirePreviewColor,
          strokeWidth: 2.5,
          strokeLinecap: 'round',
        }}
        connectionRadius={24}
        connectOnClick
        elevateNodesOnSelect={false}
        zIndexMode="manual"
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.4}
        maxZoom={2.5}
        panOnDrag={!wireDraft}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        deleteKeyCode={
          wireDraft || selectedWireId ? null : ['Backspace', 'Delete']
        }
        className="berry-studio-flow h-full w-full rounded-2xl"
      >
        <Background gap={SCENE_SCALE * 0.02} size={1} color="rgba(28,25,23,0.08)" />
        <Controls showInteractive={false} />
        <WireOverlay
          wires={wires}
          selectedWireId={selectedWireId}
          hoveredWireId={hoveredWireId}
          onWireSelect={handleWireSelect}
          onWireHover={setHoveredWireId}
        />
        {!wireDraft && (
          <BreadboardHoleOverlay project={project} selectedId={selectedNodeId} />
        )}
      </ReactFlow>
    </div>
  )
}
