import type { BuildDiagnostic, BuildResult, FirmwareSourceFiles } from '@/lib/build/types'
import type { CodegenResult } from '@/lib/codegen/types'
import type { BerryModelProvider, BerryReasoningEffort } from '@/lib/ai/model-registry'
import type { BerryProject, BoardId, ComponentTypeId } from '@/lib/project/types'
import type { SimulationResult } from '@/lib/simulation'
import type { ValidationResult } from '@/lib/validation'
import type { StudioToolCall } from './tools/calls'

/** Terminal agent workflow status returned to Studio. */
export type AgentRunStatus = 'completed' | 'needs_clarification' | 'failed'

/** Hosted backend run status used while polling an asynchronous agent run. */
export type AgentBackendRunStatus =
  | 'queued'
  | 'running'
  | 'needs_clarification'
  | 'completed'
  | 'failed'

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

/** One chat message sent as project-iteration context. */
export interface AgentProjectChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Current project context sent with an in-project chat request. */
export interface AgentProjectIterationContext {
  project: BerryProject
  firmwareFiles: FirmwareSourceFiles
  buildErrors?: BuildDiagnostic[]
  buildResult?: BuildResult
  simulationResult?: SimulationResult
  wiringGuide?: string
  timeline?: AgentTimelineEvent[]
}

/** Input payload for a project follow-up request. */
export interface AgentFollowupInput {
  message: string
  mode?: 'auto' | 'question' | 'modify'
  projectContext: AgentProjectIterationContext
  chatHistory?: AgentProjectChatMessage[]
  provider?: BerryModelProvider
  model?: string
  reasoningEffort?: BerryReasoningEffort
  tokenLimit?: number
  compactThreshold?: number
}

/** Accepted response returned when creating a project follow-up request. */
export interface AgentFollowupAccepted {
  requestId: string
  status: Extract<AgentBackendRunStatus, 'queued' | 'running'>
  statusUrl: string
}

/** Result returned by a completed project follow-up request. */
export type AgentFollowupResult =
  | {
      kind: 'answer' | 'diagnosis' | 'unsupported'
      intent?: string
      message: string
      suggestedChecks?: string[]
      notes?: string[]
    }
  | {
      kind: 'modification'
      intent?: string
      message: string
      project?: BerryProject
      firmwareFiles?: Partial<FirmwareSourceFiles>
      wiringGuide?: string
      notes?: string[]
    }
  | {
      kind: 'clarification'
      intent?: string
      message?: string
      questions: ClarifyingQuestion[]
    }

/** Public project follow-up record returned by the hosted API. */
export interface AgentFollowupRecord {
  requestId: string
  status: AgentBackendRunStatus
  input?: AgentFollowupInput
  result?: AgentFollowupResult
  error?: string
  usageEvents?: AgentUsageEvent[]
  createdAt?: string
  updatedAt?: string
}

/** Follow-up chat context collected by the Studio chat rail before request assembly. */
export interface AgentProjectChatContext {
  activeChatId?: string
  chatHistory: AgentProjectChatMessage[]
}

/** Input payload for an AI workflow run. */
export interface AgentRunInput {
  prompt: string
  project?: BerryProject
  projectContext?: AgentProjectIterationContext
  answers?: Record<string, string>
  mode?: 'auto' | 'deterministic' | 'real'
  provider?: BerryModelProvider
  model?: string
  reasoningEffort?: BerryReasoningEffort
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

/** One model or workflow usage event emitted by the hosted agent API. */
export interface AgentUsageEvent {
  action: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  provider?: string
  model?: string
}

/** Public run record returned by the hosted Berry agent API. */
export interface AgentBackendRunRecord {
  runId: string
  status: AgentBackendRunStatus
  input?: {
    prompt: string
    provider: BerryModelProvider
    model: string
    reasoningEffort?: BerryReasoningEffort
    answers?: Record<string, string>
  }
  answers?: Record<string, string>
  result?: AgentRunResult
  error?: string
  usageEvents?: AgentUsageEvent[]
  createdAt?: string
  updatedAt?: string
}

/** Accepted response returned when creating or resuming a backend agent run. */
export interface AgentBackendRunAccepted {
  runId: string
  status: Extract<AgentBackendRunStatus, 'queued' | 'running'>
  statusUrl: string
}

/** Clarification answers submitted against an existing backend run. */
export interface AgentAnswerSubmission {
  runId: string
  answers: Record<string, string>
}
