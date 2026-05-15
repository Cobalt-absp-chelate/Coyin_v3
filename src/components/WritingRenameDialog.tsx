import { useState, useRef, useEffect, useCallback } from 'react'
import type { WritingDocument } from '../types/writing'

type Theme = 'light' | 'dark'

interface WritingRenameDialogProps {
  theme: Theme
  document: WritingDocument
  onSave: (title: string) => void
  onSkip: () => void
  onCancel: () => void
}

export function WritingRenameDialog({ theme, document, onSave, onSkip, onCancel }: WritingRenameDialogProps) {
  const [title, setTitle] = useState(document.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(document.title)
    // Focus and select input on mount
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 100)
  }, [document.title])

  const handleSave = useCallback(() => {
    const trimmed = title.trim()
    onSave(trimmed || '未命名写作')
  }, [title, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onCancel()
  }, [handleSave, onCancel])

  return (
    <div className="writing-rename-overlay" onClick={onCancel}>
      <div className={`writing-rename-dialog theme-${theme}`} onClick={(e) => e.stopPropagation()}>
        <h2>文档信息</h2>
        <div className="writing-rename-field">
          <label>文档名称</label>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入文档名称"
          />
        </div>
        <div className="writing-rename-actions">
          <button className="writing-rename-btn writing-rename-save" onClick={handleSave}>
            保存并返回
          </button>
          <button className="writing-rename-btn" onClick={onSkip}>
            直接返回
          </button>
          <button className="writing-rename-btn writing-rename-cancel" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
