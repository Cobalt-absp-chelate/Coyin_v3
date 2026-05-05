import { useCallback, useEffect, useState } from 'react'
import type { PdfViewerProps } from '../../types/pdf'
import { PdfViewerFallback } from './PdfViewerFallback'
import { PdfJsViewer } from './PdfJsViewer'
import { resolvePdfPath } from '../../utils/pdfPaths'
import { getPdfSource, getPdfData } from '../../services/documentStorageService'

type Format = 'pdf' | 'text' | 'markdown' | 'docx' | 'unknown'

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF

function isPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  return bytes[0] === PDF_MAGIC[0] && bytes[1] === PDF_MAGIC[1] && bytes[2] === PDF_MAGIC[2] && bytes[3] === PDF_MAGIC[3]
}

function detectFormat(filePath: string, mime?: string, originalName?: string): Format {
  // 1. mime
  if (mime === 'application/pdf') return 'pdf'
  // 2. originalName extension
  if (originalName) {
    if (/\.pdf$/i.test(originalName)) return 'pdf'
    if (/\.md$/i.test(originalName) || /\.markdown$/i.test(originalName)) return 'markdown'
    if (/\.txt$/i.test(originalName)) return 'text'
    if (/\.docx$/i.test(originalName)) return 'docx'
  }
  // 3. filePath / storedPath extension
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  if (lower.endsWith('.txt')) return 'text'
  if (lower.endsWith('.docx')) return 'docx'
  return 'unknown'
}

function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br/>')
  return '<p>' + html + '</p>'
}

function NonPdfShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="pdf-reader-shell page-primary">
      <div className="pdf-reader-topbar">
        <div className="pdf-reader-topbar-left">
          <button type="button" className="pdf-reader-icon-button" aria-label="返回资料库" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="pdf-reader-topbar-center">
          <span className="pdf-reader-title">{title}</span>
        </div>
        <div className="pdf-reader-topbar-right" />
      </div>
      {children}
    </section>
  )
}

export function PdfViewerHost({ filePath, title, onBack, theme, storageBackend, storedPath, mime, originalName }: PdfViewerProps) {
  const [useFallback, setUseFallback] = useState(false)
  const [resolvedPath, setResolvedPath] = useState<string>('')
  const [rawData, setRawData] = useState<Uint8Array | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<Format>('unknown')

  const switchToFallback = useCallback(() => setUseFallback(true), [])

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      // Step 1: detect format via metadata
      let fmt = detectFormat(filePath, mime, originalName)

      // Step 2: if unknown and we have a stored copy, try loading data and checking magic bytes
      if (fmt === 'unknown' && storageBackend && storageBackend !== 'metadata-only') {
        setLoading(true)
        try {
          const data = await getPdfData({ id: '', storedPath, storageBackend })
          if (!cancelled && data) {
            if (isPdfMagic(data)) {
              fmt = 'pdf'
              setRawData(data)
              setResolvedPath('')
            }
            // Could detect other formats by magic bytes here
          }
        } catch { /* will fall through */ }
        if (!cancelled) setLoading(false)
      }

      if (!cancelled) setDetectedFormat(fmt)

      if (fmt === 'pdf') {
        // If we already have rawData from magic bytes check, skip re-loading
        if (rawData) return

        if (storageBackend && storageBackend !== 'metadata-only') {
          setLoading(true)
          try {
            const data = await getPdfData({ id: '', storedPath, storageBackend })
            if (!cancelled && data) {
              if (isPdfMagic(data)) {
                setRawData(data)
                setResolvedPath('')
              } else {
                setError('文件不是合法 PDF（文件头校验失败）')
                setResolvedPath(resolvePdfPath(filePath))
              }
            } else if (!cancelled) {
              const source = await getPdfSource({ id: '', storedPath, storageBackend })
              if (!cancelled) {
                if (source) setResolvedPath(source)
                else setError('文件副本不存在，请重新导入')
              }
            }
          } catch (e) {
            if (!cancelled) setError(`文件读取失败: ${e instanceof Error ? e.message : '未知错误'}`)
          } finally {
            if (!cancelled) setLoading(false)
          }
          return
        }

        setResolvedPath(resolvePdfPath(filePath))
        return
      }

      // ── Non-PDF formats: try to load text ──
      if (fmt === 'text' || fmt === 'markdown') {
        setLoading(true)
        try {
          if (storageBackend === 'tauri' && storedPath) {
            const { readTextFile } = await import('@tauri-apps/plugin-fs')
            const text = await readTextFile(storedPath)
            if (!cancelled) setTextContent(text)
          } else if (storageBackend === 'indexeddb') {
            const data = await getPdfData({ id: '', storedPath, storageBackend })
            if (data && !cancelled) {
              setTextContent(new TextDecoder().decode(data))
            }
          } else if (filePath) {
            try {
              const res = await fetch(filePath)
              if (res.ok && !cancelled) setTextContent(await res.text())
            } catch { /* will show error */ }
          }
        } catch {
          if (!cancelled) setTextContent('')
        } finally {
          if (!cancelled) setLoading(false)
        }
        setResolvedPath('')
        return
      }

      setResolvedPath('')
    }

    resolve()
    return () => { cancelled = true }
  }, [filePath, storageBackend, storedPath, mime, originalName, rawData])

  // ── Markdown view ──
  if (detectedFormat === 'markdown') {
    return (
      <NonPdfShell title={title} onBack={onBack}>
        <div className="pdf-reader-viewer-container" style={{ padding: '24px 32px', overflow: 'auto', flex: 1 }}>
          {loading ? (
            <span style={{ color: 'var(--muted)' }}>正在加载…</span>
          ) : textContent !== null ? (
            textContent ? (
              <div
                className="markdown-viewer"
                dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(textContent) }}
                style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: 'var(--fg)' }}
              />
            ) : (
              <span style={{ color: 'var(--muted)' }}>文件内容为空</span>
            )
          ) : (
            <span style={{ color: 'var(--muted)' }}>无法加载文件</span>
          )}
        </div>
      </NonPdfShell>
    )
  }

  // ── Text view ──
  if (detectedFormat === 'text') {
    return (
      <NonPdfShell title={title} onBack={onBack}>
        <div className="pdf-reader-viewer-container" style={{ padding: '24px 32px', overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '14px', lineHeight: 1.7, color: 'var(--fg)', flex: 1 }}>
          {loading ? (
            <span style={{ color: 'var(--muted)' }}>正在加载文本…</span>
          ) : textContent !== null ? (
            textContent || <span style={{ color: 'var(--muted)' }}>文件内容为空</span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>无法加载文本文件</span>
          )}
        </div>
      </NonPdfShell>
    )
  }

  // ── DOCX ──
  if (detectedFormat === 'docx') {
    return (
      <NonPdfShell title={title} onBack={onBack}>
        <div className="pdf-reader-viewer-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted)', flexDirection: 'column', gap: '12px' }}>
          <span>.docx 文件暂不支持预览</span>
          <span style={{ fontSize: '13px' }}>文件已入库保存，可在桌面应用中打开</span>
        </div>
      </NonPdfShell>
    )
  }

  // ── Unknown format ──
  if (detectedFormat === 'unknown') {
    const nameForDisplay = originalName || filePath || '未知文件'
    return (
      <NonPdfShell title={title} onBack={onBack}>
        <div className="pdf-reader-viewer-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted)', flexDirection: 'column', gap: '12px' }}>
          <span>暂不支持预览此文件格式</span>
          <span style={{ fontSize: '13px' }}>文件名：{nameForDisplay}</span>
          <span style={{ fontSize: '13px' }}>文件已入库保存，可作为文件保存</span>
        </div>
      </NonPdfShell>
    )
  }

  // ── PDF loading ──
  if (loading) {
    return (
      <NonPdfShell title={title} onBack={onBack}>
        <div className="pdf-reader-viewer-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted)' }}>
          正在加载文档…
        </div>
      </NonPdfShell>
    )
  }

  // ── PDF error (no data, no resolved path) ──
  if (error && !resolvedPath && !rawData) {
    return (
      <NonPdfShell title={title} onBack={onBack}>
        <div className="pdf-reader-viewer-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#e06060', flexDirection: 'column', gap: '8px' }}>
          <span>打开 PDF 失败</span>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{error}</span>
        </div>
      </NonPdfShell>
    )
  }

  // ── PDF fallback ──
  if (useFallback && resolvedPath) {
    return <PdfViewerFallback filePath={resolvedPath} title={title} onBack={onBack} />
  }

  // ── PDF: raw data or file URL ──
  return (
    <PdfJsViewer
      filePath={resolvedPath}
      rawData={rawData || undefined}
      title={title}
      onBack={onBack}
      onFallback={switchToFallback}
      theme={theme}
    />
  )
}
