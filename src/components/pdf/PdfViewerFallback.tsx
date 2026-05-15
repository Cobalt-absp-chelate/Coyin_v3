import type { PdfViewerProps } from '../../types/pdf'
import { GlassSurface } from '../GlassSurface'

export function PdfViewerFallback({ filePath, title, onBack }: PdfViewerProps) {
  return (
    <section className="pdf-reader-shell page-primary">
      <div className="pdf-reader-topbar">
        <div className="pdf-reader-topbar-left">
          <GlassSurface
            className="pdf-reader-back-glass"
            contentClassName="pdf-reader-icon-button"
            theme="dark"
            radius={14}
            elasticity={0.76}
            onClick={onBack}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </GlassSurface>
        </div>
        <div className="pdf-reader-topbar-center">
          <span className="pdf-reader-title">{title}</span>
        </div>
      </div>

      <div className="pdf-reader-browser-shell">
        <iframe
          key={filePath}
          className="pdf-reader-native-frame"
          src={`${filePath}#page=1&zoom=page-width&toolbar=1&navpanes=1`}
          title={title}
        />
      </div>
    </section>
  )
}