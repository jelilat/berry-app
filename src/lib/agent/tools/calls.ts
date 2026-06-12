import type { WireEndpointRef } from '@/lib/project/mutations'
import type { BoardId, ComponentTypeId, WireColor } from '@/lib/project/types'

/**
 * Endpoint a circuit tool call may reference: a component terminal or a bare
 * breadboard hole/rail. Mirrors {@link WireEndpointRef} so the executor can pass
 * it straight into the project mutation layer.
 */
export type StudioToolEndpoint = WireEndpointRef

/** Set the firmware target board. */
export interface StudioSetBoardCall {
  tool: 'studio.set_board'
  board: BoardId
}

/** Add one catalog component at a scene position. */
export interface StudioAddComponentCall {
  tool: 'studio.add_component'
  componentType: ComponentTypeId
  id: string
  x: number
  y: number
  rotationZ?: number
}

/** Move an existing component to a new 2D scene position. */
export interface StudioMoveComponentCall {
  tool: 'studio.move_component'
  id: string
  x: number
  y: number
}

/** Connect two terminals (or breadboard holes) with a visual wire + net. */
export interface StudioConnectTerminalsCall {
  tool: 'studio.connect_terminals'
  from: StudioToolEndpoint
  to: StudioToolEndpoint
  color?: WireColor
}

/** Run wiring validation against the current project graph. */
export interface ProjectValidateCall {
  tool: 'project.validate'
}

/**
 * Structured circuit-designer tool call. The model is only ever allowed to emit
 * these typed calls; raw `project.json` edits are intentionally not part of the
 * union.
 */
export type StudioToolCall =
  | StudioSetBoardCall
  | StudioAddComponentCall
  | StudioMoveComponentCall
  | StudioConnectTerminalsCall
  | ProjectValidateCall

/** Tool names the executor understands. */
export type StudioToolName = StudioToolCall['tool']
