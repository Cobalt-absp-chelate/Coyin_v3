import { useCallback, useRef, useState } from 'react'
import type { HomeLayout } from '../types/pet'

interface HomeLayoutEditorProps {
  layout: HomeLayout
  onSave: (layout: HomeLayout) => void
  onCancel: () => void
  theme: 'light' | 'dark'
}

const ITEM_LABELS: Record<string, string> = {
  'ai-input': 'AI 输入卡片',
  'today-plan': '今日计划',
  'memo-card': '备忘卡片',
  'info-panel': '信息面板',
}

export function HomeLayoutEditor({ layout, onSave, onCancel, theme }: HomeLayoutEditorProps) {
  const [order, setOrder] = useState<string[]>(() => [...layout.order])
  const dragItemRef = useRef<string | null>(null)
  const dragOverRef = useRef<string | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragItemRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    ;(e.currentTarget as HTMLElement).classList.add('dragging')
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('dragging')
    dragItemRef.current = null
    dragOverRef.current = null
    // Remove all drag-over classes
    document.querySelectorAll('.layout-drag-over').forEach((el) => el.classList.remove('layout-drag-over'))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverRef.current !== id) {
      if (dragOverRef.current) {
        const prev = document.querySelector(`[data-layout-id="${dragOverRef.current}"]`)
        prev?.classList.remove('layout-drag-over')
      }
      dragOverRef.current = id
      ;(e.currentTarget as HTMLElement).classList.add('layout-drag-over')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).classList.remove('layout-drag-over')
    dragOverRef.current = null

    const sourceId = dragItemRef.current
    if (!sourceId || sourceId === targetId) return

    setOrder((prev) => {
      const next = [...prev]
      const srcIdx = next.indexOf(sourceId)
      const dstIdx = next.indexOf(targetId)
      if (srcIdx === -1 || dstIdx === -1) return prev
      next.splice(srcIdx, 1)
      next.splice(dstIdx, 0, sourceId)
      return next
    })
  }, [])

  const handleSave = useCallback(() => {
    onSave({ order })
  }, [order, onSave])

  return (
    <div className={`home-layout-editor theme-${theme}`}>
      <div className="home-layout-editor-header">
        <h2>布局编辑模式</h2>
        <p>拖动卡片调整顺序，完成后保存</p>
      </div>
      <div className="home-layout-editor-list">
        {order.map((id) => (
          <div
            key={id}
            data-layout-id={id}
            className="home-layout-editor-item"
            draggable
            onDragStart={(e) => handleDragStart(e, id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={(e) => handleDrop(e, id)}
          >
            <span className="layout-drag-handle">⋮⋮</span>
            <span className="layout-item-label">{ITEM_LABELS[id] || id}</span>
          </div>
        ))}
      </div>
      <div className="home-layout-editor-actions">
        <button className="ai-btn" onClick={onCancel}>取消</button>
        <button className="ai-btn pet-layout-save-btn" onClick={handleSave}>保存布局</button>
      </div>
    </div>
  )
}
