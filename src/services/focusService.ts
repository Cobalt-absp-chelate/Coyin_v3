import {
  FOCUS_ACTIVE_KEY,
  FOCUS_HISTORY_KEY,
  type ActiveFocusSession,
  type CompletedFocusSession,
  type FocusCategory,
} from '../types/focus'

export function loadActiveFocus(): ActiveFocusSession | null {
  try {
    const raw = localStorage.getItem(FOCUS_ACTIVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as ActiveFocusSession
    if (!data.planId || !data.startedAt) return null
    if (data.status === 'running' && data.pausedAt === null) {
      const elapsed = Date.now() - new Date(data.startedAt).getTime() + data.elapsedMs
      return { ...data, elapsedMs: elapsed, startedAt: new Date().toISOString() }
    }
    return data
  } catch {
    return null
  }
}

export function saveActiveFocus(session: ActiveFocusSession | null): void {
  if (session) {
    localStorage.setItem(FOCUS_ACTIVE_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(FOCUS_ACTIVE_KEY)
  }
}

export function loadFocusHistory(): CompletedFocusSession[] {
  try {
    const raw = localStorage.getItem(FOCUS_HISTORY_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? (data as CompletedFocusSession[]) : []
  } catch {
    return []
  }
}

export function saveFocusHistory(sessions: CompletedFocusSession[]): void {
  localStorage.setItem(FOCUS_HISTORY_KEY, JSON.stringify(sessions))
}

export function startFocus(planId: string, title: string): ActiveFocusSession {
  const session: ActiveFocusSession = {
    planId,
    title,
    startedAt: new Date().toISOString(),
    elapsedMs: 0,
    pausedAt: null,
    status: 'running',
  }
  saveActiveFocus(session)
  return session
}

export function pauseFocus(session: ActiveFocusSession): ActiveFocusSession {
  const now = Date.now()
  const additional = now - new Date(session.startedAt).getTime()
  const updated: ActiveFocusSession = {
    ...session,
    elapsedMs: session.elapsedMs + additional,
    pausedAt: new Date().toISOString(),
    status: 'paused',
  }
  saveActiveFocus(updated)
  return updated
}

export function resumeFocus(session: ActiveFocusSession): ActiveFocusSession {
  const updated: ActiveFocusSession = {
    ...session,
    startedAt: new Date().toISOString(),
    pausedAt: null,
    status: 'running',
  }
  saveActiveFocus(updated)
  return updated
}

export function completeFocus(
  session: ActiveFocusSession,
  category: FocusCategory,
): CompletedFocusSession {
  let totalMs = session.elapsedMs
  if (session.status === 'running') {
    totalMs += Date.now() - new Date(session.startedAt).getTime()
  }

  const completed: CompletedFocusSession = {
    planId: session.planId,
    title: session.title,
    category,
    startedAt: session.startedAt,
    endedAt: new Date().toISOString(),
    durationMs: totalMs,
  }

  const history = loadFocusHistory()
  history.push(completed)
  saveFocusHistory(history)
  saveActiveFocus(null)

  return completed
}

export function cancelFocus(): void {
  saveActiveFocus(null)
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
