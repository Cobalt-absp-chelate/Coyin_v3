import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/openalex': {
        target: 'https://api.openalex.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openalex/, '/works'),
      },
      '/api/crossref': {
        target: 'https://api.crossref.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/crossref/, '/works'),
      },
      '/api/dblp': {
        target: 'https://dblp.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dblp/, '/search/publ/api'),
      },
      '/api/arxiv': {
        target: 'https://export.arxiv.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/arxiv/, '/api/query'),
      },
    },
  },
})
