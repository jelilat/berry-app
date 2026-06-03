import { describe, expect, it } from 'vitest'
import { getComponentDefinition, listCatalog } from './catalog'

describe('component catalog', () => {
  it('listCatalog returns 12 parts', () => {
    expect(listCatalog()).toHaveLength(12)
  })

  it('getComponentDefinition returns ESP32 with GPIO terminals', () => {
    const def = getComponentDefinition('esp32-devkit-v1')
    expect(def.id).toBe('esp32-devkit-v1')
    expect(def.group).toBe('microcontrollers')
    expect(def.terminals.some((t) => t.id === 'IO13')).toBe(true)
  })
})
