import { describe, expect, it } from 'vitest'
import { parseBerryProject } from './io'
import {
  addComponent,
  buildDefaultWirePoints,
  connectTerminals,
  createEmptyProject,
  findNetForTerminal,
  removeWire,
  createStarterProject,
  moveComponent,
  removeComponent,
  rerouteWiresForComponent,
  rotateComponent,
  snapValue,
  uniqueId,
} from './mutations'
import type { BerryProject } from './types'

function minimalProject(): BerryProject {
  return parseBerryProject({
    version: 1,
    board: 'esp32-devkit-v1',
    metadata: { name: 'test' },
    components: [
      {
        id: 'esp32_1',
        type: 'esp32-devkit-v1',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
      },
      {
        id: 'led_1',
        type: 'led-5mm',
        transform: { position: { x: 0.3, y: 0.1, z: 0 } },
      },
    ],
    nets: [],
    wires: [],
  })
}

describe('snapValue', () => {
  it('snaps to 0.02 grid', () => {
    expect(snapValue(0.051)).toBeCloseTo(0.06, 5)
    expect(snapValue(0.049)).toBeCloseTo(0.04, 5)
  })
})

describe('uniqueId', () => {
  it('avoids collisions', () => {
    const existing = new Set(['led_1', 'led_2'])
    expect(uniqueId('led', existing)).toBe('led_3')
  })
})

describe('createEmptyProject', () => {
  it('returns valid empty graph', () => {
    const p = createEmptyProject()
    expect(p.components).toHaveLength(0)
    expect(p.board).toBe('esp32-devkit-v1')
  })
})

describe('createStarterProject', () => {
  it('includes breadboard and esp32', () => {
    const p = createStarterProject()
    expect(p.components.map((c) => c.type)).toEqual(['breadboard-full', 'esp32-devkit-v1'])
  })
})

describe('addComponent', () => {
  it('appends a snapped instance', () => {
    const p = addComponent(createEmptyProject(), 'led-5mm', { x: 0.21, y: 0.15 })
    expect(p.components).toHaveLength(1)
    expect(p.components[0].transform.position.x).toBeCloseTo(0.22, 5)
  })

  it('rejects wire template types', () => {
    expect(() => addComponent(createEmptyProject(), 'jumper-mm')).toThrow(/wire type/)
  })
})

describe('moveComponent', () => {
  it('updates position', () => {
    const p = moveComponent(minimalProject(), 'led_1', 0.5, 0.4)
    const led = p.components.find((c) => c.id === 'led_1')!
    expect(led.transform.position.x).toBeCloseTo(0.5, 5)
    expect(led.transform.position.y).toBeCloseTo(0.4, 5)
  })
})

describe('rotateComponent', () => {
  it('adds 90 degrees on z and preserves center', () => {
    const p = rotateComponent(minimalProject(), 'esp32_1')
    const esp = p.components.find((c) => c.id === 'esp32_1')!
    expect(esp.transform.rotation?.z).toBe(90)
  })
})

describe('removeComponent', () => {
  it('removes component and dependent nets', () => {
    let p = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    p = removeComponent(p, 'led_1')
    expect(p.components).toHaveLength(1)
    expect(p.nets).toHaveLength(0)
    expect(p.wires).toHaveLength(0)
  })

  it('cascades to child components', () => {
    const p = createStarterProject()
    const removed = removeComponent(p, 'breadboard_1')
    expect(removed.components).toHaveLength(0)
  })
})

describe('connectTerminals', () => {
  it('creates net and wire with default points', () => {
    const p = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    expect(p.nets).toHaveLength(1)
    expect(p.nets[0].terminals).toHaveLength(2)
    expect(p.wires).toHaveLength(1)
    expect(p.wires[0].points.length).toBeGreaterThanOrEqual(2)
  })

  it('extends existing net when one terminal is already connected', () => {
    let p = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    p = addComponent(p, 'resistor-220', { x: 0.2, y: 0.1, id: 'res_1' })
    p = connectTerminals(
      p,
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'res_1', terminalId: 'pin1' },
    )
    expect(p.nets).toHaveLength(1)
    expect(p.nets[0].terminals).toHaveLength(3)
    expect(p.wires).toHaveLength(2)
  })

  it('stores jumper connector metadata on the wire', () => {
    const p = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
      {
        color: 'orange',
        connectors: { start: 'male', end: 'female' },
      },
    )
    expect(p.wires[0].color).toBe('orange')
    expect(p.wires[0].connectors).toEqual({ start: 'male', end: 'female' })
  })

  it('stores visual wire endpoints for rerouting', () => {
    const p = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )

    expect(p.wires[0].from).toEqual({ component: 'esp32_1', terminal: 'IO13' })
    expect(p.wires[0].to).toEqual({ component: 'led_1', terminal: 'anode' })
  })

  it('reroutes visual wires when a connected component moves', () => {
    const wired = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    const before = wired.wires[0].points
    const moved = moveComponent(wired, 'led_1', 0.5, 0.3, { snap: false })
    const rerouted = rerouteWiresForComponent(moved, 'led_1')

    expect(rerouted.wires[0].points).not.toEqual(before)
    expect(rerouted.wires[0].points.at(-1)?.x).toBeGreaterThan(0.5)
  })
})

describe('removeWire', () => {
  it('removes wire, net, and frees both terminals', () => {
    const wired = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    const wireId = wired.wires[0].id
    const next = removeWire(wired, wireId)

    expect(next.wires).toHaveLength(0)
    expect(next.nets).toHaveLength(0)
    expect(findNetForTerminal(next, { componentId: 'esp32_1', terminalId: 'IO13' })).toBeUndefined()
    expect(findNetForTerminal(next, { componentId: 'led_1', terminalId: 'anode' })).toBeUndefined()
  })

  it('keeps net when another wire still uses the terminals', () => {
    let p = connectTerminals(
      minimalProject(),
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'led_1', terminalId: 'anode' },
    )
    p = addComponent(p, 'resistor-220', { x: 0.2, y: 0.1, id: 'res_1' })
    p = connectTerminals(
      p,
      { componentId: 'esp32_1', terminalId: 'IO13' },
      { componentId: 'res_1', terminalId: 'pin1' },
    )
    const removeId = p.wires.find(
      (w) => w.from?.terminal === 'anode' || w.to?.terminal === 'anode',
    )!.id

    const next = removeWire(p, removeId)

    expect(next.wires).toHaveLength(1)
    expect(next.nets).toHaveLength(1)
    expect(next.nets[0].terminals).toHaveLength(2)
    expect(findNetForTerminal(next, { componentId: 'esp32_1', terminalId: 'IO13' })).toBeDefined()
    expect(findNetForTerminal(next, { componentId: 'res_1', terminalId: 'pin1' })).toBeDefined()
    expect(findNetForTerminal(next, { componentId: 'led_1', terminalId: 'anode' })).toBeUndefined()
  })
})

describe('buildDefaultWirePoints', () => {
  it('returns two z=0 points', () => {
    const pts = buildDefaultWirePoints(minimalProject(), {
      componentId: 'esp32_1',
      terminalId: 'IO13',
    }, {
      componentId: 'led_1',
      terminalId: 'anode',
    })
    expect(pts.length).toBeGreaterThanOrEqual(2)
    expect(pts.every((p) => p.z === 0)).toBe(true)
  })
})
