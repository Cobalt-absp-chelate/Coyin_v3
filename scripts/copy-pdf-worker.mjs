import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const src = resolve(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.js')
const dest = resolve(root, 'public/vendor/pdfjs/pdf.worker.min.js')

if (!existsSync(src)) {
  console.error(`[copy-pdf-worker] Source not found: ${src}`)
  console.error('Run "npm install" first.')
  process.exit(1)
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(`[copy-pdf-worker] ${src} -> ${dest}`)
