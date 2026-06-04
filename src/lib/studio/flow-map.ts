import type { PointerEvent as ReactPointerEvent } from "react";
import type { Edge, Node } from "@xyflow/react";
import { getComponentDefinition } from "@/lib/project/catalog";
import type {
  BerryProject,
  ComponentTypeId,
  Wire,
  WireEndpoint,
} from "@/lib/project/types";
import { xy } from "@/lib/project/vec3";
import { COMPONENT_NODE_TYPE, SCENE_SCALE } from "./constants";
import { WIRE_STROKE_HEX, wireStrokeHex } from "./wire-colors";
import { catalogTerminalLayout } from "./studio-terminal-layout";
import {
  componentBasePixelSize,
  componentPixelSize,
  sceneToFlowPosition,
} from "./layout";
import { componentNodeZIndex } from "./node-z-index";
import { connectedTerminalKeys, terminalKey } from "./connect-pins";

/** Data payload on each component React Flow node. */
export interface ComponentNodeData {
  instanceId: string;
  typeId: ComponentTypeId;
  label: string;
  terminals: { id: string; label: string; kind: string }[];
  terminalLayout: Record<string, { x: number; y: number }>;
  connectedTerminalIds: string[];
  width: number;
  height: number;
  baseWidth: number;
  baseHeight: number;
  rotationZ: number;
  onPinWireStart?: (
    componentId: string,
    terminalId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onPinWireTarget?: (
    componentId: string,
    terminalId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onVisualPinLayout?: (
    instanceId: string,
    layout: Record<string, { x: number; y: number }>,
  ) => void;
  onPartDragEnd?: (sceneX: number, sceneY: number) => void;
  [key: string]: unknown;
}

/** Active terminal pick during wire mode. */
export interface TerminalSelection {
  componentId: string;
  terminalId: string;
}

/**
 * Build React Flow nodes from project components.
 * @param project Berry project.
 * @param selectedNodeId Selected bench part id.
 */
export function projectToFlowNodes(
  project: BerryProject,
  selectedNodeId: string | null,
): Node<ComponentNodeData>[] {
  const sorted = [...project.components].sort(
    (a, b) => componentNodeZIndex(a) - componentNodeZIndex(b),
  );
  const connected = connectedTerminalKeys(project);

  return sorted.map((instance) => {
    const def = getComponentDefinition(instance.type);
    const pos = xy(instance.transform.position);
    const flowPos = sceneToFlowPosition(pos.x, pos.y, SCENE_SCALE);
    const rotationZ = instance.transform.rotation?.z ?? 0;
    const { width, height } = componentPixelSize(
      instance.type,
      SCENE_SCALE,
      rotationZ,
    );
    const { width: baseWidth, height: baseHeight } = componentBasePixelSize(
      instance.type,
      SCENE_SCALE,
    );
    const rel = catalogTerminalLayout(instance);

    return {
      id: instance.id,
      type: COMPONENT_NODE_TYPE,
      position: flowPos,
      data: {
        instanceId: instance.id,
        typeId: instance.type,
        label: def.name,
        terminals: def.terminals.map((t) => ({
          id: t.id,
          label: t.label ?? t.id,
          kind: t.kind,
        })),
        terminalLayout: rel,
        connectedTerminalIds: def.terminals
          .filter((t) => connected.has(terminalKey(instance.id, t.id)))
          .map((t) => t.id),
        width,
        height,
        baseWidth,
        baseHeight,
        rotationZ,
      },
      style: { width, height },
      zIndex: componentNodeZIndex(instance),
      draggable: false,
      selectable: true,
    };
  });
}

/**
 * Build React Flow edges from project wires.
 * @param project Berry project.
 */
export function projectToFlowEdges(project: BerryProject): Edge[] {
  return project.wires.flatMap((wire) => {
    const endpoints = wireEndpointsForFlow(project, wire);
    if (!endpoints) return [];

    return [
      {
        id: wire.id,
        source: endpoints.from.component,
        sourceHandle: endpoints.from.terminal,
        target: endpoints.to.component,
        targetHandle: endpoints.to.terminal,
        type: "step",
        selectable: false,
        focusable: false,
        className: "berry-wire-edge",
        style: {
          stroke: wireStrokeHex(wire.color ?? "yellow"),
          strokeWidth: 4,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
      },
    ];
  });
}

/**
 * Resolve a visual wire's component-terminal endpoints for React Flow.
 * @param project Berry project containing nets and wires.
 * @param wire Wire to resolve.
 */
function wireEndpointsForFlow(
  project: BerryProject,
  wire: Wire,
): { from: WireEndpoint; to: WireEndpoint } | null {
  if (wire.from && wire.to) return { from: wire.from, to: wire.to };

  const net = project.nets.find((candidate) => candidate.id === wire.net);
  if (!net || net.terminals.length < 2) return null;
  const endpoints = net.terminals.filter(
    (terminal): terminal is WireEndpoint =>
      Boolean(terminal.component && terminal.terminal),
  );
  if (endpoints.length < 2) return null;

  return {
    from: endpoints[0],
    to: endpoints[1],
  };
}

/** Wire polyline ready for SVG overlay (pixel coordinates). */
export interface WireOverlayItem {
  id: string;
  color: string;
  connectors?: { start: "male" | "female"; end: "male" | "female" };
  points: { x: number; y: number }[];
}

/**
 * Map project wires to canvas polylines in pixel space.
 * @param project Berry project.
 */
export function projectToWireOverlay(project: BerryProject): WireOverlayItem[] {
  return project.wires.map((wire) => ({
    id: wire.id,
    color: wireStrokeHex(wire.color ?? "yellow"),
    connectors: wire.connectors,
    points: wire.points.map((p) => ({
      x: p.x * SCENE_SCALE,
      y: p.y * SCENE_SCALE,
    })),
  }));
}

export { WIRE_STROKE_HEX, wireStrokeHex };
