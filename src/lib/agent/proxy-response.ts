import { parseBerryProject, ProjectParseError } from '@/lib/project/io'

/**
 * Type guard: value is a non-null, non-array object.
 * @param value Untrusted JSON value.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normalize a workflow state when it includes a project graph.
 * @param state Hosted workflow state snapshot.
 * @throws ProjectParseError when the hosted payload contains an invalid project graph.
 */
function normalizeStateProject(state: unknown): unknown {
  if (!isRecord(state) || !('project' in state)) return state

  return {
    ...state,
    project: parseBerryProject(state.project),
  }
}

/**
 * Normalize an agent result when it includes a workflow state.
 * @param result Hosted workflow result or partial result.
 * @throws ProjectParseError when the hosted payload contains an invalid project graph.
 */
function normalizeResultProject(result: unknown): unknown {
  if (!isRecord(result)) return result
  const state = normalizeStateProject(result.state)
  if (state === result.state) return result

  return {
    ...result,
    state,
  }
}

/**
 * Normalize hosted agent project snapshots before they reach Studio state.
 * @param json Hosted agent API JSON payload.
 * @throws ProjectParseError when the hosted payload contains an invalid project graph.
 */
export function normalizeHostedAgentRunJson(json: unknown): unknown {
  if (!isRecord(json)) return json

  const state = normalizeStateProject(json.state)
  const partialResult = normalizeResultProject(json.partialResult)
  const result = normalizeResultProject(json.result)

  if (state === json.state && partialResult === json.partialResult && result === json.result) {
    return json
  }

  return {
    ...json,
    state,
    partialResult,
    result,
  }
}

/**
 * Convert hosted project-shape failures into a proxy error for the Studio client.
 * @param error Error thrown while normalizing hosted agent JSON.
 */
export function hostedAgentProjectErrorMessage(error: unknown): string | null {
  if (error instanceof ProjectParseError) {
    return `Agent API returned invalid project: ${error.message}`
  }
  return null
}
