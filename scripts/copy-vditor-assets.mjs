import { cpSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const src = resolve(root, 'node_modules/vditor/dist')
const dest = resolve(root, 'public/vendor/vditor/dist')

if (!existsSync(src)) {
  console.error(`[copy-vditor-assets] Source not found: ${src}`)
  console.error('Run "npm install" first.')
  process.exit(1)
}

cpSync(src, dest, { recursive: true, force: true })
console.log(`[copy-vditor-assets] ${src} -> ${dest}`)
