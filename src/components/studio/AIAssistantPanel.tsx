'use client'

import { Bot, Check, Clock3, MessageSquare, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AgentRunResult } from '@/lib/agent/types'

const CHAT_STORAGE_KEY = 'berry.studio.bench.chats.v1'

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

/**
 * Right-side AI assistant rail with local chat history.
 * @param props Agent run status, latest result, and submit callback.
 */
export function AIAssistantPanel({
  loading,
  result,
  onSubmit,
}: {
  loading: boolean
  result: AgentRunResult | null
  onSubmit: (prompt: string) => void
}) {
  const [prompt, setPrompt] = useState('Build me an ESP32 blinking LED')
  const [chats, setChats] = useState<BenchChat[]>(() => loadChats())
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id ?? createChat().id)

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [activeChatId, chats],
  )

  useEffect(() => {
    saveChats(chats)
  }, [chats])

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
    setPrompt('Build me an ESP32 blinking LED')
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
    onSubmit(cleanPrompt)
  }

  return (
    <aside
      className="flex w-[360px] shrink-0 flex-col border-l"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex h-[58px] shrink-0 items-center gap-2 border-b px-4" style={{ borderColor: 'var(--border)' }}>
        <div className="min-w-0">
          <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Bench
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
          </div>
        ) : (
          <div className="space-y-3">
            <ThoughtRow text="Ask me to build, test, or iterate on a hardware idea." />
            <div className="rounded-xl p-4 text-sm font-semibold leading-relaxed" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              I can create the Studio graph, generate firmware, run validation, build, simulate, and give you real wiring instructions.
            </div>
          </div>
        )}

        {result?.state.timeline.length ? (
          <div className="mt-4 space-y-2">
            <PlanHeader done={result.status === 'completed'} count={result.state.timeline.length} />
            {result.state.timeline.slice(-6).map((event) => (
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
            disabled={loading || prompt.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: 'var(--accent)' }}
            title="Send to Bench"
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
        {isUser ? 'You' : 'Bench'}
      </div>
      {message.text}
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
 * Render latest plan status.
 * @param props Completion and timeline count.
 */
function PlanHeader({ done, count }: { done: boolean; count: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold" style={{ background: 'rgba(0,0,0,0.045)', color: 'var(--text-secondary)' }}>
      <Check size={14} style={{ color: done ? 'var(--leaf)' : 'var(--text-muted)' }} />
      <span>Plan</span>
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
  if (result.status === 'needs_clarification' && result.state.clarification.status === 'needs_clarification') {
    return result.state.clarification.questions.map((question) => question.question).join('\n')
  }
  if (!result.ok) {
    return result.error ?? 'I could not finish this build yet.'
  }
  return 'I built the ESP32 LED blink circuit, generated firmware, ran validation, built the artifact, simulated it, and prepared the wiring guide.'
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
 * Load local chat sessions.
 */
function loadChats(): BenchChat[] {
  if (typeof window === 'undefined') return [createChat()]
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
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
function saveChats(chats: BenchChat[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats.slice(0, 12)))
}
