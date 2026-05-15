export type AiProtocol = 'openai' | 'anthropic'

export type AiAuthMethod = 'bearer' | 'x-api-key' | 'custom'

export type AiProviderConfig = {
  id: string
  name: string
  protocol: AiProtocol
  baseUrl: string
  apiKey: string
  authMethod: AiAuthMethod
  customHeaderName: string
  currentModel: string
  manualModel: string
  modelsPath: string
  chatPath: string
  enabled: boolean
  demoMode: boolean
  modelsList: string[]
}

export type AiProviderState = AiProviderConfig & {
  modelsList: string[]
  modelsLoading: boolean
  modelsError: string | null
}

export type AiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiCallOptions = {
  messages: AiMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export type AiCallResult = {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

export const AI_STORAGE_KEY = 'coyin-ai-provider'

export const DEFAULT_OPENAI_CONFIG: Partial<AiProviderConfig> = {
  protocol: 'openai',
  authMethod: 'bearer',
  modelsPath: '/models',
  chatPath: '/chat/completions',
  customHeaderName: '',
}

export const DEFAULT_ANTHROPIC_CONFIG: Partial<AiProviderConfig> = {
  protocol: 'anthropic',
  authMethod: 'x-api-key',
  modelsPath: '/models',
  chatPath: '/messages',
  customHeaderName: '',
}

export function createDefaultConfig(): AiProviderConfig {
  return {
    id: 'default',
    name: '',
    protocol: 'openai',
    baseUrl: '',
    apiKey: '',
    authMethod: 'bearer',
    customHeaderName: '',
    currentModel: '',
    manualModel: '',
    modelsPath: '/models',
    chatPath: '/chat/completions',
    enabled: true,
    demoMode: false,
    modelsList: [],
  }
}
