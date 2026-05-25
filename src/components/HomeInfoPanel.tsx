interface HomeInfoPanelProps {
  visible: boolean
  theme: 'light' | 'dark'
}

export function HomeInfoPanel({ visible, theme }: HomeInfoPanelProps) {
  if (!visible) return null

  const stats = getStats()

  return (
    <article className={`content-panel console-card home-info-panel theme-${theme}`}>
      <span className="eyebrow">今日概览</span>
      <div className="home-info-grid">
        {stats.map((s) => (
          <div key={s.label} className="home-info-stat">
            <span className="home-info-stat-value">{s.value}</span>
            <span className="home-info-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

export function getStats(): Array<{ label: string; value: string | number }> {
  const stats: Array<{ label: string; value: string | number }> = []

  try {
    const memos = JSON.parse(localStorage.getItem('coyin-memo-items') || '[]')
    stats.push({ label: '备忘', value: Array.isArray(memos) ? memos.length : 0 })
  } catch {
    stats.push({ label: '备忘', value: 0 })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const plans = JSON.parse(localStorage.getItem('coyin-today-plans') || '[]')
    const todayPlans = Array.isArray(plans) ? plans.filter((p: { date?: string }) => p.date === today) : []
    const done = todayPlans.filter((p: { status?: string }) => p.status === 'done').length
    stats.push({ label: '今日计划', value: todayPlans.length })
    stats.push({ label: '已完成', value: done })
  } catch {
    stats.push({ label: '今日计划', value: 0 })
    stats.push({ label: '已完成', value: 0 })
  }

  try {
    const focus = JSON.parse(localStorage.getItem('coyin-focus-active') || 'null')
    stats.push({ label: '专注', value: focus ? '进行中' : '空闲' })
  } catch {
    stats.push({ label: '专注', value: '空闲' })
  }

  try {
    const lib = JSON.parse(localStorage.getItem('coyin-library-items') || '[]')
    stats.push({ label: '阅读库', value: Array.isArray(lib) ? lib.length : 0 })
  } catch {
    stats.push({ label: '阅读库', value: 0 })
  }

  try {
    const docs = JSON.parse(localStorage.getItem('coyin-writing-documents') || '[]')
    stats.push({ label: '写作文档', value: Array.isArray(docs) ? docs.length : 0 })
  } catch {
    stats.push({ label: '写作文档', value: 0 })
  }

  try {
    const sessions = JSON.parse(localStorage.getItem('coyin-chat-sessions') || '[]')
    stats.push({ label: 'AI 会话', value: Array.isArray(sessions) ? sessions.length : 0 })
  } catch {
    stats.push({ label: 'AI 会话', value: 0 })
  }

  return stats
}
