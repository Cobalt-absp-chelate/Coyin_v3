/**
 * PDF document storage abstraction.
 *
 * Backends (in priority order):
 *   1. tauri       — copy to appDataDir via @tauri-apps/plugin-fs
 *   2. indexeddb   — store ArrayBuffer in IndexedDB (browser dev / fallback)
 *   3. metadata-only — record kept but no file copy; shows "需重新选择"
 */

const IDB_NAME = 'coyin-documents'
const IDB_STORE = 'pdf-files'

export type StorageBackend = 'tauri' | 'indexeddb' | 'metadata-only'

export interface StoredDocumentRef {
  storageBackend: StorageBackend
  storedPath: string       // Tauri: absolute path in appDataDir; indexeddb: blob:<id>
  originalName: string
  size: number
  mime: string
  importedAt: number
}

function isTauriEnv(): boolean {
  try {
    return typeof window !== 'undefined' && '__TAURI__' in window
  } catch {
    return false
  }
}

export function detectStorageBackend(): StorageBackend {
  if (isTauriEnv()) return 'tauri'
  try {
    if (typeof indexedDB !== 'undefined') return 'indexeddb'
  } catch { /* ignore */ }
  return 'metadata-only'
}

// ── IndexedDB helpers ──

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(buffer, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function idbGet(key: string): Promise<ArrayBuffer | null> {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ── Tauri helpers ──

async function tauriImportPdf(file: File, docId: string): Promise<StoredDocumentRef> {
  const { join, appDataDir } = await import('@tauri-apps/api/path')
  const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')

  const docsDir = await join(await appDataDir(), 'Coyin', 'documents')
  await mkdir(docsDir, { recursive: true })

  const storedPath = await join(docsDir, `${docId}.pdf`)
  const buffer = await file.arrayBuffer()
  await writeFile(storedPath, new Uint8Array(buffer))

  return {
    storageBackend: 'tauri',
    storedPath,
    originalName: file.name,
    size: file.size,
    mime: file.type || 'application/pdf',
    importedAt: Date.now(),
  }
}

async function tauriGetSource(storedPath: string): Promise<string> {
  // Tauri can serve local files directly — return the absolute path
  // PdfViewerHost will resolve it via resolvePdfPath
  const { convertFileSrc } = await import('@tauri-apps/api/core')
  return convertFileSrc(storedPath)
}

async function tauriDeletePdf(storedPath: string): Promise<void> {
  const { remove } = await import('@tauri-apps/plugin-fs')
  try {
    await remove(storedPath)
  } catch { /* file may already be deleted */ }
}

// ── IndexedDB import / get / delete ──

async function idbImportPdf(file: File, docId: string): Promise<StoredDocumentRef> {
  const buffer = await file.arrayBuffer()
  await idbPut(docId, buffer)

  return {
    storageBackend: 'indexeddb',
    storedPath: docId, // key in IndexedDB
    originalName: file.name,
    size: file.size,
    mime: file.type || 'application/pdf',
    importedAt: Date.now(),
  }
}

async function idbGetSource(docId: string): Promise<string> {
  const buffer = await idbGet(docId)
  if (!buffer) throw new Error('PDF data not found in IndexedDB')
  const blob = new Blob([buffer], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

async function idbDeletePdf(docId: string): Promise<void> {
  await idbDelete(docId)
}

// ── Public API ──

export interface DownloadPaperResult {
  success: boolean
  local_path: string
  file_size: number
  error: string | null
}

/**
 * Download a paper PDF via the Rust backend and save it to the local papers directory.
 * Only works in Tauri environment. Returns the absolute local path.
 */
export async function downloadPaperViaTauri(
  url: string,
  title: string,
  safeFilename: string,
): Promise<DownloadPaperResult> {
  const { invoke } = await import('@tauri-apps/api/core')
  // Use dynamic import to avoid build errors in non-Tauri contexts
  return invoke<DownloadPaperResult>('download_paper_pdf', {
    request: {
      url,
      title,
      safe_filename: safeFilename,
    },
  })
}

export interface StoredPaperRef {
  storageBackend: string
  localPath: string
  originalName: string
  size: number
  mime: string
  importedAt: number
}

/**
 * Import a downloaded paper into the library storage.
 * In Tauri mode, the file is already on disk, so we just record the reference.
 * In browser mode, we save to IndexedDB.
 */
export async function importDownloadedPaper(
  file: File,
  docId: string,
  localPath?: string,
): Promise<StoredPaperRef> {
  const backend = detectStorageBackend()

  if (backend === 'tauri' && localPath) {
    // File already saved by download_paper_pdf, just record
    return {
      storageBackend: 'tauri',
      localPath,
      originalName: file.name,
      size: file.size,
      mime: file.type || 'application/pdf',
      importedAt: Date.now(),
    }
  }

  // Fallback: save via importPdfFile
  const ref = await importPdfFile(file, docId)
  return {
    storageBackend: ref.storageBackend,
    localPath: ref.storedPath || '',
    originalName: ref.originalName,
    size: ref.size,
    mime: ref.mime,
    importedAt: ref.importedAt,
  }
}

export async function importPdfFile(file: File, docId: string): Promise<StoredDocumentRef> {
  const backend = detectStorageBackend()

  if (backend === 'tauri') {
    return tauriImportPdf(file, docId)
  }

  if (backend === 'indexeddb') {
    return idbImportPdf(file, docId)
  }

  // metadata-only: no file copy, just record
  return {
    storageBackend: 'metadata-only',
    storedPath: '',
    originalName: file.name,
    size: file.size,
    mime: file.type || 'application/pdf',
    importedAt: Date.now(),
  }
}

/**
 * Returns a source that the PDF viewer can use:
 *   - Tauri: returns the file URL via convertFileSrc()
 *   - IndexedDB: returns a blob: URL (caller should revoke when done)
 *   - metadata-only: returns null
 */
export async function getPdfSource(
  item: { id: string; storageBackend?: string; storedPath?: string }
): Promise<string | null> {
  const backend = (item.storageBackend as StorageBackend) || detectStorageBackend()

  if (backend === 'tauri' && item.storedPath) {
    return tauriGetSource(item.storedPath)
  }

  if (backend === 'indexeddb') {
    const key = item.storedPath || item.id
    return idbGetSource(key)
  }

  return null
}

/**
 * Returns raw PDF data as Uint8Array for the pdf.js viewer.
 * For Tauri + IndexedDB case, avoids blob: URLs which can fail in workers.
 */
export async function getPdfData(
  item: { id: string; storageBackend?: string; storedPath?: string }
): Promise<Uint8Array | null> {
  const backend = (item.storageBackend as StorageBackend) || detectStorageBackend()

  if (backend === 'tauri' && item.storedPath) {
    // For Tauri filesystem, read the file via fs plugin
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const data = await readFile(item.storedPath)
      return data
    } catch {
      return null
    }
  }

  if (backend === 'indexeddb') {
    const key = item.storedPath || item.id
    const buffer = await idbGet(key)
    if (!buffer) return null
    return new Uint8Array(buffer)
  }

  return null
}

export async function deleteStoredPdf(
  item: { id: string; storageBackend?: string; storedPath?: string }
): Promise<void> {
  const backend = (item.storageBackend as StorageBackend) || detectStorageBackend()

  if (backend === 'tauri' && item.storedPath) {
    await tauriDeletePdf(item.storedPath)
  } else if (backend === 'indexeddb') {
    const key = item.storedPath || item.id
    await idbDeletePdf(key)
  }
  // metadata-only: nothing to delete
}
