import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'
import { SessionList } from './SessionList'
import type { ChatSession, ChatMessage } from '../types/chat'

type ChatPanelProps = {
  sessions: ChatSession[]
  activeSessionId: string | null
  messages: ChatMessage[]
  isStreaming: boolean
  visible: boolean
  isFullScreen: boolean
  showSessionList: boolean
  theme: 'light' | 'dark'
  onSend: (text: string) => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onToggleFullScreen: () => void
  onCloseFullScreen: () => void
  onToggleSessionList: () => void
  onCloseSessionList: () => void
  onNewSession: () => void
}

export function ChatPanel({
  sessions,
  activeSessionId,
  messages,
  isStreaming,
  visible,
  isFullScreen,
  showSessionList,
  theme,
  onSend,
  onSelectSession,
  onDeleteSession,
  onToggleFullScreen,
  onCloseFullScreen,
  onToggleSessionList,
  onCloseSessionList,
  onNewSession,
}: ChatPanelProps) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const [hasEverOpened, setHasEverOpened] = useState(() => {
    // Restore from localStorage or check for existing sessions
    const saved = localStorage.getItem('coyin-chat-collapsed')
    return saved !== null || false
  })
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('coyin-chat-collapsed') === '1'
  })

  // If sessions exist, panel should be available (possibly collapsed)
  useEffect(() => {
    if (sessions.length > 0 && !hasEverOpened) {
      setHasEverOpened(true)
    }
  }, [sessions, hasEverOpened])

  useEffect(() => {
    if (visible && !hasEverOpened) {
      setHasEverOpened(true)
    }
  }, [visible, hasEverOpened])

  // Persist collapse state
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('coyin-chat-collapsed', next ? '1' : '0')
      return next
    })
  }, [])

  // Auto-expand when a new message arrives
  useEffect(() => {
    if (visible && isCollapsed) {
      setIsCollapsed(false)
      localStorage.setItem('coyin-chat-collapsed', '0')
    }
  }, [visible])

  const scrollToBottom = useCallback(() => {
    const el = messageListRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const lastMsg = messages[messages.length - 1]

  const panelContent = (
    <div className={`chat-panel ${visible ? 'is-visible' : ''} ${isFullScreen ? 'is-fullscreen' : ''}`}>
      <div className="chat-panel-inner">
        {/* Header */}
        <div className="chat-panel-header">
          <div className="chat-panel-header-left">
            {/* Collapse button — inline mode only */}
            {!isFullScreen && (
              <button
                type="button"
                className="chat-header-btn"
                onClick={handleToggleCollapse}
                title="折叠面板"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="7 16 12 11 17 16" />
                  <polyline points="7 9 12 4 17 9" />
                </svg>
              </button>
            )}
            {sessions.length > 0 && (
              <button
                type="button"
                className="chat-header-btn"
                onClick={onToggleSessionList}
                title="对话记录"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            )}
            <span className="chat-panel-title">
              {activeSessionId
                ? sessions.find((s) => s.id === activeSessionId)?.title || '对话'
                : 'AI 对话'}
            </span>
          </div>
          <div className="chat-panel-header-right">
            <button
              type="button"
              className="chat-header-btn"
              onClick={onNewSession}
              title="新建对话"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            {isFullScreen ? (
              <button
                type="button"
                className="chat-header-btn"
                onClick={onCloseFullScreen}
                title="退出全屏"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="chat-header-btn"
                onClick={onToggleFullScreen}
                title="全屏"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Session list overlay */}
        {showSessionList && (
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={(id) => {
              onSelectSession(id)
              onCloseSessionList()
            }}
            onDelete={onDeleteSession}
            onClose={onCloseSessionList}
          />
        )}

        {/* Messages */}
        <div className="chat-message-list" ref={messageListRef}>
          {messages.length === 0 && !isStreaming && (
            <div className="chat-empty">
              <p>开始与 AI 对话</p>
              <span>输入任何内容，AI 将会回复</span>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && msg.role === 'assistant' && msg.id === lastMsg?.id}
            />
          ))}
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <ChatInput
            onSend={onSend}
            disabled={isStreaming}
            placeholder="输入消息…"
          />
        </div>
      </div>
    </div>
  )

  // Fullscreen mode — plain div with backdrop-filter, full viewport
  if (isFullScreen) {
    return (
      <div
        className={`chat-fullscreen-glass theme-${theme}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onCloseFullScreen()
        }}
      >
        <div className="chat-fullscreen-content">
          {panelContent}
        </div>
      </div>
    )
  }

  // Collapsed strip
  if (isCollapsed && hasEverOpened) {
    return (
      <div className="chat-panel-glass chat-panel-entering is-collapsed">
        <button
          className="chat-collapsed-expand"
          onClick={handleToggleCollapse}
          title="展开对话"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7 8 12 13 17 8" />
            <polyline points="7 15 12 20 17 15" />
          </svg>
        </button>
      </div>
    )
  }

  if (!hasEverOpened && !visible) return null

  return (
    <div className={`chat-panel-glass ${visible ? 'chat-panel-entering' : ''}`}>
      <div className="chat-panel-glass-content">
        {panelContent}
      </div>
    </div>
  )
}
