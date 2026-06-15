import { createHash } from 'node:crypto'
import type { BerryProject } from '@/lib/project/types'
import type { FirmwareSourceFiles } from './types'

/**
 * JSON stringify with stable object key ordering for deterministic hashes.
 * @param value Value to encode.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Compute the content hash tying a project graph to the firmware files built from it.
 * @param project Parsed Berry project.
 * @param files Firmware source files included in the build.
 */
export function computeFirmwareHash(project: BerryProject, files: FirmwareSourceFiles): string {
  const normalizedFiles = Object.fromEntries(
    Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
  )
  return createHash('sha256')
    .update(stableStringify({ project, files: normalizedFiles }))
    .digest('hex')
}
