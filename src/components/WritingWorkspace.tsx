import {
  ArrowLeft,
  Bold,
  Italic,
  List,
  Quote,
  Type,
  Heading1,
  Heading2,
  FileDown,
  Copy,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import html2pdf from 'html2pdf.js'
import { GlassSurface } from './GlassSurface'
import { translateText, polishText, continueWriting } from '../services/aiActions'
import type { WritingDocument } from '../types/writing'

type Theme = 'light' | 'dark'

const PLACEHOLDER_TEXT = '开始写作……'

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

type ContextMenuState = {
  x: number
  y: number
  hasSelection: boolean
  selectionText: string
} | null

type AiCardState = {
  title: string
  body: string
  loading: boolean
} | null

interface WritingWorkspaceProps {
  theme: Theme
  doc: WritingDocument
  onSave: (html: string) => void
  onBack: () => void
}

export function WritingWorkspace({ theme, doc, onSave, onBack }: WritingWorkspaceProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [aiCard, setAiCard] = useState<AiCardState>(null)
  const [diffActive, setDiffActive] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const editorWrapRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRangeRef = useRef<Range | null>(null)

  // Initialize editor content from document
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (doc.contentHtml) {
      editor.innerHTML = doc.contentHtml
    } else {
      editor.innerHTML = ''
    }
    setIsEmpty(!editor.textContent?.trim())
  }, [doc.id]) // reload when switching documents

  // Save on input (debounced)
  const handleInput = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    setIsEmpty(!editor.textContent?.trim())

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!editor) return
      if (diffActive) {
        const diffNode = editor.querySelector('.writing-diff')
        if (!diffNode) {
          setDiffActive(false)
        }
      }
      onSave(editor.innerHTML)
    }, 400)
  }, [diffActive, onSave])

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  // Focus editor and exec command
  const execFormat = useCallback((cmd: string, value?: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(cmd, false, value)
    handleInput()
  }, [handleInput])

  // Right-click handler — bound to editor wrapper to catch all clicks in the editor area
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const editor = editorRef.current
    if (!editor) return

    // Save the current selection range
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    } else {
      savedRangeRef.current = null
    }

    const text = sel ? sel.toString().trim() : ''
    const hasSelection = text.length > 0

    const maxX = window.innerWidth - 200
    const maxY = window.innerHeight - 220
    setContextMenu({
      x: Math.min(e.clientX, maxX),
      y: Math.min(e.clientY, maxY),
      hasSelection,
      selectionText: text,
    })
  }, [])

  // Restore saved selection range
  const restoreSavedRange = useCallback((): boolean => {
    const range = savedRangeRef.current
    if (!range) return false
    const editor = editorRef.current
    if (!editor) return false
    try {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      return true
    } catch {
      return false
    }
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  const closeAiCard = useCallback(() => setAiCard(null), [])

  // ── AI Actions ──

  const handleTranslate = useCallback(async () => {
    if (!contextMenu?.selectionText) return
    const text = contextMenu.selectionText
    closeContextMenu()

    setAiCard({ title: '翻译结果', body: '', loading: true })

    const result = await translateText(text)
    setAiCard({ title: '翻译结果', body: result.ok ? result.text : `错误：${result.text}`, loading: false })
  }, [contextMenu, closeContextMenu])

  const handlePolish = useCallback(async () => {
    if (!contextMenu?.selectionText || !editorRef.current) return
    const original = contextMenu.selectionText
    closeContextMenu()

    if (diffActive) {
      showToast('请先处理当前修订建议')
      return
    }

    // Use the saved range from right-click
    if (!restoreSavedRange()) {
      showToast('无法定位选区，请重新选择文本')
      return
    }

    showToast('AI 润色中...')

    const result = await polishText(original)
    if (!result.ok) {
      showToast(`润色失败：${result.text}`)
      return
    }

    // Restore again after async call
    const editor = editorRef.current!
    editor.focus()

    if (!restoreSavedRange()) {
      // Fallback: search for text
      if (!findAndSelectText(editor, original)) {
        showToast('无法定位原文，可能是内容已变更')
        return
      }
    }

    insertDiffNode(original, result.text)
  }, [contextMenu, closeContextMenu, diffActive, showToast, restoreSavedRange])

  const handleContinue = useCallback(async () => {
    closeContextMenu()

    if (diffActive) {
      showToast('请先处理当前修订建议')
      return
    }

    const editor = editorRef.current
    if (!editor) return

    // Use saved cursor position from right-click if available
    const sel = window.getSelection()
    let context = editor.textContent || ''

    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      const cursorOffset = getCursorCharOffset(editor, sel)
      const start = Math.max(0, cursorOffset - 1500)
      const end = Math.min(context.length, cursorOffset + 500)
      context = context.slice(start, end)
      if (start > 0) context = '…' + context
      if (end < (editor.textContent || '').length) context = context + '…'
    } else if (context.length > 2000) {
      context = context.slice(-2000)
    }

    showToast('AI 续写中...')

    const result = await continueWriting(context)
    if (!result.ok) {
      showToast(`续写失败：${result.text}`)
      return
    }

    editor.focus()
    const curSel = window.getSelection()
    if (curSel && curSel.rangeCount && editor.contains(curSel.anchorNode)) {
      insertContinueNode(result.text)
    } else {
      const continueNode = createContinueNode(result.text)
      editor.appendChild(continueNode)
      editor.scrollTop = editor.scrollHeight
      setDiffActive(true)
    }
  }, [closeContextMenu, diffActive, showToast])

  // ── Helpers ──

  function getCursorCharOffset(container: Node, sel: Selection): number {
    const preRange = document.createRange()
    preRange.setStart(container, 0)
    preRange.setEnd(sel.anchorNode!, sel.anchorOffset)
    return preRange.toString().length
  }

  function findAndSelectText(editor: HTMLElement, text: string): boolean {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.textContent?.indexOf(text) ?? -1
      if (idx !== -1) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + text.length)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        return true
      }
    }
    return false
  }

  function insertDiffNode(original: string, suggestion: string) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return

    const range = sel.getRangeAt(0)
    range.deleteContents()

    const diffSpan = document.createElement('span')
    diffSpan.className = 'writing-diff'
    diffSpan.contentEditable = 'false'

    diffSpan.innerHTML =
      `<span class="writing-diff-original">${escapeHtml(original)}</span>` +
      `<span class="writing-diff-suggestion">${escapeHtml(suggestion)}</span>` +
      `<span class="writing-diff-actions">` +
      `<button class="writing-diff-replace">替换</button>` +
      `<button class="writing-diff-cancel">取消</button>` +
      `<button class="writing-diff-copy">复制</button>` +
      `</span>`

    diffSpan.querySelector('.writing-diff-replace')?.addEventListener('click', () => {
      diffSpan.replaceWith(document.createTextNode(suggestion))
      setDiffActive(false)
      onSave(editorRef.current?.innerHTML || '')
      showToast('已替换')
    })

    diffSpan.querySelector('.writing-diff-cancel')?.addEventListener('click', () => {
      diffSpan.replaceWith(document.createTextNode(original))
      setDiffActive(false)
      onSave(editorRef.current?.innerHTML || '')
      showToast('已取消')
    })

    diffSpan.querySelector('.writing-diff-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(suggestion).then(() => showToast('已复制')).catch(() => showToast('复制失败'))
    })

    range.insertNode(diffSpan)
    range.setStartAfter(diffSpan)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)

    setDiffActive(true)
    onSave(editorRef.current?.innerHTML || '')
  }

  function createContinueNode(text: string): HTMLSpanElement {
    const span = document.createElement('span')
    span.className = 'writing-diff writing-continue'
    span.contentEditable = 'false'

    span.innerHTML =
      `<span class="writing-diff-suggestion">${escapeHtml(text)}</span>` +
      `<span class="writing-diff-actions">` +
      `<button class="writing-diff-replace">插入</button>` +
      `<button class="writing-diff-cancel">取消</button>` +
      `<button class="writing-diff-copy">复制</button>` +
      `</span>`

    span.querySelector('.writing-diff-replace')?.addEventListener('click', () => {
      span.replaceWith(document.createTextNode(text))
      setDiffActive(false)
      onSave(editorRef.current?.innerHTML || '')
      showToast('已插入')
    })

    span.querySelector('.writing-diff-cancel')?.addEventListener('click', () => {
      span.remove()
      setDiffActive(false)
      onSave(editorRef.current?.innerHTML || '')
      showToast('已取消')
    })

    span.querySelector('.writing-diff-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'))
    })

    return span
  }

  function insertContinueNode(text: string) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return

    const continueNode = createContinueNode(text)
    const range = sel.getRangeAt(0)
    range.collapse(true)
    range.insertNode(continueNode)
    range.setStartAfter(continueNode)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)

    setDiffActive(true)
    onSave(editorRef.current?.innerHTML || '')
  }

  // ── Export ──

  const buildCleanExportHtml = useCallback((): string => {
    const editor = editorRef.current
    if (!editor) return ''
    const clone = editor.cloneNode(true) as HTMLElement

    // Remove diff action buttons
    clone.querySelectorAll('.writing-diff-actions').forEach((el) => el.remove())
    // Remove any remaining buttons
    clone.querySelectorAll('button').forEach((el) => el.remove())
    // Remove contenteditable attributes so diff nodes render as plain blocks
    clone.querySelectorAll('[contenteditable]').forEach((el) => {
      el.removeAttribute('contenteditable')
    })

    const title = doc.title || '写作'
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  body {
    margin: 0; padding: 32px;
    background: #ffffff;
    color: #111111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
    font-size: 15px;
    line-height: 1.85;
  }
  h1 { font-size: 26px; font-weight: 700; margin: 20px 0 12px; color: #111; }
  h2 { font-size: 20px; font-weight: 600; margin: 16px 0 10px; color: #222; }
  h3 { font-size: 17px; font-weight: 600; margin: 14px 0 8px; color: #333; }
  p { margin: 0 0 10px; }
  ul, ol { padding-left: 24px; margin: 0 0 10px; }
  li { margin-bottom: 3px; }
  blockquote {
    border-left: 3px solid #68bdd3;
    padding: 4px 0 4px 14px;
    margin: 0 0 10px;
    color: #555;
    font-style: italic;
  }
  strong { font-weight: 600; }
  em { font-style: italic; }
  .writing-diff { display: block; margin: 6px 0; padding: 6px; border: 1px solid #ddd; border-radius: 6px; }
  .writing-diff-original {
    display: block; padding: 4px 8px; margin-bottom: 4px;
    background: #fff0f0; color: #a04040; text-decoration: line-through;
    white-space: pre-wrap; word-break: break-word;
  }
  .writing-diff-suggestion {
    display: block; padding: 4px 8px;
    background: #f0fff4; color: #2d7a4f;
    white-space: pre-wrap; word-break: break-word;
  }
</style>
</head>
<body>${clone.innerHTML}</body>
</html>`
  }, [doc.title])

  const handleExportHtml = useCallback(() => {
    const title = doc.title || '写作'
    const html = buildCleanExportHtml()
    if (!html) return
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.html`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
    showToast('已导出 HTML')
  }, [showToast, doc.title, buildCleanExportHtml])

  const handleExportPdfDirect = useCallback(async () => {
    const editor = editorRef.current
    if (!editor || !editor.textContent?.trim()) {
      showToast('正文为空，无法导出 PDF')
      return
    }

    setExportOpen(false)

    // Clone editor content and strip UI-only elements
    const clone = editor.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.writing-diff-actions').forEach((el) => el.remove())
    clone.querySelectorAll('button').forEach((el) => el.remove())
    clone.querySelectorAll('[contenteditable]').forEach((el) => {
      el.removeAttribute('contenteditable')
    })

    const bodyContent = clone.innerHTML
    if (!bodyContent.trim()) {
      showToast('正文为空，无法导出 PDF')
      return
    }

    // Build visible export overlay — no opacity tricks, no z-index:-1
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;' +
      'padding:24px;overflow:auto;'

    const status = document.createElement('div')
    status.textContent = '正在生成 PDF…'
    status.style.cssText =
      'color:#fff;font-size:14px;margin-bottom:16px;font-family:sans-serif;flex-shrink:0;'

    // Visible, opaque, white export root with real dimensions
    const exportRoot = document.createElement('div')
    exportRoot.style.cssText =
      'width:794px;min-height:100px;padding:48px;' +
      'background:#ffffff;color:#111111;' +
      'font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;' +
      'font-size:15px;line-height:1.75;' +
      'opacity:1;flex-shrink:0;'

    // Style tag scoped to exportRoot content
    const style = document.createElement('style')
    style.textContent = [
      'h1{font-size:26px;font-weight:700;margin:20px 0 12px;color:#111}',
      'h2{font-size:20px;font-weight:600;margin:16px 0 10px;color:#222}',
      'h3{font-size:17px;font-weight:600;margin:14px 0 8px;color:#333}',
      'p{margin:0 0 10px}',
      'ul,ol{padding-left:24px;margin:0 0 10px}',
      'li{margin-bottom:3px}',
      'blockquote{border-left:3px solid #68bdd3;padding:4px 0 4px 14px;margin:0 0 10px;color:#555;font-style:italic}',
      'strong{font-weight:600}',
      'em{font-style:italic}',
      '.writing-diff{display:block;margin:6px 0;padding:6px;border:1px solid #ddd;border-radius:6px}',
      '.writing-diff-original{display:block;padding:4px 8px;margin-bottom:4px;background:#fff0f0;color:#a04040;text-decoration:line-through;white-space:pre-wrap;word-break:break-word}',
      '.writing-diff-suggestion{display:block;padding:4px 8px;background:#f0fff4;color:#2d7a4f;white-space:pre-wrap;word-break:break-word}',
    ].join('')
    exportRoot.appendChild(style)
    exportRoot.innerHTML += bodyContent

    overlay.appendChild(status)
    overlay.appendChild(exportRoot)
    document.body.appendChild(overlay)

    // Content / visibility checks
    const rootText = exportRoot.innerText.trim()
    const rect = exportRoot.getBoundingClientRect()
    console.log('editor text length:', editor.textContent?.trim().length)
    console.log('export text length:', rootText.length)
    console.log('export rect:', rect.width, rect.height)

    if (!rootText || rect.width <= 0 || rect.height <= 0) {
      showToast('正文为空，无法导出 PDF')
      document.body.removeChild(overlay)
      return
    }

    // Wait 2 frames for layout
    await new Promise((r) => requestAnimationFrame(r))
    await new Promise((r) => requestAnimationFrame(r))

    const title = doc.title || '写作'
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_')

    try {
      await html2pdf()
        .set({
          margin: 12,
          filename: `${safeTitle}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(exportRoot)
        .save()

      showToast('已导出 PDF')
    } catch {
      showToast('PDF 导出失败，请尝试打印 / 另存 PDF')
    } finally {
      document.body.removeChild(overlay)
    }
  }, [doc.title])

  const handleExportPrint = useCallback(() => {
    setExportOpen(false)
    window.print()
  }, [])

  // ── Keyboard ──

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeContextMenu()
      closeAiCard()
    }
  }, [closeContextMenu, closeAiCard])

  // Close context menu on scroll
  useEffect(() => {
    const handler = () => closeContextMenu()
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [closeContextMenu])

  // Global click to close menus
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.writing-context-menu') || target.closest('.writing-ai-card') || target.closest('.writing-export-wrap')) return
      closeContextMenu()
      setExportOpen(false)
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [closeContextMenu])

  return (
    <div className={`writing-workspace theme-${theme}`}>
      {/* Toolbar */}
      <header className="writing-toolbar">
        <div className="writing-toolbar-left">
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
        </div>

        <div className="writing-toolbar-center">
          <button type="button" className={`writing-format-btn ${theme === 'light' ? 'theme-light' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); execFormat('formatBlock', '<p>') }} title="正文">
            <Type size={16} />
          </button>
          <button type="button" className={`writing-format-btn ${theme === 'light' ? 'theme-light' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); execFormat('formatBlock', '<h1>') }} title="标题 1">
            <Heading1 size={16} />
          </button>
          <button type="button" className={`writing-format-btn ${theme === 'light' ? 'theme-light' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); execFormat('formatBlock', '<h2>') }} title="标题 2">
            <Heading2 size={16} />
          </button>
          <span className="writing-toolbar-divider" />
          <button type="button" className={`writing-format-btn ${theme === 'light' ? 'theme-light' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); execFormat('bold') }} title="加粗 (Ctrl+B)">
            <Bold size={16} />
          </button>
          <button type="button" className={`writing-format-btn ${theme === 'light' ? 'theme-light' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); execFormat('italic') }} title="斜体 (Ctrl+I)">
            <Italic size={16} />
          </button>
          <span className="writing-toolbar-divider" />
          <button type="button" className={`writing-format-btn ${theme === 'light' ? 'theme-light' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); execFormat('insertUnorderedList') }} title="无序列表">
            <List size={16} />
          </button>
          <button type="button" className={`writing-format-btn ${theme === 'light' ? 'theme-light' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              const sel = window.getSelection()
              let inBlockquote = false
              if (sel && sel.rangeCount > 0) {
                let node: Node | null = sel.getRangeAt(0).startContainer
                while (node) {
                  if (node.nodeType === 1 && (node as Element).tagName === 'BLOCKQUOTE') {
                    inBlockquote = true
                    break
                  }
                  node = node.parentNode
                }
              }
              execFormat('formatBlock', inBlockquote ? '<p>' : '<blockquote>')
            }} title="引用">
            <Quote size={16} />
          </button>
        </div>

        <div className="writing-toolbar-right">
          <div className="writing-export-wrap">
            <GlassSurface
              className="writing-export-glass"
              contentClassName="writing-export-content"
              theme={theme}
              radius={18}
              elasticity={0.88}
              onClick={() => setExportOpen(!exportOpen)}
            >
              <FileDown size={17} />
              <span>导出</span>
            </GlassSurface>
            {exportOpen && (
              <div className="writing-export-menu">
                <button className="writing-export-menu-item" onClick={handleExportHtml}>导出为 HTML</button>
                <button className="writing-export-menu-item" onClick={() => { void handleExportPdfDirect() }}>导出为 PDF</button>
                <button className="writing-export-menu-item" onClick={handleExportPrint}>打印 / 另存 PDF</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Editor area — contextMenu bound here to catch all right-clicks */}
      <div className="writing-editor-wrap" ref={editorWrapRef} onContextMenu={handleContextMenu}>
        <div
          ref={editorRef}
          className={`writing-editor ${isEmpty ? 'is-empty' : ''}`}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder={PLACEHOLDER_TEXT}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="writing-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.hasSelection && (
            <>
              <button className="writing-context-menu-item" onClick={handleTranslate}>翻译选中内容</button>
              <button className="writing-context-menu-item" onClick={handlePolish}>润色这段文字</button>
            </>
          )}
          <button className="writing-context-menu-item" onClick={handleContinue}>续写到光标处</button>
          {contextMenu.hasSelection && (
            <button className="writing-context-menu-item" onClick={() => {
              navigator.clipboard.writeText(contextMenu.selectionText).then(() => showToast('已复制')).catch(() => showToast('复制失败'))
              closeContextMenu()
            }}>复制</button>
          )}
        </div>
      )}

      {/* AI Translate Card */}
      {aiCard && (
        <div className="writing-ai-card">
          <button className="writing-ai-card-close" onClick={closeAiCard}><X size={16} /></button>
          <div className="writing-ai-card-title">{aiCard.title}</div>
          <div className="writing-ai-card-body">
            {aiCard.loading ? (
              <div className="writing-ai-card-loading">
                <div className="writing-spinner" />
                <span>AI 处理中...</span>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiCard.body}</div>
            )}
          </div>
          {!aiCard.loading && aiCard.body && (
            <div className="writing-ai-card-actions">
              <button className="writing-glass-btn" onClick={() => {
                navigator.clipboard.writeText(aiCard.body).then(() => showToast('已复制')).catch(() => showToast('复制失败'))
              }}>
                <Copy size={14} /><span>复制</span>
              </button>
              <button className="writing-glass-btn" onClick={closeAiCard}>
                <X size={14} /><span>关闭</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      <div className={`writing-toast ${toast ? 'is-visible' : ''}`}>{toast}</div>
    </div>
  )
}
