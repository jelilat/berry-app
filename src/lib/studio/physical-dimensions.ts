import type { ComponentTypeId } from '@/lib/project/types'

/** Approximate physical size in millimeters for inspector display. */
export interface PhysicalDimensionsMm {
  width: number
  height: number
  depth: number
}

/**
 * Catalog footprint sizes for the component inspector (mm).
 * Scene layout uses separate scene units; these are builder-facing dimensions.
 */
export const PHYSICAL_DIMENSIONS_MM: Partial<Record<ComponentTypeId, PhysicalDimensionsMm>> = {
  'breadboard-full': { width: 165, height: 55, depth: 10 },
  'esp32-devkit-v1': { width: 51.4, height: 28.5, depth: 15 },
  'arduino-uno': { width: 68.6, height: 53.4, depth: 15 },
  'led-5mm': { width: 5, height: 5, depth: 8 },
  'resistor-220': { width: 6, height: 2, depth: 2 },
  'resistor-1k': { width: 6, height: 2, depth: 2 },
  'resistor-2k': { width: 6, height: 2, depth: 2 },
  'push-button': { width: 12, height: 12, depth: 8 },
  'hc-sr04': { width: 45, height: 20, depth: 15 },
  'bme280': { width: 20, height: 20, depth: 3 },
  'servo-sg90': { width: 23, height: 12, depth: 27 },
  'lcd-1602-i2c': { width: 80, height: 36, depth: 12 },
}

/**
 * Resolve physical dimensions for a catalog type, with a small default fallback.
 * @param type Catalog component type id.
 */
export function getPhysicalDimensionsMm(type: ComponentTypeId): PhysicalDimensionsMm {
  return (
    PHYSICAL_DIMENSIONS_MM[type] ?? {
      width: 10,
      height: 10,
      depth: 5,
    }
  )
}
