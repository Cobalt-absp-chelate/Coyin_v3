import { useEffect, useRef, useState } from 'react'
import type { ActiveFocusSession, FocusCategory } from '../types/focus'
import { FOCUS_CATEGORIES } from '../types/focus'
import {
  completeFocus,
  formatDuration,
  pauseFocus,
  resumeFocus,
} from '../services/focusService'
import { GlassSurface } from './GlassSurface'

type FocusCapsuleProps = {
  session: ActiveFocusSession
  theme: 'light' | 'dark'
  onUpdate: (session: ActiveFocusSession | null) => void
  onComplete: (planId: string, category: FocusCategory) => void
}

function CategoryDropdown({
  value,
  onChange,
  theme,
}: {
  value: FocusCategory
  onChange: (v: FocusCategory) => void
  theme: 'light' | 'dark'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handle)
    return () => document.removeEventListener('pointerdown', handle)
  }, [open])

  const current = FOCUS_CATEGORIES.find((c) => c.value === value)

  return (
    <div className="focus-category-selector" ref={ref}>
      <GlassSurface
        className="focus-cat-glass"
        contentClassName="focus-cat-content"
        theme={theme}
        radius={8}
        elasticity={0.9}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="focus-cat-label">{current?.label}</span>
        <span className="focus-cat-arrow">▾</span>
      </GlassSurface>
      {open && (
        <div className="focus-category-panel">
          {FOCUS_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              className={`focus-category-item${c.value === value ? ' is-active' : ''}`}
              onClick={() => { onChange(c.value); setOpen(false) }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function FocusCapsule({ session, theme, onUpdate, onComplete }: FocusCapsuleProps) {
  const [expanded, setExpanded] = useState(false)
  const [immersive, setImmersion] = useState(false)
  const [category, setCategory] = useState<FocusCategory>('study')
  const [tick, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  // Reset tick when resuming from pause so elapsed doesn't jump
  useEffect(() => {
    if (session.status === 'running') setTick(0)
  }, [session.status])

  const elapsed = (() => {
    if (session.status === 'paused') return session.elapsedMs
    return session.elapsedMs + tick * 1000
  })()

  const handlePause = () => onUpdate(pauseFocus(session))
  const handleResume = () => onUpdate(resumeFocus(session))
  const handleComplete = () => {
    completeFocus(session, category)
    onComplete(session.planId, category)
    onUpdate(null)
  }

  if (immersive) {
    return (
      <div className="focus-immersive-overlay">
        <div className="focus-immersive-bg" />
        <div className="focus-immersive-glow" />
        <div className="focus-immersive-content">
          <h2 className="focus-immersive-title">{session.title}</h2>
          <div className="focus-immersive-timer">{formatDuration(elapsed)}</div>
          <div className="focus-immersive-controls">
            {session.status === 'running' ? (
              <GlassSurface className="focus-btn-glass" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={handlePause}>
                <span>暂停</span>
              </GlassSurface>
            ) : (
              <GlassSurface className="focus-btn-glass" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={handleResume}>
                <span>继续</span>
              </GlassSurface>
            )}
            <GlassSurface className="focus-btn-glass" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={() => { setImmersion(false); setExpanded(true); }}>
              <span>完成</span>
            </GlassSurface>
            <GlassSurface className="focus-btn-glass focus-btn-glass-exit" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={() => setImmersion(false)}>
              <span>退出沉浸</span>
            </GlassSurface>
          </div>
        </div>
      </div>
    )
  }

  if (expanded) {
    return (
      <div className="focus-panel">
        <div className="focus-panel-header">
          <span className="focus-panel-dot" />
          <span className="focus-panel-label">专注中</span>
          <button type="button" className="focus-panel-close" onClick={() => setExpanded(false)}>×</button>
        </div>
        <h3 className="focus-panel-title">{session.title}</h3>
        <div className="focus-panel-timer">{formatDuration(elapsed)}</div>
        <div className="focus-panel-controls">
          {session.status === 'running' ? (
            <GlassSurface className="focus-btn-glass" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={handlePause}>
              <span>暂停</span>
            </GlassSurface>
          ) : (
            <GlassSurface className="focus-btn-glass" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={handleResume}>
              <span>继续</span>
            </GlassSurface>
          )}
          <GlassSurface className="focus-btn-glass focus-btn-glass-accent" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={() => setImmersion(true)}>
            <span>沉浸模式</span>
          </GlassSurface>
        </div>
        <div className="focus-panel-complete-section">
          <label className="focus-category-label">
            <span>分类</span>
            <CategoryDropdown value={category} onChange={setCategory} theme={theme} />
          </label>
          <div className="focus-panel-finish-actions">
            <GlassSurface className="focus-btn-glass focus-btn-glass-good" contentClassName="focus-btn-content" theme={theme} radius={12} elasticity={0.9} onClick={handleComplete}>
              <span>完成任务</span>
            </GlassSurface>
          </div>
        </div>
      </div>
    )
  }

  return (
    <GlassSurface
      className="focus-capsule-glass"
      contentClassName="focus-capsule-content"
      theme={theme}
      radius={999}
      elasticity={0.85}
      onClick={() => setExpanded(true)}
    >
      <span className="focus-capsule-dot" />
      <span className="focus-capsule-title">{session.title}</span>
      <span className="focus-capsule-timer">{formatDuration(elapsed)}</span>
    </GlassSurface>
  )
}
