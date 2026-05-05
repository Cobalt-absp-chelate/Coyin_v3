export type PlanPriority = 'high' | 'medium' | 'low'
export type PlanStatus = 'pending' | 'active' | 'done'
export type PlanCategory = 'study' | 'work' | 'life' | 'other'

export type TodayPlan = {
  id: string
  date: string
  time: string
  title: string
  description: string
  category: PlanCategory
  priority: PlanPriority
  status: PlanStatus
  source: string
}

export const PLAN_STORAGE_KEY = 'coyin-today-plans'
export const PLAN_HISTORY_KEY = 'coyin-plan-history'

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}
