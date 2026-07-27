import type { FirmwareSourceFiles } from '@/lib/build/types'
import { DEFAULT_FIRMWARE_PATH } from './source'

/** Virtual source folder that contains user-editable firmware files. */
export const FIRMWARE_SOURCE_ROOT = 'src'

/** Result of validating a user-entered firmware workspace path. */
export interface FirmwarePathValidation {
  ok: boolean
  path?: string
  error?: string
}

/**
 * Normalize a user-entered path to a project-relative path under `src`.
 * @param input User-entered file or folder path.
 */
export function normalizeFirmwareSourcePath(input: string): string {
  const normalized = input.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (normalized === FIRMWARE_SOURCE_ROOT || normalized.startsWith(`${FIRMWARE_SOURCE_ROOT}/`)) {
    return normalized
  }
  return normalized ? `${FIRMWARE_SOURCE_ROOT}/${normalized}` : FIRMWARE_SOURCE_ROOT
}

/**
 * Validate that a project-relative path is safely contained under `src`.
 * @param input User-entered file or folder path.
 * @param kind Expected path kind.
 */
export function validateFirmwareSourcePath(
  input: string,
  kind: 'file' | 'folder',
): FirmwarePathValidation {
  const path = normalizeFirmwareSourcePath(input)
  const segments = path.split('/')

  if (path === FIRMWARE_SOURCE_ROOT) {
    return kind === 'folder'
      ? { ok: false, error: 'Choose a folder name inside src.' }
      : { ok: false, error: 'Choose a file name inside src.' }
  }
  if (
    !path.startsWith(`${FIRMWARE_SOURCE_ROOT}/`) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return { ok: false, error: 'Paths must stay inside src.' }
  }
  if (kind === 'file' && !segments.at(-1)?.includes('.')) {
    return { ok: false, error: 'Add a file extension, such as .cpp or .h.' }
  }
  return { ok: true, path }
}

/**
 * True when a build input path is a safe, supported firmware source path.
 * @param path Project-relative build file path.
 */
export function isSafeFirmwareBuildPath(path: string): boolean {
  if (path === 'platformio.ini') return true
  const result = validateFirmwareSourcePath(path, 'file')
  return result.ok && result.path === path
}

/**
 * Return all parent folders for a source file or nested folder.
 * @param path Project-relative source path.
 */
export function firmwareParentFolders(path: string): string[] {
  const segments = normalizeFirmwareSourcePath(path).split('/')
  const folders: string[] = []
  for (let index = 1; index < segments.length - 1; index += 1) {
    folders.push(segments.slice(0, index + 1).join('/'))
  }
  return folders
}

/**
 * Infer source folders from the paths in a firmware file map.
 * @param files Firmware files keyed by project-relative path.
 */
export function inferFirmwareFolders(files: Partial<FirmwareSourceFiles>): string[] {
  return Array.from(
    new Set(
      Object.keys(files)
        .filter((path) => path.startsWith(`${FIRMWARE_SOURCE_ROOT}/`))
        .flatMap(firmwareParentFolders),
    ),
  ).sort()
}

/**
 * Return starter content for a newly created source file.
 * @param path Project-relative source file path.
 */
export function createFirmwareFileContent(path: string): string {
  if (path.endsWith('.h') || path.endsWith('.hpp')) {
    return '#pragma once\n'
  }
  if (path.endsWith('.cpp') || path.endsWith('.c')) {
    return '#include <Arduino.h>\n'
  }
  return ''
}

/**
 * Merge the main source and additional user files into one build-ready map.
 * @param mainCpp Current `src/main.cpp` content.
 * @param additionalFiles Additional source files.
 */
export function createFirmwareSourceFiles(
  mainCpp: string,
  additionalFiles: Partial<FirmwareSourceFiles>,
): FirmwareSourceFiles {
  return {
    ...additionalFiles,
    [DEFAULT_FIRMWARE_PATH]: mainCpp,
  }
}

/**
 * Remove the canonical main file from a persisted firmware file map.
 * @param files Firmware files keyed by project-relative path.
 */
export function additionalFirmwareFiles(
  files: Partial<FirmwareSourceFiles> | undefined,
): FirmwareSourceFiles {
  const additional: FirmwareSourceFiles = {}
  for (const [path, source] of Object.entries(files ?? {})) {
    if (
      path !== DEFAULT_FIRMWARE_PATH &&
      path !== 'platformio.ini' &&
      typeof source === 'string' &&
      validateFirmwareSourcePath(path, 'file').ok
    ) {
      additional[path] = source
    }
  }
  return additional
}
