/** localStorage key for the builder home model preference. */
export const SELECTED_MODEL_STORAGE_KEY = 'berry-selected-model'

/** User-facing AI model option shown in the builder prompt. */
export interface UserModelOption {
  id: string
  label: string
  description: string
  /** Agent workflow mode hint for `/api/agent/run`. */
  mode: 'auto' | 'deterministic' | 'real'
}

/** Models builders can pick before starting a hardware project. */
export const USER_MODEL_OPTIONS: UserModelOption[] = [
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    description: 'Fast wiring and firmware drafts',
    mode: 'auto',
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    description: 'Stronger reasoning for complex builds',
    mode: 'auto',
  },
  {
    id: 'berry-demo',
    label: 'Berry Demo',
    description: 'Offline deterministic demo path',
    mode: 'deterministic',
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
