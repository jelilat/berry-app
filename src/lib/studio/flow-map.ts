import type { PointerEvent as ReactPointerEvent } from "react";
import type { Edge, Node } from "@xyflow/react";
import { getComponentDefinition } from "@/lib/project/catalog";
import type { BreadboardSite } from "@/lib/project/breadboard";
import type {
  BerryProject,
  ComponentInstance,
  ComponentTypeId,
  TerminalDefinition,
  Wire,
  WireEndpoint,
} from "@/lib/project/types";
import type { ValidationResult } from "@/lib/validation/types";
import type { ValidationIndex } from "./validation-index";
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
import { holeScenePosition } from "./breadboard-layout";
import { terminalRelativePositions } from "@/lib/project/terminal-layout";

/** Node geometry and terminal layout derived from manually edited breadboard sites. */
interface PlacementDrivenNodeGeometry {
  positionScene: { x: number; y: number };
  width: number;
  height: number;
  baseWidth: number;
  baseHeight: number;
  terminalLayout: Record<string, { x: number; y: number }>;
}

/**
 * Terminal definitions to use for rendering a component node.
 * Known catalog parts stay catalog-strict; unsupported imported parts infer
 * display-only terminals from placement, nets, and wire endpoint metadata.
 * @param project Berry project graph.
 * @param instance Component instance to inspect.
 * @param catalogTerminals Terminals from the component catalog.
 */
function displayTerminalsForInstance(
  project: BerryProject,
  instance: ComponentInstance,
  catalogTerminals: TerminalDefinition[],
): TerminalDefinition[] {
  if (catalogTerminals.length > 0) return catalogTerminals;

  const ids = new Set<string>();
  for (const terminalId of Object.keys(instance.placement?.sites ?? {})) {
    ids.add(terminalId);
  }
  for (const net of project.nets) {
    for (const terminal of net.terminals) {
      if (terminal.component === instance.id && terminal.terminal) {
        ids.add(terminal.terminal);
      }
    }
  }
  for (const wire of project.wires) {
    for (const endpoint of [wire.from, wire.to]) {
      if (endpoint?.component === instance.id && endpoint.terminal) {
        ids.add(endpoint.terminal);
      }
    }
  }

  return [...ids].map((id) => ({
    id,
    label: id,
    kind: "passive",
  }));
}

/**
 * Bench scene position for a breadboard site on a specific parent board.
 * @param breadboard Parent breadboard instance.
 * @param site Hole or rail site.
 */
function siteScenePosition(
  breadboard: ComponentInstance,
  site: BreadboardSite,
): { x: number; y: number } {
  if (site.kind !== "hole") return xy(breadboard.transform.position);
  return holeScenePosition(
    breadboard.transform.position.x,
    breadboard.transform.position.y,
    site.row,
    site.column,
  );
}

/**
 * Whether a part stretches its node box to match manually edited breadboard holes.
 * LEDs keep the Wokwi skin; only resistors use flexible placement art.
 * @param instance Component instance to inspect.
 */
function usesPlacementDrivenVisualGeometry(instance: ComponentInstance): boolean {
  return instance.type.startsWith("resistor-");
}

/**
 * Map breadboard hole sites to pin handles inside a fixed-size part box (LEDs).
 * @param project Berry project.
 * @param instance Component instance.
 * @param scale Pixels per scene unit.
 * @param baseWidth Unrotated part width in pixels.
 * @param baseHeight Unrotated part height in pixels.
 */
function fixedBoxPlacementTerminalLayout(
  project: BerryProject,
  instance: ComponentInstance,
  terminals: TerminalDefinition[],
  scale: number,
  baseWidth: number,
  baseHeight: number,
): Record<string, { x: number; y: number }> | null {
  const usePlacementLayout =
    instance.type.startsWith("led-") || getComponentDefinition(instance.type).terminals.length === 0;
  if (!usePlacementLayout || !instance.parent || !instance.placement) {
    return null;
  }

  const breadboard = project.components.find((c) => c.id === instance.parent);
  if (!breadboard || breadboard.type !== "breadboard-full") return null;

  const centerX = instance.transform.position.x * scale;
  const centerY = instance.transform.position.y * scale;
  const leftPx = centerX - baseWidth / 2;
  const topPx = centerY - baseHeight / 2;
  const layout: Record<string, { x: number; y: number }> = {};

  for (const terminal of terminals) {
    const site = instance.placement?.sites[terminal.id];
    if (!site) continue;
    const bench = siteScenePosition(breadboard, site);
    layout[terminal.id] = {
      x: (bench.x * scale - leftPx) / baseWidth,
      y: (bench.y * scale - topPx) / baseHeight,
    };
  }

  return Object.keys(layout).length > 0 ? layout : null;
}

/**
 * Build a node box from the actual breadboard sites for flexible two-pin parts.
 * @param project Berry project.
 * @param instance Component instance.
 * @param scale Pixels per scene unit.
 */
function placementDrivenNodeGeometry(
  project: BerryProject,
  instance: ComponentInstance,
  terminals: TerminalDefinition[],
  scale: number,
): PlacementDrivenNodeGeometry | null {
  if (!usesPlacementDrivenVisualGeometry(instance) || !instance.parent || !instance.placement) {
    return null;
  }

  const breadboard = project.components.find((c) => c.id === instance.parent);
  if (!breadboard || breadboard.type !== "breadboard-full") return null;

  const placed = terminals.flatMap((terminal) => {
    const site = instance.placement?.sites[terminal.id];
    return site ? [{ terminalId: terminal.id, position: siteScenePosition(breadboard, site) }] : [];
  });
  if (placed.length === 0) return null;

  const catalog = componentPixelSize(instance.type, scale, instance.transform.rotation?.z ?? 0);
  const base = componentBasePixelSize(instance.type, scale);
  const xs = placed.map((p) => p.position.x);
  const ys = placed.map((p) => p.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanW = (maxX - minX) * scale;
  const spanH = (maxY - minY) * scale;
  const width = Math.max(spanW, catalog.width);
  const height = Math.max(spanH, catalog.height);
  const centerX = ((minX + maxX) / 2) * scale;
  const centerY = ((minY + maxY) / 2) * scale;
  const leftPx = spanW >= catalog.width ? minX * scale : centerX - width / 2;
  const topPx = spanH >= catalog.height ? minY * scale : centerY - height / 2;
  const terminalLayout = Object.fromEntries(
    placed.map((terminal) => [
      terminal.terminalId,
      {
        x: (terminal.position.x * scale - leftPx) / width,
        y: (terminal.position.y * scale - topPx) / height,
      },
    ]),
  );

  return {
    positionScene: { x: leftPx / scale, y: topPx / scale },
    width,
    height,
    baseWidth: width,
    baseHeight: height,
    terminalLayout,
  };
}

/** Data payload on each component React Flow node. */
export interface ComponentNodeData {
  instanceId: string;
  typeId: ComponentTypeId;
  label: string;
  terminals: { id: string; label: string; kind: string }[];
  terminalLayout: Record<string, { x: number; y: number }>;
  connectedTerminalIds: string[];
  /** Terminal ids with validation findings (berry-red pin ring). */
  errorTerminalIds?: string[];
  terminalValidation?: Map<string, ValidationResult[]>;
  width: number;
  height: number;
  baseWidth: number;
  baseHeight: number;
  rotationZ: number;
  placementDriven: boolean;
  /** Keep terminal handles on breadboard placement sites instead of live Wokwi pinInfo. */
  lockRuntimePinLayout: boolean;
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
  onPartDragMove?: (sceneX: number, sceneY: number) => void;
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
 * @param validation Optional validation index for inline pin highlights.
 */
export function projectToFlowNodes(
  project: BerryProject,
  selectedNodeId: string | null,
  validation?: ValidationIndex,
): Node<ComponentNodeData>[] {
  const sorted = [...project.components].sort(
    (a, b) => componentNodeZIndex(a) - componentNodeZIndex(b),
  );
  const connected = connectedTerminalKeys(project);

  return sorted.map((instance) => {
    const def = getComponentDefinition(instance.type);
    const terminals = displayTerminalsForInstance(project, instance, def.terminals);
    const placementGeometry = placementDrivenNodeGeometry(project, instance, terminals, SCENE_SCALE);
    const pos = placementGeometry?.positionScene ?? xy(instance.transform.position);
    const flowPos = sceneToFlowPosition(pos.x, pos.y, SCENE_SCALE);
    const rotationZ = instance.transform.rotation?.z ?? 0;
    const defaultSize = componentPixelSize(
      instance.type,
      SCENE_SCALE,
      rotationZ,
    );
    const defaultBaseSize = componentBasePixelSize(
      instance.type,
      SCENE_SCALE,
    );
    const width = placementGeometry?.width ?? defaultSize.width;
    const height = placementGeometry?.height ?? defaultSize.height;
    const baseWidth = placementGeometry?.baseWidth ?? defaultBaseSize.width;
    const baseHeight = placementGeometry?.baseHeight ?? defaultBaseSize.height;
    const rel =
      placementGeometry?.terminalLayout ??
      fixedBoxPlacementTerminalLayout(
        project,
        instance,
        terminals,
        SCENE_SCALE,
        defaultBaseSize.width,
        defaultBaseSize.height,
      ) ??
      (def.terminals.length > 0
        ? catalogTerminalLayout(instance)
        : terminalRelativePositions(terminals, instance.type));
    const lockRuntimePinLayout = Boolean(instance.parent && instance.placement?.sites);

    const terminalValidation = new Map<string, ValidationResult[]>()
    const errorTerminalIds: string[] = []
    if (validation) {
      for (const terminal of def.terminals) {
        const findings = validation.byTerminalKey.get(
          terminalKey(instance.id, terminal.id),
        )
        if (!findings?.length) continue
        terminalValidation.set(terminal.id, findings)
        errorTerminalIds.push(terminal.id)
      }
    }

    return {
      id: instance.id,
      type: COMPONENT_NODE_TYPE,
      position: flowPos,
      data: {
        instanceId: instance.id,
        typeId: instance.type,
        label: def.name,
        terminals: terminals.map((t) => ({
          id: t.id,
          label: t.label ?? t.id,
          kind: t.kind,
        })),
        terminalLayout: rel,
        connectedTerminalIds: terminals
          .filter((t) => connected.has(terminalKey(instance.id, t.id)))
          .map((t) => t.id),
        errorTerminalIds,
        terminalValidation:
          terminalValidation.size > 0 ? terminalValidation : undefined,
        width,
        height,
        baseWidth,
        baseHeight,
        rotationZ,
        placementDriven: placementGeometry !== null,
        lockRuntimePinLayout,
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

/** Wire endpoint that resolves to a concrete component terminal. */
type ComponentWireEndpoint = { component: string; terminal: string };

/**
 * Resolve a visual wire's component-terminal endpoints for React Flow.
 * Breadboard-hole endpoints have no React Flow handle, so such wires are skipped.
 * @param project Berry project containing nets and wires.
 * @param wire Wire to resolve.
 */
function wireEndpointsForFlow(
  project: BerryProject,
  wire: Wire,
): { from: ComponentWireEndpoint; to: ComponentWireEndpoint } | null {
  const isComponentEndpoint = (
    endpoint?: WireEndpoint,
  ): endpoint is ComponentWireEndpoint =>
    Boolean(endpoint?.component && endpoint?.terminal);

  if (isComponentEndpoint(wire.from) && isComponentEndpoint(wire.to)) {
    return { from: wire.from, to: wire.to };
  }

  const net = project.nets.find((candidate) => candidate.id === wire.net);
  if (!net || net.terminals.length < 2) return null;
  const endpoints = net.terminals.filter(isComponentEndpoint);
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
