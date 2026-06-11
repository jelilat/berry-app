import type { BoardId } from '@/lib/project/types'

/** One GPIO line mapped from the board to a peripheral. */
export interface MappedGpio {
  boardTerminalId: string
  boardTerminalLabel: string
  arduinoPin: number
}

/** LED wired to a board GPIO through the project graph. */
export interface MappedLed {
  componentId: string
  componentName: string
  gpio: MappedGpio
}

/** Pin map extracted from the wiring graph for firmware codegen. */
export interface ProjectPinMap {
  board: BoardId
  mcuComponentId: string
  mcuComponentName: string
  leds: MappedLed[]
}

/** Result of deterministic graph → sketch codegen. */
export interface CodegenResult {
  ok: boolean
  source: string
  pinMap: ProjectPinMap
  notes: string[]
}
