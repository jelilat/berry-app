'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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
  type OnConnectStartParams,
  type FinalConnectionState,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { orthogonalWireRoute } from '@/lib/project/wire-route'
import { position2d } from '@/lib/project/vec3'
import {
  isBreadboardHoleRef,
  moveComponent,
  removeComponent,
  type BreadboardHoleRef,
  type WireEndpointRef,
} from '@/lib/project/mutations'
import { breadboardPhysicalSiteKey } from '@/lib/project/breadboard-nets'
import { snapPositionToBreadboardHole } from '@/lib/studio/breadboard-layout'
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
  isBreadboardEndpointOccupied,
  isTerminalConnected,
  terminalOccupiesBreadboardEndpoint,
} from '@/lib/studio/connect-pins'
import {
  sameTerminal,
  terminalFromPinElement,
  type WireDraftState,
} from '@/lib/studio/wire-draft'
import {
  breadboardWireTargetAtPoint,
  nearestWireTarget,
} from '@/lib/studio/wire-target'
import { getWireTemplate } from '@/lib/project/catalog'
import { wireConnectorsFitEndpoints } from '@/lib/project/connection-gender'
import { componentDropScenePosition } from '@/lib/studio/drop-position'
import {
  evaluateBreadboardSnap,
  findBreadboardAtPoint,
  holeBenchPosition,
} from '@/lib/studio/breadboard-snap'
import {
  BreadboardHoleOverlay,
  type BreadboardHoleHoverMarker,
} from './BreadboardHoleOverlay'
import { ComponentNode } from './ComponentNode'
import { WireDraftOverlay } from './WireDraftOverlay'
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
  onPlacementError,
}: {
  project: BerryProject
  activeWireType: ComponentTypeId
  selectedNodeId: string | null
  selectedWireId: string | null
  onProjectChange: (next: BerryProject) => void
  onPartDrop: (type: ComponentTypeId, x: number, y: number) => void
  onWireConnect: (
    from: WireEndpointRef,
    to: WireEndpointRef,
    points: { x: number; y: number; z: number }[],
  ) => void
  onSelectionChange: (nodeId: string | null) => void
  onWireSelectionChange: (wireId: string | null) => void
  onPlacementError?: (message: string | null) => void
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
        onPlacementError={onPlacementError}
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
  onPlacementError,
}: {
  project: BerryProject
  activeWireType: ComponentTypeId
  selectedNodeId: string | null
  selectedWireId: string | null
  onProjectChange: (next: BerryProject) => void
  onPartDrop: (type: ComponentTypeId, x: number, y: number) => void
  onWireConnect: (
    from: WireEndpointRef,
    to: WireEndpointRef,
    points: { x: number; y: number; z: number }[],
  ) => void
  onSelectionChange: (nodeId: string | null) => void
  onWireSelectionChange: (wireId: string | null) => void
  onPlacementError?: (message: string | null) => void
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
  const onPlacementErrorRef = useRef(onPlacementError)
  onPlacementErrorRef.current = onPlacementError

  const [pinLayoutVersion, setPinLayoutVersion] = useState(0)
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null)
  const [breadboardHoverMarkers, setBreadboardHoverMarkers] = useState<
    BreadboardHoleHoverMarker[]
  >([])
  const [wireDraft, setWireDraft] = useState<WireDraftState | null>(null)
  const [breadboardWireDraft, setBreadboardWireDraft] = useState<{
    from: BreadboardHoleRef
    startPx: { x: number; y: number }
    cursorPx: { x: number; y: number }
    hoverTarget: null
    hoverTargetPx: { x: number; y: number } | null
  } | null>(null)
  const wireDraftRef = useRef(wireDraft)
  wireDraftRef.current = wireDraft
  const breadboardWireDraftRef = useRef(breadboardWireDraft)
  breadboardWireDraftRef.current = breadboardWireDraft
  const wireListenersRef = useRef<{
    move: (e: PointerEvent) => void
    up: (e: PointerEvent) => void
    cancel: () => void
  } | null>(null)
  const connectSourceRef = useRef<TerminalSelection | null>(null)
  const connectMoveRef = useRef<((e: PointerEvent) => void) | null>(null)
  const [reactFlowConnecting, setReactFlowConnecting] = useState(false)

  const activeWireConnectors = useMemo(
    () => getWireTemplate(activeWireType).connectors,
    [activeWireType],
  )
  const wirePreviewColor = wireStrokeHex(getWireTemplate(activeWireType).defaultColor)

  /**
   * Whether the active jumper template can mate both endpoints (allows end flip).
   * @param from Wire source endpoint.
   * @param to Wire target endpoint.
   */
  const canConnectWithActiveWire = useCallback(
    (from: WireEndpointRef, to: WireEndpointRef) =>
      wireConnectorsFitEndpoints(from, to, activeWireConnectors),
    [activeWireConnectors],
  )

  useEffect(() => {
    for (const inst of project.components) {
      pinLayoutsRef.current.mergeCatalogBaseline(
        inst.id,
        catalogTerminalLayout(inst),
      )
    }
  }, [project.components])

  useEffect(() => {
    return () => {
      wireListenersRef.current?.cancel()
      if (connectMoveRef.current) {
        window.removeEventListener('pointermove', connectMoveRef.current)
        connectMoveRef.current = null
      }
    }
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
    setBreadboardWireDraft(null)
  }, [clearWireListeners])

  const endpointCanvasPosition = useCallback(
    (endpoint: WireEndpointRef): { x: number; y: number } | null => {
      if (isBreadboardHoleRef(endpoint)) {
        const breadboard = projectRef.current.components.find(
          (c) => c.id === endpoint.breadboardId,
        )
        if (!breadboard || breadboard.type !== 'breadboard-full') return null
        const bench = holeBenchPosition(breadboard, endpoint.site)
        return { x: bench.x * SCENE_SCALE, y: bench.y * SCENE_SCALE }
      }
      return terminalCanvasPosition(
        projectRef.current,
        endpoint.componentId,
        endpoint.terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
    },
    [],
  )

  const resolveHoverTarget = useCallback(
    (clientX: number, clientY: number): {
      hoverTarget: TerminalSelection | null
      hoverTargetPx: { x: number; y: number } | null
      hoverEndpoint: WireEndpointRef | null
    } => {
      const draft = wireDraftRef.current
      if (!draft) {
        return { hoverTarget: null, hoverTargetPx: null, hoverEndpoint: null }
      }
      if (isBreadboardHoleRef(draft.from)) {
        return { hoverTarget: null, hoverTargetPx: null, hoverEndpoint: null }
      }

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
      if (nearest && canConnectWithActiveWire(draft.from, nearest.target)) {
        return {
          hoverTarget: nearest.target,
          hoverTargetPx: nearest.positionPx,
          hoverEndpoint: nearest.target,
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
          ) &&
          canConnectWithActiveWire(draft.from, target)
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
        return { hoverTarget: target, hoverTargetPx: px, hoverEndpoint: target }
      }

      const breadboardTarget = breadboardWireTargetAtPoint(
        projectRef.current,
        cursorPx,
        SCENE_SCALE,
      )
      if (
        breadboardTarget &&
        !terminalOccupiesBreadboardEndpoint(
          projectRef.current,
          draft.from.componentId,
          draft.from.terminalId,
          breadboardTarget.target,
        ) &&
        canConnectWithActiveWire(draft.from, breadboardTarget.target)
      ) {
        return {
          hoverTarget: null,
          hoverTargetPx: breadboardTarget.positionPx,
          hoverEndpoint: breadboardTarget.target,
        }
      }

      return {
        hoverTarget: null,
        hoverTargetPx: null,
        hoverEndpoint: null,
      }
    },
    [canConnectWithActiveWire, screenToFlowPosition],
  )

  const finishWireDrag = useCallback(
    (clientX: number, clientY: number) => {
      clearWireListeners()

      const draft = wireDraftRef.current
      if (!draft) return
      if (isBreadboardHoleRef(draft.from)) return

      const { hoverEndpoint, hoverTargetPx } = resolveHoverTarget(clientX, clientY)
      if (
        hoverEndpoint &&
        hoverTargetPx &&
        canConnectWithActiveWire(draft.from, hoverEndpoint)
      ) {
        const fromBench = terminalCanvasPosition(
          projectRef.current,
          draft.from.componentId,
          draft.from.terminalId,
          SCENE_SCALE,
          pinLayoutsRef.current,
        )
        if (fromBench) {
          const route = orthogonalWireRoute(fromBench, hoverTargetPx)
          onWireConnectRef.current(
            draft.from,
            hoverEndpoint,
            route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
          )
        }
      }
      setWireDraft(null)
    },
    [canConnectWithActiveWire, clearWireListeners, resolveHoverTarget],
  )

  const sameBreadboardEndpoint = useCallback(
    (a: BreadboardHoleRef, b: BreadboardHoleRef): boolean =>
      a.breadboardId === b.breadboardId &&
      breadboardPhysicalSiteKey(a.site) === breadboardPhysicalSiteKey(b.site),
    [],
  )

  const handleBreadboardHolePointerDown = useCallback(
    (
      endpoint: BreadboardHoleRef,
      positionPx: { x: number; y: number },
      event: ReactPointerEvent<SVGCircleElement>,
    ) => {
      if (isBreadboardEndpointOccupied(projectRef.current, endpoint)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const active = breadboardWireDraftRef.current
      if (!active) {
        setBreadboardWireDraft({
          from: endpoint,
          startPx: positionPx,
          cursorPx: positionPx,
          hoverTarget: null,
          hoverTargetPx: null,
        })
        onSelectionChange(null)
        onWireSelectionChange(null)
        return
      }

      if (sameBreadboardEndpoint(active.from, endpoint)) {
        setBreadboardWireDraft(null)
        return
      }

      const fromPx = endpointCanvasPosition(active.from)
      if (!fromPx) {
        setBreadboardWireDraft(null)
        return
      }

      if (!canConnectWithActiveWire(active.from, endpoint)) {
        setBreadboardWireDraft(null)
        return
      }

      const route = orthogonalWireRoute(fromPx, positionPx)
      onWireConnectRef.current(
        active.from,
        endpoint,
        route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
      )
      setBreadboardWireDraft(null)
    },
    [
      canConnectWithActiveWire,
      endpointCanvasPosition,
      onSelectionChange,
      onWireSelectionChange,
      sameBreadboardEndpoint,
    ],
  )

  useEffect(() => {
    if (!breadboardWireDraft) return
    const onMove = (event: PointerEvent) => {
      const cursorPx = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setBreadboardWireDraft((draft) =>
        draft ? { ...draft, cursorPx, hoverTargetPx: null } : null,
      )
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBreadboardWireDraft(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [breadboardWireDraft, screenToFlowPosition])

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
    return canConnectWithActiveWire(
      { componentId: source, terminalId: sourceHandle },
      { componentId: target, terminalId: targetHandle },
    )
  }, [canConnectWithActiveWire])

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

      if (!canConnectWithActiveWire(from, to)) return

      const route = orthogonalWireRoute(fromBench, toBench)
      onWireConnectRef.current(
        from,
        to,
        route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
      )
    },
    [canConnectWithActiveWire, isValidReactFlowConnection],
  )

  const clearConnectMoveListener = useCallback(() => {
    if (connectMoveRef.current) {
      window.removeEventListener('pointermove', connectMoveRef.current)
      connectMoveRef.current = null
    }
  }, [])

  const terminalFromConnectionState = useCallback(
    (connectionState: FinalConnectionState): TerminalSelection | null => {
      const fromHandle = connectionState.fromHandle
      if (!fromHandle?.nodeId || !fromHandle.id) return null
      return { componentId: fromHandle.nodeId, terminalId: fromHandle.id }
    },
    [],
  )

  const handleConnectStart = useCallback(
    (_event: unknown, params: OnConnectStartParams) => {
      setReactFlowConnecting(true)
      connectSourceRef.current =
        params.nodeId && params.handleId
          ? { componentId: params.nodeId, terminalId: params.handleId }
          : null

      clearConnectMoveListener()
      if (!connectSourceRef.current) return

      const onMove = (e: PointerEvent) => {
        const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const sceneX = flow.x / SCENE_SCALE
        const sceneY = flow.y / SCENE_SCALE
        const breadboard = findBreadboardAtPoint(projectRef.current, sceneX, sceneY)
        if (!breadboard) {
          setBreadboardHoverMarkers([])
          return
        }
        const snapped = snapPositionToBreadboardHole(
          breadboard.transform.position.x,
          breadboard.transform.position.y,
          sceneX,
          sceneY,
        )
        const bench = holeBenchPosition(breadboard, snapped.hole)
        setBreadboardHoverMarkers([
          { id: 'connect-hole-hover', x: bench.x, y: bench.y },
        ])
      }
      connectMoveRef.current = onMove
      window.addEventListener('pointermove', onMove)
    },
    [clearConnectMoveListener, screenToFlowPosition],
  )

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      clearConnectMoveListener()
      setBreadboardHoverMarkers([])
      setReactFlowConnecting(false)

      const from =
        connectSourceRef.current ?? terminalFromConnectionState(connectionState)
      connectSourceRef.current = null
      if (!from) return
      // A valid handle-to-handle drop is already handled by onConnect.
      if (connectionState.toHandle) return
      if (
        isTerminalConnected(
          connectedTerminalsRef.current,
          from.componentId,
          from.terminalId,
        )
      ) {
        return
      }

      const point =
        'changedTouches' in event && event.changedTouches.length > 0
          ? event.changedTouches[0]
          : (event as MouseEvent)
      const flow = screenToFlowPosition({ x: point.clientX, y: point.clientY })
      const sceneX = flow.x / SCENE_SCALE
      const sceneY = flow.y / SCENE_SCALE

      // Only plug into the breadboard when the drop is actually over one.
      const breadboard = findBreadboardAtPoint(projectRef.current, sceneX, sceneY)
      if (!breadboard) return

      const snapped = snapPositionToBreadboardHole(
        breadboard.transform.position.x,
        breadboard.transform.position.y,
        sceneX,
        sceneY,
      )
      const holeRef: WireEndpointRef = {
        breadboardId: breadboard.id,
        site: snapped.hole,
      }
      if (
        terminalOccupiesBreadboardEndpoint(
          projectRef.current,
          from.componentId,
          from.terminalId,
          holeRef,
        )
      ) {
        return
      }

      const fromBench = terminalCanvasPosition(
        projectRef.current,
        from.componentId,
        from.terminalId,
        SCENE_SCALE,
        pinLayoutsRef.current,
      )
      if (!fromBench) return
      const holeScene = holeBenchPosition(breadboard, snapped.hole)
      const toBench = { x: holeScene.x * SCENE_SCALE, y: holeScene.y * SCENE_SCALE }
      if (!canConnectWithActiveWire(from, holeRef)) return

      const route = orthogonalWireRoute(fromBench, toBench)
      onWireConnectRef.current(
        from,
        holeRef,
        route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
      )
    },
    [
      canConnectWithActiveWire,
      clearConnectMoveListener,
      screenToFlowPosition,
      terminalFromConnectionState,
    ],
  )

  const handlePinWireTarget = useCallback(
    (componentId: string, terminalId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      event.preventDefault()

      const draft = wireDraftRef.current
      if (!draft) return
      if (isBreadboardHoleRef(draft.from)) return

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
      if (
        fromBench &&
        toBench &&
        canConnectWithActiveWire(draft.from, target)
      ) {
        const route = orthogonalWireRoute(fromBench, toBench)
        onWireConnectRef.current(
          draft.from,
          target,
          route.map((p) => position2d(p.x / SCENE_SCALE, p.y / SCENE_SCALE)),
        )
      }
      setWireDraft(null)
    },
    [canConnectWithActiveWire, clearWireListeners],
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
        const { hoverTarget, hoverTargetPx, hoverEndpoint } = resolveHoverTarget(
          e.clientX,
          e.clientY,
        )
        setWireDraft((draft) =>
          draft
            ? {
                ...draft,
                cursorPx,
                mode: dragged ? 'dragging' : 'armed',
                hoverTarget: dragged ? hoverTarget : null,
                hoverTargetPx: dragged ? hoverTargetPx : null,
                hoverEndpoint: dragged ? hoverEndpoint : null,
              }
            : {
                from: { componentId, terminalId },
                startPx,
                cursorPx,
                mode: dragged ? 'dragging' : 'armed',
                hoverTarget: dragged ? hoverTarget : null,
                hoverTargetPx: dragged ? hoverTargetPx : null,
                hoverEndpoint: dragged ? hoverEndpoint : null,
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
                hoverEndpoint: null,
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
        hoverEndpoint: null,
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
      setBreadboardHoverMarkers([])
      const instance = projectRef.current.components.find((c) => c.id === instanceId)
      if (!instance) return

      const evaluation = evaluateBreadboardSnap(
        projectRef.current,
        instance,
        sceneX,
        sceneY,
        { layout: pinLayoutsRef.current.get(instanceId) },
      )
      if (evaluation.conflict) {
        onPlacementErrorRef.current?.(evaluation.conflict)
        return
      }

      try {
        const moved = moveComponent(projectRef.current, instanceId, sceneX, sceneY, {
          pinLayout: pinLayoutsRef.current.get(instanceId),
        })
        onProjectChange(
          rerouteWiresVisual(moved, instanceId, pinLayoutsRef.current, SCENE_SCALE),
        )
        onPlacementErrorRef.current?.(null)
      } catch (e) {
        onPlacementErrorRef.current?.(
          e instanceof Error ? e.message : 'Could not move part',
        )
      }
    },
    [onProjectChange],
  )

  const handlePartDragMove = useCallback(
    (instanceId: string, sceneX: number, sceneY: number) => {
      const instance = projectRef.current.components.find((c) => c.id === instanceId)
      if (!instance) {
        setBreadboardHoverMarkers([])
        return
      }

      const evaluation = evaluateBreadboardSnap(
        projectRef.current,
        instance,
        sceneX,
        sceneY,
        { layout: pinLayoutsRef.current.get(instanceId) },
      )
      const preview = evaluation.candidate ?? evaluation.rejected
      if (!preview) {
        setBreadboardHoverMarkers([])
        if (!evaluation.conflict) {
          onPlacementErrorRef.current?.(null)
        }
        return
      }

      const invalid = Boolean(evaluation.conflict)
      const sites = Object.entries(preview.placement?.sites ?? {}).filter(
        (entry): entry is [string, typeof preview.hole] => entry[1].kind === 'hole',
      )
      const hoverSites =
        sites.length > 0 ? sites : [[preview.terminalId, preview.hole] as const]
      setBreadboardHoverMarkers(
        hoverSites.map(([terminalId, site]) => {
          const bench = holeBenchPosition(preview.breadboard, site)
          return {
            id: `${instanceId}:${terminalId}:breadboard-hover`,
            x: bench.x,
            y: bench.y,
            invalid,
          }
        }),
      )
    },
    [],
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
          onPartDragMove: (sceneX: number, sceneY: number) =>
            handlePartDragMove(n.id, sceneX, sceneY),
          onPartDragEnd: (sceneX: number, sceneY: number) =>
            handlePartDragEnd(n.id, sceneX, sceneY),
        },
      })),
    [
      selectedNodeId,
      handlePinWireStart,
      handlePinWireTarget,
      handleVisualPinLayout,
      handlePartDragMove,
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
    if (wireDraftRef.current || breadboardWireDraftRef.current) {
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
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
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
        panOnDrag={!wireDraft && !breadboardWireDraft}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        deleteKeyCode={
          wireDraft || breadboardWireDraft || selectedWireId
            ? null
            : ['Backspace', 'Delete']
        }
        className="berry-studio-flow h-full w-full rounded-2xl"
      >
        <Background gap={SCENE_SCALE * 0.02} size={1} color="rgba(28,25,23,0.08)" />
        <Controls showInteractive={false} />
        <WireDraftOverlay
          draft={wireDraft ?? breadboardWireDraft}
          color={wirePreviewColor}
        />
        <WireOverlay
          wires={wires}
          selectedWireId={selectedWireId}
          hoveredWireId={hoveredWireId}
          onWireSelect={handleWireSelect}
          onWireHover={setHoveredWireId}
        />
        {(!wireDraft || reactFlowConnecting) && (
          <BreadboardHoleOverlay
            project={project}
            selectedId={selectedNodeId}
            hoverMarkers={breadboardHoverMarkers}
            wireStart={breadboardWireDraft?.from ?? null}
            interactiveHoles={activeWireType === 'jumper-mm'}
            elevateForWireConnect={!!breadboardWireDraft}
            onHolePointerDown={handleBreadboardHolePointerDown}
          />
        )}
      </ReactFlow>
    </div>
  )
}
