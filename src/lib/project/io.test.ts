import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loadBerryProjectFromJson,
  parseBerryProject,
  ProjectParseError,
  serializeBerryProject,
} from './io'
import { hasValidationErrors, validate } from '@/lib/validation'
import type { BerryProject } from './types'

/** Minimal valid project for mutation in error-case tests. */
function minimalProject(): BerryProject {
  return parseBerryProject({
    version: 1,
    board: 'esp32-devkit-v1',
    metadata: { name: 'minimal' },
    components: [
      {
        id: 'esp32_1',
        type: 'esp32-devkit-v1',
        transform: { position: { x: 0, y: 0, z: 0 } },
      },
      {
        id: 'led_1',
        type: 'led-5mm',
        transform: { position: { x: 1, y: 0, z: 0 } },
      },
    ],
    nets: [
      {
        id: 'net_1',
        terminals: [
          { component: 'esp32_1', terminal: 'IO13' },
          { component: 'led_1', terminal: 'anode' },
        ],
      },
    ],
    wires: [
      {
        id: 'wire_1',
        net: 'net_1',
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      },
    ],
  })
}

describe('parseBerryProject', () => {
  it('parses a minimal valid project', () => {
    const project = minimalProject()
    expect(project.metadata.name).toBe('minimal')
    expect(project.components).toHaveLength(2)
  })

  it('ignores empty placement on a breadboard from agent output', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'arduino-uno',
      metadata: { name: 'agent output' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full',
          transform: { position: { x: 0, y: 0, z: 0 } },
          placement: { sites: {} },
        },
        {
          id: 'hc_sr04_1',
          type: 'hc-sr04',
          parent: 'breadboard_1',
          transform: { position: { x: 0.12, y: 0.05, z: 0 } },
          placement: {
            sites: {
              VCC: { kind: 'hole', block: 'top', row: 'a', column: 10 },
              TRIG: { kind: 'hole', block: 'top', row: 'a', column: 11 },
              ECHO: { kind: 'hole', block: 'top', row: 'a', column: 12 },
              GND: { kind: 'hole', block: 'top', row: 'a', column: 13 },
            },
          },
        },
      ],
      nets: [],
      wires: [],
    })

    expect(project.components[0].placement).toBeUndefined()
    expect(project.components[1].parent).toBe('breadboard_1')
  })

  it('keeps unsupported hosted components as display-only placeholders', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'unsupported component' },
      components: [
        {
          id: 'breadboard_1',
          type: 'breadboard-full',
          transform: { position: { x: 0, y: 0, z: 0 } },
          placement: { sites: {} },
        },
        {
          id: 'esp32_1',
          type: 'esp32-devkit-v1',
          transform: { position: { x: 0.1, y: 0, z: 0 } },
          placement: { sites: {} },
        },
        {
          id: 'pir_1',
          type: 'hc-sr501',
          parent: 'breadboard_1',
          transform: { position: { x: 0.2, y: 0, z: 0 } },
          placement: { sites: {} },
        },
      ],
      nets: [],
      wires: [],
    })

    expect(project.components.map((component) => component.id)).toEqual([
      'breadboard_1',
      'esp32_1',
      'pir_1',
    ])
    expect(project.components[1].placement).toBeUndefined()
    expect(project.components[2].type).toBe('hc-sr501')
    expect(project.components[2].placement).toBeUndefined()
  })

  it('rejects non-empty placement on a breadboard', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'arduino-uno',
        metadata: { name: 'bad breadboard placement' },
        components: [
          {
            id: 'breadboard_1',
            type: 'breadboard-full',
            transform: { position: { x: 0, y: 0, z: 0 } },
            placement: {
              sites: {
                VCC: { kind: 'hole', block: 'top', row: 'a', column: 10 },
              },
            },
          },
        ],
        nets: [],
        wires: [],
      }),
    ).toThrow(
      new ProjectParseError(
        'components[0].placement is only valid for parts placed on a breadboard',
      ),
    )
  })

  it('loads examples/esp32-led-blink.project.json from disk', () => {
    const fixturePath = path.join(
      process.cwd(),
      'examples',
      'esp32-led-blink.project.json',
    )
    const json = readFileSync(fixturePath, 'utf8')
    const project = loadBerryProjectFromJson(json)
    expect(project.metadata.name).toBe('ESP32 LED blink')
    expect(project.components).toHaveLength(4)
    expect(project.nets).toHaveLength(3)
    expect(project.wires).toHaveLength(3)
    expect(project.wires[0].type).toBe('jumper-mm')
    expect(project.wires[0].connectors).toEqual({ start: 'male', end: 'male' })
  })

  it.each([
    ['arduino-calculator.project.json', 'Arduino calculator'],
    ['esp32-max7219-display.project.json', 'ESP32 MAX7219 display'],
  ])('loads examples/%s from disk', (fixtureName, projectName) => {
    const fixturePath = path.join(process.cwd(), 'examples', fixtureName)
    const json = readFileSync(fixturePath, 'utf8')
    const project = loadBerryProjectFromJson(json)
    expect(project.metadata.name).toBe(projectName)
    expect(project.components.length).toBeGreaterThan(0)
    expect(project.nets.length).toBeGreaterThan(0)
    expect(project.wires.length).toBeGreaterThan(0)
    expect(hasValidationErrors(validate(project))).toBe(false)
  })
})

describe('serialize round-trip', () => {
  it('parse → serialize → load preserves project data', () => {
    const original = minimalProject()
    const json = serializeBerryProject(original)
    const roundTripped = loadBerryProjectFromJson(json)
    expect(roundTripped).toEqual(original)
  })

  it('round-trips the ESP32 LED blink example', () => {
    const fixturePath = path.join(
      process.cwd(),
      'examples',
      'esp32-led-blink.project.json',
    )
    const json = readFileSync(fixturePath, 'utf8')
    const parsed = loadBerryProjectFromJson(json)
    const again = loadBerryProjectFromJson(serializeBerryProject(parsed))
    expect(again).toEqual(parsed)
  })
})

describe('ProjectParseError', () => {
  it('rejects unsupported version', () => {
    expect(() =>
      parseBerryProject({
        version: 99,
        board: 'esp32-devkit-v1',
        metadata: { name: 'x' },
        components: [],
        nets: [],
        wires: [],
      }),
    ).toThrow(new ProjectParseError('Unsupported version: 99'))
  })

  it('rejects missing metadata.name', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: {},
        components: [],
        nets: [],
        wires: [],
      }),
    ).toThrow(new ProjectParseError('metadata.name is required'))
  })

  it('rejects duplicate component ids', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'dup' },
        components: [
          {
            id: 'same',
            type: 'led-5mm',
            transform: { position: { x: 0, y: 0, z: 0 } },
          },
          {
            id: 'same',
            type: 'resistor-220',
            transform: { position: { x: 1, y: 0, z: 0 } },
          },
        ],
        nets: [],
        wires: [],
      }),
    ).toThrow(new ProjectParseError('Duplicate component ids'))
  })

  it('rejects unknown parent', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'parent' },
        components: [
          {
            id: 'child',
            type: 'led-5mm',
            parent: 'missing_parent',
            transform: { position: { x: 0, y: 0, z: 0 } },
          },
        ],
        nets: [],
        wires: [],
      }),
    ).toThrow(
      new ProjectParseError('Component child references unknown parent missing_parent'),
    )
  })

  it('rejects net with fewer than 2 terminals', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'net' },
        components: [
          {
            id: 'esp32_1',
            type: 'esp32-devkit-v1',
            transform: { position: { x: 0, y: 0, z: 0 } },
          },
        ],
        nets: [{ id: 'lonely', terminals: [{ component: 'esp32_1', terminal: 'IO13' }] }],
        wires: [],
      }),
    ).toThrow(new ProjectParseError('Net lonely must connect at least 2 terminals'))
  })

  it('rejects unknown component in net', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'net' },
        components: [
          {
            id: 'esp32_1',
            type: 'esp32-devkit-v1',
            transform: { position: { x: 0, y: 0, z: 0 } },
          },
        ],
        nets: [
          {
            id: 'bad_ref',
            terminals: [
              { component: 'esp32_1', terminal: 'IO13' },
              { component: 'ghost', terminal: 'anode' },
            ],
          },
        ],
        wires: [],
      }),
    ).toThrow(new ProjectParseError('Net bad_ref references unknown component ghost'))
  })

  it('rejects invalid terminal on catalog part', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'term' },
        components: [
          {
            id: 'esp32_1',
            type: 'esp32-devkit-v1',
            transform: { position: { x: 0, y: 0, z: 0 } },
          },
          {
            id: 'led_1',
            type: 'led-5mm',
            transform: { position: { x: 1, y: 0, z: 0 } },
          },
        ],
        nets: [
          {
            id: 'bad_term',
            terminals: [
              { component: 'esp32_1', terminal: 'NOT_A_PIN' },
              { component: 'led_1', terminal: 'anode' },
            ],
          },
        ],
        wires: [],
      }),
    ).toThrow(
      new ProjectParseError(
        'Net bad_term: terminal NOT_A_PIN is not defined on esp32-devkit-v1',
      ),
    )
  })

  it('rejects wire referencing unknown net', () => {
    const base = minimalProject()
    expect(() =>
      parseBerryProject({
        ...base,
        wires: [
          {
            id: 'orphan_wire',
            net: 'no_such_net',
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          },
        ],
      }),
    ).toThrow(new ProjectParseError('Wire orphan_wire references unknown net no_such_net'))
  })

  it('rejects wire with fewer than 2 points', () => {
    expect(() =>
      parseBerryProject({
        version: 1,
        board: 'esp32-devkit-v1',
        metadata: { name: 'wire' },
        components: [
          {
            id: 'esp32_1',
            type: 'esp32-devkit-v1',
            transform: { position: { x: 0, y: 0, z: 0 } },
          },
        ],
        nets: [
          {
            id: 'net_1',
            terminals: [
              { component: 'esp32_1', terminal: 'IO13' },
              { component: 'esp32_1', terminal: 'GND_R' },
            ],
          },
        ],
        wires: [{ id: 'short', net: 'net_1', points: [{ x: 0, y: 0, z: 0 }] }],
      }),
    ).toThrow(new ProjectParseError('wires[0].points must have at least 2 points'))
  })

  it('rejects unknown wire type', () => {
    const base = minimalProject()
    expect(() =>
      parseBerryProject({
        ...base,
        wires: [
          {
            ...base.wires[0],
            type: 'dupont-magic',
          },
        ],
      }),
    ).toThrow(new ProjectParseError('wires[0].type must be a jumper wire type'))
  })

  it('rejects connectors that do not match the wire type', () => {
    const base = minimalProject()
    expect(() =>
      parseBerryProject({
        ...base,
        wires: [
          {
            ...base.wires[0],
            type: 'jumper-mm',
            connectors: { start: 'female', end: 'female' },
          },
        ],
      }),
    ).toThrow(new ProjectParseError('wires[0].connectors must match jumper-mm'))
  })
})

describe('loadBerryProjectFromJson', () => {
  it('throws on invalid JSON', () => {
    expect(() => loadBerryProjectFromJson('not json')).toThrow(SyntaxError)
  })
})
