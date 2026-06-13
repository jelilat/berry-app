import { loadBerryProjectFromJson } from '@/lib/project/io'
import { createStarterProject } from '@/lib/project/mutations'
import type { BerryProject } from '@/lib/project/types'
import {
  createDefaultFirmwareSource,
  createEsp32BlinkFirmwareSource,
} from '@/lib/firmware/source'
import { getBuilderTemplate } from '@/lib/studio/templates'
import {
  clearFirmwareSourceStorage,
  saveFirmwareSourceToStorage,
  saveProjectToStorage,
} from '@/lib/studio/storage'
import { upsertUserProject } from '@/lib/projects/user-projects'
import type { UserModelOption } from '@/lib/studio/user-models'

/** sessionStorage key for a prompt to run after opening Studio. */
export const PENDING_PROMPT_KEY = 'berry-studio-pending-prompt'

/** sessionStorage key for the selected model on the next agent run. */
export const PENDING_MODEL_MODE_KEY = 'berry-studio-pending-model-mode'

/**
 * Store a custom prompt and model mode for Studio to pick up on load.
 * @param prompt Builder prompt text.
 * @param model Selected user model option.
 */
export function stashPendingAgentRun(prompt: string, model: UserModelOption): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(PENDING_PROMPT_KEY, prompt.trim())
  window.sessionStorage.setItem(PENDING_MODEL_MODE_KEY, model.mode)
}

/**
 * Read and clear a pending Studio agent prompt, if present.
 */
export function consumePendingAgentRun(): { prompt: string; mode: UserModelOption['mode'] } | null {
  if (typeof window === 'undefined') return null
  const prompt = window.sessionStorage.getItem(PENDING_PROMPT_KEY)?.trim()
  const mode = window.sessionStorage.getItem(PENDING_MODEL_MODE_KEY)
  window.sessionStorage.removeItem(PENDING_PROMPT_KEY)
  window.sessionStorage.removeItem(PENDING_MODEL_MODE_KEY)
  if (!prompt) return null
  return {
    prompt,
    mode:
      mode === 'real' || mode === 'deterministic' || mode === 'auto'
        ? mode
        : 'auto',
  }
}

/**
 * Apply starter metadata to a freshly created project graph.
 * @param project Base project graph.
 * @param name Display name for the project.
 * @param description Optional description.
 */
function withProjectMetadata(
  project: BerryProject,
  name: string,
  description?: string,
): BerryProject {
  const now = new Date().toISOString()
  return {
    ...project,
    metadata: {
      ...project.metadata,
      name,
      description: description ?? project.metadata.description,
      createdAt: project.metadata.createdAt ?? now,
      updatedAt: now,
    },
  }
}

/**
 * Load a builder template into browser storage and optionally save it for a signed-in user.
 * @param templateId Template id from a reference chip.
 * @param options Whether to persist the project in the user library.
 */
export async function bootstrapBuilderTemplate(
  templateId: string,
  options?: { saveForUser?: boolean },
): Promise<BerryProject> {
  const template = getBuilderTemplate(templateId)
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`)
  }

  let project: BerryProject
  if (template.kind === 'example' && template.examplePath) {
    const response = await fetch(template.examplePath)
    if (!response.ok) {
      throw new Error(`Example file not found: ${template.examplePath}`)
    }
    project = loadBerryProjectFromJson(await response.text())
  } else {
    project = withProjectMetadata(createStarterProject(), template.projectName, template.prompt)
  }

  saveProjectToStorage(project)
  if (template.id === 'blink-led') {
    saveFirmwareSourceToStorage(createEsp32BlinkFirmwareSource())
  } else {
    clearFirmwareSourceStorage()
    saveFirmwareSourceToStorage(createDefaultFirmwareSource(project.board))
  }

  if (options?.saveForUser) {
    upsertUserProject(project)
  }

  return project
}

/**
 * Load a saved user project into browser storage before opening Studio.
 * @param projectJson Serialized Berry project JSON.
 */
export function bootstrapSavedProject(projectJson: string): BerryProject {
  const project = loadBerryProjectFromJson(projectJson)
  saveProjectToStorage(project)
  saveFirmwareSourceToStorage(createDefaultFirmwareSource(project.board))
  return project
}
