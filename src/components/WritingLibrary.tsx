import { ArrowLeft, FileText, Plus, Trash2, Pencil, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GlassSurface } from './GlassSurface'
import type { WritingDocument } from '../types/writing'
import { WRITING_GROUPS } from '../types/writing'

type Theme = 'light' | 'dark'

type LibraryContextMenu = {
  x: number
  y: number
  docId: string
} | null

interface WritingLibraryProps {
  theme: Theme
  documents: WritingDocument[]
  activeGroup: string
  onGroupChange: (group: string) => void
  onOpen: (doc: WritingDocument) => void
  onCreate: () => void
  onRename: (doc: WritingDocument) => void
  onChangeGroup: (doc: WritingDocument) => void
  onDelete: (docId: string) => void
  onBack: () => void
  deletingId: string | null
}

export function WritingLibrary({
  theme,
  documents,
  activeGroup,
  onGroupChange,
  onOpen,
  onCreate,
  onRename,
  onChangeGroup,
  onDelete,
  onBack,
  deletingId,
}: WritingLibraryProps) {
  const [contextMenu, setContextMenu] = useState<LibraryContextMenu>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const filtered = activeGroup === '全部'
    ? documents
    : documents.filter((d) => d.group === activeGroup)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleContextMenu = useCallback((e: React.MouseEvent, docId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const maxX = window.innerWidth - 190
    const maxY = window.innerHeight - 180
    setContextMenu({
      x: Math.min(e.clientX, maxX),
      y: Math.min(e.clientY, maxY),
      docId,
    })
  }, [])

  // Global click to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return
      closeContextMenu()
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [closeContextMenu])

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeContextMenu])

  function formatDate(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return '今天'
    if (diff < 172800000) return '昨天'
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }

  return (
    <div className={`writing-library theme-${theme}`}>
      <div className="writing-library-panel page-primary">
        <div className="writing-library-toolbar">
          <div className="writing-library-toolbar-left">
            <GlassSurface
              className="writing-back-glass"
              contentClassName="writing-back-content"
              theme={theme}
              radius={18}
              elasticity={0.88}
              onClick={onBack}
            >
              <ArrowLeft size={17} />
              <span>返回</span>
            </GlassSurface>
            <div>
              <h2>写作库</h2>
            </div>
          </div>
          <div className="writing-library-actions">
            <div className="segmented writing-group-tabs">
              {WRITING_GROUPS.map((group) => (
                <GlassSurface
                  key={group}
                  className="segment-glass"
                  contentClassName={`segment-content ${activeGroup === group ? 'is-active' : ''}`}
                  theme={theme}
                  radius={14}
                  elasticity={0.88}
                  onClick={() => onGroupChange(group)}
                >
                  {group}
                </GlassSurface>
              ))}
            </div>
            <GlassSurface
              className="writing-new-glass"
              contentClassName="writing-new-content"
              theme={theme}
              radius={18}
              elasticity={0.88}
              onClick={onCreate}
            >
              <Plus size={17} />
              <span>新建</span>
            </GlassSurface>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="writing-library-empty">
            <FileText size={32} strokeWidth={1} />
            <p>暂无写作文档</p>
            <p className="writing-library-empty-hint">点击「新建」创建第一篇写作</p>
          </div>
        ) : (
          <div className="writing-library-items">
            {filtered.map((doc) => (
              <article
                key={doc.id}
                className={`writing-library-item ${deletingId === doc.id ? 'is-deleting' : ''}`}
                onClick={() => onOpen(doc)}
                onContextMenu={(e) => handleContextMenu(e, doc.id)}
              >
                <div className="writing-library-item-main">
                  <div className="writing-library-item-icon">
                    <FileText size={18} />
                  </div>
                  <div className="writing-library-item-info">
                    <h3>{doc.title}</h3>
                    <p>
                      <span className="writing-library-item-group">{doc.group}</span>
                      <span className="writing-library-item-date">{formatDate(doc.updatedAt)}</span>
                      <span className="writing-library-item-words">
                        {(doc.contentHtml || '').replace(/<[^>]*>/g, '').length} 字
                      </span>
                    </p>
                  </div>
                  <div className="writing-library-item-delete-wrap">
                    <GlassSurface
                      className="library-delete-glass"
                      contentClassName="library-delete-content"
                      theme={theme}
                      radius={999}
                      elasticity={0.78}
                    >
                      <button
                        type="button"
                        className="library-delete-button"
                        aria-label={`删除 ${doc.title}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(doc.id)
                        }}
                      >
                        <span className="trash-icon">
                          <span className="trash-lid" />
                          <span className="trash-body" />
                        </span>
                      </button>
                    </GlassSurface>
                    {deletingId === doc.id ? (
                      <span className="library-delete-burst" aria-hidden="true">
                        <span /><span /><span /><span /><span /><span />
                        <span /><span /><span /><span /><span /><span />
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Context menu for document cards */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="writing-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="writing-context-menu-item" onClick={() => {
            const doc = documents.find((d) => d.id === contextMenu.docId)
            if (doc) onRename(doc)
            closeContextMenu()
          }}>
            <Pencil size={14} />
            <span>重命名</span>
          </button>
          <button className="writing-context-menu-item" onClick={() => {
            const doc = documents.find((d) => d.id === contextMenu.docId)
            if (doc) onChangeGroup(doc)
            closeContextMenu()
          }}>
            <FolderOpen size={14} />
            <span>修改分组</span>
          </button>
          <button className="writing-context-menu-item" onClick={() => {
            onDelete(contextMenu.docId)
            closeContextMenu()
          }}>
            <Trash2 size={14} />
            <span>删除</span>
          </button>
        </div>
      )}
    </div>
  )
}
