import {
  AI_STORAGE_KEY,
  createDefaultConfig,
  type AiCallOptions,
  type AiCallResult,
  type AiProviderConfig,
} from '../types/ai'
import { appFetch } from './httpClient'

// ── localStorage ──

export function loadConfig(): AiProviderConfig {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY)
    if (raw) {
      return { ...createDefaultConfig(), ...JSON.parse(raw) }
    }
  } catch {
    // corrupted storage – fall through to default
  }
  return createDefaultConfig()
}

export function saveConfig(config: AiProviderConfig): void {
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(config))
}

// ── helpers ──

function buildHeaders(config: AiProviderConfig, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  }

  if (config.apiKey) {
    switch (config.authMethod) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${config.apiKey}`
        break
      case 'x-api-key':
        headers['x-api-key'] = config.apiKey
        break
      case 'custom':
        if (config.customHeaderName) {
          headers[config.customHeaderName] = config.apiKey
        }
        break
    }
  }

  return headers
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Build full API URL avoiding /v1/v1/ duplication for DeepSeek-style base URLs */
function buildApiUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl)
  if (base.endsWith('/v1') && path.startsWith('/v1')) {
    return `${base}${path.slice(3)}`
  }
  return `${base}${path}`
}

function isDeepSeekUrl(url: string): boolean {
  return url.includes('deepseek.com')
}

const DEEPSEEK_FALLBACK_MODELS = ['deepseek-chat', 'deepseek-reasoner']

function parseServerError(body: string): string {
  try {
    const data = JSON.parse(body)
    if (data?.error?.message) return String(data.error.message)
    return ''
  } catch {
    // Not JSON or no error field
    const plain = body.trim().slice(0, 200)
    return plain ? `服务器返回: ${plain}` : ''
  }
}

export function parseErrorMessage(status: number, body?: string): string {
  const serverMsg = body ? parseServerError(body) : ''
  switch (status) {
    case 401:
      return serverMsg || 'API Key 无效或已过期'
    case 403:
      return serverMsg || 'API Key 权限不足'
    case 404:
      return serverMsg || '接口路径不存在，请检查 Base URL 或路径'
    case 429:
      return '请求频率超限，请稍后再试'
    case 500:
    case 502:
    case 503:
      return serverMsg || `服务器内部错误 (${status})`
    default:
      return serverMsg || `服务器返回错误 (${status})`
  }
}

// ── fetch models ──

export type FetchModelsResult = {
  models: string[]
  error: string | null
}

export async function fetchModels(config: AiProviderConfig): Promise<FetchModelsResult> {
  if (!config.baseUrl) {
    return { models: [], error: '请先填写 Base URL' }
  }

  if (!config.apiKey) {
    return { models: [], error: '请先填写 API Key' }
  }

  const url = buildApiUrl(config.baseUrl, config.modelsPath)

  try {
    const res = await appFetch(url, {
      method: 'GET',
      headers: buildHeaders(config),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      const msg = parseErrorMessage(res.status, errBody)
      // DeepSeek fallback: even if /models fails, provide known models
      const fallback = isDeepSeekUrl(config.baseUrl) ? DEEPSEEK_FALLBACK_MODELS : []
      return { models: fallback, error: fallback.length > 0 ? `${msg}，已使用默认模型候选` : msg }
    }

    const data = await res.json()

    // OpenAI-compatible: { data: [{ id: "model-name" }, ...] }
    if (Array.isArray(data?.data)) {
      const models = data.data
        .map((item: { id?: string }) => item.id)
        .filter((id: string | undefined): id is string => typeof id === 'string' && id.length > 0)
      return { models, error: null }
    }

    // Flat array: ["model-a", "model-b"]
    if (Array.isArray(data)) {
      const models = data.filter((item: unknown): item is string => typeof item === 'string')
      return { models, error: null }
    }

    const fallback = isDeepSeekUrl(config.baseUrl) ? DEEPSEEK_FALLBACK_MODELS : []
    return {
      models: fallback,
      error: fallback.length > 0 ? '返回格式无法识别，已使用默认模型候选' : '返回格式无法识别',
    }
  } catch (err) {
    const msg = err instanceof TypeError
      ? '网络请求失败，Base URL 不可达或网络断开'
      : err instanceof Error
        ? err.message
        : `网络请求异常: ${String(err)}`
    const fallback = isDeepSeekUrl(config.baseUrl) ? DEEPSEEK_FALLBACK_MODELS : []
    return { models: fallback, error: fallback.length > 0 ? `${msg}，已使用默认模型候选` : msg }
  }
}

// ── call AI ──

const DEMO_RESPONSE: AiCallResult = {
  content: '这是一条来自 Demo 模式的模拟回复。关闭 Demo 模式后，将调用真实 AI 接口。',
  model: 'demo-model',
  usage: { promptTokens: 0, completionTokens: 0 },
}

export async function callAI(
  config: AiProviderConfig,
  options: AiCallOptions,
): Promise<AiCallResult> {
  if (config.demoMode) {
    await new Promise((r) => setTimeout(r, 600))
    return DEMO_RESPONSE
  }

  if (!config.baseUrl) {
    throw new Error('未配置 Base URL')
  }

  const model = options.model || config.currentModel || config.manualModel
  if (!model) {
    throw new Error('未选择或输入模型')
  }

  const url = buildApiUrl(config.baseUrl, config.chatPath)

  if (config.protocol === 'anthropic') {
    return callAnthropic(config, url, model, options)
  }
  return callOpenAI(config, url, model, options)
}

async function callOpenAI(
  config: AiProviderConfig,
  url: string,
  model: string,
  options: AiCallOptions,
): Promise<AiCallResult> {
  const body = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  }

  const res = await appFetch(url, {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(parseErrorMessage(res.status, errBody))
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('返回格式异常：缺少 choices[0].message.content')
  }

  return {
    content,
    model: data.model ?? model,
    usage: data.usage
      ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
      : undefined,
  }
}

async function callAnthropic(
  config: AiProviderConfig,
  url: string,
  model: string,
  options: AiCallOptions,
): Promise<AiCallResult> {
  // Anthropic expects system as a top-level field, not in messages
  const systemMsg = options.messages.find((m) => m.role === 'system')
  const nonSystemMsgs = options.messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.7,
  }
  if (systemMsg) {
    body.system = systemMsg.content
  }

  const headers = buildHeaders(config, {
    'anthropic-version': '2023-06-01',
  })

  const res = await appFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(parseErrorMessage(res.status, errBody))
  }

  const data = await res.json()
  const content = data?.content?.[0]?.text
  if (typeof content !== 'string') {
    throw new Error('返回格式异常：缺少 content[0].text')
  }

  return {
    content,
    model: data.model ?? model,
    usage: data.usage
      ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens }
      : undefined,
  }
}

// ── test connection ──

export type TestResult = {
  ok: boolean
  message: string
}

export async function testConnection(config: AiProviderConfig): Promise<TestResult> {
  const model = config.currentModel || config.manualModel
  if (!model && !config.demoMode) {
    return { ok: false, message: '请先选择或输入模型再测试连接' }
  }

  try {
    const result = await callAI(config, {
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 8,
    })
    return {
      ok: true,
      message: `连接成功 (模型: ${result.model})`,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : '连接失败',
    }
  }
}
