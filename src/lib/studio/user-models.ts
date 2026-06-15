import type { BerryModelProvider } from '@/lib/ai/model-registry'

/** localStorage key for the builder home model preference. */
export const SELECTED_MODEL_STORAGE_KEY = 'berry-selected-model'

/** localStorage key for the builder home reasoning preference. */
export const SELECTED_REASONING_STORAGE_KEY = 'berry-selected-reasoning'

/** Reasoning effort levels exposed by current GPT models. */
export type UserReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

/** User-facing AI model option shown in the builder prompt. */
export interface UserModelOption {
  id: string
  label: string
  shortLabel: string
  description: string
  provider: BerryModelProvider
  model: string
  /** Agent workflow mode hint for `/api/agent/run`. */
  mode: 'auto' | 'deterministic' | 'real'
}

/** User-facing reasoning option shown next to the model picker. */
export interface UserReasoningOption {
  id: UserReasoningEffort
  label: string
  description: string
}

/** Models builders can pick before starting a hardware project. */
export const USER_MODEL_OPTIONS: UserModelOption[] = [
  {
    id: 'gpt-5.5',
    label: 'GPT-5.5',
    shortLabel: '5.5',
    description: 'Frontier reasoning for complex hardware builds',
    provider: 'openai',
    model: 'gpt-5.5',
    mode: 'auto',
  },
  {
    id: 'gpt-5.4',
    label: 'GPT-5.4',
    shortLabel: '5.4',
    description: 'Affordable coding and project reasoning',
    provider: 'openai',
    model: 'gpt-5.4',
    mode: 'auto',
  },
  {
    id: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    shortLabel: '5.4 Mini',
    description: 'Faster drafts for wiring and firmware iteration',
    provider: 'openai',
    model: 'gpt-5.4-mini',
    mode: 'auto',
  },
  {
    id: 'claude-fable-5',
    label: 'Claude Fable 5',
    shortLabel: 'Fable 5',
    description: 'Anthropic frontier model for demanding agentic work',
    provider: 'anthropic',
    model: 'claude-fable-5',
    mode: 'auto',
  },
  {
    id: 'claude-opus-4.8',
    label: 'Claude Opus 4.8',
    shortLabel: 'Opus 4.8',
    description: 'Anthropic Opus-tier reasoning and long-horizon coding',
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    mode: 'auto',
  },
  {
    id: 'claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    shortLabel: 'Sonnet 4.6',
    description: 'Anthropic speed/intelligence balance for coding workflows',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    mode: 'auto',
  },
]

/** Reasoning levels builders can pick before starting a hardware project. */
export const USER_REASONING_OPTIONS: UserReasoningOption[] = [
  {
    id: 'low',
    label: 'Low',
    description: 'Fastest pass for simple prompts',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Balanced depth for normal builds',
  },
  {
    id: 'high',
    label: 'High',
    description: 'Deeper planning for tricky circuits',
  },
  {
    id: 'xhigh',
    label: 'Extra High',
    description: 'Most thorough reasoning for complex work',
  },
]

/**
 * Resolve a stored model id to a known option, falling back to the first entry.
 * @param modelId Stored model id.
 */
export function resolveUserModel(modelId: string | null | undefined): UserModelOption {
  return USER_MODEL_OPTIONS.find((option) => option.id === modelId) ?? USER_MODEL_OPTIONS[0]!
}

/**
 * Resolve a stored reasoning id to a known option, falling back to medium.
 * @param reasoningId Stored reasoning id.
 */
export function resolveUserReasoning(
  reasoningId: string | null | undefined,
): UserReasoningOption {
  return (
    USER_REASONING_OPTIONS.find((option) => option.id === reasoningId) ??
    USER_REASONING_OPTIONS[1]!
  )
}

/**
 * Load the persisted model preference from localStorage.
 */
export function loadSelectedModelId(): string {
  if (typeof window === 'undefined') return USER_MODEL_OPTIONS[0]!.id
  const stored = window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY)
  return resolveUserModel(stored).id
}

/**
 * Persist the builder model preference.
 * @param modelId Selected model id.
 */
export function saveSelectedModelId(modelId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId)
}

/**
 * Load the persisted reasoning preference from localStorage.
 */
export function loadSelectedReasoningId(): UserReasoningEffort {
  if (typeof window === 'undefined') return USER_REASONING_OPTIONS[1]!.id
  const stored = window.localStorage.getItem(SELECTED_REASONING_STORAGE_KEY)
  return resolveUserReasoning(stored).id
}

/**
 * Persist the builder reasoning preference.
 * @param reasoningId Selected reasoning id.
 */
export function saveSelectedReasoningId(reasoningId: UserReasoningEffort): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SELECTED_REASONING_STORAGE_KEY, reasoningId)
}
