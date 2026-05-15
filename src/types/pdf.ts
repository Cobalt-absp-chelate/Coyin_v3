export type PdfDocument = {
  id: string
  title: string
  filePath: string
  lastPage?: number
  zoomLevel?: number
  storageBackend?: string
  storedPath?: string
  mime?: string
  originalName?: string
}

export interface PdfViewerProps {
  filePath: string
  title: string
  onBack: () => void
  theme?: 'light' | 'dark'
  storageBackend?: string
  storedPath?: string
  mime?: string
  originalName?: string
}