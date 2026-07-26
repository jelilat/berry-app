import type { SupabaseClient } from '@supabase/supabase-js'
import type { FirmwareSourceFiles } from '@/lib/build/types'
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
  firmware_files?: unknown
}

interface CloudProjectShareRow {
  is_shared: boolean
  shared_at: string | null
}

/** Current public-sharing state for a cloud project. */
export interface CloudProjectShareState {
  isShared: boolean
  sharedAt: string | null
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
 * Parse stored firmware files from Supabase JSON.
 * @param value Unknown JSON value from the `firmware_files` column.
 */
function parseFirmwareFiles(value: unknown): Partial<FirmwareSourceFiles> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const files = Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string',
    ),
  )
  return Object.keys(files).length > 0 ? files : undefined
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
    firmwareFiles: parseFirmwareFiles(row.firmware_files),
  }
}

/**
 * Convert a Supabase share row into the app-facing sharing state.
 * @param row Share fields returned from the `projects` table.
 */
function cloudRowToShareState(row: CloudProjectShareRow): CloudProjectShareState {
  return {
    isShared: row.is_shared,
    sharedAt: row.shared_at,
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
    .select('id,name,board,updated_at,project_json,firmware_files')
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
    .select('id,name,board,updated_at,project_json,firmware_files')
    .eq('id', projectId)
    .maybeSingle()

  if (error) throw error
  return data ? cloudRowToProjectEntry(data as CloudProjectRow) : null
}

/**
 * Load a project through the public, read-only sharing RPC.
 * @param supabase Browser Supabase client; no signed-in session is required.
 * @param projectId Shared project UUID from the URL.
 */
export async function loadPublicCloudProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<UserProjectEntry | null> {
  const { data, error } = await supabase
    .rpc('get_shared_project', { project_id: projectId })
    .maybeSingle()

  if (error) throw error
  return data ? cloudRowToProjectEntry(data as CloudProjectRow) : null
}

/**
 * Load sharing state for a project owned by the current user.
 * @param supabase Browser Supabase client with an active user session.
 * @param projectId Supabase project row id.
 */
export async function loadCloudProjectShareState(
  supabase: SupabaseClient,
  projectId: string,
): Promise<CloudProjectShareState> {
  const { data, error } = await supabase
    .from('projects')
    .select('is_shared,shared_at')
    .eq('id', projectId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Project not found')
  return cloudRowToShareState(data as CloudProjectShareRow)
}

/**
 * Enable or revoke public, view-only access for an owned cloud project.
 * @param supabase Browser Supabase client with an active user session.
 * @param projectId Supabase project row id.
 * @param isShared Whether anyone with the project URL may view it.
 */
export async function setCloudProjectSharing(
  supabase: SupabaseClient,
  projectId: string,
  isShared: boolean,
): Promise<CloudProjectShareState> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      is_shared: isShared,
      shared_at: isShared ? new Date().toISOString() : null,
    })
    .eq('id', projectId)
    .select('is_shared,shared_at')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Project not found')
  return cloudRowToShareState(data as CloudProjectShareRow)
}

/**
 * Insert or update one project for the currently signed-in Supabase user.
 * @param supabase Browser Supabase client with an active user session.
 * @param project Current Berry project graph.
 * @param firmwareFiles Firmware source files keyed by project-relative path.
 * @param projectId Existing cloud row id, when this bench was opened from cloud.
 */
export async function upsertCloudUserProject(
  supabase: SupabaseClient,
  project: BerryProject,
  firmwareFiles?: Partial<FirmwareSourceFiles>,
  projectId?: string | null,
): Promise<UserProjectEntry> {
  const now = new Date().toISOString()
  const projectJson = JSON.parse(serializeBerryProject(project, false))
  const payload = {
    name: projectTitle(project),
    board: project.board,
    project_json: projectJson,
    firmware_files: firmwareFiles ?? {},
    updated_at: now,
  }

  if (projectId) {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .select('id,name,board,updated_at,project_json,firmware_files')
      .maybeSingle()

    if (error) throw error
    if (data) return cloudRowToProjectEntry(data as CloudProjectRow)
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select('id,name,board,updated_at,project_json,firmware_files')
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
