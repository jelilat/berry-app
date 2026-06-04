import { describe, expect, it } from 'vitest'
import { breadboardHole } from '@/lib/project/breadboard'
import { connectTerminals } from '@/lib/project/mutations'
import type { BerryProject } from '@/lib/project/types'
import { buildWireInspectorModel } from './wire-inspector'

/**
 * Build a minimal project with one breadboard for wire inspector tests.
 */
function breadboardProject(): BerryProject {
  return {
    version: 1,
    board: 'esp32-devkit-v1',
    metadata: { name: 'wire inspect' },
    components: [
      {
        id: 'breadboard_1',
        type: 'breadboard-full',
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
      },
    ],
    nets: [],
    wires: [],
  }
}

describe('buildWireInspectorModel', () => {
  it('shows breadboard hole endpoints for a jumper wire', () => {
    const project = connectTerminals(
      breadboardProject(),
      { breadboardId: 'breadboard_1', site: breadboardHole('a', 10) },
      { breadboardId: 'breadboard_1', site: breadboardHole('j', 30) },
      { color: 'green', connectors: { start: 'male', end: 'male' } },
    )

    const model = buildWireInspectorModel(project, project.wires[0].id)

    expect(model?.wireId).toBe(project.wires[0].id)
    expect(model?.colorHex).toBe('#0FA886')
    expect(model?.from.label).toContain('a10')
    expect(model?.from.canEditHole).toBe(true)
    expect(model?.from.holeInput).toBe('a10')
    expect(model?.to.label).toContain('j30')
    expect(model?.to.canEditHole).toBe(true)
    expect(model?.netMembers).toHaveLength(2)
  })
})
