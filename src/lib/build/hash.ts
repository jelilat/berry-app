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
 * Encode a SHA-256 digest as lowercase hex (Edge-compatible via Web Crypto).
 * @param data Bytes to hash.
 */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Compute the content hash tying a project graph to the firmware files built from it.
 * @param project Parsed Berry project.
 * @param files Firmware source files included in the build.
 */
export async function computeFirmwareHash(
  project: BerryProject,
  files: FirmwareSourceFiles,
): Promise<string> {
  const normalizedFiles = Object.fromEntries(
    Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
  )
  const payload = stableStringify({ project, files: normalizedFiles })
  return sha256Hex(new TextEncoder().encode(payload))
}
