import type { ComponentTypeId } from '@/lib/project/types'
import { listCatalog } from '@/lib/project/catalog'
import { getPhysicalDimensionsMm } from '@/lib/studio/physical-dimensions'
import { getWokwiVisual } from '@/lib/studio/wokwi-map'

/** Breadboard width in scene units (reference for mm → scene scale). */
const REF_SCENE_W = 0.42
const REF_MM_W = 165
const MM_TO_SCENE = REF_SCENE_W / REF_MM_W

/** Minimum practical canvas footprints for tiny loose parts (scene units). */
const INTERACTION_FLOOR_SCENE_SIZE: Partial<Record<ComponentTypeId, { w: number; h: number }>> = {
  'led-5mm': { w: 0.028, h: 0.04 },
  'resistor-220': { w: 0.08, h: 0.018 },
  'resistor-1k': { w: 0.08, h: 0.018 },
  'resistor-2k': { w: 0.08, h: 0.018 },
  'push-button': { w: 0.04, h: 0.04 },
  'pushbutton-6mm': { w: 0.034, h: 0.034 },
  'slide-switch': { w: 0.034, h: 0.036 },
  'potentiometer': { w: 0.05, h: 0.05 },
  'neopixel': { w: 0.026, h: 0.026 },
  'rgb-led': { w: 0.034, h: 0.04 },
  'buzzer': { w: 0.04, h: 0.048 },
  'max7219-led-matrix': { w: 0.082, h: 0.082 },
  'single-7segment': { w: 0.05, h: 0.07 },
  'led-bar-graph': { w: 0.04, h: 0.07 },
}

/**
 * Apply a small interaction floor to tiny loose parts while leaving boards physical.
 * @param type Catalog component type.
 * @param size Physically derived scene footprint.
 */
export function applyInteractionFloor(
  type: ComponentTypeId,
  size: { w: number; h: number },
): { w: number; h: number } {
  const floor = INTERACTION_FLOOR_SCENE_SIZE[type]
  if (!floor) return size
  return {
    w: Math.max(size.w, floor.w),
    h: Math.max(size.h, floor.h),
  }
}

/**
 * Scene footprint from catalog physical dimensions (mm).
 * @param type Catalog component type.
 */
export function sceneSizeFromPhysicalMm(type: ComponentTypeId): { w: number; h: number } {
  const mm = getPhysicalDimensionsMm(type)
  return { w: mm.width * MM_TO_SCENE, h: mm.height * MM_TO_SCENE }
}

/**
 * Scene footprint aligned to Wokwi SVG aspect ratio (unrotated catalog box).
 * Uses the real physical footprint, oriented to the Wokwi element's native bounds.
 * @param type Catalog component type.
 */
export function sceneSizeForWokwiPart(type: ComponentTypeId): { w: number; h: number } {
  const visual = getWokwiVisual(type)
  if (!visual) return sceneSizeFromPhysicalMm(type)

  const mm = getPhysicalDimensionsMm(type)
  const aspect = visual.nativeWidth / visual.nativeHeight
  if (aspect >= 1) {
    return {
      w: Math.max(mm.width, mm.height) * MM_TO_SCENE,
      h: Math.min(mm.width, mm.height) * MM_TO_SCENE,
    }
  }
  return {
    w: Math.min(mm.width, mm.height) * MM_TO_SCENE,
    h: Math.max(mm.width, mm.height) * MM_TO_SCENE,
  }
}

/**
 * Scene size for a catalog part (Wokwi-aware when a skin exists).
 * @param type Catalog component type.
 */
export function catalogSceneSize(type: ComponentTypeId): { w: number; h: number } {
  const physical = getWokwiVisual(type)
    ? sceneSizeForWokwiPart(type)
    : sceneSizeFromPhysicalMm(type)
  return applyInteractionFloor(type, physical)
}

/**
 * Full scene size table for all catalog types.
 */
export function buildComponentSceneSizeTable(): Record<
  ComponentTypeId,
  { w: number; h: number }
> {
  return {
    ...Object.fromEntries(
      listCatalog()
        .filter((part) => !part.wireTemplate)
        .map((part) => [part.id, catalogSceneSize(part.id)]),
    ),
    'jumper-mm': { w: 0.01, h: 0.01 },
    'jumper-mf': { w: 0.01, h: 0.01 },
    'jumper-ff': { w: 0.01, h: 0.01 },
  } as Record<ComponentTypeId, { w: number; h: number }>
}
