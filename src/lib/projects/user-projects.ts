import { serializeBerryProject } from '@/lib/project/io'
import type { BerryProject } from '@/lib/project/types'

/** localStorage key for saved user projects. */
export const USER_PROJECTS_STORAGE_KEY = 'berry-user-projects'

/** Saved project entry shown in the builder sidebar. */
export interface UserProjectEntry {
  id: string
  name: string
  board: BerryProject['board']
  updatedAt: string
  projectJson: string
}

/**
 * Load saved projects for the signed-in builder.
 */
export function loadUserProjects(): UserProjectEntry[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(USER_PROJECTS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as UserProjectEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Persist the full project list for the signed-in builder.
 * @param projects Saved project entries.
 */
export function saveUserProjects(projects: UserProjectEntry[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(USER_PROJECTS_STORAGE_KEY, JSON.stringify(projects))
}

/**
 * Upsert a project into the signed-in builder library.
 * @param project Current Berry project graph.
 */
export function upsertUserProject(project: BerryProject): UserProjectEntry {
  const slug =
    project.metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    'project'
  const projects = loadUserProjects()
  const existingIndex = projects.findIndex(
    (item) => item.name === project.metadata.name && item.board === project.board,
  )
  const entry: UserProjectEntry = {
    id: existingIndex >= 0 ? projects[existingIndex]!.id : `${slug}-${Date.now()}`,
    name: project.metadata.name,
    board: project.board,
    updatedAt: new Date().toISOString(),
    projectJson: serializeBerryProject(project, false),
  }

  if (existingIndex >= 0) {
    projects[existingIndex] = entry
  } else {
    projects.unshift(entry)
  }
  saveUserProjects(projects)
  return entry
}

/**
 * Remove one saved project from the builder library.
 * @param projectId Saved project id.
 */
export function removeUserProject(projectId: string): void {
  saveUserProjects(loadUserProjects().filter((project) => project.id !== projectId))
}
