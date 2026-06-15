/** Berry agent role that can be mapped to different AI model policies. */
export type BerryAgentRole =
  | 'clarifier'
  | 'planner'
  | 'circuit_designer'
  | 'firmware'
  | 'wiring_guide'
  | 'presenter'

/** Provider family for model calls made by Berry agents. */
export type BerryModelProvider = 'mock' | 'openai' | 'anthropic' | 'google' | 'openrouter'

/** Reasoning effort accepted by current OpenAI reasoning models. */
export type BerryReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

/** Capability and runtime settings for one model option. */
export interface BerryModelConfig {
  provider: BerryModelProvider
  model: string
  supportsTools: boolean
  supportsStructuredOutput: boolean
  temperature: number
  reasoningEffort?: BerryReasoningEffort
}

/** Named model profiles used by agent roles. */
export type BerryModelProfile = 'mock' | 'fast_reasoning' | 'strong_reasoning' | 'code_reasoning' | 'fast_writer'

/** Registry of model profiles available to the agent workflow. */
export type BerryModelRegistry = Record<BerryModelProfile, BerryModelConfig>

/** Role-to-profile policy for model selection. */
export type BerryModelPolicy = Record<BerryAgentRole, BerryModelProfile>

/** Default model registry; real provider values can be overridden from env later. */
export const DEFAULT_MODEL_REGISTRY: BerryModelRegistry = {
  mock: {
    provider: 'mock',
    model: 'berry-deterministic-v1',
    supportsTools: true,
    supportsStructuredOutput: true,
    temperature: 0,
  },
  fast_reasoning: {
    provider: 'openai',
    model: process.env.BERRY_AI_FAST_MODEL?.trim() || 'gpt-5.4-mini',
    supportsTools: true,
    supportsStructuredOutput: true,
    temperature: 0.2,
  },
  strong_reasoning: {
    provider: 'openai',
    model: process.env.BERRY_AI_STRONG_MODEL?.trim() || 'gpt-5.5',
    supportsTools: true,
    supportsStructuredOutput: true,
    temperature: 0.1,
  },
  code_reasoning: {
    provider: 'openai',
    model: process.env.BERRY_AI_CODE_MODEL?.trim() || 'gpt-5.5',
    supportsTools: true,
    supportsStructuredOutput: true,
    temperature: 0,
  },
  fast_writer: {
    provider: 'openai',
    model: process.env.BERRY_AI_WRITER_MODEL?.trim() || 'gpt-5.4-mini',
    supportsTools: false,
    supportsStructuredOutput: true,
    temperature: 0.4,
  },
}

/** Default assignment of agents to model profiles. */
export const DEFAULT_MODEL_POLICY: BerryModelPolicy = {
  clarifier: 'fast_reasoning',
  planner: 'strong_reasoning',
  circuit_designer: 'strong_reasoning',
  firmware: 'code_reasoning',
  wiring_guide: 'fast_writer',
  presenter: 'fast_writer',
}

/**
 * Resolve the model config for one agent role.
 * @param role Agent role that needs a model.
 * @param registry Optional model registry override.
 * @param policy Optional role-to-profile policy override.
 */
export function resolveAgentModel(
  role: BerryAgentRole,
  registry: BerryModelRegistry = DEFAULT_MODEL_REGISTRY,
  policy: BerryModelPolicy = DEFAULT_MODEL_POLICY,
): BerryModelConfig {
  return registry[policy[role]]
}
