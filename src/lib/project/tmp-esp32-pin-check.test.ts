import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { loadBerryProjectFromJson } from '@/lib/project/io'
import { snapPartToBreadboardHole } from '@/lib/studio/breadboard-snap'

describe('esp32 example pin check', () => {
  it('keeps recorded ESP32 sites aligned with snapped Studio placement', () => {
    const project = loadBerryProjectFromJson(
      readFileSync('public/examples/esp32-led-blink.project.json', 'utf8'),
    )
    const bb = project.components.find((c) => c.id === 'breadboard_1')!
    const esp = project.components.find((c) => c.id === 'esp32_1')!
    const snapped = snapPartToBreadboardHole(
      bb,
      { ...esp, placement: undefined },
      esp.transform.position.x,
      esp.transform.position.y,
    )

    expect(Object.keys(esp.placement?.sites ?? {})).toHaveLength(30)
    expect(esp.placement?.sites).toEqual(snapped.placement?.sites)
  })
})
