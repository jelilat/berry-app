import { describe, expect, it } from 'vitest'
import { parseBerryProject } from '@/lib/project/io'
import {
  BERRY_MOCK_COMPILE_ERROR_MARKER,
  compileWithMock,
} from './mock'
import type { BuildInput } from './types'

/**
 * Build a minimal mock compile input.
 */
function mockInput(mainCpp: string): BuildInput {
  return {
    project: parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 'Mock build', description: '' },
      components: [],
      nets: [],
      wires: [],
    }),
    files: { 'src/main.cpp': mainCpp },
  }
}

describe('compileWithMock', () => {
  it('returns success with artifact metadata for valid source', async () => {
    const result = await compileWithMock(mockInput('#include <Arduino.h>\n'))

    expect(result.ok).toBe(true)
    expect(result.backend).toBe('mock')
    expect(result.artifact?.firmwareHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.artifact?.board).toBe('esp32-devkit-v1')
    expect(result.diagnostics).toHaveLength(0)
  })

  it('returns an error diagnostic when the mock marker is present', async () => {
    const result = await compileWithMock(
      mockInput(`// ${BERRY_MOCK_COMPILE_ERROR_MARKER}\n`),
    )

    expect(result.ok).toBe(false)
    expect(result.backend).toBe('mock')
    expect(result.artifact).toBeUndefined()
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]?.severity).toBe('error')
  })
})
