import { invoke } from '@tauri-apps/api/core'

interface AppFetchResponsePayload {
  status: number
  status_text: string
  headers: [string, string][]
  body: string
  body_base64: boolean
  error: string | null
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function validateUrl(url: string): void {
  const lower = url.toLowerCase()
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    throw new Error('不支持的协议：仅允许 http/https')
  }
}

function sanitizeUrlForLog(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname}`
  } catch {
    return url.slice(0, 100)
  }
}

async function tauriFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers: [string, string][] = []
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => headers.push([k, v]))
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) {
        headers.push([k, v])
      }
    } else {
      for (const [k, v] of Object.entries(init.headers)) {
        headers.push([k, v ?? ''])
      }
    }
  }

  const method = init?.method ?? 'GET'
  const bodyStr = typeof init?.body === 'string' ? init.body : null

  console.log(
    `[appFetch] Tauri → ${method} ${sanitizeUrlForLog(url)}`,
  )

  const response = await invoke<AppFetchResponsePayload>('ai_http_request', {
    request: {
      url,
      method,
      headers,
      body: bodyStr,
      timeout_secs: 60,
    },
  })

  if (response.error) {
    throw new Error(response.error)
  }

  console.log(
    `[appFetch] Tauri ← ${response.status} ${response.status_text} (${response.body.length} chars${response.body_base64 ? ', base64' : ''})`,
  )

  const respHeaders = new Headers()
  for (const [k, v] of response.headers ?? []) {
    respHeaders.append(k, v)
  }

  const bodyInit: BodyInit = response.body_base64
    ? (() => {
        const binary = atob(response.body)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        return new Blob([bytes])
      })()
    : response.body

  return new Response(bodyInit, {
    status: response.status,
    statusText: response.status_text,
    headers: respHeaders,
  })
}

/**
 * Unified HTTP fetch for Coyin.
 *
 * - In browser dev mode: delegates to native `fetch`.
 * - In Tauri desktop: invokes `ai_http_request` Rust command via IPC,
 *   bypassing webview CORS/CSP restrictions.
 *
 * Only `http://` and `https://` URLs are allowed.
 */
export async function appFetch(url: string, init?: RequestInit): Promise<Response> {
  validateUrl(url)
  const tauri = isTauri()
  console.log(
    `[appFetch] isTauri=${tauri} ${init?.method ?? 'GET'} ${sanitizeUrlForLog(url)}`,
  )
  if (tauri) {
    return tauriFetch(url, init)
  }
  return fetch(url, init)
}
