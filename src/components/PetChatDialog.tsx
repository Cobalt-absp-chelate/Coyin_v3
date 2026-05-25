import { useCallback, useEffect, useRef, useState } from 'react'
import { loadConfig, callAI } from '../services/aiProvider'
import { buildPetChatSystemPrompt } from '../services/petAiService'
import type { PetChatMessage } from '../types/pet'
import type { AiMessage } from '../types/ai'

interface PetChatDialogProps {
  userName: string
  currentPage: string
  theme: 'light' | 'dark'
  onClose: () => void
}

const CHAT_STORAGE_KEY = 'coyin-pet-chat-messages'

function loadMessages(): PetChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.slice(-40)
    return []
  } catch { return [] }
}

function saveMessages(msgs: PetChatMessage[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs.slice(-40)))
  } catch { /* ignore */ }
}

export function PetChatDialog({ userName, currentPage, theme, onClose }: PetChatDialogProps) {
  const [messages, setMessages] = useState<PetChatMessage[]>(() => loadMessages())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: PetChatMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const config = loadConfig()
      const h = new Date().getHours()
      let timeOfDay = '上午'
      if (h >= 12 && h < 14) timeOfDay = '中午'
      else if (h >= 14 && h < 18) timeOfDay = '下午'
      else if (h >= 18 && h < 22) timeOfDay = '晚上'
      else if (h >= 22 || h < 5) timeOfDay = '深夜'
      else if (h >= 5 && h < 8) timeOfDay = '清晨'

      const systemPrompt = buildPetChatSystemPrompt({
        userName,
        currentPage,
        timeOfDay,
        sessionMinutes: Math.round((Date.now() - ((globalThis as Record<string, unknown>).__sessionStart as number ?? Date.now())) / 60000),
      })

      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...updated.map((m) => ({ role: m.role, content: m.content })),
      ]

      const result = await callAI(config, {
        messages: chatMessages as AiMessage[],
        maxTokens: 200,
        temperature: 0.9,
      })

      const aiMsg: PetChatMessage = { role: 'assistant', content: result.content.trim() }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      const errMsg: PetChatMessage = {
        role: 'assistant',
        content: err instanceof Error ? `唔…好像出了点问题：${err.message}` : '唔…我好像连不上啦…',
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, userName, currentPage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  return (
    <div className="pet-chat-overlay" onClick={onClose}>
      <div
        className={`pet-chat-dialog theme-${theme}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pet-chat-header">
          <div className="pet-chat-header-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="9" cy="9" r="1.5" fill="currentColor" />
              <circle cx="15" cy="9" r="1.5" fill="currentColor" />
              <path d="M8 14c0 0 1.5 2 4 2s4-2 4-2" strokeLinecap="round" />
            </svg>
            <span>和小知聊天</span>
          </div>
          <button className="pet-chat-close" onClick={onClose}>×</button>
        </div>

        <div className="pet-chat-messages">
          {messages.length === 0 && (
            <div className="pet-chat-empty">
              <p>你好呀！我是小知，你的桌宠小伙伴~</p>
              <p>想聊什么都可以！</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`pet-chat-msg ${msg.role === 'user' ? 'is-user' : 'is-pet'}`}
            >
              <span className="pet-chat-msg-text">{msg.content}</span>
            </div>
          ))}
          {loading && (
            <div className="pet-chat-msg is-pet is-loading">
              <span className="pet-chat-typing">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="pet-chat-input-row">
          <input
            ref={inputRef}
            className="ai-input pet-chat-input"
            type="text"
            placeholder="说点什么..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            className="ai-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
