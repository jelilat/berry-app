import type { BerryProject } from '@/lib/project/types'
import { buildValidationContext } from './context'
import { checkComponents, checkConnectivity, checkNetPower } from './rules'
import type { ValidationResult, ValidationSeverity } from './types'

const SEVERITY_RANK: Record<ValidationSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

/**
 * Sort findings by severity, code, then message for stable UI ordering.
 * @param results Unsorted validation findings.
 */
function sortResults(results: ValidationResult[]): ValidationResult[] {
  return [...results].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (bySeverity !== 0) return bySeverity
    const byCode = a.code.localeCompare(b.code)
    if (byCode !== 0) return byCode
    return a.message.localeCompare(b.message)
  })
}

/**
 * Run all validation rules against a Berry project.
 * @param project Project graph to inspect.
 */
export function validate(project: BerryProject): ValidationResult[] {
  const ctx = buildValidationContext(project)
  const results: ValidationResult[] = []
  results.push(...checkNetPower(ctx))
  results.push(...checkConnectivity(ctx))
  results.push(...checkComponents(ctx))
  return sortResults(results)
}

/**
 * True when any finding is an error (blocks Build / Deploy).
 * @param results Validation output from {@link validate}.
 */
export function hasValidationErrors(results: ValidationResult[]): boolean {
  return results.some((r) => r.severity === 'error')
}

/**
 * Count error-severity results for toolbar tooltips.
 * @param results Output from {@link validate}.
 */
export function countValidationErrors(results: ValidationResult[]): number {
  return results.filter((r) => r.severity === 'error').length
}

/**
 * Filter findings that reference a specific net.
 * @param results Validation output.
 * @param netId Net id to match on `subject.netId`.
 */
export function resultsForNet(
  results: ValidationResult[],
  netId: string,
): ValidationResult[] {
  return results.filter((r) => r.subject?.netId === netId)
}

/**
 * Filter findings that reference a specific component terminal.
 * @param results Validation output.
 * @param componentId Component instance id.
 * @param terminalId Catalog terminal id.
 */
export function resultsForTerminal(
  results: ValidationResult[],
  componentId: string,
  terminalId: string,
): ValidationResult[] {
  return results.filter(
    (r) =>
      r.subject?.componentId === componentId &&
      r.subject?.terminalId === terminalId,
  )
}
