import type { CatalogTraySection, ComponentDefinition, ComponentGroup } from './types'
import { listCatalog } from './catalog'

/** Tray section order (top to bottom in Studio). */
export const COMPONENT_GROUP_ORDER: readonly ComponentGroup[] = [
  'breadboards',
  'wires',
  'microcontrollers',
  'sensors',
  'displays',
  'inputs',
  'actuators',
  'passives',
] as const

/** Human-readable labels for tray section headers. */
export const COMPONENT_GROUP_LABELS: Record<ComponentGroup, string> = {
  breadboards: 'Breadboards',
  wires: 'Wires',
  microcontrollers: 'Microcontrollers',
  sensors: 'Sensors',
  displays: 'Displays',
  inputs: 'Input',
  actuators: 'Actuators',
  passives: 'Passives',
  unsupported: 'Unsupported',
}

/**
 * Return all parts belonging to one tray group.
 * @param group Component group id.
 */
export function getComponentsByGroup(group: ComponentGroup): ComponentDefinition[] {
  return listCatalog().filter((part) => part.group === group)
}

/**
 * Catalog entries grouped for Studio component tray UI.
 * Sections with no parts are omitted. Order follows {@link COMPONENT_GROUP_ORDER}.
 */
export function listCatalogGrouped(): CatalogTraySection[] {
  const all = listCatalog()
  return COMPONENT_GROUP_ORDER.map((group) => {
    const parts = all.filter((p) => p.group === group)
    if (parts.length === 0) return null
    return {
      group,
      label: COMPONENT_GROUP_LABELS[group],
      parts,
    }
  }).filter((section): section is CatalogTraySection => section !== null)
}
