'use client'

import { useMemo } from 'react'
import type { BerryProject } from '@/lib/project/types'
import { validate, type ValidationResult } from '@/lib/validation'

/**
 * Memoized validation results for the current Studio project.
 *
 * @param project Live bench project graph.
 */
export function useValidation(project: BerryProject): ValidationResult[] {
  return useMemo(() => validate(project), [project])
}
