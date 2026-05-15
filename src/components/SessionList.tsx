import { useState, useCallback } from 'react'
import type { ChatSession } from '../types/chat'

type SessionListProps = {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  onClose: () => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function SessionList({ sessions, activeSessionId, onSelect, onDelete, onClose }: SessionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = useCallback((sessionId: string) => {
    setDeletingId(sessionId)
    setTimeout(() => {
      onDelete(sessionId)
      setDeletingId(null)
    }, 580)
  }, [onDelete])

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h3>对话记录</h3>
        <button type="button" className="session-list-close" onClick={onClose} aria-label="关闭">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="session-list-empty">暂无对话记录</div>
      ) : (
        <div className="session-list-items">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'is-active' : ''} ${deletingId === session.id ? 'is-deleting' : ''}`}
            >
              <button
                type="button"
                className="session-item-main"
                onClick={() => onSelect(session.id)}
              >
                <span className="session-item-title">{session.title}</span>
                <span className="session-item-date">{formatDate(session.updated_at)}</span>
              </button>
              <button
                type="button"
                className="session-item-delete"
                onClick={() => handleDelete(session.id)}
                aria-label={`删除 ${session.title}`}
                title="删除对话"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
              {deletingId === session.id && (
                <span className="session-delete-burst" aria-hidden="true">
                  <span /><span /><span /><span /><span /><span />
                  <span /><span /><span /><span /><span /><span />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
