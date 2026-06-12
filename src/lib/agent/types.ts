import type { BuildResult, FirmwareSourceFiles } from '@/lib/build/types'
import type { CodegenResult } from '@/lib/codegen/types'
import type { BerryProject, BoardId, ComponentTypeId } from '@/lib/project/types'
import type { SimulationResult } from '@/lib/simulation'
import type { ValidationResult } from '@/lib/validation'
import type { StudioToolCall } from './tools/calls'

/** Agent workflow status returned to Studio. */
export type AgentRunStatus = 'completed' | 'needs_clarification' | 'failed'

/** Timeline event severity for the AI build panel. */
export type AgentTimelineTone = 'info' | 'success' | 'warning' | 'error'

/** One visible step in an AI run timeline. */
export interface AgentTimelineEvent {
  id: string
  agent: string
  title: string
  detail?: string
  tone: AgentTimelineTone
  createdAt: string
}

/** Clarifying question presented to a user before planning. */
export interface ClarifyingQuestion {
  id: string
  question: string
  reason: string
  options?: string[]
}

/** Result of the clarifier stage. */
export type ClarificationResult =
  | {
      status: 'ready'
      normalizedGoal: string
      assumptions: string[]
    }
  | {
      status: 'needs_clarification'
      questions: ClarifyingQuestion[]
    }

/** One planned part for a hardware build. */
export interface AgentPlannedComponent {
  type: ComponentTypeId
  role: string
}

/** Hardware behavior expected from the generated firmware. */
export interface AgentBehaviorPlan {
  kind: 'blink' | 'serial_monitor' | 'custom'
  intervalMs?: number
  description: string
}

/** Structured plan produced by the planner agent. */
export interface AgentBuildPlan {
  goal: string
  board: BoardId
  components: AgentPlannedComponent[]
  behavior: AgentBehaviorPlan
  constraints: string[]
}

/** Board-aware reference circuit the AI build loop can execute today. */
export type AgentReferenceCircuit =
  | 'esp32_led_blink'
  | 'arduino_uno_led_blink'
  | 'unsupported'

/** Bounded circuit implementation intent selected by the circuit design agent. */
export interface AgentCircuitIntent {
  referenceCircuit: AgentReferenceCircuit
  rationale: string
  toolPlan: string[]
  toolCalls: StudioToolCall[]
}

/** Model-authored wiring guide draft. */
export interface WiringGuideDraft {
  markdown: string
}

/** Input payload for an AI workflow run. */
export interface AgentRunInput {
  prompt: string
  project?: BerryProject
  answers?: Record<string, string>
  mode?: 'auto' | 'deterministic' | 'real'
}

/** Shared state carried through a Phase 6 agent workflow. */
export interface AgentRunState {
  runId: string
  userPrompt: string
  clarification: ClarificationResult
  plan?: AgentBuildPlan
  circuitIntent?: AgentCircuitIntent
  project: BerryProject
  firmwareFiles: Partial<FirmwareSourceFiles>
  validationResults: ValidationResult[]
  codegenResult?: CodegenResult
  buildResult?: BuildResult
  simulationResult?: SimulationResult
  wiringGuide?: string
  timeline: AgentTimelineEvent[]
}

/** Final result returned by the agent workflow API. */
export interface AgentRunResult {
  ok: boolean
  status: AgentRunStatus
  state: AgentRunState
  error?: string
}
