import type { PdfDocument } from '../types/pdf'
import { PdfViewerHost } from './pdf/PdfViewerHost'

export type PdfReaderDocument = PdfDocument

type PdfReaderPageProps = {
  document: PdfDocument
  onBack: () => void
  theme?: 'light' | 'dark'
}

export function PdfReaderPage({ document, onBack, theme }: PdfReaderPageProps) {
  return (
    <PdfViewerHost
      filePath={document.filePath}
      title={document.title}
      onBack={onBack}
      theme={theme}
      storageBackend={document.storageBackend}
      storedPath={document.storedPath}
      mime={document.mime}
      originalName={document.originalName}
    />
  )
}
