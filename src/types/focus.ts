export type FocusCategory = 'study' | 'project' | 'writing' | 'life' | 'entertainment' | 'other'

export type ActiveFocusSession = {
  planId: string
  title: string
  startedAt: string
  elapsedMs: number
  pausedAt: string | null
  status: 'running' | 'paused'
}

export type CompletedFocusSession = {
  planId: string
  title: string
  category: FocusCategory
  startedAt: string
  endedAt: string
  durationMs: number
}

export const FOCUS_ACTIVE_KEY = 'coyin-focus-active'
export const FOCUS_HISTORY_KEY = 'coyin-focus-history'

export const FOCUS_CATEGORIES: { value: FocusCategory; label: string }[] = [
  { value: 'study', label: '学习' },
  { value: 'project', label: '项目' },
  { value: 'writing', label: '写作' },
  { value: 'life', label: '生活' },
  { value: 'entertainment', label: '娱乐' },
  { value: 'other', label: '其他' },
]
