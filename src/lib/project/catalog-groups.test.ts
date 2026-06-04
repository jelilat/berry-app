import { describe, expect, it } from 'vitest'
import {
  COMPONENT_GROUP_LABELS,
  COMPONENT_GROUP_ORDER,
  getComponentsByGroup,
  listCatalogGrouped,
} from './catalog-groups'

describe('catalog groups', () => {
  it('listCatalogGrouped returns all 8 tray sections with parts', () => {
    const sections = listCatalogGrouped()
    expect(sections).toHaveLength(8)
    expect(sections.map((s) => s.group)).toEqual([...COMPONENT_GROUP_ORDER])
    const totalParts = sections.reduce((n, s) => n + s.parts.length, 0)
    expect(totalParts).toBe(15)
  })

  it('each section has a display label', () => {
    for (const { group, label } of listCatalogGrouped()) {
      expect(label).toBe(COMPONENT_GROUP_LABELS[group])
    }
  })

  it('microcontrollers group contains ESP32 and UNO', () => {
    const ids = getComponentsByGroup('microcontrollers').map((p) => p.id)
    expect(ids).toContain('esp32-devkit-v1')
    expect(ids).toContain('arduino-uno')
  })

  it('breadboards group contains only breadboard', () => {
    const parts = getComponentsByGroup('breadboards')
    expect(parts).toHaveLength(1)
    expect(parts[0].id).toBe('breadboard-full')
  })
})
