interface PetInfoPanelProps {
  theme: 'light' | 'dark'
  onClose: () => void
}

interface StatItem {
  label: string
  value: string | number
  navPage?: string
}

export function PetInfoPanel({ theme, onClose }: PetInfoPanelProps) {
  const stats = getStats()

  const handleStatClick = (navPage?: string) => {
    if (navPage) {
      window.dispatchEvent(new CustomEvent('pet-nav-to', { detail: { page: navPage } }))
    }
    onClose()
  }

  return (
    <div className="pet-info-overlay" onClick={onClose}>
      <div
        className={`pet-info-panel theme-${theme}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pet-info-header">
          <h3>今日概览</h3>
          <button className="pet-info-close" onClick={onClose}>×</button>
        </div>
        <div className="pet-info-grid">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`pet-info-stat ${s.navPage ? 'is-clickable' : ''}`}
              onClick={() => handleStatClick(s.navPage)}
            >
              <span className="pet-info-stat-value">{s.value}</span>
              <span className="pet-info-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getStats(): StatItem[] {
  const stats: StatItem[] = []

  try {
    const memos = JSON.parse(localStorage.getItem('coyin-memo-items') || '[]')
    stats.push({ label: '备忘', value: Array.isArray(memos) ? memos.length : 0, navPage: 'workbench' })
  } catch {
    stats.push({ label: '备忘', value: 0 })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const plans = JSON.parse(localStorage.getItem('coyin-today-plans') || '[]')
    const todayPlans = Array.isArray(plans) ? plans.filter((p: { date?: string }) => p.date === today) : []
    const done = todayPlans.filter((p: { status?: string }) => p.status === 'done').length
    stats.push({ label: '今日计划', value: todayPlans.length, navPage: 'workbench' })
    stats.push({ label: '已完成', value: done, navPage: 'workbench' })
  } catch {
    stats.push({ label: '今日计划', value: 0 })
    stats.push({ label: '已完成', value: 0 })
  }

  try {
    const focus = JSON.parse(localStorage.getItem('coyin-focus-active') || 'null')
    stats.push({ label: '专注', value: focus ? '进行中' : '空闲', navPage: 'workbench' })
  } catch {
    stats.push({ label: '专注', value: '空闲' })
  }

  try {
    const lib = JSON.parse(localStorage.getItem('coyin-library-items') || '[]')
    stats.push({ label: '阅读库', value: Array.isArray(lib) ? lib.length : 0, navPage: 'library' })
  } catch {
    stats.push({ label: '阅读库', value: 0 })
  }

  try {
    const docs = JSON.parse(localStorage.getItem('coyin-writing-documents') || '[]')
    stats.push({ label: '写作文档', value: Array.isArray(docs) ? docs.length : 0, navPage: 'writing' })
  } catch {
    stats.push({ label: '写作文档', value: 0 })
  }

  try {
    const sessions = JSON.parse(localStorage.getItem('coyin-chat-sessions') || '[]')
    stats.push({ label: 'AI 会话', value: Array.isArray(sessions) ? sessions.length : 0, navPage: 'workbench' })
  } catch {
    stats.push({ label: 'AI 会话', value: 0 })
  }

  return stats
}
