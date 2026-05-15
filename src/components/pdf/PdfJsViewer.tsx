import { useCallback, useEffect, useRef } from 'react'
import { Viewer, Worker } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'

import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

import type { PdfViewerProps } from '../../types/pdf'
import { PdfSelectionMenu } from './PdfSelectionMenu'

const WORKER_URL = '/vendor/pdfjs/pdf.worker.min.js'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4.0
const ZOOM_STEP_PX = 120

type PdfJsViewerProps = PdfViewerProps & {
  rawData?: Uint8Array
  onFallback?: () => void
  theme?: 'light' | 'dark'
}

export function PdfJsViewer({ filePath, rawData, title, onBack, onFallback, theme = 'dark' }: PdfJsViewerProps) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin()
  const viewerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1.0)

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    e.stopPropagation()

    const zoomPlugin = defaultLayoutPluginInstance.toolbarPluginInstance.zoomPluginInstance

    // Normalize delta across browsers — deltaY can vary wildly
    const absDelta = Math.abs(e.deltaY)
    let step: number
    if (absDelta < 40) {
      step = 0.05
    } else if (absDelta < 80) {
      step = 0.08
    } else {
      step = Math.min(0.15, absDelta / ZOOM_STEP_PX)
    }

    const direction = e.deltaY > 0 ? -1 : 1
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scaleRef.current + direction * step))
    scaleRef.current = next
    zoomPlugin.zoomTo(next)
  }, [defaultLayoutPluginInstance])

  useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    // Capture phase so we beat any internal handler in default-layout
    el.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', handleWheel, { capture: true })
  }, [handleWheel])

  const source = rawData || filePath

  console.log('[PdfJsViewer] source type:', rawData ? 'Uint8Array' : filePath ? 'URL' : 'none')

  return (
    <section className="pdf-reader-shell page-primary">
      <div className="pdf-reader-topbar">
        <div className="pdf-reader-topbar-left">
          <button
            type="button"
            className="pdf-reader-icon-button"
            aria-label="返回资料库"
            onClick={onBack}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>

        <div className="pdf-reader-topbar-center">
          <span className="pdf-reader-title">{title}</span>
        </div>

        <div className="pdf-reader-topbar-right">
          {onFallback && (
            <button
              type="button"
              className="pdf-reader-fallback-btn"
              onClick={onFallback}
              title="切换到原生 PDF 查看器"
            >
              原生阅读器
            </button>
          )}
        </div>
      </div>

      <div className="pdf-reader-viewer-container" ref={viewerRef}>
        <Worker workerUrl={WORKER_URL}>
          <Viewer
            fileUrl={source}
            plugins={[defaultLayoutPluginInstance]}
            defaultScale={1.0}
          />
        </Worker>
      </div>
      <PdfSelectionMenu theme={theme} />
    </section>
  )
}
