import { useCallback, useEffect, useRef, useState } from 'react'
import type { TodayPlan } from '../types/plan'
import { extractTimePeriod } from '../services/planService'

type TodayPlanOrbitProps = {
  plans: TodayPlan[]
  onStart: (planId: string) => void
  onComplete: (planId: string) => void
  onUncomplete: (planId: string) => void
  onDelete: (planId: string) => void
}

const ORBIT_SPREAD = 220
const ORBIT_CURVE = 40
const SCALE_DECAY = 0.18
const OPACITY_DECAY = 0.28

const WHEEL_THRESHOLD = 80
const WHEEL_STEP_COOLDOWN = 120
const WHEEL_MAX_STEPS = 1

function priorityLabel(p: string): string {
  return p === 'high' ? '重要' : p === 'medium' ? '一般' : '低优'
}

function statusDotClass(s: string): string {
  return s === 'active' ? 'orbit-status-active' : s === 'done' ? 'orbit-status-done' : 'orbit-status-pending'
}

function categoryLabel(c: string): string {
  return c === 'study' ? '学习' : c === 'work' ? '工作' : c === 'life' ? '生活' : '其他'
}

export function TodayPlanOrbit({ plans, onStart, onComplete, onUncomplete, onDelete }: TodayPlanOrbitProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const wheelAccumRef = useRef(0)
  const wheelLastDirRef = useRef(0)
  const wheelLastStepRef = useRef(0)

  useEffect(() => {
    if (activeIndex >= plans.length) {
      setActiveIndex(Math.max(0, plans.length - 1))
    }
  }, [plans.length, activeIndex])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      const dir = e.deltaY > 0 ? 1 : -1

      if (dir !== wheelLastDirRef.current) {
        wheelAccumRef.current = 0
        wheelLastDirRef.current = dir
      }

      wheelAccumRef.current += e.deltaY

      const steps = Math.min(
        Math.floor(Math.abs(wheelAccumRef.current) / WHEEL_THRESHOLD),
        WHEEL_MAX_STEPS,
      )

      if (steps === 0) return
      if (now - wheelLastStepRef.current < WHEEL_STEP_COOLDOWN) return

      wheelLastStepRef.current = now
      wheelAccumRef.current = 0

      setActiveIndex((i) => {
        const next = i + dir * steps
        return Math.max(0, Math.min(next, plans.length - 1))
      })
    },
    [plans.length],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <div className="orbit-container" ref={containerRef}>
      <div className="orbit-track">
        {plans.map((plan, i) => {
          const offset = i - activeIndex
          const absOffset = Math.abs(offset)
          const tx = offset * ORBIT_SPREAD
          const ty = -Math.cos((offset / Math.max(plans.length - 1, 1)) * Math.PI) * ORBIT_CURVE + ORBIT_CURVE
          const scale = Math.max(0.5, 1 - absOffset * SCALE_DECAY)
          const opacity = Math.max(0.15, 1 - absOffset * OPACITY_DECAY)
          const zIndex = 100 - absOffset
          const isActive = offset === 0

          return (
            <div
              key={plan.id}
              className={`orbit-card ${isActive ? 'is-active' : ''} ${plan.status === 'done' ? 'is-done' : ''}`}
              style={{
                transform: `translateX(${tx}px) translateY(${ty}px) scale(${scale})`,
                opacity,
                zIndex,
              }}
              onClick={() => {
                if (!isActive) setActiveIndex(i)
              }}
            >
              <div className="orbit-card-header">
                <span className={`orbit-status-dot ${statusDotClass(plan.status)}`} />
                <span className="orbit-time">{extractTimePeriod(plan.time)}</span>
                <span className="orbit-category">{categoryLabel(plan.category)}</span>
                <span className={`orbit-priority orbit-priority-${plan.priority}`}>
                  {priorityLabel(plan.priority)}
                </span>
              </div>

              <h3 className={`orbit-card-title ${plan.status === 'done' ? 'is-done' : ''}`}>{plan.title}</h3>
              <p className="orbit-card-desc">{plan.description}</p>

              <div className="orbit-card-actions">
                <button
                  type="button"
                  className={`orbit-check-btn ${plan.status === 'done' ? 'is-checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (plan.status === 'done') {
                      onUncomplete(plan.id)
                    } else {
                      onComplete(plan.id)
                    }
                  }}
                >
                  {plan.status === 'done' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" /></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                  )}
                </button>

                {plan.status === 'done' && (
                  <span className="orbit-done-badge">已完成</span>
                )}

                {isActive && plan.status === 'pending' && (
                  <button
                    type="button"
                    className="orbit-action-btn orbit-action-start"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStart(plan.id)
                    }}
                  >
                    开始
                  </button>
                )}
                {isActive && (
                  <button
                    type="button"
                    className="orbit-action-btn orbit-action-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(plan.id)
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="orbit-indicator">
        {plans.map((_, i) => (
          <span
            key={i}
            className={`orbit-dot ${i === activeIndex ? 'is-active' : ''}`}
            onClick={() => setActiveIndex(i)}
          />
        ))}
      </div>
    </div>
  )
}
