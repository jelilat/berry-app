import { describe, expect, it } from 'vitest'
import { parseBerryProject } from '@/lib/project/io'
import { computeFirmwareHash } from './hash'
import type { FirmwareSourceFiles } from './types'

/**
 * Minimal valid project for hash tests.
 */
function minimalProject() {
  return parseBerryProject({
    version: 1,
    board: 'esp32-devkit-v1',
    metadata: { name: 'Hash test', description: '' },
    components: [],
    nets: [],
    wires: [],
  })
}

describe('computeFirmwareHash', () => {
  it('returns a stable SHA-256 hex digest for identical inputs', async () => {
    const project = minimalProject()
    const files: FirmwareSourceFiles = {
      'src/main.cpp': '#include <Arduino.h>\n',
    }

    const first = await computeFirmwareHash(project, files)
    const second = await computeFirmwareHash(project, files)

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes when source content changes', async () => {
    const project = minimalProject()
    const base: FirmwareSourceFiles = { 'src/main.cpp': 'void setup() {}\n' }
    const changed: FirmwareSourceFiles = { 'src/main.cpp': 'void setup() { pinMode(1, OUTPUT); }\n' }

    expect(await computeFirmwareHash(project, base)).not.toBe(
      await computeFirmwareHash(project, changed),
    )
  })

  it('includes custom platformio.ini in the hash', async () => {
    const project = minimalProject()
    const withoutIni: FirmwareSourceFiles = { 'src/main.cpp': 'void setup() {}\n' }
    const withIni: FirmwareSourceFiles = {
      'src/main.cpp': 'void setup() {}\n',
      'platformio.ini': '[env:custom]\nboard = esp32dev\n',
    }

    expect(await computeFirmwareHash(project, withoutIni)).not.toBe(
      await computeFirmwareHash(project, withIni),
    )
  })
})
