import { describe, expect, it } from 'vitest'
import { getComponentDefinition, isWireTemplate, listCatalog } from './catalog'

describe('component catalog', () => {
  it('listCatalog returns 15 parts', () => {
    expect(listCatalog()).toHaveLength(15)
  })

  it('getComponentDefinition returns ESP32 with GPIO terminals', () => {
    const def = getComponentDefinition('esp32-devkit-v1')
    expect(def.id).toBe('esp32-devkit-v1')
    expect(def.group).toBe('microcontrollers')
    expect(def.terminals.some((t) => t.id === 'IO13')).toBe(true)
  })

  it('jumper wire templates are not placeable parts', () => {
    expect(isWireTemplate('jumper-mm')).toBe(true)
    expect(getComponentDefinition('jumper-mm').wireTemplate?.connectors).toEqual({
      start: 'male',
      end: 'male',
    })
  })
})
