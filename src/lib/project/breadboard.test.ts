import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  breadboardHole,
  breadboardHoleTieKey,
  formatBreadboardSite,
  sitesShareTie,
} from './breadboard'
import { inferPlacementFromAnchor } from './breadboard-placement'
import { loadBerryProjectFromJson, parseBerryProject } from './io'

describe('breadboardTieKey', () => {
  it('groups same-column strips within one breadboard block', () => {
    const a = breadboardHole('a', 10, 'top')
    const b = breadboardHole('e', 10, 'top')
    const c = breadboardHole('e', 11, 'top')
    expect(sitesShareTie(a, b)).toBe(true)
    expect(sitesShareTie(a, c)).toBe(false)
    expect(breadboardHoleTieKey(a)).toBe('hole:top:10')
  })

  it('separates top and bottom blocks', () => {
    const top = breadboardHole('e', 10, 'top')
    const bottom = breadboardHole('f', 10, 'bottom')
    expect(sitesShareTie(top, bottom)).toBe(false)
  })

  it('formats hole labels for UI', () => {
    expect(formatBreadboardSite(breadboardHole('e', 10, 'top'))).toBe('e10↑')
  })
})

describe('inferPlacementFromAnchor', () => {
  it('spreads two passive pins along columns at 0°', () => {
    const anchor = breadboardHole('e', 10, 'top')
    const p = inferPlacementFromAnchor('resistor-220', anchor, 0)
    expect(p?.sites.pin1).toEqual(anchor)
    expect(p?.sites.pin2).toMatchObject({ kind: 'hole', row: 'e', column: 12 })
    expect(sitesShareTie(p!.sites.pin1, p!.sites.pin2)).toBe(false)
  })

  it('keeps rotated passive pins out of the same breadboard tie', () => {
    const anchor = breadboardHole('e', 10, 'top')
    const p = inferPlacementFromAnchor('resistor-220', anchor, 90)

    expect(p?.sites.pin1).toEqual(anchor)
    expect(p?.sites.pin2).toMatchObject({ kind: 'hole', row: 'e', column: 12 })
    expect(sitesShareTie(p!.sites.pin1, p!.sites.pin2)).toBe(false)
  })
})

describe('placement in project JSON', () => {
  it('round-trips placement on breadboard children', () => {
    const project = parseBerryProject({
      version: 1,
      board: 'esp32-devkit-v1',
      metadata: { name: 't' },
      components: [
        {
          id: 'bb',
          type: 'breadboard-full',
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'led',
          type: 'led-5mm',
          parent: 'bb',
          transform: { position: { x: 0.1, y: 0.05, z: 0 } },
          placement: {
            sites: {
              anode: { kind: 'hole', block: 'top', row: 'e', column: 14 },
              cathode: { kind: 'hole', block: 'top', row: 'e', column: 16 },
            },
          },
        },
      ],
      nets: [
        {
          id: 'n1',
          terminals: [
            { component: 'led', terminal: 'anode' },
            {
              component: 'led',
              terminal: 'cathode',
              site: { kind: 'hole', block: 'top', row: 'f', column: 14 },
            },
          ],
        },
      ],
      wires: [],
    })
    expect(project.components[1].placement?.sites.anode).toMatchObject({ row: 'e', column: 14 })
  })

  it('keeps the ESP32 LED blink example sites aligned with the visual breadboard placement', () => {
    const filePath = path.join(process.cwd(), 'examples', 'esp32-led-blink.project.json')
    const project = loadBerryProjectFromJson(readFileSync(filePath, 'utf8'))

    for (const net of project.nets) {
      for (const terminal of net.terminals) {
        if (!terminal.component || !terminal.terminal) continue
        const component = project.components.find(
          (candidate) => candidate.id === terminal.component,
        )
        expect(terminal.site).toEqual(component?.placement?.sites[terminal.terminal])
      }
    }

    const resistor = project.components.find((component) => component.id === 'resistor_1')
    const led = project.components.find((component) => component.id === 'led_1')

    expect(
      sitesShareTie(resistor!.placement!.sites.pin2, led!.placement!.sites.anode),
    ).toBe(true)
    expect(
      sitesShareTie(led!.placement!.sites.anode, led!.placement!.sites.cathode),
    ).toBe(false)
  })
})
