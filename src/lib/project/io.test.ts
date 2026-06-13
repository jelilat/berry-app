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
})

describe('loadBerryProjectFromJson', () => {
  it('throws on invalid JSON', () => {
    expect(() => loadBerryProjectFromJson('not json')).toThrow(SyntaxError)
  })
})
