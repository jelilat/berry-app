import type { AgentRunState, AgentTimelineEvent, AgentTimelineTone } from './types'

/**
 * Build a stable-enough event id from the current timeline length.
 * @param state Current agent run state.
 */
function nextEventId(state: AgentRunState): string {
  return `event_${String(state.timeline.length + 1).padStart(3, '0')}`
}

/**
 * Append one event to an agent run timeline.
 * @param state Current agent run state.
 * @param agent Agent or tool name responsible for the event.
 * @param title Short event title.
 * @param detail Optional event detail shown in Studio.
 * @param tone Visual tone for the event.
 */
export function appendTimelineEvent(
  state: AgentRunState,
  agent: string,
  title: string,
  detail?: string,
  tone: AgentTimelineTone = 'info',
): AgentRunState {
  const event: AgentTimelineEvent = {
    id: nextEventId(state),
    agent,
    title,
    detail,
    tone,
    createdAt: new Date().toISOString(),
  }
  return { ...state, timeline: [...state.timeline, event] }
}
