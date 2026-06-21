import type { SupabaseClient } from '@supabase/supabase-js'
import { serializeBerryProject } from '@/lib/project/io'
import type { BerryProject } from '@/lib/project/types'
import type { UserProjectEntry } from './user-projects'

/** localStorage key for the cloud row currently open in Studio. */
export const ACTIVE_CLOUD_PROJECT_ID_KEY = 'berry-active-cloud-project-id'

interface CloudProjectRow {
  id: string
  name: string
  board: BerryProject['board']
  updated_at: string
  project_json: unknown
}

/**
 * Clear the active Supabase project id when opening a guest/local-only bench.
 */
export function clearActiveCloudProjectId(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACTIVE_CLOUD_PROJECT_ID_KEY)
}

/**
 * Display title for a saved project entry.
 * @param project Current Berry project graph.
 */
function projectTitle(project: BerryProject): string {
  return project.metadata.name.trim() || 'Untitled project'
}

/**
 * Convert a Supabase row into the sidebar's existing project entry shape.
 * @param row Row returned from the `projects` table.
 */
function cloudRowToProjectEntry(row: CloudProjectRow): UserProjectEntry {
  return {
    id: row.id,
    name: row.name,
    board: row.board,
    updatedAt: row.updated_at,
    projectJson:
      typeof row.project_json === 'string'
        ? row.project_json
        : JSON.stringify(row.project_json),
  }
}

/**
 * Load cloud projects for the currently signed-in Supabase user.
 * @param supabase Browser Supabase client with an active user session.
 */
export async function loadCloudUserProjects(
  supabase: SupabaseClient,
): Promise<UserProjectEntry[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,board,updated_at,project_json')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as CloudProjectRow[]).map(cloudRowToProjectEntry)
}

/**
 * Load one cloud project for the currently signed-in Supabase user.
 * @param supabase Browser Supabase client with an active user session.
 * @param projectId Supabase project row id from the route.
 */
export async function loadCloudUserProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<UserProjectEntry | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,board,updated_at,project_json')
    .eq('id', projectId)
    .maybeSingle()

  if (error) throw error
  return data ? cloudRowToProjectEntry(data as CloudProjectRow) : null
}

/**
 * Insert or update one project for the currently signed-in Supabase user.
 * @param supabase Browser Supabase client with an active user session.
 * @param project Current Berry project graph.
 * @param projectId Existing cloud row id, when this bench was opened from cloud.
 */
export async function upsertCloudUserProject(
  supabase: SupabaseClient,
  project: BerryProject,
  projectId?: string | null,
): Promise<UserProjectEntry> {
  const now = new Date().toISOString()
  const projectJson = JSON.parse(serializeBerryProject(project, false))
  const payload = {
    name: projectTitle(project),
    board: project.board,
    project_json: projectJson,
    updated_at: now,
  }

  if (projectId) {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .select('id,name,board,updated_at,project_json')
      .maybeSingle()

    if (error) throw error
    if (data) return cloudRowToProjectEntry(data as CloudProjectRow)
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select('id,name,board,updated_at,project_json')
    .single()

  if (error) throw error
  return cloudRowToProjectEntry(data as CloudProjectRow)
}

/**
 * Delete one cloud project for the currently signed-in Supabase user.
 * @param supabase Browser Supabase client with an active user session.
 * @param projectId Supabase project row id.
 */
export async function deleteCloudUserProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw error
}
