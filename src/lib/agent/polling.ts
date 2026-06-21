import type { AgentBackendRunRecord } from './types'

/** Options that control hosted agent run polling behavior. */
export interface AgentRunPollingOptions {
  pauseOnClarification?: boolean
}

/**
 * True when a backend run status no longer needs polling.
 * @param record Hosted agent run record.
 * @param options Polling behavior for clarification pauses.
 */
export function isTerminalAgentRun(
  record: AgentBackendRunRecord,
  options: AgentRunPollingOptions = {},
): boolean {
  if (record.status === 'completed' || record.status === 'failed') {
    return true
  }

  return record.status === 'needs_clarification' && (options.pauseOnClarification ?? true)
}
