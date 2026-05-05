import { useCallback, useEffect, useState } from 'react'
import { WritingWorkspace } from './WritingWorkspace'
import { WritingLibrary } from './WritingLibrary'
import { WritingRenameDialog } from './WritingRenameDialog'
import {
  loadDocuments,
  loadActiveDocId,
  saveActiveDocId,
  createDocument,
  updateDocument,
  deleteDocument,
  renameDocument,
  changeDocumentGroup,
} from '../services/writingService'
import type { WritingDocument } from '../types/writing'
import { WRITING_GROUPS } from '../types/writing'

type Theme = 'light' | 'dark'
type View = 'library' | 'editor'

export function WritingModule({ theme, onBack }: { theme: Theme; onBack: () => void }) {
  const [view, setView] = useState<View>('library')
  const [documents, setDocuments] = useState<WritingDocument[]>(() => loadDocuments())
  const [activeDocId, setActiveDocId] = useState<string | null>(() => loadActiveDocId())
  const [showRename, setShowRename] = useState(false)
  const [showGroupPicker, setShowGroupPicker] = useState<string | null>(null) // docId
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState('全部')

  // Get active document
  const activeDoc = activeDocId ? documents.find((d) => d.id === activeDocId) : null

  // Restore active document on mount
  useEffect(() => {
    const id = loadActiveDocId()
    if (id && documents.some((d) => d.id === id)) {
      setActiveDocId(id)
      setView('editor')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Library actions ──

  const handleCreate = useCallback(() => {
    const doc = createDocument()
    setDocuments(loadDocuments())
    setActiveDocId(doc.id)
    setView('editor')
  }, [])

  const handleOpen = useCallback((doc: WritingDocument) => {
    setActiveDocId(doc.id)
    saveActiveDocId(doc.id)
    setView('editor')
  }, [])

  const handleDelete = useCallback((docId: string) => {
    setDeletingId(docId)
    setTimeout(() => {
      deleteDocument(docId)
      setDocuments(loadDocuments())
      setDeletingId(null)
      if (activeDocId === docId) {
        setActiveDocId(null)
        saveActiveDocId(null)
      }
    }, 600)
  }, [activeDocId])

  // ── Editor actions ──

  const handleSave = useCallback((html: string) => {
    if (!activeDocId) return
    updateDocument(activeDocId, { contentHtml: html })
    // Don't re-read all docs from storage on every keystroke — just update local state
    setDocuments((prev) => prev.map((d) =>
      d.id === activeDocId ? { ...d, contentHtml: html, updatedAt: Date.now() } : d
    ))
  }, [activeDocId])

  const handleBackFromEditor = useCallback(() => {
    setShowRename(true)
  }, [])

  // ── Rename dialog ──

  const handleRenameSave = useCallback((title: string) => {
    if (activeDocId) {
      renameDocument(activeDocId, title)
      setDocuments(loadDocuments())
    }
    setShowRename(false)
    setActiveDocId(null)
    saveActiveDocId(null)
    setView('library')
  }, [activeDocId])

  const handleRenameSkip = useCallback(() => {
    setShowRename(false)
    setActiveDocId(null)
    saveActiveDocId(null)
    setView('library')
  }, [])

  const handleRenameCancel = useCallback(() => {
    setShowRename(false)
  }, [])

  // ── Rename from library (right-click) ──

  const handleRenameFromLibrary = useCallback((doc: WritingDocument) => {
    const newTitle = window.prompt('重命名文档：', doc.title)
    if (newTitle && newTitle.trim()) {
      renameDocument(doc.id, newTitle.trim())
      setDocuments(loadDocuments())
    }
  }, [])

  // ── Group change from library (right-click) ──

  const handleChangeGroup = useCallback((doc: WritingDocument) => {
    setShowGroupPicker(doc.id)
  }, [])

  const handleGroupSelect = useCallback((docId: string, group: string) => {
    changeDocumentGroup(docId, group)
    setDocuments(loadDocuments())
    setShowGroupPicker(null)
  }, [])

  // ── Render ──

  if (view === 'editor' && activeDoc) {
    return (
      <>
        <WritingWorkspace
          theme={theme}
          doc={activeDoc}
          onSave={handleSave}
          onBack={handleBackFromEditor}
        />
        {showRename && (
          <WritingRenameDialog
            theme={theme}
            document={activeDoc}
            onSave={handleRenameSave}
            onSkip={handleRenameSkip}
            onCancel={handleRenameCancel}
          />
        )}
      </>
    )
  }

  return (
    <>
      <WritingLibrary
        theme={theme}
        documents={documents}
        activeGroup={activeGroup}
        onGroupChange={setActiveGroup}
        onOpen={handleOpen}
        onCreate={handleCreate}
        onRename={handleRenameFromLibrary}
        onChangeGroup={handleChangeGroup}
        onDelete={handleDelete}
        onBack={onBack}
        deletingId={deletingId}
      />
      {/* Group picker modal */}
      {showGroupPicker && (
        <div className="writing-rename-overlay" onClick={() => setShowGroupPicker(null)}>
          <div className="writing-group-picker" onClick={(e) => e.stopPropagation()}>
            <h3>选择分组</h3>
            <div className="writing-group-options">
              {WRITING_GROUPS.filter((g) => g !== '全部').map((group) => (
                <button
                  key={group}
                  className="writing-glass-btn"
                  onClick={() => handleGroupSelect(showGroupPicker, group)}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
