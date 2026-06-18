'use client'

import { Bot, Check, Clock3, MessageSquare, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentAnswerSubmission, AgentRunResult, ClarifyingQuestion } from '@/lib/agent/types'
import { getBoardProfile } from '@/lib/project/boards'
import { getComponentDefinition } from '@/lib/project/catalog'
import type { BerryProject, Net } from '@/lib/project/types'
import { validate } from '@/lib/validation'

const CHAT_STORAGE_PREFIX = 'berry.studio.bench.chats.v2'
const ASSISTANT_NAME = 'Pip'

interface BenchMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

interface BenchChat {
  id: string
  title: string
  messages: BenchMessage[]
  updatedAt: string
}

interface AssistantChoiceRequest {
  id: string
  label: string
  options: string[]
}

interface ClarificationFormRequest {
  runId: string
  userPrompt: string
  questions: ClarifyingQuestion[]
}

/** Prompt forwarded from home into the bench chat (already running or about to). */
export interface SubmittedPrompt {
  id: string
  text: string
}

/**
 * Right-side AI assistant rail with local chat history.
 * @param props Agent run status, latest result, and submit callback.
 */
export function AIAssistantPanel({
  loading,
  projectChatKey,
  submittedPrompt = null,
  result,
  onSubmit,
}: {
  loading: boolean
  projectChatKey: string
  submittedPrompt?: SubmittedPrompt | null
  result: AgentRunResult | null
  onSubmit: (
    prompt: string,
    mode?: 'auto' | 'deterministic' | 'real',
    provider?: string,
    model?: string,
    reasoningEffort?: string,
    answerSubmission?: AgentAnswerSubmission,
  ) => void | Promise<void>
}) {
  const [prompt, setPrompt] = useState('')
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({})
  const [chats, setChats] = useState<BenchChat[]>(() => loadChats(projectChatKey))
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id ?? createChat().id)
  const skipNextSaveRef = useRef(false)

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [activeChatId, chats],
  )

  const choiceRequest = useMemo(() => choiceRequestFromResult(result), [result])
  const clarificationRequest = useMemo(() => clarificationRequestFromResult(result), [result])

  useEffect(() => {
    setClarificationAnswers({})
  }, [clarificationRequest?.runId])

  useEffect(() => {
    const nextChats = loadChats(projectChatKey)
    skipNextSaveRef.current = true
    setChats(nextChats)
    setActiveChatId(nextChats[0]?.id ?? createChat().id)
  }, [projectChatKey])

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    saveChats(projectChatKey, chats)
  }, [chats, projectChatKey])

  useEffect(() => {
    const text = submittedPrompt?.text.trim()
    if (!text || !submittedPrompt) return
    const chat = createChatFromPrompt(text, submittedPrompt.id)
    setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)])
    setActiveChatId(chat.id)
  }, [submittedPrompt])

  useEffect(() => {
    if (!result || !activeChatId) return
    const message = summarizeAgentResult(result)
    setChats((current) =>
      current.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: appendUniqueMessage(chat.messages, {
                id: `assistant_${result.state.runId}`,
                role: 'assistant',
                text: message,
              }),
              updatedAt: new Date().toISOString(),
            }
          : chat,
      ),
    )
  }, [activeChatId, result])

  /**
   * Start a blank chat session.
   */
  function handleNewChat() {
    const chat = createChat()
    setChats((current) => [chat, ...current])
    setActiveChatId(chat.id)
    setPrompt('')
  }

  /**
   * Delete the active chat session.
   */
  function handleDeleteChat() {
    setChats((current) => {
      const next = current.filter((chat) => chat.id !== activeChatId)
      if (next.length === 0) {
        const chat = createChat()
        setActiveChatId(chat.id)
        return [chat]
      }
      setActiveChatId(next[0]!.id)
      return next
    })
  }

  /**
   * Submit the current prompt to the workflow.
   */
  function handleSubmit() {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || loading) return
    const chat = activeChat ?? createChat()
    if (!activeChat) {
      setChats((current) => [chat, ...current])
      setActiveChatId(chat.id)
    }
    setChats((current) =>
      current.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              title: item.messages.length === 0 ? titleFromPrompt(cleanPrompt) : item.title,
              messages: [
                ...item.messages,
                { id: `user_${Date.now()}`, role: 'user', text: cleanPrompt },
              ],
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
    setPrompt('')
    onSubmit(
      promptForWorkflow(chat.messages, cleanPrompt),
      undefined,
      undefined,
      undefined,
      undefined,
    )
  }

  /**
   * Submit a structured assistant choice without requiring typed text.
   * @param option Selected option label.
   */
  function handleSelectChoice(option: string) {
    if (loading) return
    const cleanOption = option.trim()
    if (!cleanOption) return
    const chat = activeChat ?? createChat()
    if (!activeChat) {
      setChats((current) => [chat, ...current])
      setActiveChatId(chat.id)
    }
    setChats((current) =>
      current.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              title: item.messages.length === 0 ? titleFromPrompt(cleanOption) : item.title,
              messages: [
                ...item.messages,
                { id: `user_choice_${Date.now()}`, role: 'user', text: cleanOption },
              ],
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
    onSubmit(
      promptForChoiceWorkflow(result, chat.messages, cleanOption),
    )
  }

  /**
   * Store one clarification answer draft.
   * @param questionId Stable backend clarification question id.
   * @param answer Draft answer text.
   */
  function handleClarificationAnswerChange(questionId: string, answer: string) {
    setClarificationAnswers((current) => ({ ...current, [questionId]: answer }))
  }

  /**
   * Submit all collected clarification answers in one backend request.
   */
  function handleSubmitClarificationAnswers() {
    if (!clarificationRequest || loading) return
    const answers = answersForQuestions(clarificationRequest.questions, clarificationAnswers)
    if (!answers) return
    const summary = clarificationAnswerSummary(clarificationRequest.questions, answers)
    const chat = activeChat ?? createChat()
    if (!activeChat) {
      setChats((current) => [chat, ...current])
      setActiveChatId(chat.id)
    }
    setChats((current) =>
      current.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              messages: [
                ...item.messages,
                { id: `user_answers_${Date.now()}`, role: 'user', text: summary },
              ],
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
    onSubmit(
      clarificationRequest.userPrompt,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        runId: clarificationRequest.runId,
        answers,
      },
    )
  }

  return (
    <aside
      className="flex w-[360px] shrink-0 flex-col border-l"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex h-[58px] shrink-0 items-center gap-2 border-b px-4" style={{ borderColor: 'var(--border)' }}>
        <div className="min-w-0">
          <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {ASSISTANT_NAME}
          </p>
          <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Hardware build assistant
          </p>
        </div>
        <button type="button" className="ml-auto rounded-lg p-2" onClick={handleNewChat} title="New chat" style={{ color: 'var(--text-secondary)' }}>
          <Plus size={16} />
        </button>
        <button type="button" className="rounded-lg p-2" onClick={handleDeleteChat} title="Delete chat" style={{ color: 'var(--text-secondary)' }}>
          <Trash2 size={16} />
        </button>
      </div>

      <div className="shrink-0 border-b p-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2 overflow-x-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => setActiveChatId(chat.id)}
              className="max-w-[160px] shrink-0 truncate rounded-lg px-3 py-1.5 text-xs font-bold"
              style={{
                background: chat.id === activeChatId ? 'rgba(214,51,108,0.1)' : 'var(--bg-elevated)',
                color: chat.id === activeChatId ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {chat.title}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeChat?.messages.length ? (
          <div className="space-y-3">
            {activeChat.messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {clarificationRequest ? (
              <ClarificationForm
                request={clarificationRequest}
                answers={clarificationAnswers}
                disabled={loading}
                onAnswerChange={handleClarificationAnswerChange}
                onSubmit={handleSubmitClarificationAnswers}
              />
            ) : choiceRequest ? (
              <AssistantChoiceField
                choiceRequest={choiceRequest}
                disabled={loading}
                onSelect={handleSelectChoice}
              />
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <ThoughtRow text="Ask me to build, test, or iterate on a supported bench." />
            <div className="rounded-xl p-4 text-sm font-semibold leading-relaxed" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Tell me what you want to build. I can set up the bench, wire the starter circuit, write the code, and show you how to build it for real.
            </div>
          </div>
        )}

        {result?.state.timeline.length ? (
          <div className="mt-4 space-y-2">
            <RunLogHeader done={result.status === 'completed'} count={result.state.timeline.length} />
            {result.state.timeline.map((event) => (
              <ThoughtRow key={event.id} text={`${event.title}${event.detail ? ` — ${event.detail}` : ''}`} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t p-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-end gap-2 rounded-xl p-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={2}
            placeholder="Build, test, or iterate..."
            disabled={!!clarificationRequest}
            className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-sm font-semibold outline-none"
            style={{ color: 'var(--text-primary)' }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSubmit()
              }
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !!clarificationRequest || prompt.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: 'var(--accent)' }}
            title={`Send to ${ASSISTANT_NAME}`}
          >
            {loading ? <Sparkles size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </aside>
  )
}

/**
 * Render one compact chat bubble.
 * @param props Chat message.
 */
function ChatBubble({ message }: { message: BenchMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm font-semibold leading-relaxed"
      style={{
        marginLeft: isUser ? 28 : 0,
        marginRight: isUser ? 0 : 28,
        background: isUser ? 'rgba(214,51,108,0.1)' : 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs font-extrabold" style={{ color: isUser ? 'var(--accent)' : 'var(--leaf)' }}>
        {isUser ? <MessageSquare size={13} /> : <Bot size={13} />}
        {isUser ? 'You' : ASSISTANT_NAME}
      </div>
      <div className="whitespace-pre-wrap">{message.text}</div>
    </div>
  )
}

/**
 * Render all backend clarification questions and submit them together.
 * @param props Clarification request, draft answers, and callbacks.
 */
function ClarificationForm({
  request,
  answers,
  disabled,
  onAnswerChange,
  onSubmit,
}: {
  request: ClarificationFormRequest
  answers: Record<string, string>
  disabled: boolean
  onAnswerChange: (questionId: string, answer: string) => void
  onSubmit: () => void
}) {
  const completeAnswers = answersForQuestions(request.questions, answers)
  return (
    <div
      className="mr-7 space-y-3 rounded-xl p-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
        Answer these before I continue
      </div>
      {request.questions.map((question) => (
        <ClarificationQuestionField
          key={question.id}
          question={question}
          value={answers[question.id] ?? ''}
          disabled={disabled}
          onChange={(answer) => onAnswerChange(question.id, answer)}
        />
      ))}
      <button
        type="button"
        disabled={disabled || !completeAnswers}
        onClick={onSubmit}
        className="flex h-10 w-full items-center justify-center rounded-lg text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45"
        style={{ background: 'var(--accent)' }}
      >
        {disabled ? 'Sending...' : 'Continue'}
      </button>
    </div>
  )
}

/**
 * Render one clarification question as choices or a text input.
 * @param props Clarification question, value, disabled state, and change callback.
 */
function ClarificationQuestionField({
  question,
  value,
  disabled,
  onChange,
}: {
  question: ClarifyingQuestion
  value: string
  disabled: boolean
  onChange: (answer: string) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {question.question}
        </div>
        {question.reason ? (
          <div className="mt-1 text-xs font-semibold leading-4" style={{ color: 'var(--text-muted)' }}>
            {question.reason}
          </div>
        ) : null}
      </div>
      {question.options?.length ? (
        <div className="grid gap-2">
          {question.options.map((option) => {
            const selected = value.trim() === option
            return (
              <button
                key={`${question.id}_${option}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option)}
                className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: selected ? 'rgba(214,51,108,0.1)' : 'transparent',
                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  color: selected ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                <span>{option}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-lg bg-transparent px-3 text-sm font-semibold outline-none disabled:opacity-50"
          style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      )}
    </div>
  )
}

/**
 * Render assistant-provided choices as a direct selection control.
 * @param props Choice prompt, disabled state, and selection callback.
 */
function AssistantChoiceField({
  choiceRequest,
  disabled,
  onSelect,
}: {
  choiceRequest: AssistantChoiceRequest
  disabled: boolean
  onSelect: (option: string) => void
}) {
  return (
    <div
      className="mr-7 rounded-xl p-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="mb-2 text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
        {choiceRequest.label}
      </div>
      <div className="grid gap-2">
        {choiceRequest.options.map((option) => (
          <button
            key={`${choiceRequest.id}_${option}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option)}
            className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <span>{option}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Render a muted agent thought row.
 * @param props Text to show.
 */
function ThoughtRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(0,0,0,0.035)', color: 'var(--text-secondary)' }}>
      <Clock3 size={13} style={{ color: 'var(--text-muted)' }} />
      <span className="min-w-0 truncate">{text}</span>
    </div>
  )
}

/**
 * Render latest build log status.
 * @param props Completion and timeline count.
 */
function RunLogHeader({ done, count }: { done: boolean; count: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold" style={{ background: 'rgba(0,0,0,0.045)', color: 'var(--text-secondary)' }}>
      <Check size={14} style={{ color: done ? 'var(--leaf)' : 'var(--text-muted)' }} />
      <span>Build log</span>
      <span className="ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {done ? count : 0}/{count} done
      </span>
    </div>
  )
}

/**
 * Summarize the latest agent result as an assistant chat message.
 * @param result Agent workflow result.
 */
function summarizeAgentResult(result: AgentRunResult): string {
  return renderAiResponseTemplate(result)
}

/**
 * Render a reusable assistant response for any main-page handoff or bench run.
 * @param result Agent workflow result.
 */
function renderAiResponseTemplate(result: AgentRunResult): string {
  if (result.status === 'needs_clarification' && result.state.clarification.status === 'needs_clarification') {
    return renderClarificationFeedback(result)
  }

  if (isScriptedStarterResult(result)) {
    return renderScriptedStarterResponse(result)
  }

  const project = result.state.project
  const lines = [
    renderRunSummary(result),
    '',
    renderProjectOverview(project),
    '',
    renderConnectionGuide(project),
    '',
    renderBehaviorSummary(project),
    '',
    renderPipelineStatus(result),
  ]

  if (result.state.wiringGuide) {
    lines.push('', 'Wiring guide:', result.state.wiringGuide)
  }

  return lines.filter((line) => line !== null).join('\n')
}

/**
 * True when a prepared starter followed the no-model scripted agent path.
 * @param result Agent workflow result.
 */
function isScriptedStarterResult(result: AgentRunResult): boolean {
  return (
    result.status === 'completed' &&
    !result.state.buildResult &&
    result.state.timeline.some((event) => event.agent === 'Next-step agent')
  )
}

/**
 * Render a starter response as an agent-loop turn, not a project-file summary.
 * @param result Scripted starter workflow result.
 */
function renderScriptedStarterResponse(result: AgentRunResult): string {
  const project = result.state.project
  const promptIntent = starterFollowUpIntent(result.state.userPrompt)

  if (promptIntent === 'firmware') {
    return [
      'I’ll take the firmware path next.',
      '',
      renderStarterPlan(project),
      '',
      'Firmware direction:',
      ...starterFirmwareNotes(project).map((note) => `- ${note}`),
      '',
      'Next question:',
      'Should I generate the first firmware draft now, or adjust the wiring before code?',
    ].join('\n')
  }

  if (promptIntent === 'modify') {
    return [
      'I can change the circuit before firmware.',
      '',
      renderStarterPlan(project),
      '',
      'What should change?',
      'Describe the change and I’ll update the bench.',
    ].join('\n')
  }

  return [
    starterOpeningLine(project),
    '',
    renderStarterPlan(project),
    '',
    renderConnectionGuide(project),
    '',
    renderBehaviorSummary(project),
    '',
    renderPipelineStatus(result),
    '',
    'Next question:',
    'What do you want Pip to do next?',
  ].join('\n')
}

/**
 * Infer the user's selected next step from a clarification-style follow-up.
 * @param prompt Workflow prompt for the current turn.
 */
function starterFollowUpIntent(prompt: string): 'firmware' | 'modify' | 'explain' | null {
  const answer = prompt.toLowerCase().split('clarification answer:').at(-1) ?? prompt.toLowerCase()
  if (answer.includes('firmware') || answer.includes('code') || answer.includes('generate')) return 'firmware'
  if (answer.includes('change') || answer.includes('modify') || answer.includes('adjust')) return 'modify'
  if (answer.includes('explain') || answer.includes('wiring')) return 'explain'
  return null
}

/**
 * Opening line for a prepared starter workflow.
 * @param project Current project graph.
 */
function starterOpeningLine(project: BerryProject): string {
  const componentTypes = new Set(project.components.map((component) => component.type))
  if (componentTypes.has('lcd-1602-i2c') && componentTypes.has('push-button')) {
    return 'I’ll build this as a button-driven calculator with an Arduino display.'
  }
  if (componentTypes.has('max7219-led-matrix')) {
    return 'I’ll build this as an ESP32 message display using a MAX7219 LED matrix.'
  }
  return 'I’ll turn this request into a concrete bench circuit.'
}

/**
 * Render the agent's selected architecture for a prepared starter.
 * @param project Current project graph.
 */
function renderStarterPlan(project: BerryProject): string {
  const board = getBoardProfile(project.board)
  const componentTypes = new Set(project.components.map((component) => component.type))
  const plan =
    componentTypes.has('lcd-1602-i2c') && componentTypes.has('push-button')
      ? [
          `Controller: ${board.name}`,
          'Display: LCD 1602 over I2C',
          'Inputs: four push buttons with pull-down resistors',
          'Behavior: read button presses, update calculator state, print result to the LCD',
        ]
      : componentTypes.has('max7219-led-matrix')
        ? [
            `Controller: ${board.name}`,
            'Display: MAX7219 LED matrix',
            'Signals: DIN, CLK, and CS',
            'Behavior: send text/frame data from firmware to the display driver',
          ]
        : [
            `Controller: ${board.name}`,
            `Parts: ${project.components.length}`,
            'Behavior: use the bench graph as the circuit source of truth',
          ]

  return ['Plan:', ...plan.map((item) => `- ${item}`)].join('\n')
}

/**
 * Hardcoded firmware notes for prepared starter paths.
 * @param project Current project graph.
 */
function starterFirmwareNotes(project: BerryProject): string[] {
  const componentTypes = new Set(project.components.map((component) => component.type))
  if (componentTypes.has('lcd-1602-i2c') && componentTypes.has('push-button')) {
    return [
      'Read D2, D3, D4, and D5 as calculator controls.',
      'Use A4/A5 for LCD I2C.',
      'Keep the pull-down resistor behavior in the firmware assumptions.',
    ]
  }
  if (componentTypes.has('max7219-led-matrix')) {
    return [
      'Use IO23 for DIN, IO18 for CLK, and IO5 for CS.',
      'Initialize the MAX7219 driver before writing display frames.',
      'Keep display power at the selected board logic voltage.',
    ]
  }
  return ['Generate firmware from the project graph pin map.']
}

/**
 * Render a short follow-up prompt when the agent needs user input.
 * @param result Agent workflow result containing clarification questions.
 */
function renderClarificationFeedback(result: AgentRunResult): string {
  if (result.state.clarification.status !== 'needs_clarification') {
    return 'I need one more detail before I can continue.'
  }

  const questions = result.state.clarification.questions
  if (questions.length === 0) {
    return 'I need one more detail before I can continue.'
  }

  return [
    questions.length === 1
      ? 'I need one detail before I continue.'
      : `I need ${questions.length} details before I continue.`,
  ].join('\n')
}

/**
 * Build the multi-question clarification request from the latest result.
 * @param result Latest agent result.
 */
function clarificationRequestFromResult(result: AgentRunResult | null): ClarificationFormRequest | null {
  if (
    result?.status !== 'needs_clarification' ||
    result.state.clarification.status !== 'needs_clarification' ||
    result.state.clarification.questions.length === 0
  ) {
    return null
  }
  return {
    runId: result.state.runId,
    userPrompt: result.state.userPrompt,
    questions: result.state.clarification.questions,
  }
}

/**
 * Build a selectable choice request from the latest assistant result.
 * @param result Latest agent result.
 */
function choiceRequestFromResult(result: AgentRunResult | null): AssistantChoiceRequest | null {
  if (!result) return null

  if (!isScriptedStarterResult(result)) return null

  const promptIntent = starterFollowUpIntent(result.state.userPrompt)
  if (promptIntent === 'firmware') {
    return {
      id: 'starter_firmware_next',
      label: 'Choose the next step',
      options: ['Generate firmware', 'Adjust wiring'],
    }
  }

  if (promptIntent === 'modify') return null

  return {
    id: 'starter_next',
    label: 'Choose the next step',
    options: ['Explain the wiring step by step', 'Generate firmware', 'Change the circuit'],
  }
}

/**
 * Summarize whether the AI run completed, paused, or failed.
 * @param result Agent workflow result.
 */
function renderRunSummary(result: AgentRunResult): string {
  if (result.status === 'completed' && !result.state.buildResult) {
    return 'I mapped the requested circuit into an agent plan and checked the bench graph.'
  }

  if (result.status === 'completed') {
    return 'I set up the bench project, generated firmware, ran validation, built the artifact, and simulated the supported circuit.'
  }

  if (result.status === 'needs_clarification' && result.state.clarification.status === 'needs_clarification') {
    const questions = result.state.clarification.questions
      .map((question) => `- ${question.question}`)
      .join('\n')
    return [
      'I loaded the project context, but the current executable AI build loop needs one more choice before it can mutate/build this circuit.',
      questions,
    ].join('\n')
  }

  return `I loaded the project context, but I could not finish the full build loop yet. ${result.error ?? 'No detailed error was returned.'}`
}

/**
 * Render the board and component list from a Berry project.
 * @param project Project graph to explain.
 */
function renderProjectOverview(project: BerryProject): string {
  const board = getBoardProfile(project.board)
  const parts = project.components
    .map((component) => {
      return `- ${component.id}: ${componentDisplayName(component.type)}`
    })
    .join('\n')

  return [
    `Project: ${project.metadata.name}`,
    `Target board: ${board.name} (${board.operatingVoltage} V logic)`,
    'Parts:',
    parts || '- No parts placed yet.',
  ].join('\n')
}

/**
 * Render a human-readable connection list from project nets.
 * @param project Project graph to explain.
 */
function renderConnectionGuide(project: BerryProject): string {
  const connections = project.nets.map((net) => renderNet(project, net)).filter(Boolean)
  return [
    'How to connect it:',
    connections.length > 0
      ? connections.map((connection) => `- ${connection}`).join('\n')
      : '- No electrical nets are connected yet. Use Connect in Studio or ask me to wire the circuit.',
  ].join('\n')
}

/**
 * Explain the practical behavior implied by the project graph.
 * @param project Project graph to explain.
 */
function renderBehaviorSummary(project: BerryProject): string {
  const componentTypes = new Set(project.components.map((component) => component.type))

  if (componentTypes.has('lcd-1602-i2c') && componentTypes.has('push-button')) {
    return [
      'How it works:',
      '- The Arduino reads each button as a digital input.',
      '- Each button has a resistor path to GND, so the input has a stable low state when the button is not pressed.',
      '- The LCD uses the Arduino I2C pins to show the calculator state/result.',
    ].join('\n')
  }

  if (componentTypes.has('max7219-led-matrix')) {
    return [
      'How it works:',
      '- The ESP32 powers the MAX7219 module from 3.3 V and GND.',
      '- DIN, CLK, and CS form the display control link; firmware shifts display data into the driver.',
      '- The MAX7219 handles the LED matrix scanning after the ESP32 sends the frame data.',
    ].join('\n')
  }

  if (componentTypes.has('led-5mm')) {
    return [
      'How it works:',
      '- A GPIO pin drives current through the resistor into the LED anode.',
      '- The resistor limits current so the LED and board pin are protected.',
      '- Firmware toggles the GPIO high/low to blink the LED.',
    ].join('\n')
  }

  return [
    'How it works:',
    '- The project graph lists parts, nets, and visual wires. Nets define the real electrical connections; wires show the route on the bench.',
  ].join('\n')
}

/**
 * Render one net as a compact terminal-to-terminal instruction.
 * @param project Project graph containing component names.
 * @param net Net to render.
 */
function renderNet(project: BerryProject, net: Net): string {
  const terminals = net.terminals.map((terminal) => {
    if (terminal.component && terminal.terminal) {
      const component = project.components.find((candidate) => candidate.id === terminal.component)
      const name = component ? componentDisplayName(component.type) : terminal.component
      return `${name} ${terminal.component}.${terminal.terminal}`
    }
    if (terminal.breadboard && terminal.site) {
      return `${terminal.breadboard} ${terminal.site.kind}`
    }
    return null
  }).filter((terminal): terminal is string => Boolean(terminal))

  if (terminals.length < 2) return ''
  return `${terminalLabelFromNetId(net.id)}: ${terminals.join(' -> ')}.`
}

/**
 * Return a component catalog name, falling back when project data references an unknown type.
 * @param type Component catalog id from the project graph.
 */
function componentDisplayName(type: BerryProject['components'][number]['type']): string {
  return getComponentDefinition(type)?.name ?? type
}

/**
 * Turn a net id into a short readable label.
 * @param netId Project net id.
 */
function terminalLabelFromNetId(netId: string): string {
  return netId
    .replace(/^net_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/**
 * Render build, validation, and simulation status from the run state.
 * @param result Agent workflow result.
 */
function renderPipelineStatus(result: AgentRunResult): string {
  const validationResults =
    result.state.validationResults.length > 0
      ? result.state.validationResults
      : validate(result.state.project)
  const validationErrors = validationResults.filter((finding) => finding.severity === 'error')
  const validationWarnings = validationResults.filter((finding) => finding.severity === 'warning')
  const build = result.state.buildResult
  const simulation = result.state.simulationResult

  return [
    'Status:',
    `- Validation: ${validationErrors.length === 0 ? 'no blocking errors' : `${validationErrors.length} blocking error(s)`}${validationWarnings.length > 0 ? `, ${validationWarnings.length} warning(s)` : ''}`,
    `- Firmware: ${result.state.codegenResult?.ok ? 'generated from the graph' : 'not generated yet'}`,
    `- Build: ${build ? (build.ok ? 'passed' : 'failed') : 'not run yet'}`,
    `- Simulation: ${simulation ? simulation.status : 'not run yet'}`,
    '- Deploy: coming soon.',
  ].join('\n')
}

/**
 * Create a blank local chat session.
 */
function createChat(): BenchChat {
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'New build',
    messages: [],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Create a chat seeded by a prompt that was submitted before opening the bench.
 * @param prompt Prompt text forwarded from the home page.
 * @param submissionId Stable id for this prompt handoff.
 */
function createChatFromPrompt(prompt: string, submissionId: string): BenchChat {
  const now = new Date().toISOString()
  return {
    id: `chat_${submissionId}`,
    title: titleFromPrompt(prompt),
    messages: [{ id: `user_${submissionId}`, role: 'user', text: prompt }],
    updatedAt: now,
  }
}

/**
 * Create a short title from a prompt.
 * @param prompt User prompt.
 */
function titleFromPrompt(prompt: string): string {
  return prompt.length > 28 ? `${prompt.slice(0, 28)}...` : prompt
}

/**
 * Append a message unless an identical id is already present.
 * @param messages Existing messages.
 * @param message Message to append.
 */
function appendUniqueMessage(messages: BenchMessage[], message: BenchMessage): BenchMessage[] {
  if (messages.some((item) => item.id === message.id)) return messages
  return [...messages, message]
}

/**
 * Build the workflow prompt for a user turn.
 * Keeps clarification answers attached to the original request while displaying
 * only the user's short answer in chat.
 * @param messages Existing chat messages before the new user turn.
 * @param cleanPrompt Current user input.
 */
function promptForWorkflow(messages: BenchMessage[], cleanPrompt: string): string {
  const firstUserPrompt = messages.find((message) => message.role === 'user')?.text
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const isClarificationReply =
    lastAssistant?.text.includes('Choose an option below') ||
    lastAssistant?.text.includes('What do you want Pip to do next?') ||
    lastAssistant?.text.includes('Should I generate the first firmware draft now')

  if (!firstUserPrompt || !isClarificationReply) return cleanPrompt

  return [
    firstUserPrompt,
    '',
    `Clarification answer: ${cleanPrompt}`,
  ].join('\n')
}

/**
 * Return trimmed answers only when every clarification question has a value.
 * @param questions Clarification questions that require answers.
 * @param drafts Draft answers keyed by question id.
 */
function answersForQuestions(
  questions: ClarifyingQuestion[],
  drafts: Record<string, string>,
): Record<string, string> | null {
  const entries = questions.map((question) => [question.id, drafts[question.id]?.trim() ?? ''] as const)
  if (entries.some(([, answer]) => answer.length === 0)) {
    return null
  }
  return Object.fromEntries(entries)
}

/**
 * Render the user's collected clarification answers as one chat message.
 * @param questions Clarification questions that were answered.
 * @param answers Submitted answer map.
 */
function clarificationAnswerSummary(
  questions: ClarifyingQuestion[],
  answers: Record<string, string>,
): string {
  return questions
    .map((question) => `${question.question}\n${answers[question.id] ?? ''}`)
    .join('\n\n')
}

/**
 * Build the workflow prompt for a clicked assistant choice.
 * @param result Latest agent result, when available.
 * @param messages Existing chat messages before the selected choice.
 * @param cleanPrompt Selected option text.
 */
function promptForChoiceWorkflow(
  result: AgentRunResult | null,
  messages: BenchMessage[],
  cleanPrompt: string,
): string {
  if (choiceRequestFromResult(result)) {
    return [
      result!.state.userPrompt,
      '',
      `Clarification answer: ${cleanPrompt}`,
    ].join('\n')
  }

  return promptForWorkflow(messages, cleanPrompt)
}

/**
 * Load local chat sessions.
 */
function loadChats(projectChatKey: string): BenchChat[] {
  if (typeof window === 'undefined') return [createChat()]
  try {
    const raw = window.localStorage.getItem(chatStorageKey(projectChatKey))
    if (!raw) return [createChat()]
    const parsed = JSON.parse(raw) as BenchChat[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createChat()]
  } catch {
    return [createChat()]
  }
}

/**
 * Persist local chat sessions.
 * @param chats Chat sessions.
 */
function saveChats(projectChatKey: string, chats: BenchChat[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(chatStorageKey(projectChatKey), JSON.stringify(chats.slice(0, 12)))
}

/**
 * Storage key for one project's local chat history.
 * @param projectChatKey Stable project identity string.
 */
function chatStorageKey(projectChatKey: string): string {
  return `${CHAT_STORAGE_PREFIX}:${projectChatKey}`
}
