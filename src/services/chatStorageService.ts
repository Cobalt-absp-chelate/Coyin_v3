import type { ChatSession, ChatMessage } from '../types/chat'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const STORAGE_SESSIONS_KEY = 'coyin-chat-sessions'
const STORAGE_MSGS_PREFIX = 'coyin-chat-msgs-'

// ── localStorage helpers (browser fallback) ──

function loadLocalSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalSessions(sessions: ChatSession[]): void {
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions))
}

function loadLocalMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_MSGS_PREFIX + sessionId)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalMessages(sessionId: string, messages: ChatMessage[]): void {
  localStorage.setItem(STORAGE_MSGS_PREFIX + sessionId, JSON.stringify(messages))
}

// ── Tauri IPC wrappers ──

async function tauriCreateSession(title: string): Promise<ChatSession> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<ChatSession>('create_chat_session', { title })
}

async function tauriListSessions(): Promise<ChatSession[]> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<ChatSession[]>('list_chat_sessions')
}

async function tauriGetMessages(sessionId: string): Promise<ChatMessage[]> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<ChatMessage[]>('get_chat_messages', { sessionId })
}

async function tauriAddMessage(
  sessionId: string,
  role: string,
  content: string,
  thinking: string | null,
  timestamp: number,
): Promise<ChatMessage> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<ChatMessage>('add_chat_message', { sessionId, role, content, thinking, timestamp })
}

async function tauriDeleteSession(sessionId: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<void>('delete_chat_session', { sessionId })
}

// ── Public API (auto-detects backend) ──

export async function createSession(title: string): Promise<ChatSession> {
  if (isTauri()) {
    try { return await tauriCreateSession(title) } catch { /* fall through */ }
  }
  const now = Date.now()
  const session: ChatSession = {
    id: `chat-${now}`,
    title: title || '新对话',
    created_at: now,
    updated_at: now,
  }
  const sessions = loadLocalSessions()
  sessions.push(session)
  saveLocalSessions(sessions)
  saveLocalMessages(session.id, [])
  return session
}

export async function listSessions(): Promise<ChatSession[]> {
  if (isTauri()) {
    try { return await tauriListSessions() } catch { /* fall through */ }
  }
  return loadLocalSessions().sort((a, b) => b.updated_at - a.updated_at)
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  if (isTauri()) {
    try { return await tauriGetMessages(sessionId) } catch { /* fall through */ }
  }
  return loadLocalMessages(sessionId)
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  thinking?: string | null,
): Promise<ChatMessage> {
  const timestamp = Date.now()
  if (isTauri()) {
    try {
      return await tauriAddMessage(sessionId, role, content, thinking ?? null, timestamp)
    } catch { /* fall through */ }
  }

  const msg: ChatMessage = {
    id: `msg-${timestamp}-${role}`,
    session_id: sessionId,
    role,
    content,
    thinking: thinking ?? null,
    timestamp,
  }
  const messages = loadLocalMessages(sessionId)
  messages.push(msg)
  saveLocalMessages(sessionId, messages)

  // Update session
  const sessions = loadLocalSessions()
  const session = sessions.find((s) => s.id === sessionId)
  if (session) {
    session.updated_at = timestamp
    if (session.title === '新对话' && role === 'user') {
      session.title = content.slice(0, 30) + (content.length > 30 ? '…' : '')
    }
    saveLocalSessions(sessions)
  }
  return msg
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (isTauri()) {
    try { await tauriDeleteSession(sessionId); return } catch { /* fall through */ }
  }
  const sessions = loadLocalSessions().filter((s) => s.id !== sessionId)
  saveLocalSessions(sessions)
  localStorage.removeItem(STORAGE_MSGS_PREFIX + sessionId)
}
