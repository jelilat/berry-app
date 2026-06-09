import { loadBerryProjectFromJson, serializeBerryProject } from '@/lib/project/io'
import type { BerryProject } from '@/lib/project/types'
import {
  FIRMWARE_SOURCE_STORAGE_KEY,
  INSPECTOR_WIDTH_DEFAULT,
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
  INSPECTOR_WIDTH_STORAGE_KEY,
  STUDIO_STORAGE_KEY,
} from './constants'

/**
 * Persist the current project to `localStorage`.
 * @param project Valid Berry project.
 */
export function saveProjectToStorage(project: BerryProject): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STUDIO_STORAGE_KEY, serializeBerryProject(project, false))
}

/**
 * Load a project from `localStorage`, or null if missing/invalid.
 */
export function loadProjectFromStorage(): BerryProject | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY)
  if (!raw) return null
  try {
    return loadBerryProjectFromJson(raw)
  } catch {
    return null
  }
}

/**
 * Remove persisted project from storage.
 */
export function clearProjectStorage(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STUDIO_STORAGE_KEY)
}

/**
 * Persist browser-edited firmware source to `localStorage`.
 * @param source Source text for `src/main.cpp`.
 */
export function saveFirmwareSourceToStorage(source: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FIRMWARE_SOURCE_STORAGE_KEY, source)
}

/**
 * Load browser-edited firmware source from `localStorage`, or null if missing.
 */
export function loadFirmwareSourceFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(FIRMWARE_SOURCE_STORAGE_KEY)
}

/**
 * Remove browser-edited firmware source from storage.
 */
export function clearFirmwareSourceStorage(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(FIRMWARE_SOURCE_STORAGE_KEY)
}

/**
 * Clamp inspector panel width to allowed bounds.
 * @param width Raw width in pixels.
 */
export function clampInspectorWidth(width: number): number {
  return Math.min(INSPECTOR_WIDTH_MAX, Math.max(INSPECTOR_WIDTH_MIN, width))
}

/**
 * Load persisted component inspector width, or the default.
 */
export function loadInspectorWidth(): number {
  if (typeof window === 'undefined') return INSPECTOR_WIDTH_DEFAULT
  const raw = window.localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY)
  if (!raw) return INSPECTOR_WIDTH_DEFAULT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return INSPECTOR_WIDTH_DEFAULT
  return clampInspectorWidth(n)
}

/**
 * Persist component inspector panel width.
 * @param width Width in pixels (clamped before save).
 */
export function saveInspectorWidth(width: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    INSPECTOR_WIDTH_STORAGE_KEY,
    String(clampInspectorWidth(width)),
  )
}

/**
 * Trigger a browser download of project JSON.
 * @param project Berry project to export.
 * @param filename Download filename.
 */
export function downloadProjectJson(
  project: BerryProject,
  filename = 'project.json',
): void {
  const blob = new Blob([serializeBerryProject(project)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
