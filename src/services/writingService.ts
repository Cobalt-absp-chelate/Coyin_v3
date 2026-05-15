import { createWritingDocument, type WritingDocument } from '../types/writing'

const DOCS_KEY = 'coyin-writing-documents'
const ACTIVE_KEY = 'coyin-writing-active-document'

export function loadDocuments(): WritingDocument[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY)
    if (raw) return JSON.parse(raw) as WritingDocument[]
  } catch { /* ignore */ }
  return []
}

export function saveDocuments(docs: WritingDocument[]): void {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
  } catch { /* ignore */ }
}

export function loadActiveDocId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveDocId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch { /* ignore */ }
}

export function createDocument(): WritingDocument {
  const docs = loadDocuments()
  const doc = createWritingDocument()
  docs.push(doc)
  saveDocuments(docs)
  saveActiveDocId(doc.id)
  return doc
}

export function getDocument(id: string): WritingDocument | undefined {
  return loadDocuments().find((d) => d.id === id)
}

export function updateDocument(id: string, patch: Partial<WritingDocument>): WritingDocument | null {
  const docs = loadDocuments()
  const idx = docs.findIndex((d) => d.id === id)
  if (idx === -1) return null
  docs[idx] = { ...docs[idx], ...patch, updatedAt: Date.now() }
  saveDocuments(docs)
  return docs[idx]
}

export function deleteDocument(id: string): void {
  const docs = loadDocuments().filter((d) => d.id !== id)
  saveDocuments(docs)
  if (loadActiveDocId() === id) saveActiveDocId(null)
}

export function renameDocument(id: string, title: string): WritingDocument | null {
  return updateDocument(id, { title })
}

export function changeDocumentGroup(id: string, group: string): WritingDocument | null {
  return updateDocument(id, { group })
}
