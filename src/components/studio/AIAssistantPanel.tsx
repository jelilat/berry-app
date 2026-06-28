'use client'

import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Clipboard,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type ReactNode,
} from 'react'
import type {
  AgentAnswerSubmission,
  AgentAttachment,
  AgentBackendRunRecord,
  AgentImageAttachment,
  AgentProjectChatContext,
  AgentRunResult,
  ClarifyingQuestion,
} from '@/lib/agent/types'
import { hasSupabaseBrowserConfig, isAuthEnabled } from '@/lib/auth/config'
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-browser'
import {
  loadCloudProjectChats,
  upsertCloudProjectChats,
  type CloudBenchChat,
  type CloudBenchMessage,
} from '@/lib/projects/cloud-chats'
import { copyTextToClipboard } from '@/lib/clipboard'
import { getBoardProfile } from '@/lib/project/boards'
import { getComponentDefinition } from '@/lib/project/catalog'
import type { BerryProject, Net } from '@/lib/project/types'
import { validate } from '@/lib/validation'

const CHAT_STORAGE_PREFIX = 'berry.studio.bench.chats.v2'
const CHAT_SYNC_DEBOUNCE_MS = 600
const ASSISTANT_NAME = 'Pip'
const IMAGE_REVIEW_PROMPT = 'Please review this setup image and tell me whether the wiring looks good.'
const MAX_IMAGE_ATTACHMENTS = 3
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_IMAGE_ATTACHMENT_BYTES = 220 * 1024
const COMPRESSED_IMAGE_TARGET_BYTES = 180 * 1024
const COMPRESSED_IMAGE_MAX_DIMENSION = 1280
const COMPRESSED_IMAGE_MIN_DIMENSION = 720
const COMPRESSED_IMAGE_QUALITY_STEPS = [0.75, 0.68, 0.6, 0.52] as const
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
const COPY_FEEDBACK_MS = 1600

type BenchMessage = CloudBenchMessage
type BenchChat = CloudBenchChat

export type ProjectChatSubmitContext = AgentProjectChatContext

export interface AssistantTurn {
  id: string
  text: string
  chatId?: string
}

type MarkdownBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; text: string }

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

type WorkflowStepStatus = 'active' | 'complete' | 'failed'

interface WorkflowLogStep {
  id: string
  label: string
  status: WorkflowStepStatus
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
  legacyProjectChatKey = null,
  submittedPrompt = null,
  result,
  backendRunRecord = null,
  assistantTurn = null,
  clarificationSubmitted = false,
  onSubmit,
}: {
  loading: boolean
  projectChatKey: string
  legacyProjectChatKey?: string | null
  submittedPrompt?: SubmittedPrompt | null
  result: AgentRunResult | null
  backendRunRecord?: AgentBackendRunRecord | null
  assistantTurn?: AssistantTurn | null
  clarificationSubmitted?: boolean
  onSubmit: (
    prompt: string,
    mode?: 'auto' | 'deterministic' | 'real',
    provider?: string,
    model?: string,
    reasoningEffort?: string,
    answerSubmission?: AgentAnswerSubmission,
    chatContext?: ProjectChatSubmitContext,
  ) => void | Promise<void>
}) {
  const [prompt, setPrompt] = useState('')
  const [imageAttachments, setImageAttachments] = useState<AgentImageAttachment[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({})
  const [chats, setChats] = useState<BenchChat[]>(() =>
    loadChats(projectChatKey, legacyProjectChatKey),
  )
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id ?? createChat().id)
  const [pendingChatIds, setPendingChatIds] = useState<Set<string>>(() => new Set())
  const skipNextSaveRef = useRef(false)
  const cloudSaveTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const submittedChatIdRef = useRef<string | null>(null)
  const imageAttachmentsRef = useRef<AgentImageAttachment[]>([])

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [activeChatId, chats],
  )
  const activeChatPending = isChatPending(pendingChatIds, activeChat?.id)

  const choiceRequest = useMemo(() => choiceRequestFromResult(result), [result])
  const clarificationRequest = useMemo(() => clarificationRequestFromResult(result), [result])
  const workflowLog = useMemo(
    () => workflowLogFromBackendRun(backendRunRecord, {
      loading,
      clarificationSubmitted,
      result,
    }),
    [backendRunRecord, clarificationSubmitted, loading, result],
  )

  useEffect(() => {
    setClarificationAnswers({})
  }, [clarificationRequest?.runId])

  useEffect(() => {
    imageAttachmentsRef.current = imageAttachments
  }, [imageAttachments])

  useEffect(() => () => revokeImageAttachmentUrls(imageAttachmentsRef.current), [])

  useEffect(() => {
    const nextChats = loadChats(projectChatKey, legacyProjectChatKey)
    skipNextSaveRef.current = true
    setChats(nextChats)
    setActiveChatId(nextChats[0]?.id ?? createChat().id)
    setPendingChatIds(new Set())
    let cancelled = false

    /**
     * Load the signed-in user's cloud chat history for this project namespace.
     */
    async function hydrateCloudChats() {
      if (!canSyncCloudChats()) return
      try {
        const supabase = createSupabaseBrowserClient()
        const { data } = await supabase.auth.getUser()
        if (!data.user || cancelled) return
        const cloudChats = await loadCloudProjectChats(supabase, projectChatKey)
        if (cancelled) return
        if (cloudChats.length > 0) {
          skipNextSaveRef.current = true
          setChats(cloudChats)
          setActiveChatId(cloudChats[0]?.id ?? createChat().id)
          return
        }
        if (legacyProjectChatKey && legacyProjectChatKey !== projectChatKey) {
          const legacyCloudChats = await loadCloudProjectChats(supabase, legacyProjectChatKey)
          if (cancelled) return
          if (legacyCloudChats.length > 0) {
            skipNextSaveRef.current = true
            setChats(legacyCloudChats)
            setActiveChatId(legacyCloudChats[0]?.id ?? createChat().id)
            await upsertCloudProjectChats(supabase, projectChatKey, legacyCloudChats)
            return
          }
        }
        await upsertCloudProjectChats(supabase, projectChatKey, nextChats)
      } catch {
        // Local chat persistence remains the fallback when cloud sync is unavailable.
      }
    }

    void hydrateCloudChats()
    return () => {
      cancelled = true
    }
  }, [legacyProjectChatKey, projectChatKey])

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    saveChats(projectChatKey, chats)
    if (cloudSaveTimerRef.current) {
      window.clearTimeout(cloudSaveTimerRef.current)
    }
    cloudSaveTimerRef.current = window.setTimeout(() => {
      void saveChatsToCloud(projectChatKey, chats)
    }, CHAT_SYNC_DEBOUNCE_MS)
    return () => {
      if (cloudSaveTimerRef.current) {
        window.clearTimeout(cloudSaveTimerRef.current)
      }
    }
  }, [chats, projectChatKey])

  useEffect(() => {
    const text = submittedPrompt?.text.trim()
    if (!text || !submittedPrompt) return
    const chat = createChatFromPrompt(text, submittedPrompt.id)
    setChats((current) =>
      current.some((item) => item.id === chat.id)
        ? current
        : [chat, ...current],
    )
    submittedChatIdRef.current = chat.id
    setActiveChatId(chat.id)
  }, [submittedPrompt])

  useEffect(() => {
    const submittedChatId = submittedChatIdRef.current
    if (!result || !submittedChatId) return
    const message = summarizeAgentResult(result)
    if (!message.trim()) return
    setChats((current) =>
      current.map((chat) =>
        chat.id === submittedChatId
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
  }, [result])

  useEffect(() => {
    if (!assistantTurn || !assistantTurn.text.trim()) return
    const submittedChatId = assistantTurn.chatId ?? submittedChatIdRef.current
    if (!submittedChatId) return
    setChats((current) =>
      current.map((chat) =>
        chat.id === submittedChatId
          ? {
              ...chat,
              messages: appendUniqueMessage(chat.messages, {
                id: assistantTurn.id,
                role: 'assistant',
                text: assistantTurn.text,
              }),
              updatedAt: new Date().toISOString(),
            }
          : chat,
      ),
    )
  }, [assistantTurn])

  /**
   * Start a blank chat session.
   */
  function handleNewChat() {
    const chat = createChat()
    setChats((current) => [chat, ...current])
    setActiveChatId(chat.id)
    setPrompt('')
    clearImageAttachments()
    setImageError(null)
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
   * Convert selected browser files into pending image attachments.
   * @param event File input change event.
   */
  async function handleImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    await addImageAttachments(files)
  }

  /**
   * Attach any images included in a clipboard paste.
   * @param event Textarea paste event.
   */
  async function handlePromptPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = imageFilesFromClipboard(event.clipboardData)
    if (files.length === 0) return
    event.preventDefault()
    await addImageAttachments(files)
  }

  /**
   * Validate and store pending image attachment files.
   * @param files Image files selected or pasted by the user.
   */
  async function addImageAttachments(files: File[]) {
    if (files.length === 0) return
    setImageError(null)
    try {
      const nextAttachments = await attachmentsFromFiles(files, imageAttachmentsRef.current.length)
      setImageAttachments((current) => {
        const next = current.concat(nextAttachments)
        const kept = next.slice(0, MAX_IMAGE_ATTACHMENTS)
        revokeImageAttachmentUrls(next.slice(MAX_IMAGE_ATTACHMENTS))
        return kept
      })
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Could not attach image')
    }
  }

  /**
   * Clear pending image attachments and release local preview URLs.
   */
  function clearImageAttachments() {
    revokeImageAttachmentUrls(imageAttachmentsRef.current)
    imageAttachmentsRef.current = []
    setImageAttachments([])
  }

  /**
   * Remove one pending image attachment before submit.
   * @param attachmentId Pending image attachment id.
   */
  function handleRemoveImageAttachment(attachmentId: string) {
    setImageAttachments((current) => {
      const removed = current.filter((attachment) => attachment.id === attachmentId)
      revokeImageAttachmentUrls(removed)
      return current.filter((attachment) => attachment.id !== attachmentId)
    })
  }

  /**
   * Open the browser image picker.
   */
  function handleChooseImage() {
    fileInputRef.current?.click()
  }

  /**
   * Submit the current prompt and any image attachments to the workflow.
   */
  async function handleSubmit() {
    const cleanPrompt = prompt.trim()
    const attachments = imageAttachments
    if ((!cleanPrompt && attachments.length === 0) || activeChatPending) return
    const submittedPromptText = cleanPrompt || IMAGE_REVIEW_PROMPT
    const displayedPrompt = chatTextWithAttachmentSummary(submittedPromptText, attachments)
    const chat = activeChat ?? createChat()
    const userMessage: BenchMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: displayedPrompt,
    }
    if (!activeChat) {
      setChats((current) => [chat, ...current])
      setActiveChatId(chat.id)
    }
    setChats((current) =>
      current.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              title: item.messages.length === 0 ? titleFromPrompt(submittedPromptText) : item.title,
              messages: [
                ...item.messages,
                userMessage,
              ],
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
    setPrompt('')
    clearImageAttachments()
    setImageError(null)
    setChatPending(chat.id, true)
    try {
      await onSubmit(
        promptForWorkflow(chat.messages, submittedPromptText),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          activeChatId: chat.id,
          chatHistory: projectChatHistoryForSubmit(chats, chat, [userMessage]),
          attachments: attachments.map(agentAttachmentFromImage),
        },
      )
    } finally {
      setChatPending(chat.id, false)
    }
  }

  /**
   * Submit a structured assistant choice without requiring typed text.
   * @param option Selected option label.
   */
  async function handleSelectChoice(option: string) {
    if (activeChatPending) return
    const cleanOption = option.trim()
    if (!cleanOption) return
    const chat = activeChat ?? createChat()
    const userMessage: BenchMessage = {
      id: `user_choice_${Date.now()}`,
      role: 'user',
      text: cleanOption,
    }
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
                userMessage,
              ],
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
    setChatPending(chat.id, true)
    try {
      await onSubmit(
        promptForChoice(result, chat.messages, cleanOption),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          activeChatId: chat.id,
          chatHistory: projectChatHistoryForSubmit(chats, chat, [userMessage]),
        },
      )
    } finally {
      setChatPending(chat.id, false)
    }
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
  async function handleSubmitClarificationAnswers() {
    if (!clarificationRequest || activeChatPending) return
    const answers = answersForQuestions(clarificationRequest.questions, clarificationAnswers)
    if (!answers) return
    const transcriptMessages = clarificationTranscriptMessages(
      clarificationRequest.runId,
      clarificationRequest.questions,
      answers,
    )
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
                ...transcriptMessages,
              ],
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
    setChatPending(chat.id, true)
    try {
      await onSubmit(
        clarificationRequest.userPrompt,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          runId: clarificationRequest.runId,
          answers,
        },
        {
          activeChatId: chat.id,
          chatHistory: projectChatHistoryForSubmit(chats, chat, transcriptMessages),
        },
      )
    } finally {
      setChatPending(chat.id, false)
    }
  }

  /**
   * Mark one chat as waiting for an assistant response.
   * @param chatId Chat session id.
   * @param pending Whether the chat has an in-flight request.
   */
  function setChatPending(chatId: string, pending: boolean) {
    setPendingChatIds((current) => {
      const next = new Set(current)
      if (pending) {
        next.add(chatId)
      } else {
        next.delete(chatId)
      }
      return next
    })
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
              {isChatPending(pendingChatIds, chat.id) ? 'Running... ' : ''}
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
                disabled={activeChatPending}
                onAnswerChange={handleClarificationAnswerChange}
                onSubmit={handleSubmitClarificationAnswers}
              />
            ) : choiceRequest ? (
              <AssistantChoiceField
                choiceRequest={choiceRequest}
                disabled={activeChatPending}
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

        {workflowLog.length ? (
          <div className="mt-4 space-y-2">
            {/* <WorkflowLogHeader done={result?.status === 'completed'} /> */}
            {workflowLog.map((step) => (
              <WorkflowStepRow key={step.id} step={step} />
            ))}
          </div>
        ) : null}

      </div>

      <div className="shrink-0 border-t p-3" style={{ borderColor: 'var(--border)' }}>
        {imageAttachments.length > 0 || imageError ? (
          <div className="mb-2 space-y-2">
            {imageAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {imageAttachments.map((attachment) => (
                  <ImageAttachmentChip
                    key={attachment.id}
                    attachment={attachment}
                    disabled={loading}
                    onRemove={handleRemoveImageAttachment}
                  />
                ))}
              </div>
            ) : null}
            {imageError ? (
              <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {imageError}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl p-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={handleImageInputChange}
          />
          <button
            type="button"
            onClick={handleChooseImage}
            disabled={activeChatPending || !!clarificationRequest || imageAttachments.length >= MAX_IMAGE_ATTACHMENTS}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-45"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            title="Attach setup image"
          >
            <ImageIcon size={16} />
          </button>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={2}
            placeholder="Build, test, or iterate..."
            disabled={!!clarificationRequest}
            className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-sm font-semibold outline-none"
            style={{ color: 'var(--text-primary)' }}
            onPaste={handlePromptPaste}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={activeChatPending || !!clarificationRequest || (prompt.trim().length === 0 && imageAttachments.length === 0)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: 'var(--accent)' }}
            title={`Send to ${ASSISTANT_NAME}`}
          >
            {activeChatPending ? <Sparkles size={16} /> : <Send size={16} />}
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
      <MarkdownContent text={message.text} />
    </div>
  )
}

/**
 * Render one pending image attachment chip.
 * @param props Attachment metadata, disabled state, and remove callback.
 */
function ImageAttachmentChip({
  attachment,
  disabled,
  onRemove,
}: {
  attachment: AgentImageAttachment
  disabled: boolean
  onRemove: (attachmentId: string) => void
}) {
  return (
    <div
      className="flex max-w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
    >
      <img
        src={attachment.dataUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-md object-cover"
      />
      <span className="min-w-0 max-w-[220px] truncate">{attachment.name}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove(attachment.id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-45"
        style={{ color: 'var(--text-muted)' }}
        title="Remove image"
      >
        <X size={13} />
      </button>
    </div>
  )
}

/**
 * Render chat markdown without injecting raw HTML.
 * @param props Markdown source text.
 */
function MarkdownContent({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text])
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const Heading = block.level === 2 ? 'h2' : 'h3'
          return (
            <Heading key={`${block.kind}_${index}`} className="text-sm font-extrabold">
              {renderInlineMarkdown(block.text)}
            </Heading>
          )
        }
        if (block.kind === 'list') {
          return (
            <ul key={`${block.kind}_${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${block.kind}_${index}_${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.kind === 'code') {
          return <CopyableCodeBlock key={`${block.kind}_${index}`} text={block.text} />
        }
        return (
          <p key={`${block.kind}_${index}`} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block.text)}
          </p>
        )
      })}
    </div>
  )
}

/**
 * Render a chat code block with a clipboard action.
 * @param props Code block text.
 */
function CopyableCodeBlock({ text }: { text: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (copyState === 'idle') return undefined
    const timeout = window.setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  /**
   * Copy this code block to the system clipboard.
   */
  const copyCode = async () => {
    try {
      await copyTextToClipboard(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div
      className="group relative rounded-lg"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <button
        type="button"
        onClick={copyCode}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-extrabold opacity-80 transition-opacity group-hover:opacity-100"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: copyState === 'failed' ? 'var(--accent)' : 'var(--text-primary)',
        }}
        title="Copy code"
      >
        {copyState === 'copied' ? <Check size={12} /> : <Clipboard size={12} />}
        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-3 pr-20 text-xs font-semibold">
        <code>{text}</code>
      </pre>
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
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const completeAnswers = answersForQuestions(request.questions, answers)
  const questionCount = request.questions.length

  useEffect(() => {
    setActiveQuestionIndex(0)
  }, [request.runId])

  /**
   * Move the carousel to the previous available question.
   */
  function handlePreviousQuestion() {
    setActiveQuestionIndex((current) => Math.max(0, current - 1))
  }

  /**
   * Move the carousel to the next available question.
   */
  function handleNextQuestion() {
    setActiveQuestionIndex((current) => Math.min(questionCount - 1, current + 1))
  }

  /**
   * Store an answer and advance option-based questions to the next slide.
   * @param question Clarification question being answered.
   * @param questionIndex Index of the question in the carousel.
   * @param answer Selected or typed answer.
   */
  function handleAnswerChange(question: ClarifyingQuestion, questionIndex: number, answer: string) {
    onAnswerChange(question.id, answer)
    if (question.options?.length && questionIndex < questionCount - 1) {
      setActiveQuestionIndex(questionIndex + 1)
    }
  }

  return (
    <div
      className="mr-7 space-y-3 rounded-xl p-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
        <span>Question {activeQuestionIndex + 1} of {questionCount}</span>
        {questionCount > 1 ? (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              disabled={disabled || activeQuestionIndex === 0}
              onClick={handlePreviousQuestion}
              className="flex h-7 w-7 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              title="Previous question"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={disabled || activeQuestionIndex === questionCount - 1}
              onClick={handleNextQuestion}
              className="flex h-7 w-7 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              title="Next question"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </div>
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeQuestionIndex * 100}%)` }}
        >
          {request.questions.map((question, index) => (
            <div key={question.id} className="w-full shrink-0">
              <ClarificationQuestionField
                question={question}
                value={answers[question.id] ?? ''}
                disabled={disabled}
                onChange={(answer) => handleAnswerChange(question, index, answer)}
              />
            </div>
          ))}
        </div>
      </div>
      {questionCount > 1 ? (
        <div className="flex justify-center gap-1.5">
          {request.questions.map((question, index) => {
            const isActive = index === activeQuestionIndex
            const isAnswered = (answers[question.id]?.trim() ?? '').length > 0
            return (
              <button
                key={`${question.id}_dot`}
                type="button"
                disabled={disabled}
                onClick={() => setActiveQuestionIndex(index)}
                className="h-2.5 w-2.5 rounded-full disabled:cursor-not-allowed"
                style={{
                  background: isActive
                    ? 'var(--accent)'
                    : isAnswered
                      ? 'var(--leaf)'
                      : 'var(--border)',
                }}
                aria-label={`Show question ${index + 1}`}
              />
            )
          })}
        </div>
      ) : null}
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
 * Render the coarse backend workflow header.
 * @param props Whether the hosted run has completed.
 */
function WorkflowLogHeader({ done }: { done: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold" style={{ background: 'rgba(0,0,0,0.045)', color: 'var(--text-secondary)' }}>
      <Check size={14} style={{ color: done ? 'var(--leaf)' : 'var(--text-muted)' }} />
      <span>Workflow</span>
    </div>
  )
}

/**
 * Render one backend workflow progress row.
 * @param props Workflow step to display.
 */
function WorkflowStepRow({ step }: { step: WorkflowLogStep }) {
  const isComplete = step.status === 'complete'
  const isFailed = step.status === 'failed'
  const isActive = step.status === 'active'
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(0,0,0,0.035)', color: 'var(--text-secondary)' }}>
      {isComplete ? (
        <Check size={13} style={{ color: 'var(--leaf)' }} />
      ) : isActive ? (
        <span className="berry-workflow-active-icon" aria-hidden="true">
          <Clock3 size={13} />
        </span>
      ) : (
        <Clock3 size={13} style={{ color: isFailed ? 'var(--accent)' : 'var(--text-muted)' }} />
      )}
      <span className="min-w-0 truncate">{step.label}</span>
    </div>
  )
}

/**
 * True when a hosted usage event action has been reported.
 * @param record Latest backend run record.
 * @param action Usage event action name.
 */
function hasUsageAction(record: AgentBackendRunRecord | null, action: string): boolean {
  return record?.usageEvents?.some((event) => event.action === action) ?? false
}

/**
 * Derive the visible backend workflow from usage events.
 * @param record Latest backend run record.
 * @param context Current UI state for in-flight runs.
 */
function workflowLogFromBackendRun(
  record: AgentBackendRunRecord | null,
  context: {
    loading: boolean
    clarificationSubmitted: boolean
    result: AgentRunResult | null
  },
): WorkflowLogStep[] {
  if (!context.loading && !record && !context.result) return []

  const hasClarifier = hasUsageAction(record, 'agent.clarifier')
  const hasPlanner = hasUsageAction(record, 'agent.planner')
  const hasCircuitDesigner = hasUsageAction(record, 'agent.circuit_designer')
  const runFailed = record?.status === 'failed' || context.result?.status === 'failed'
  const reachedPlanning = hasClarifier || context.clarificationSubmitted

  let activeIndex = 0
  if (hasCircuitDesigner) {
    activeIndex = 3
  } else if (hasPlanner) {
    activeIndex = 2
  } else if (reachedPlanning) {
    activeIndex = 1
  }

  const labels = [
    'Processing your request',
    'Preparing a plan',
    'Designing the circuit',
    'Generating firmware',
  ]
  const visibleLabels = labels.slice(0, activeIndex + 1)
  return visibleLabels.map((label, index) => {
    const status =
      index < activeIndex || context.result?.status === 'completed'
        ? 'complete'
        : runFailed
          ? 'failed'
          : 'active'
    return {
      id: `workflow_${index}`,
      label,
      status,
    }
  })
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
    return ''
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
    lines.push(result.state.wiringGuide)
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
 * Whether a chat currently has an in-flight assistant request.
 * @param pendingChatIds Set of chat ids waiting for a response.
 * @param chatId Chat id to check.
 */
function isChatPending(pendingChatIds: Set<string>, chatId?: string): boolean {
  return !!chatId && pendingChatIds.has(chatId)
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
 * Convert the active bench chat into backend follow-up history.
 * @param chats Current project chat sessions.
 * @param activeChat Chat that is receiving the new messages.
 * @param pendingMessages Messages being submitted before React state updates.
 */
function projectChatHistoryForSubmit(
  chats: BenchChat[],
  activeChat: BenchChat,
  pendingMessages: BenchMessage[],
): AgentProjectChatContext['chatHistory'] {
  const sourceChat = chats.find((chat) => chat.id === activeChat.id) ?? activeChat
  return sourceChat.messages
    .concat(pendingMessages)
    .map((message) => ({ role: message.role, content: message.text }))
}

/**
 * Add a short image summary to the visible chat transcript.
 * @param text User-entered text or default image-review prompt.
 * @param attachments Images sent with the same turn.
 */
function chatTextWithAttachmentSummary(
  text: string,
  attachments: AgentImageAttachment[],
): string {
  if (attachments.length === 0) return text
  const names = attachments.map((attachment) => attachment.name).join(', ')
  return [text, '', `Attached image${attachments.length === 1 ? '' : 's'}: ${names}`].join('\n')
}

/**
 * Extract image files from clipboard data while ignoring pasted text.
 * @param clipboardData Browser clipboard payload from a paste event.
 */
function imageFilesFromClipboard(clipboardData: DataTransfer): File[] {
  const itemFiles = Array.from(clipboardData.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file)
  if (itemFiles.length > 0) return itemFiles
  return Array.from(clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'))
}

/**
 * Convert browser image files into bounded agent attachments.
 * @param files Selected files from the image input.
 * @param existingCount Number of images already attached.
 * @throws Error when a file is unsupported or too large.
 */
async function attachmentsFromFiles(
  files: File[],
  existingCount: number,
): Promise<AgentImageAttachment[]> {
  const remainingSlots = MAX_IMAGE_ATTACHMENTS - existingCount
  if (remainingSlots <= 0) {
    throw new Error(`Attach up to ${MAX_IMAGE_ATTACHMENTS} images`)
  }
  const selectedFiles = files.slice(0, remainingSlots)
  const attachments: AgentImageAttachment[] = []
  for (const file of selectedFiles) {
    attachments.push(await fileToImageAttachment(file))
  }
  return attachments
}

/**
 * Convert one image file to a compressed JPEG attachment.
 * @param file Browser file selected by the user.
 * @throws Error when the file is unsupported or too large.
 */
async function fileToImageAttachment(file: File): Promise<AgentImageAttachment> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error('Use a PNG, JPEG, WebP, or GIF image')
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Image must be 25 MB or smaller')
  }
  const compressed = await compressImageFile(file)
  return {
    id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    name: jpegFilename(file.name || 'setup image'),
    mediaType: 'image/jpeg',
    data: compressed.data,
    dataUrl: compressed.dataUrl,
    size: compressed.size,
  }
}

/**
 * Resize and compress an image file before it is sent through JSON.
 * @param file Browser image file selected or pasted by the user.
 * @throws Error when the browser cannot decode or compress the image.
 */
async function compressImageFile(file: File): Promise<{ data: string; dataUrl: string; size: number }> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas context')

    let bestBlob: Blob | null = null
    const dimensionSteps = imageDimensionSteps(bitmap.width, bitmap.height)
    for (const maxDimension of dimensionSteps) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      for (const quality of COMPRESSED_IMAGE_QUALITY_STEPS) {
        const blob = await canvasToJpegBlob(canvas, quality)
        bestBlob = !bestBlob || blob.size < bestBlob.size ? blob : bestBlob
        if (blob.size <= COMPRESSED_IMAGE_TARGET_BYTES) {
          return compressedBlobToAttachmentData(blob)
        }
      }
    }

    if (!bestBlob || bestBlob.size > MAX_IMAGE_ATTACHMENT_BYTES) {
      throw new Error('Image is too large after compression')
    }
    return compressedBlobToAttachmentData(bestBlob)
  } finally {
    bitmap.close()
  }
}

/**
 * Build descending max-dimension attempts for image compression.
 * @param width Source image width.
 * @param height Source image height.
 */
function imageDimensionSteps(width: number, height: number): number[] {
  const largestSide = Math.max(width, height)
  const firstStep = Math.min(COMPRESSED_IMAGE_MAX_DIMENSION, largestSide)
  const steps = [firstStep, 1024, 900, COMPRESSED_IMAGE_MIN_DIMENSION]
  return [...new Set(steps.filter((step) => step > 0 && step <= firstStep))]
}

/**
 * Convert a canvas frame to a JPEG blob.
 * @param canvas Canvas containing the resized image frame.
 * @param quality JPEG quality from 0 to 1.
 * @throws Error when browser canvas encoding fails.
 */
function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Convert a compressed JPEG blob into attachment data and preview URL.
 * @param blob Compressed JPEG image blob.
 */
async function compressedBlobToAttachmentData(
  blob: Blob,
): Promise<{ data: string; dataUrl: string; size: number }> {
  const dataUrl = await readBlobAsDataUrl(blob)
  return {
    data: base64DataFromUrl(dataUrl),
    dataUrl: URL.createObjectURL(blob),
    size: blob.size,
  }
}

/**
 * Release object URLs owned by pending image previews.
 * @param attachments Image attachments that may hold local object URLs.
 */
function revokeImageAttachmentUrls(attachments: AgentImageAttachment[]): void {
  for (const attachment of attachments) {
    if (attachment.dataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.dataUrl)
    }
  }
}

/**
 * Whether a browser file MIME type is supported for AI image review.
 * @param mimeType Browser-reported file MIME type.
 */
function isAcceptedImageType(mimeType: string): mimeType is AgentImageAttachment['mediaType'] {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Return a backend-ready attachment from a local image preview object.
 * @param attachment Local image attachment with preview metadata.
 */
function agentAttachmentFromImage(attachment: AgentImageAttachment): AgentAttachment {
  return {
    type: attachment.type,
    mediaType: attachment.mediaType,
    data: attachment.data,
    name: attachment.name,
  }
}

/**
 * Extract raw base64 image data from a browser data URL.
 * @param dataUrl Browser file data URL.
 */
function base64DataFromUrl(dataUrl: string): string {
  const marker = ';base64,'
  const markerIndex = dataUrl.indexOf(marker)
  return markerIndex >= 0 ? dataUrl.slice(markerIndex + marker.length) : dataUrl
}

/**
 * Return a JPEG filename for a compressed image.
 * @param filename Original browser filename.
 */
function jpegFilename(filename: string): string {
  const cleanName = filename.trim() || 'setup image'
  return /\.[^.]+$/.test(cleanName) ? cleanName.replace(/\.[^.]+$/, '.jpg') : `${cleanName}.jpg`
}

/**
 * Read a browser blob as a data URL.
 * @param blob Browser blob created by canvas compression.
 * @throws Error when the browser cannot read the blob.
 */
function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Could not read image'))
    }
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(blob)
  })
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
 * Build interleaved assistant and user messages for submitted clarifications.
 * @param runId Agent run id that requested clarification.
 * @param questions Clarification questions that were answered.
 * @param answers Submitted answer map.
 */
function clarificationTranscriptMessages(
  runId: string,
  questions: ClarifyingQuestion[],
  answers: Record<string, string>,
): BenchMessage[] {
  return questions.flatMap((question, index) => {
    const answer = answers[question.id] ?? ''
    return [
      {
        id: `assistant_clarification_${runId}_${question.id}_${index}`,
        role: 'assistant' as const,
        text: question.question,
      },
      {
        id: `user_clarification_${runId}_${question.id}_${index}`,
        role: 'user' as const,
        text: answer,
      },
    ]
  })
}

/**
 * Build the workflow prompt for a clicked assistant choice.
 * @param result Latest agent result, when available.
 * @param messages Existing chat messages before the selected choice.
 * @param cleanPrompt Selected option text.
 */
function promptForChoice(
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
 * Whether the current browser session can sync chats to Supabase.
 */
function canSyncCloudChats(): boolean {
  return isAuthEnabled() && hasSupabaseBrowserConfig()
}

/**
 * Persist chat sessions to Supabase for the signed-in user.
 * @param projectChatKey Stable project chat namespace.
 * @param chats Chat sessions to save.
 */
async function saveChatsToCloud(projectChatKey: string, chats: BenchChat[]): Promise<void> {
  if (!canSyncCloudChats()) return
  try {
    const supabase = createSupabaseBrowserClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    await upsertCloudProjectChats(supabase, projectChatKey, chats)
  } catch {
    // Local chat persistence remains the fallback when cloud sync is unavailable.
  }
}

/**
 * Parse markdown into display blocks for chat rendering.
 * @param text Markdown source.
 */
function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let listItems: string[] = []
  let codeLines: string[] | null = null

  /**
   * Flush the active paragraph into the block list.
   */
  function flushParagraph() {
    if (paragraph.length === 0) return
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n').trim() })
    paragraph = []
  }

  /**
   * Flush the active list into the block list.
   */
  function flushList() {
    if (listItems.length === 0) return
    blocks.push({ kind: 'list', items: listItems })
    listItems = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (codeLines) {
      if (trimmed.startsWith('```')) {
        blocks.push({ kind: 'code', text: codeLines.join('\n') })
        codeLines = null
      } else {
        codeLines.push(line)
      }
      continue
    }

    if (trimmed.startsWith('```')) {
      flushParagraph()
      flushList()
      codeLines = []
      continue
    }

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = /^(#{2,3})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({
        kind: 'heading',
        level: headingMatch[1]!.length === 2 ? 2 : 3,
        text: headingMatch[2]!,
      })
      continue
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed)
    if (listMatch) {
      flushParagraph()
      listItems.push(listMatch[1]!)
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  if (codeLines) {
    blocks.push({ kind: 'code', text: codeLines.join('\n') })
  }
  return blocks.length > 0 ? blocks : [{ kind: 'paragraph', text }]
}

/**
 * Render inline markdown spans for a single text fragment.
 * @param text Inline markdown source.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index))
    }
    nodes.push(renderInlineToken(match[0], nodes.length))
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }
  return nodes
}

/**
 * Render one inline markdown token.
 * @param token Matched token source.
 * @param key Stable token index.
 */
function renderInlineToken(token: string, key: number): ReactNode {
  if (token.startsWith('`') && token.endsWith('`')) {
    return (
      <code key={key} className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--bg-surface)' }}>
        {token.slice(1, -1)}
      </code>
    )
  }
  if (token.startsWith('**') && token.endsWith('**')) {
    return <strong key={key}>{token.slice(2, -2)}</strong>
  }
  if (token.startsWith('*') && token.endsWith('*')) {
    return <em key={key}>{token.slice(1, -1)}</em>
  }
  const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
  if (linkMatch) {
    const href = safeMarkdownHref(linkMatch[2]!)
    if (!href) return linkMatch[1]
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-extrabold underline"
        style={{ color: 'var(--accent)' }}
      >
        {linkMatch[1]}
      </a>
    )
  }
  return token
}

/**
 * Return a safe link href for chat markdown.
 * @param href Raw markdown href.
 */
function safeMarkdownHref(href: string): string | null {
  const cleanHref = href.trim()
  if (/^(https?:|mailto:)/i.test(cleanHref)) return cleanHref
  if (cleanHref.startsWith('/')) return cleanHref
  return null
}

/**
 * Load locally stored chat sessions, returning null when no saved entry exists.
 * @param projectChatKey Stable project identity string.
 */
function loadStoredChats(projectChatKey: string): BenchChat[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(chatStorageKey(projectChatKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as BenchChat[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

/**
 * Load local chat sessions, using a legacy key as a migration fallback.
 * @param projectChatKey Stable project identity string.
 * @param legacyProjectChatKey Previous project identity string, when one exists.
 */
function loadChats(
  projectChatKey: string,
  legacyProjectChatKey?: string | null,
): BenchChat[] {
  const primaryChats = loadStoredChats(projectChatKey)
  if (primaryChats) return primaryChats

  if (legacyProjectChatKey && legacyProjectChatKey !== projectChatKey) {
    const legacyChats = loadStoredChats(legacyProjectChatKey)
    if (legacyChats) {
      saveChats(projectChatKey, legacyChats)
      return legacyChats
    }
  }

  return [createChat()]
}

/**
 * Persist local chat sessions.
 * @param projectChatKey Stable project identity string.
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
