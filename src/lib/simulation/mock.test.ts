import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBerryProjectFromJson } from '@/lib/project/io'
import { createStarterProject } from '@/lib/project/mutations'
import { computeFirmwareHash } from '@/lib/build/hash'
import { createEsp32BlinkFirmwareSource } from '@/lib/firmware/source'
import { detectEsp32LedBlinkCircuit } from './circuits'
import { SimulationInputError, simulateProject } from './mock'
import type { SimulationResult } from './types'

/**
 * Load the ESP32 LED blink example project fixture.
 */
function loadEsp32BlinkProject() {
  return loadBerryProjectFromJson(
    readFileSync(
      path.join(process.cwd(), 'examples', 'esp32-led-blink.project.json'),
      'utf8',
    ),
  )
}

/**
 * Compute a firmware hash for the example blink project.
 * @param project Parsed example project.
 */
function exampleFirmwareHash(project: ReturnType<typeof loadEsp32BlinkProject>): string {
  return computeFirmwareHash(project, {
    'src/main.cpp': createEsp32BlinkFirmwareSource(),
  })
}

/**
 * Firmware files for the ESP32 blink fixture.
 */
function exampleFirmwareFiles() {
  return { 'src/main.cpp': createEsp32BlinkFirmwareSource() }
}

describe('simulation result contract', () => {
  it('returns passed status with firmwareHash, logs, and errors array', () => {
    const project = loadEsp32BlinkProject()
    const firmwareHash = exampleFirmwareHash(project)
    const result = simulateProject({
      project,
      artifact: { firmwareHash },
      files: exampleFirmwareFiles(),
    })

    expect(result.status).toBe('passed')
    expect(result.firmwareHash).toBe(firmwareHash)
    expect(Array.isArray(result.logs)).toBe(true)
    expect(result.logs.length).toBeGreaterThan(0)
    expect(Array.isArray(result.errors)).toBe(true)
    expect(result.logs.every((line) => typeof line.text === 'string')).toBe(true)
    expect(result.logs.every((line) => line.source === 'serial' || line.source === 'sim')).toBe(
      true,
    )
  })
})

describe('detectEsp32LedBlinkCircuit', () => {
  it('detects the ESP32 LED blink example circuit', () => {
    const circuit = detectEsp32LedBlinkCircuit(loadEsp32BlinkProject())

    expect(circuit).not.toBeNull()
    expect(circuit?.profile).toBe('esp32-led-blink')
    expect(circuit?.gpioPin).toBe(13)
  })

  it('returns null for the starter bench without LED wiring', () => {
    expect(detectEsp32LedBlinkCircuit(createStarterProject())).toBeNull()
  })
})

describe('simulateProject', () => {
  it('passes mock blink simulation for the ESP32 LED example with deterministic logs', () => {
    const project = loadEsp32BlinkProject()
    const firmwareHash = exampleFirmwareHash(project)
    const first = simulateProject({
      project,
      artifact: { firmwareHash },
      files: exampleFirmwareFiles(),
    })
    const second = simulateProject({
      project,
      artifact: { firmwareHash },
      files: exampleFirmwareFiles(),
    })

    expect(first.status).toBe('passed')
    expect(first.logs.some((line) => line.text.includes('GPIO13 HIGH'))).toBe(true)
    expect(first.traces?.length).toBeGreaterThan(0)
    expect(first).toEqual(second)
  })

  it('returns unsupported for projects outside the demo circuit profile', () => {
    const project = createStarterProject()
    const firmwareHash = computeFirmwareHash(project, {
      'src/main.cpp': '#include <Arduino.h>\n',
    })
    const result = simulateProject({
      project,
      artifact: { firmwareHash },
      files: { 'src/main.cpp': '#include <Arduino.h>\n' },
    })

    expect(result.status).toBe('unsupported')
    expect(result.firmwareHash).toBe(firmwareHash)
    expect(result.errors[0]?.code).toBe('sim.unsupported_circuit')
    expect(result.logs.some((line) => line.source === 'sim')).toBe(true)
  })

  it('throws when firmwareHash is missing', () => {
    const project = loadEsp32BlinkProject()

    expect(() =>
      simulateProject({
        project,
        artifact: { firmwareHash: '' },
        files: exampleFirmwareFiles(),
      }),
    ).toThrow(SimulationInputError)
  })

  it('echoes the same firmwareHash in the simulation result', () => {
    const project = loadEsp32BlinkProject()
    const firmwareHash = 'abc123deadbeef'
    const result: SimulationResult = simulateProject({
      project,
      artifact: { firmwareHash },
      files: exampleFirmwareFiles(),
    })

    expect(result.firmwareHash).toBe(firmwareHash)
  })

  it('returns unsupported when blink source behavior is absent', () => {
    const project = loadEsp32BlinkProject()
    const firmwareHash = computeFirmwareHash(project, {
      'src/main.cpp': '#include <Arduino.h>\nvoid setup() {}\nvoid loop() {}\n',
    })
    const result = simulateProject({
      project,
      artifact: { firmwareHash },
      files: { 'src/main.cpp': '#include <Arduino.h>\nvoid setup() {}\nvoid loop() {}\n' },
    })

    expect(result.status).toBe('unsupported')
    expect(result.errors[0]?.code).toBe('sim.unsupported_firmware')
  })
})
