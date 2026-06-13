import type { ComponentTypeId, TerminalDefinition } from "./types";
import { buildComponentSceneSizeTable } from "@/lib/studio/scene-size";

/** Scene-space width/height per component type (for terminal and wire layout). */
export const COMPONENT_SCENE_SIZE: Record<
  ComponentTypeId,
  { w: number; h: number }
> = buildComponentSceneSizeTable();

/**
 * Normalize rotation to 0–359 degrees on the z axis.
 * @param degrees Raw rotation in degrees.
 */
export function normalizeRotationZ(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Scene bounding box for a component at a given z rotation (swaps at 90° / 270°).
 * @param type Catalog component type.
 * @param rotationZ Rotation in degrees around z.
 */
export function componentSceneDimensions(
  type: ComponentTypeId,
  rotationZ = 0,
): { w: number; h: number } {
  const base = COMPONENT_SCENE_SIZE[type];
  const r = normalizeRotationZ(rotationZ);
  if (r === 90 || r === 270) return { w: base.h, h: base.w };
  return { w: base.w, h: base.h };
}

/**
 * Relative terminal offsets within a component (0–1 of node box).
 * @param terminals Catalog terminal list.
 * @param type Component type (affects layout density).
 */
export function terminalRelativePositions(
  terminals: TerminalDefinition[],
  type: ComponentTypeId,
): Record<string, { x: number; y: number }> {
  if (terminals.length === 0) return {};

  const positions: Record<string, { x: number; y: number }> = {};
  const isBoard = type === "esp32-devkit-v1" || type === "arduino-uno";

  if (isBoard) {
    const esp32Left = new Set([
      "VIN",
      "GND_L",
      "IO13",
      "IO12",
      "IO14",
      "IO27",
      "IO26",
      "IO25",
      "IO33",
      "IO32",
      "IO35",
      "IO34",
      "VN",
      "VP",
      "EN",
    ]);
    const left = terminals.filter((t) =>
      type === "esp32-devkit-v1"
        ? esp32Left.has(t.id)
        : [
            "VIN",
            "GND_L",
            "IO4",
            "IO13",
            "IO18",
            "IO21",
            "5V",
            "GND",
            "D13",
            "A4",
          ].includes(t.id),
    );
    const right = terminals.filter((t) => !left.includes(t));
    left.forEach((t, i) => {
      const n = Math.max(left.length, 1);
      positions[t.id] = { x: 0.02, y: 0.12 + (i / n) * 0.76 };
    });
    right.forEach((t, i) => {
      const n = Math.max(right.length, 1);
      positions[t.id] = { x: 0.92, y: 0.12 + (i / n) * 0.76 };
    });
    return positions;
  }

  terminals.forEach((t, i) => {
    const n = terminals.length;
    if (n <= 2) {
      positions[t.id] = i === 0 ? { x: 0.08, y: 0.5 } : { x: 0.92, y: 0.5 };
    } else {
      const cols = Math.ceil(Math.sqrt(n));
      const row = Math.floor(i / cols);
      const col = i % cols;
      positions[t.id] = {
        x: 0.1 + (col / Math.max(cols - 1, 1)) * 0.8,
        y: 0.15 + (row / Math.max(Math.ceil(n / cols) - 1, 1)) * 0.7,
      };
    }
  });
  return positions;
}

/**
 * World scene position of a terminal (for wire polylines).
 * @param componentX Component transform x (scene).
 * @param componentY Component transform y (scene).
 * @param type Component catalog type.
 * @param terminalId Terminal id on that component.
 * @param terminals Catalog terminals for the type.
 */
export function terminalScenePosition(
  componentX: number,
  componentY: number,
  type: ComponentTypeId,
  terminalId: string,
  terminals: TerminalDefinition[],
  rotationZ = 0,
): { x: number; y: number } {
  const rel = terminalRelativePositions(terminals, type)[terminalId];
  if (!rel) {
    const { w: boxW, h: boxH } = componentSceneDimensions(type, rotationZ);
    return { x: componentX + boxW / 2, y: componentY + boxH / 2 };
  }
  return terminalScenePositionFromRel(
    componentX,
    componentY,
    type,
    rel,
    rotationZ,
  );
}

/**
 * Bench position of a terminal from a 0–1 layout coordinate in the unrotated part box.
 * @param componentX Component top-left x (scene).
 * @param componentY Component top-left y (scene).
 * @param type Catalog component type.
 * @param rel Terminal position 0–1 within the unrotated footprint.
 * @param rotationZ Rotation in degrees around z.
 */
export function terminalScenePositionFromRel(
  componentX: number,
  componentY: number,
  type: ComponentTypeId,
  rel: { x: number; y: number },
  rotationZ = 0,
): { x: number; y: number } {
  const base = COMPONENT_SCENE_SIZE[type];
  const { w: boxW, h: boxH } = componentSceneDimensions(type, rotationZ);
  const lx = rel.x * base.w;
  const ly = rel.y * base.h;
  const offX = (boxW - base.w) / 2;
  const offY = (boxH - base.h) / 2;
  const pivotX = offX + base.w / 2;
  const pivotY = offY + base.h / 2;
  const dx = lx - base.w / 2;
  const dy = ly - base.h / 2;
  const rad = (normalizeRotationZ(rotationZ) * Math.PI) / 180;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

  return {
    x: componentX + pivotX + rx,
    y: componentY + pivotY + ry,
  };
}

/**
 * Inverse of {@link terminalScenePosition}: map a bench point to 0–1 coords in the unrotated part box.
 * @param componentX Component top-left x (scene).
 * @param componentY Component top-left y (scene).
 * @param type Catalog component type.
 * @param rotationZ Rotation in degrees around z.
 * @param sceneX Bench x of the point.
 * @param sceneY Bench y of the point.
 */
export function terminalRelativeFromScenePoint(
  componentX: number,
  componentY: number,
  type: ComponentTypeId,
  rotationZ: number,
  sceneX: number,
  sceneY: number,
): { x: number; y: number } | null {
  const base = COMPONENT_SCENE_SIZE[type];
  const { w: boxW, h: boxH } = componentSceneDimensions(type, rotationZ);
  const offX = (boxW - base.w) / 2;
  const offY = (boxH - base.h) / 2;
  const pivotX = offX + base.w / 2;
  const pivotY = offY + base.h / 2;
  const rx = sceneX - componentX - pivotX;
  const ry = sceneY - componentY - pivotY;
  const rad = (-normalizeRotationZ(rotationZ) * Math.PI) / 180;
  const dx = rx * Math.cos(rad) - ry * Math.sin(rad);
  const dy = rx * Math.sin(rad) + ry * Math.cos(rad);
  const lx = dx + base.w / 2;
  const ly = dy + base.h / 2;
  if (base.w <= 0 || base.h <= 0) return null;
  return { x: lx / base.w, y: ly / base.h };
}
