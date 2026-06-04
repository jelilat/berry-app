import type { ComponentTypeId } from '@/lib/project/types'
import { getPhysicalDimensionsMm } from '@/lib/studio/physical-dimensions'
import { getWokwiVisual } from '@/lib/studio/wokwi-map'

/** Breadboard width in scene units (reference for mm → scene scale). */
const REF_SCENE_W = 0.42
const REF_MM_W = 165
const MM_TO_SCENE = REF_SCENE_W / REF_MM_W

/** Minimum practical canvas footprints for tiny parts (scene units). */
const EDITABLE_SCENE_SIZE: Partial<Record<ComponentTypeId, { w: number; h: number }>> = {
  'esp32-devkit-v1': { w: 0.12, h: 0.22 },
  'led-5mm': { w: 0.06, h: 0.072 },
  'resistor-220': { w: 0.12, h: 0.032 },
  'resistor-1k': { w: 0.12, h: 0.032 },
  'resistor-2k': { w: 0.12, h: 0.032 },
}

/**
 * Apply minimum edit-friendly dimensions without changing physical metadata.
 * @param type Catalog component type.
 * @param size Physically derived scene footprint.
 */
export function editableSceneSize(
  type: ComponentTypeId,
  size: { w: number; h: number },
): { w: number; h: number } {
  const min = EDITABLE_SCENE_SIZE[type]
  if (!min) return size
  return {
    w: Math.max(size.w, min.w),
    h: Math.max(size.h, min.h),
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
 * Uses physical mm on the long edge so the SVG fills the node without shrinking.
 * @param type Catalog component type.
 */
export function sceneSizeForWokwiPart(type: ComponentTypeId): { w: number; h: number } {
  const visual = getWokwiVisual(type)
  if (!visual) return sceneSizeFromPhysicalMm(type)

  const mm = getPhysicalDimensionsMm(type)
  const aspect = visual.nativeWidth / visual.nativeHeight
  const longMm = Math.max(mm.width, mm.height)
  const shortMm = Math.min(mm.width, mm.height)

  if (aspect >= 1) {
    return {
      w: longMm * MM_TO_SCENE,
      h: (longMm / aspect) * MM_TO_SCENE,
    }
  }
  return {
    w: shortMm * MM_TO_SCENE,
    h: longMm * MM_TO_SCENE,
  }
}

/**
 * Scene size for a catalog part (Wokwi-aware when a skin exists).
 * @param type Catalog component type.
 */
export function catalogSceneSize(type: ComponentTypeId): { w: number; h: number } {
  const physicalSize = getWokwiVisual(type)
    ? sceneSizeForWokwiPart(type)
    : sceneSizeFromPhysicalMm(type)
  return editableSceneSize(type, physicalSize)
}

/**
 * Full scene size table for all catalog types.
 */
export function buildComponentSceneSizeTable(): Record<
  ComponentTypeId,
  { w: number; h: number }
> {
  return {
    'breadboard-full': catalogSceneSize('breadboard-full'),
    'esp32-devkit-v1': catalogSceneSize('esp32-devkit-v1'),
    'arduino-uno': catalogSceneSize('arduino-uno'),
    'led-5mm': catalogSceneSize('led-5mm'),
    'resistor-220': catalogSceneSize('resistor-220'),
    'resistor-1k': catalogSceneSize('resistor-1k'),
    'resistor-2k': catalogSceneSize('resistor-2k'),
    'push-button': catalogSceneSize('push-button'),
    'hc-sr04': catalogSceneSize('hc-sr04'),
    'bme280': catalogSceneSize('bme280'),
    'servo-sg90': catalogSceneSize('servo-sg90'),
    'lcd-1602-i2c': catalogSceneSize('lcd-1602-i2c'),
    'jumper-mm': { w: 0.01, h: 0.01 },
    'jumper-mf': { w: 0.01, h: 0.01 },
    'jumper-ff': { w: 0.01, h: 0.01 },
  }
}
