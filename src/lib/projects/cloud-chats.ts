import type { SupabaseClient } from '@supabase/supabase-js'

/** One persisted assistant message in a bench chat. */
export interface CloudBenchMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

/** One persisted bench chat for a project chat namespace. */
export interface CloudBenchChat {
  id: string
  title: string
  messages: CloudBenchMessage[]
  updatedAt: string
}

interface ProjectChatRow {
  chat_key: string
  chats_json: unknown
  updated_at: string
}

/**
 * True when an unknown value is a plain object.
 * @param value Unknown value read from Supabase JSON.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse one stored message from JSON.
 * @param value Unknown JSON message.
 */
function parseMessage(value: unknown): CloudBenchMessage | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string') return null
  if (value.role !== 'user' && value.role !== 'assistant') return null
  if (typeof value.text !== 'string') return null
  return { id: value.id, role: value.role, text: value.text }
}

/**
 * Parse one stored chat from JSON.
 * @param value Unknown JSON chat.
 */
function parseChat(value: unknown): CloudBenchChat | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string') return null
  if (typeof value.title !== 'string') return null
  if (!Array.isArray(value.messages)) return null
  if (typeof value.updatedAt !== 'string') return null
  const messages = value.messages.map(parseMessage).filter((message): message is CloudBenchMessage => !!message)
  return { id: value.id, title: value.title, messages, updatedAt: value.updatedAt }
}

/**
 * Parse the stored chat JSON payload.
 * @param value Unknown JSON value from the `project_chats` row.
 */
function parseChatsJson(value: unknown): CloudBenchChat[] {
  if (!Array.isArray(value)) return []
  return value.map(parseChat).filter((chat): chat is CloudBenchChat => !!chat)
}

/**
 * Load cloud-backed chats for a project chat namespace.
 * @param supabase Browser Supabase client with an active user session.
 * @param chatKey Stable project chat namespace.
 */
export async function loadCloudProjectChats(
  supabase: SupabaseClient,
  chatKey: string,
): Promise<CloudBenchChat[]> {
  const { data, error } = await supabase
    .from('project_chats')
    .select('chat_key,chats_json,updated_at')
    .eq('chat_key', chatKey)
    .maybeSingle()

  if (error) throw error
  if (!data) return []
  return parseChatsJson((data as ProjectChatRow).chats_json)
}

/**
 * Insert or update cloud-backed chats for a project chat namespace.
 * @param supabase Browser Supabase client with an active user session.
 * @param chatKey Stable project chat namespace.
 * @param chats Chat sessions to persist.
 */
export async function upsertCloudProjectChats(
  supabase: SupabaseClient,
  chatKey: string,
  chats: CloudBenchChat[],
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('project_chats')
    .upsert(
      {
        chat_key: chatKey,
        chats_json: chats.slice(0, 12),
        updated_at: now,
      },
      { onConflict: 'user_id,chat_key' },
    )

  if (error) throw error
}
