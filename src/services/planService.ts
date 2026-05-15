import { callAI, loadConfig } from './aiProvider'
import {
  PLAN_HISTORY_KEY,
  PLAN_STORAGE_KEY,
  todayDateString,
  type PlanCategory,
  type PlanPriority,
  type PlanStatus,
  type TodayPlan,
} from '../types/plan'

// ── localStorage helpers ──

export function loadTodayPlans(): TodayPlan[] {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data as TodayPlan[]
  } catch {
    return []
  }
}

export function saveTodayPlans(plans: TodayPlan[]): void {
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans))
}

export function loadPlanHistory(): TodayPlan[] {
  try {
    const raw = localStorage.getItem(PLAN_HISTORY_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data as TodayPlan[]
  } catch {
    return []
  }
}

export function savePlanHistory(history: TodayPlan[]): void {
  localStorage.setItem(PLAN_HISTORY_KEY, JSON.stringify(history))
}

// ── Date change detection & archival ──

const ARCHIVE_DATE_KEY = 'coyin-plan-archive-date'

export function checkAndArchiveIfNeeded(): void {
  const storedDate = localStorage.getItem(ARCHIVE_DATE_KEY)
  const today = todayDateString()

  if (storedDate === today) return

  const todayPlans = loadTodayPlans()
  if (todayPlans.length > 0) {
    const history = loadPlanHistory()
    history.push(...todayPlans)
    savePlanHistory(history)
  }

  localStorage.removeItem(PLAN_STORAGE_KEY)
  localStorage.setItem(ARCHIVE_DATE_KEY, today)
}

// ── Plan generation ──

const PLAN_SYSTEM_PROMPT = `你是一个今日计划生成助手。用户会告诉你今天要做什么，请将其拆解为结构化的今日计划。

你必须返回一个 JSON 数组，每个元素包含以下字段：
- id: 唯一标识符，用 "plan-" + 序号
- date: 今天日期 (YYYY-MM-DD)
- time: 预计时间段，如 "09:00-11:00" 或 "上午" 或 "晚上"
- title: 简短标题
- description: 一句话描述
- category: "study" | "work" | "life" | "other"
- priority: "high" | "medium" | "low"
- status: "pending"
- source: "ai"

只返回 JSON 数组，不要包含其他文字。`

function generateDemoPlans(userInput: string): TodayPlan[] {
  const today = todayDateString()
  const tasks = userInput
    .split(/[,，;；、\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (tasks.length === 0) {
    return [
      {
        id: 'plan-1',
        date: today,
        time: '待定',
        title: '安排今日工作',
        description: '整理待办事项，规划今天的工作',
        category: 'work' as PlanCategory,
        priority: 'medium' as PlanPriority,
        status: 'pending' as PlanStatus,
        source: 'demo',
      },
    ]
  }

  const detectedPeriod = extractTimePeriod(userInput)
  const categories: PlanCategory[] = ['study', 'work', 'life', 'other']
  const priorities: PlanPriority[] = ['high', 'medium', 'low']

  return tasks.map((task, i) => ({
    id: `plan-${i + 1}`,
    date: today,
    time: i === 0 ? detectedPeriod || '待定' : '待定',
    title: task.length > 20 ? task.slice(0, 20) + '...' : task,
    description: task,
    category: categories[i % categories.length],
    priority: priorities[Math.min(i, 2)],
    status: 'pending' as PlanStatus,
    source: 'demo',
  }))
}

function isValidPlanArray(data: unknown): data is TodayPlan[] {
  if (!Array.isArray(data)) return false
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.date === 'string',
  )
}

export async function generatePlans(userInput: string): Promise<TodayPlan[]> {
  const config = loadConfig()

  if (config.demoMode || !config.baseUrl || !config.apiKey) {
    return generateDemoPlans(userInput)
  }

  try {
    const result = await callAI(config, {
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: userInput },
      ],
      temperature: 0.4,
      maxTokens: 2048,
    })

    const content = result.content.trim()
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return generateDemoPlans(userInput)

    const parsed = JSON.parse(jsonMatch[0])
    if (!isValidPlanArray(parsed)) return generateDemoPlans(userInput)

    const today = todayDateString()
    return parsed.map((p, i) => ({
      id: p.id || `plan-${i + 1}`,
      date: p.date || today,
      time: p.time || '待定',
      title: p.title,
      description: p.description || '',
      category: (['study', 'work', 'life', 'other'].includes(p.category) ? p.category : 'other') as PlanCategory,
      priority: (['high', 'medium', 'low'].includes(p.priority) ? p.priority : 'medium') as PlanPriority,
      status: 'pending' as PlanStatus,
      source: 'ai',
    }))
  } catch {
    return generateDemoPlans(userInput)
  }
}

// ── Time period extraction ──

export function extractTimePeriod(time: string): string {
  if (!time) return '待定'
  const t = time.trim()

  if (/上午|早上|早晨|am|AM/.test(t)) return '上午'
  if (/中午|午间/.test(t)) return '中午'
  if (/下午|午后|pm|PM/.test(t)) return '下午'
  if (/晚上|傍晚|晚间|夜里|夜晚/.test(t)) return '晚上'
  if (/全天|一天/.test(t)) return '全天'

  const hourMatch = t.match(/(\d{1,2}):\d{2}/)
  if (hourMatch) {
    const h = parseInt(hourMatch[1], 10)
    if (h >= 0 && h <= 5) return '凌晨'
    if (h >= 6 && h <= 11) return '上午'
    if (h >= 12 && h <= 13) return '中午'
    if (h >= 14 && h <= 17) return '下午'
    if (h >= 18 && h <= 23) return '晚上'
  }

  return '待定'
}

// ── Deduplication ──

function normalizeForDedup(s: string): string {
  return s
    .replace(/[\s　,，.。!！?？、;；:：""''（）()\[\]【】{}]/g, '')
    .replace(/^(我需要|我要|准备|得|还得|去|进行|完成)/, '')
    .toLowerCase()
}

export function isDuplicatePlan(existing: TodayPlan[], candidate: TodayPlan): boolean {
  const normTitle = normalizeForDedup(candidate.title)
  const normTime = normalizeForDedup(candidate.time)
  return existing.some((p) => {
    const eTitle = normalizeForDedup(p.title)
    const eTime = normalizeForDedup(p.time)
    return eTitle === normTitle && eTime === normTime
  })
}

// ── Plan status updates ──

export function updatePlanStatus(plans: TodayPlan[], planId: string, status: PlanStatus): TodayPlan[] {
  return plans.map((p) => (p.id === planId ? { ...p, status } : p))
}

export function removePlan(plans: TodayPlan[], planId: string): TodayPlan[] {
  return plans.filter((p) => p.id !== planId)
}
