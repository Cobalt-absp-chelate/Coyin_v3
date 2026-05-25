export type EyeState = 'default' | 'happy' | 'closed' | 'surprised' | 'moving' | 'curious' | 'sleepy' | 'excited' | 'dizzy' | 'wink' | 'loving' | 'thinking' | 'scared'

export type PetMoveMode = 'wander' | 'paused' | 'dragging'

export type SpeakFrequency = 'silent' | 'rare' | 'moderate'

export interface PetSettings {
  enabled: boolean
  userName: string
  orbSize: number
  orbColor: string
  colorMode: 'single' | 'rotate'
  glowIntensity: number
  allowSpeech: boolean
  speakFrequency: SpeakFrequency
  customLines: string[]
  autoWander: boolean
  allowSnap: boolean
  watchMouse: boolean
  autoBlink: boolean
  aiSpeechEnabled: boolean
  aiSpeechWindow: number
  aiSpeechCount: number
}

export const DEFAULT_PET_SETTINGS: PetSettings = {
  enabled: true,
  userName: '',
  orbSize: 52,
  orbColor: '#68bdd3',
  colorMode: 'single',
  glowIntensity: 50,
  allowSpeech: true,
  speakFrequency: 'moderate',
  customLines: [],
  autoWander: true,
  allowSnap: true,
  watchMouse: true,
  autoBlink: true,
  aiSpeechEnabled: false,
  aiSpeechWindow: 60,
  aiSpeechCount: 3,
}

// ── Pet chat message ──

export interface PetChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type HomeLayoutItem =
  | { id: 'memo-card'; visible: boolean }
  | { id: 'info-panel'; visible: boolean }
  | { id: 'today-plan'; visible: boolean }
  | { id: 'ai-input'; visible: boolean }

export interface HomeLayout {
  order: string[]
}

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  order: ['ai-input', 'today-plan', 'memo-card', 'info-panel'],
}

// ── Storage keys ──

export const PET_SETTINGS_KEY = 'coyin-pet-settings'
export const HOME_LAYOUT_KEY = 'coyin-home-layout'
export const PET_CUSTOM_LINES_KEY = 'coyin-pet-custom-lines'
