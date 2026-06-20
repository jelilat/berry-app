import { parseBerryProject, ProjectParseError } from '@/lib/project/io'

/**
 * Type guard: value is a non-null, non-array object.
 * @param value Untrusted JSON value.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normalize a hosted agent result project before it reaches Studio state.
 * @param json Hosted agent API JSON payload.
 * @throws ProjectParseError when the hosted payload contains an invalid project graph.
 */
export function normalizeHostedAgentRunJson(json: unknown): unknown {
  if (!isRecord(json)) return json
  const result = json.result
  if (!isRecord(result)) return json
  const state = result.state
  if (!isRecord(state) || !('project' in state)) return json

  const project = parseBerryProject(state.project)
  return {
    ...json,
    result: {
      ...result,
      state: {
        ...state,
        project,
      },
    },
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
