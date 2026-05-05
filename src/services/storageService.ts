// Storage keys and version management

const STORAGE_VERSION_KEY = 'coyin-storage-version'
const CURRENT_VERSION = 3

export const LIBRARY_KEY = 'coyin-library-items'
export const MEMO_KEY = 'coyin-memo-items'

// ── Demo data fingerprints for safe cleanup ──

const DEMO_LIBRARY_TITLES = [
  'Glassmorphism to Liquid Glass',
  'Provider latency comparison',
  '毕业论文写作提纲',
]

const DEMO_MEMO_TEXTS = [
  '整理今天要读的论文',
  '补一版实验记录摘要',
  '把可下载论文加入阅读',
  '把可下载论文加入资料库',
  '检查引用格式和备注',
]

// ── New defaults ──

export const DEFAULT_LIBRARY_ITEMS = [
  {
    id: 'guide-coyin-usage',
    title: '知页 使用手册',
    type: 'GUIDE',
    meta: '内置指南',
    status: '内置',
    filePath: '',
  },
]

export const DEFAULT_MEMO_ITEMS = [
  { id: 'memo-default', text: '这里可以记录临时事项。' },
]

// ── Version check ──

export function getStorageVersion(): number {
  try {
    const raw = localStorage.getItem(STORAGE_VERSION_KEY)
    return raw ? parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

function setStorageVersion(version: number): void {
  try {
    localStorage.setItem(STORAGE_VERSION_KEY, String(version))
  } catch { /* ignore */ }
}

// ── Migration ──

function isDemoLibraryTitle(title: string): boolean {
  return DEMO_LIBRARY_TITLES.some((t) => t === title)
}

function isDemoMemoText(text: string): boolean {
  return DEMO_MEMO_TEXTS.some((t) => t === text)
}

export function runMigrations(): void {
  const version = getStorageVersion()
  if (version >= CURRENT_VERSION) return

  // Migration v1: clean demo library items and demo memo items
  if (version < 1) {
    // Clean library demo items
    try {
      const raw = localStorage.getItem(LIBRARY_KEY)
      if (raw) {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          const cleaned = items.filter((item: Record<string, unknown>) => {
            if (typeof item.title === 'string' && isDemoLibraryTitle(item.title)) {
              return false
            }
            return true
          })
          if (cleaned.length !== items.length) {
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(cleaned))
          }
        }
      }
    } catch { /* ignore */ }

    // Clean memo demo items
    try {
      const raw = localStorage.getItem(MEMO_KEY)
      if (raw) {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          const cleaned = items.filter((item: Record<string, unknown>) => {
            if (typeof item.text === 'string' && isDemoMemoText(item.text)) {
              return false
            }
            return true
          })
          if (cleaned.length !== items.length) {
            localStorage.setItem(MEMO_KEY, JSON.stringify(cleaned))
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Migration v2: fix status text (replace "已同步" with appropriate values)
  if (version < 2) {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY)
      if (raw) {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          let changed = false
          const fixed = items.map((item: Record<string, unknown>) => {
            if (item.status === '已同步') {
              changed = true
              return { ...item, status: item.type === 'GUIDE' ? '内置' : '本地' }
            }
            return item
          })
          if (changed) {
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(fixed))
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Migration v3: add storageBackend to old items, fix status for orphan PDFs
  if (version < 3) {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY)
      if (raw) {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          let changed = false
          const fixed = items.map((item: Record<string, unknown>) => {
            // Skip items that already have storageBackend
            if (item.storageBackend) return item

            changed = true
            if (item.type === 'PDF') {
              // Old PDF without stored copy — keep record but mark as needing re-select
              return { ...item, storageBackend: 'metadata-only', status: '需重新选择' }
            }
            // Non-PDF items — just mark as local
            return { ...item, storageBackend: 'metadata-only', status: item.status === '已同步' ? '本地' : (item.status || '本地') }
          })
          if (changed) {
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(fixed))
          }
        }
      }
    } catch { /* ignore */ }
  }

  setStorageVersion(CURRENT_VERSION)
}

// ── Library items persistence ──

export function loadLibraryItems(): Array<{ id: string; title: string; type: string; meta: string; status: string; filePath: string; storageBackend?: string; storedPath?: string; originalName?: string; importedAt?: number; size?: number; mime?: string }> {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

export function saveLibraryItems(items: Array<{ id: string; title: string; type: string; meta: string; status: string; filePath: string }>): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items))
  } catch { /* ignore */ }
}

// ── Memo items persistence ──

export function loadMemoItems(): Array<{ id: string; text: string }> {
  try {
    const raw = localStorage.getItem(MEMO_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

export function saveMemoItems(items: Array<{ id: string; text: string }>): void {
  try {
    localStorage.setItem(MEMO_KEY, JSON.stringify(items))
  } catch { /* ignore */ }
}
