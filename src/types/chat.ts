export type ChatSession = {
  id: string
  title: string
  created_at: number
  updated_at: number
}

export type ChatMessage = {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string | null
  timestamp: number
}

export type StreamCallbacks = {
  onToken: (token: string) => void
  onThinking: (thinking: string) => void
  onDone: (fullContent: string) => void
  onError: (error: string) => void
}
