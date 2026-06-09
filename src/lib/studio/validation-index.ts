import type { BerryProject } from '@/lib/project/types'
import type { ValidationResult } from '@/lib/validation/types'
import { terminalKey } from './connect-pins'

/** O(1) lookup maps for Studio validation overlays. */
export interface ValidationIndex {
  byTerminalKey: Map<string, ValidationResult[]>
  byWireId: Map<string, ValidationResult[]>
  byNetId: Map<string, ValidationResult[]>
}

/**
 * Append a finding to a map keyed by subject anchors.
 * @param map Target lookup map.
 * @param key Lookup key.
 * @param result Validation finding to store.
 */
function pushToMap<K>(
  map: Map<K, ValidationResult[]>,
  key: K,
  result: ValidationResult,
): void {
  const list = map.get(key) ?? []
  list.push(result)
  map.set(key, list)
}

/**
 * Build terminal, wire, and net indexes from validation output.
 * Wires inherit findings from their net id for inline stroke highlighting.
 * @param project Berry project graph (for wire → net resolution).
 * @param results Sorted validation findings.
 */
export function buildValidationIndex(
  project: BerryProject,
  results: ValidationResult[],
): ValidationIndex {
  const byTerminalKey = new Map<string, ValidationResult[]>()
  const byWireId = new Map<string, ValidationResult[]>()
  const byNetId = new Map<string, ValidationResult[]>()

  for (const result of results) {
    const subject = result.subject
    if (!subject) continue

    if (subject.netId) {
      pushToMap(byNetId, subject.netId, result)
      for (const wire of project.wires) {
        if (wire.net === subject.netId) {
          pushToMap(byWireId, wire.id, result)
        }
      }
    }

    if (subject.wireId) {
      pushToMap(byWireId, subject.wireId, result)
      const wire = project.wires.find((w) => w.id === subject.wireId)
      if (wire?.net) {
        pushToMap(byNetId, wire.net, result)
      }
    }

    if (subject.componentId && subject.terminalId) {
      pushToMap(
        byTerminalKey,
        terminalKey(subject.componentId, subject.terminalId),
        result,
      )
    }
  }

  return { byTerminalKey, byWireId, byNetId }
}

/**
 * Join validation messages for a tooltip title attribute.
 * @param results Findings tied to one canvas entity.
 */
export function validationTooltip(results: ValidationResult[]): string {
  return results.map((r) => r.message).join('\n')
}

/**
 * Pick the highest-severity stroke color for a wire overlay.
 * @param results Findings tied to one wire.
 */
export function validationWireStroke(results: ValidationResult[]): string | null {
  if (results.some((r) => r.severity === 'error')) return 'var(--accent)'
  if (results.some((r) => r.severity === 'warning')) return '#ea580c'
  if (results.length > 0) return 'var(--text-muted)'
  return null
}
