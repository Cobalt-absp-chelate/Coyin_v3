import { useCallback, useEffect, useRef, useState } from 'react'
import { GlassSurface } from '../GlassSurface'
import { translateText, explainText, type AiActionResult } from '../../services/aiActions'

type MenuState = {
  x: number
  y: number
  text: string
} | null

type ResultState = {
  x: number
  y: number
  label: string
  text: string
  loading: boolean
} | null

type PdfSelectionMenuProps = {
  theme: 'light' | 'dark'
}

export function PdfSelectionMenu({ theme }: PdfSelectionMenuProps) {
  const [menu, setMenu] = useState<MenuState>(null)
  const [result, setResult] = useState<ResultState>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const getSelectedText = useCallback(() => {
    const sel = window.getSelection()
    if (!sel) return ''
    const text = sel.toString().trim()
    return text.length > 0 ? text : ''
  }, [])

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const text = getSelectedText()
      if (!text) {
        setMenu(null)
        return
      }

      const target = e.target as HTMLElement
      if (!target.closest('.pdf-reader-viewer-container')) {
        setMenu(null)
        return
      }

      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY, text })
      setResult(null)
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null)
      }
      if (resultRef.current && !resultRef.current.contains(e.target as Node)) {
        setResult(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null)
        setResult(null)
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [getSelectedText])

  const runAction = useCallback(
    async (label: string, action: (text: string) => Promise<AiActionResult>) => {
      if (!menu) return
      const selText = menu.text
      setMenu(null)

      setResult({
        x: Math.min(menu.x, window.innerWidth - 340),
        y: Math.min(menu.y, window.innerHeight - 200),
        label,
        text: 'AI 处理中…',
        loading: true,
      })

      const res = await action(selText)
      setResult((prev) =>
        prev ? { ...prev, text: res.text, loading: false } : null,
      )
    },
    [menu],
  )

  const handleCopy = useCallback(() => {
    if (!menu) return
    navigator.clipboard.writeText(menu.text).catch(() => {})
    setMenu(null)
  }, [menu])

  const handleCopyResult = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result.text).catch(() => {})
  }, [result])

  return (
    <>
      {menu && (
        <div
          ref={menuRef}
          className="pdf-context-menu"
          style={{ left: menu.x, top: menu.y }}
        >
          <GlassSurface
            className="pdf-context-glass"
            contentClassName="pdf-context-content"
            theme={theme}
            radius={14}
            elasticity={0.9}
          >
            <button
              type="button"
              className="pdf-context-item"
              onClick={() => runAction('翻译', translateText)}
            >
              翻译选中内容
            </button>
            <button
              type="button"
              className="pdf-context-item"
              onClick={() => runAction('解释', explainText)}
            >
              解释这段话
            </button>
            <div className="pdf-context-sep" />
            <button
              type="button"
              className="pdf-context-item"
              onClick={handleCopy}
            >
              复制
            </button>
          </GlassSurface>
        </div>
      )}

      {result && (
        <div
          ref={resultRef}
          className="pdf-result-card"
          style={{ left: result.x, top: result.y }}
        >
          <div className="pdf-result-header">
            <span className="pdf-result-label">{result.label}结果</span>
            <button
              type="button"
              className="pdf-result-copy"
              onClick={handleCopyResult}
              title="复制"
            >
              复制
            </button>
            <button
              type="button"
              className="pdf-result-close"
              onClick={() => setResult(null)}
            >
              ×
            </button>
          </div>
          <div className={`pdf-result-body${result.loading ? ' is-loading' : ''}`}>
            {result.text}
          </div>
        </div>
      )}
    </>
  )
}
