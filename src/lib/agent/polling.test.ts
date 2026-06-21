import { describe, expect, it } from 'vitest'
import { isTerminalAgentRun } from './polling'
import type { AgentBackendRunRecord } from './types'

/**
 * Build a minimal hosted backend run record for polling assertions.
 * @param partial Fields to override on the default running record.
 */
function runRecord(partial: Partial<AgentBackendRunRecord>): AgentBackendRunRecord {
  return {
    runId: 'agent_123',
    status: 'running',
    ...partial,
  }
}

describe('isTerminalAgentRun', () => {
  it('continues polling queued and running records', () => {
    expect(isTerminalAgentRun(runRecord({ status: 'queued' }))).toBe(false)
    expect(isTerminalAgentRun(runRecord({ status: 'running' }))).toBe(false)
  })

  it('stops polling a clarification status by default', () => {
    expect(isTerminalAgentRun(runRecord({ status: 'needs_clarification' }))).toBe(true)
  })

  it('continues polling a clarification status after answers have been submitted', () => {
    expect(
      isTerminalAgentRun(
        runRecord({ status: 'needs_clarification' }),
        { pauseOnClarification: false },
      ),
    ).toBe(false)
  })

  it('stops polling completed and failed records', () => {
    expect(isTerminalAgentRun(runRecord({ status: 'completed' }))).toBe(true)
    expect(isTerminalAgentRun(runRecord({ status: 'failed' }))).toBe(true)
  })
})
