import type { PetSettings, HomeLayout } from '../types/pet'
import { DEFAULT_PET_SETTINGS, DEFAULT_HOME_LAYOUT, PET_SETTINGS_KEY, HOME_LAYOUT_KEY } from '../types/pet'

export function loadPetSettings(): PetSettings {
  try {
    const raw = localStorage.getItem(PET_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_PET_SETTINGS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_PET_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_PET_SETTINGS }
  }
}

export function savePetSettings(settings: PetSettings): void {
  try {
    localStorage.setItem(PET_SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

export function loadHomeLayout(): HomeLayout {
  try {
    const raw = localStorage.getItem(HOME_LAYOUT_KEY)
    if (!raw) return { ...DEFAULT_HOME_LAYOUT }
    const parsed = JSON.parse(raw)
    if (!parsed.order || !Array.isArray(parsed.order)) return { ...DEFAULT_HOME_LAYOUT }
    return { order: parsed.order }
  } catch {
    return { ...DEFAULT_HOME_LAYOUT }
  }
}

export function saveHomeLayout(layout: HomeLayout): void {
  try {
    localStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(layout))
  } catch { /* ignore */ }
}

// ── Default speech lines ──

const MORNING_LINES = [
  '早上好，今天也要加油。',
  '清晨的时光最宝贵。',
  '一杯咖啡，一份好心情。',
  '新的一天，从一个小目标开始吧。',
]

const AFTERNOON_LINES = [
  '下午好，喝口水休息一下。',
  '午后的阳光正好，适合专注。',
  '已经完成不少了吧？继续加油。',
  '读文献久了，也可以站起来走走。',
]

const EVENING_LINES = [
  '今天辛苦了。',
  '晚上效率也很重要，但休息更重要。',
  '要不要整理一下今天的想法？',
  '一天的成果，值得记录。',
]

const NIGHT_LINES = [
  '已经很晚了，要记得休息。',
  '深夜的思绪最真实，但身体更重要。',
  '明天会是更好的一天。',
  '晚安，记得关掉屏幕。',
]

const GENERIC_LINES = [
  '你在思考什么呢？',
  '专注的感觉真好。',
  '每一点积累都会汇聚成河。',
  '累了就歇一歇，没关系的。',
  '今天的你也很棒。',
]

function getHourLines(): string[] {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return MORNING_LINES
  if (h >= 12 && h < 17) return AFTERNOON_LINES
  if (h >= 17 && h < 22) return EVENING_LINES
  return NIGHT_LINES
}

function buildDynamicLines(sessionMinutes: number): string[] {
  const lines: string[] = []
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const timeStr = m > 0 ? `${h}点${m}分` : `${h}点`

  lines.push(`现在已经${timeStr}了哦。`)

  if (sessionMinutes > 5) {
    lines.push(`你已经用了${sessionMinutes}分钟了，记得休息一下。`)
    lines.push(`不知不觉都${sessionMinutes}分钟了呢。`)
  }
  if (sessionMinutes > 30) {
    lines.push(`专注${sessionMinutes}分钟了，起来走走吧。`)
  }
  if (sessionMinutes > 60) {
    lines.push(`已经连续工作${Math.round(sessionMinutes / 60)}小时了，该歇歇啦。`)
  }

  return lines
}

export function pickSpeechLine(userName: string, customLines: string[], sessionMinutes = 0): string {
  const defaults = [...getHourLines(), ...GENERIC_LINES]
  const dynamic = buildDynamicLines(sessionMinutes)
  const pool = [...defaults, ...dynamic, ...customLines]
  if (pool.length === 0) return '……'

  const line = pool[Math.floor(Math.random() * pool.length)]

  if (userName.trim()) {
    // 30% chance to insert the user's name naturally
    if (Math.random() < 0.3 && !line.includes(userName)) {
      const prefixes = [`${userName}，`, `${userName}, `, '']
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
      return prefix + line
    }
  }
  return line
}
