import { useCallback, useEffect, useRef, useState } from 'react'
import type { EyeState, PetSettings } from '../types/pet'
import { PetSpeechBubble } from './PetSpeechBubble'
import { PetContextMenu } from './PetContextMenu'

const MOVE_SPEED = 0.04
const SNAP_THRESHOLD = 60
const EDGE_MARGIN = 100
const BLINK_INTERVAL_MIN = 2500
const BLINK_INTERVAL_MAX = 5500
const BLINK_DURATION = 180
const MOUSE_RESUME_DELAY = 800
const IDLE_CHANCE = 0.4
const IDLE_MIN_MS = 2000
const IDLE_MAX_MS = 5000
const DIRECTION_CHANGE_MIN = 4000
const DIRECTION_CHANGE_MAX = 8000

interface PetOrbProps {
  settings: PetSettings
  containerRef: React.RefObject<HTMLDivElement | null>
  onContextMenu: (x: number, y: number, paused: boolean) => void
  onClickOrb: () => void
  onSpeak: () => void
  onToggleMute: () => void
  onChat: () => void
  speechLine: string | null
  showSpeech: boolean
}

type MovePhase = 'wandering' | 'idling' | 'mouse-near' | 'dragging' | 'menu-paused'
type PeekEdge = 'left' | 'right' | 'top' | 'bottom'

export function PetOrb({
  settings,
  containerRef,
  onContextMenu,
  onClickOrb,
  onSpeak,
  onToggleMute,
  onChat,
  speechLine,
  showSpeech,
}: PetOrbProps) {
  const [pos, setPos] = useState({ x: 200, y: 200 })
  const [eyeState, setEyeState] = useState<EyeState>('default')
  const [blinking, setBlinking] = useState(false)
  const [winking, setWinking] = useState(false)
  const [lookAngle, setLookAngle] = useState(0)
  const [, setMoveAngle] = useState(0)
  const [peekEdge, setPeekEdge] = useState<PeekEdge | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const posRef = useRef({ x: 200, y: 200 })
  const velocityRef = useRef({ vx: 0.03, vy: 0.02 })
  const eyeStateRef = useRef<EyeState>('default')
  const draggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragStartPosRef = useRef({ x: 0, y: 0 })
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animFrameRef = useRef<number>(0)
  const mouseRef = useRef({ x: 0, y: 0 })
  const containerSizeRef = useRef({ w: 800, h: 600 })
  const containerRectRef = useRef({ left: 0, top: 0, w: 800, h: 600 })
  const lastMoveTimeRef = useRef(Date.now())
  const isMovingRef = useRef(true)
  const moveAngleRef = useRef(0)
  const targetAngleRef = useRef(0.5)
  const phaseRef = useRef<MovePhase>('wandering')
  const lastPhaseForEyeRef = useRef<MovePhase>('wandering')
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouseLeftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const changeDirTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peekEdgeRef = useRef<PeekEdge | null>(null)
  const peekHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragReleaseTimeRef = useRef(0)

  const size = settings.orbSize

  const randomDir = useCallback(() => {
    const a = Math.random() * Math.PI * 2
    velocityRef.current = {
      vx: Math.cos(a) * MOVE_SPEED,
      vy: Math.sin(a) * MOVE_SPEED,
    }
    targetAngleRef.current = a
  }, [])

  const stopMovement = useCallback(() => {
    velocityRef.current = { vx: 0, vy: 0 }
    lastMoveTimeRef.current = 0
    isMovingRef.current = false
  }, [])

  const updateEyeState = useCallback((phase: MovePhase) => {
    let next: EyeState
    if (phase === 'dragging') {
      next = 'surprised'
    } else if (phase === 'menu-paused') {
      next = 'happy'
    } else if (phase === 'idling') {
      next = 'default'
    } else if (phase === 'mouse-near') {
      next = 'curious'
    } else if (phase === 'wandering') {
      next = isMovingRef.current ? 'moving' : 'default'
    } else {
      next = 'default'
    }
    if (next !== eyeStateRef.current) {
      eyeStateRef.current = next
      setEyeState(next)
    }
  }, [])

  // ── Blink / Wink loop ──
  const scheduleBlink = useCallback(() => {
    if (!settings.autoBlink) return
    const delay = BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN)
    blinkTimerRef.current = setTimeout(() => {
      if (eyeStateRef.current !== 'surprised' && eyeStateRef.current !== 'happy' && eyeStateRef.current !== 'scared') {
        if (Math.random() < 0.3) {
          // Wink instead of full blink
          setWinking(true)
          setTimeout(() => {
            setWinking(false)
            scheduleBlink()
          }, BLINK_DURATION)
        } else {
          setBlinking(true)
          setTimeout(() => {
            setBlinking(false)
            scheduleBlink()
          }, BLINK_DURATION)
        }
      } else {
        scheduleBlink()
      }
    }, delay)
  }, [settings.autoBlink])

  useEffect(() => {
    if (settings.autoBlink) {
      scheduleBlink()
    } else {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current)
      setBlinking(false)
    }
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current)
    }
  }, [settings.autoBlink, scheduleBlink])

  // ── Idle / direction change scheduling ──
  const scheduleNextAction = useCallback(() => {
    if (changeDirTimerRef.current) clearTimeout(changeDirTimerRef.current)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)

    if (!settings.autoWander || phaseRef.current !== 'wandering') return

    const delay = DIRECTION_CHANGE_MIN + Math.random() * (DIRECTION_CHANGE_MAX - DIRECTION_CHANGE_MIN)
    changeDirTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'wandering' || draggingRef.current) return

      // Chance to go idle
      if (Math.random() < IDLE_CHANCE) {
        phaseRef.current = 'idling'
        stopMovement()
        updateEyeState('idling')
        const idleDuration = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS)
        idleTimerRef.current = setTimeout(() => {
          if (phaseRef.current === 'idling') {
            phaseRef.current = 'wandering'
            randomDir()
            lastMoveTimeRef.current = Date.now()
            isMovingRef.current = true
            updateEyeState('wandering')
            scheduleNextAction()
          }
        }, idleDuration)
      } else {
        randomDir()
        lastMoveTimeRef.current = Date.now()
        isMovingRef.current = true
        updateEyeState('wandering')
        scheduleNextAction()
      }
    }, delay)
  }, [settings.autoWander, randomDir, stopMovement, updateEyeState])

  useEffect(() => {
    if (!settings.autoWander) return
    scheduleNextAction()
    return () => {
      if (changeDirTimerRef.current) clearTimeout(changeDirTimerRef.current)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [settings.autoWander, scheduleNextAction])

  // ── Track mouse ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  // ── Main animation loop ──
  useEffect(() => {
    let prevTime = performance.now()

    const loop = (now: number) => {
      const dt = Math.min(now - prevTime, 50)
      prevTime = now

      const container = containerRef.current
      if (container) {
        const r = container.getBoundingClientRect()
        containerSizeRef.current = { w: r.width, h: r.height }
        containerRectRef.current = { left: r.left, top: r.top, w: r.width, h: r.height }
      }

      const { w, h } = containerSizeRef.current
      const cr = containerRectRef.current
      const p = posRef.current
      const v = velocityRef.current
      const phase = phaseRef.current

      // Compute orb screen position once per frame
      const orbScreenX = cr.left + p.x
      const orbScreenY = cr.top + p.y

      if (phase === 'wandering' && !draggingRef.current && settings.autoWander) {
        p.x += v.vx * dt
        p.y += v.vy * dt

        // Edge bounce with soft turn
        const margin = EDGE_MARGIN
        if (p.x < margin) {
          p.x = margin
          v.vx = Math.abs(v.vx)
          randomDir()
          scheduleNextAction()
        } else if (p.x > w - margin) {
          p.x = w - margin
          v.vx = -Math.abs(v.vx)
          randomDir()
          scheduleNextAction()
        }
        if (p.y < margin) {
          p.y = margin
          v.vy = Math.abs(v.vy)
          randomDir()
          scheduleNextAction()
        } else if (p.y > h - margin) {
          p.y = h - margin
          v.vy = -Math.abs(v.vy)
          randomDir()
          scheduleNextAction()
        }

        if (Math.abs(v.vx) > 0.001 || Math.abs(v.vy) > 0.001) {
          targetAngleRef.current = Math.atan2(v.vy, v.vx)
          isMovingRef.current = true
          lastMoveTimeRef.current = now
        }

        // Mouse proximity check - stop when cursor is near the orb
        const mx = mouseRef.current.x
        const my = mouseRef.current.y
        const distToMouse = Math.sqrt((mx - orbScreenX) ** 2 + (my - orbScreenY) ** 2)
        const stopThreshold = size * 1.6

        if (distToMouse < stopThreshold) {
          phaseRef.current = 'mouse-near'
          stopMovement()
          updateEyeState('mouse-near')
          if (mouseLeftTimerRef.current) clearTimeout(mouseLeftTimerRef.current)
        }
      }

      // Resume from mouse-near when mouse moves away
      if (phase === 'mouse-near' && !draggingRef.current) {
        const mx = mouseRef.current.x
        const my = mouseRef.current.y
        const distToMouse = Math.sqrt((mx - orbScreenX) ** 2 + (my - orbScreenY) ** 2)

        if (distToMouse >= size * 2.2) {
          if (!mouseLeftTimerRef.current) {
            mouseLeftTimerRef.current = setTimeout(() => {
              if (phaseRef.current === 'mouse-near') {
                phaseRef.current = 'wandering'
                randomDir()
                lastMoveTimeRef.current = Date.now()
                isMovingRef.current = true
                updateEyeState('wandering')
                scheduleNextAction()
              }
              mouseLeftTimerRef.current = null
            }, MOUSE_RESUME_DELAY)
          }
        } else {
          if (mouseLeftTimerRef.current) {
            clearTimeout(mouseLeftTimerRef.current)
            mouseLeftTimerRef.current = null
          }
        }
      }

      // Smooth angle transition
      const angleDiff = targetAngleRef.current - moveAngleRef.current
      const smoothDiff = ((angleDiff + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      moveAngleRef.current += smoothDiff * 0.06
      setMoveAngle(moveAngleRef.current)

      if (now - lastMoveTimeRef.current > 600) {
        isMovingRef.current = false
      }

      // Only update eye state when phase changes (not every frame)
      if (phaseRef.current !== lastPhaseForEyeRef.current) {
        lastPhaseForEyeRef.current = phaseRef.current
        updateEyeState(phaseRef.current)
      } else if (phaseRef.current === 'wandering') {
        // Update moving vs stopped within wandering
        const wanted: EyeState = isMovingRef.current ? 'moving' : 'default'
        if (wanted !== eyeStateRef.current) {
          eyeStateRef.current = wanted
          setEyeState(wanted)
        }
      }

      // Mouse look for eyes
      const isPeeking = peekEdgeRef.current !== null
      if ((settings.watchMouse || isPeeking) && !draggingRef.current && !isMovingRef.current && phaseRef.current !== 'menu-paused') {
        const containerLeft = container?.getBoundingClientRect().left ?? 0
        const containerTop = container?.getBoundingClientRect().top ?? 0
        const orbCenterX = containerLeft + p.x
        const orbCenterY = containerTop + p.y
        const dx = mouseRef.current.x - orbCenterX
        const dy = mouseRef.current.y - orbCenterY
        const dist = Math.sqrt(dx * dx + dy * dy)
        // When peeking, always track; otherwise only within range
        if (isPeeking || (dist < 250 && dist > 0)) {
          setLookAngle(Math.atan2(dy, dx))
        } else {
          setLookAngle(0)
        }
      } else if (isMovingRef.current) {
        // During movement, eyes look in movement direction
        setLookAngle(moveAngleRef.current)
      } else {
        setLookAngle(0)
      }

      setPos({ ...p })
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [settings.autoWander, settings.watchMouse, containerRef, updateEyeState, randomDir, stopMovement, scheduleNextAction, size])

  // ── Mouse event handlers ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return
    e.preventDefault()
    phaseRef.current = 'dragging'
    draggingRef.current = true
    setIsDragging(true)
    dragStartPosRef.current = { ...posRef.current }
    // Offset from orb CENTER (pos is center due to translate(-50%,-50%))
    const cr = containerRef.current?.getBoundingClientRect()
    const orbCenterScreenX = (cr?.left ?? 0) + posRef.current.x
    const orbCenterScreenY = (cr?.top ?? 0) + posRef.current.y
    dragOffsetRef.current = {
      x: e.clientX - orbCenterScreenX,
      y: e.clientY - orbCenterScreenY,
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (changeDirTimerRef.current) clearTimeout(changeDirTimerRef.current)
    if (mouseLeftTimerRef.current) clearTimeout(mouseLeftTimerRef.current)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const container = containerRef.current
      if (!container) return
      const r = container.getBoundingClientRect()
      const x = e.clientX - r.left - dragOffsetRef.current.x
      const y = e.clientY - r.top - dragOffsetRef.current.y
      posRef.current = { x, y }
      setPos({ x, y })
    }
    const handleMouseUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      setIsDragging(false)
      dragReleaseTimeRef.current = Date.now()

      if (settings.allowSnap) {
        const container = containerRef.current
        if (!container) return
        const r = container.getBoundingClientRect()
        const p = posRef.current
        const distLeft = p.x
        const distRight = r.width - p.x
        const distTop = p.y
        const distBottom = r.height - p.y
        const minDist = Math.min(distLeft, distRight, distTop, distBottom)

        if (minDist < SNAP_THRESHOLD) {
          let edge: PeekEdge
          if (minDist === distLeft) { p.x = 8; edge = 'left' }
          else if (minDist === distRight) { p.x = r.width - 8; edge = 'right' }
          else if (minDist === distTop) { p.y = 8; edge = 'top' }
          else { p.y = r.height - 8; edge = 'bottom' }
          phaseRef.current = 'idling'
          stopMovement()
          updateEyeState('idling')
          setPos({ ...p })
          peekEdgeRef.current = edge
          setPeekEdge(edge)
          return
        }
      }

      peekEdgeRef.current = null
      setPeekEdge(null)
      phaseRef.current = 'wandering'
      if (settings.autoWander) {
        randomDir()
        lastMoveTimeRef.current = Date.now()
        isMovingRef.current = true
        scheduleNextAction()
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [settings.allowSnap, settings.autoWander, containerRef, randomDir, stopMovement, updateEyeState, scheduleNextAction])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const wasPaused = phaseRef.current === 'idling' || phaseRef.current === 'menu-paused' || phaseRef.current === 'mouse-near'
    phaseRef.current = 'menu-paused'
    stopMovement()
    updateEyeState('menu-paused')
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (changeDirTimerRef.current) clearTimeout(changeDirTimerRef.current)
    onContextMenu(e.clientX, e.clientY, wasPaused)
  }, [onContextMenu, stopMovement, updateEyeState])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const dx = posRef.current.x - dragStartPosRef.current.x
    const dy = posRef.current.y - dragStartPosRef.current.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return
    e.stopPropagation()
    // Briefly show loving eyes on click
    if (phaseRef.current !== 'dragging') {
      eyeStateRef.current = 'loving'
      setEyeState('loving')
      setTimeout(() => {
        if (eyeStateRef.current === 'loving') {
          updateEyeState(phaseRef.current)
        }
      }, 800)
    }
    onClickOrb()
  }, [onClickOrb, updateEyeState])

  const pauseMovement = useCallback(() => {
    phaseRef.current = 'idling'
    stopMovement()
    updateEyeState('idling')
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (changeDirTimerRef.current) clearTimeout(changeDirTimerRef.current)
    if (mouseLeftTimerRef.current) clearTimeout(mouseLeftTimerRef.current)
  }, [stopMovement, updateEyeState])

  const resumeMovement = useCallback(() => {
    // Clear peek state when resuming movement
    peekEdgeRef.current = null
    setPeekEdge(null)
    phaseRef.current = 'wandering'
    if (settings.autoWander) {
      randomDir()
      lastMoveTimeRef.current = Date.now()
      isMovingRef.current = true
      updateEyeState('wandering')
      scheduleNextAction()
    }
  }, [settings.autoWander, randomDir, updateEyeState, scheduleNextAction])

  // Hover near peeked orb un-hides it
  const handlePeekHover = useCallback(() => {
    if (!peekEdgeRef.current || draggingRef.current) return
    // Cooldown after drag release to prevent immediate un-peek
    if (Date.now() - dragReleaseTimeRef.current < 600) return
    if (peekHoverTimerRef.current) clearTimeout(peekHoverTimerRef.current)
    peekEdgeRef.current = null
    setPeekEdge(null)
    const container = containerRef.current
    if (container) {
      const r = container.getBoundingClientRect()
      if (posRef.current.x < 20) posRef.current.x = 20
      else if (posRef.current.x > r.width - 20) posRef.current.x = r.width - 20
      if (posRef.current.y < 20) posRef.current.y = 20
      else if (posRef.current.y > r.height - 20) posRef.current.y = r.height - 20
      setPos({ ...posRef.current })
    }
  }, [containerRef])

  // ── Eye rendering ──

  // Compute peek-aware eye offset so eyes look toward visible area
  const getPeekEyeOffset = () => {
    if (!peekEdge || draggingRef.current) return { x: 0, y: 0 }
    const offset = size * 0.32
    switch (peekEdge) {
      case 'left': return { x: offset, y: 0 }
      case 'right': return { x: -offset, y: 0 }
      case 'top': return { x: 0, y: offset }
      case 'bottom': return { x: 0, y: -offset }
    }
  }

  const renderEyes = () => {
    const peekOff = getPeekEyeOffset()
    const peekStyle: React.CSSProperties = (peekOff.x !== 0 || peekOff.y !== 0)
      ? { transform: `translate(${peekOff.x}px, ${peekOff.y}px)` }
      : {}

    // ── Peek eyes: two vertical ovals looking out from the edge ──
    if (peekEdge && !draggingRef.current && !blinking) {
      const px = Math.cos(lookAngle) * 2.5
      const py = Math.sin(lookAngle) * 2.5
      return (
        <div className="pet-eyes pet-eyes-peek" style={peekStyle}>
          <span className="pet-peek-eye" style={{ transform: `translate(${px}px, ${py}px)` }} />
          <span className="pet-peek-eye" style={{ transform: `translate(${px}px, ${py}px)` }} />
        </div>
      )
    }

    if (blinking) {
      return (
        <div className="pet-eyes pet-eyes-closed" style={peekStyle}>
          <span className="pet-eye-line">—</span>
          <span className="pet-eye-line">—</span>
        </div>
      )
    }

    if (winking) {
      return (
        <div className="pet-eyes pet-eyes-wink" style={peekStyle}>
          <span className="pet-eye-line">—</span>
          <span className="pet-eye-dot">•</span>
        </div>
      )
    }

    switch (eyeState) {
      case 'happy':
        return (
          <div className="pet-eyes pet-eyes-happy" style={peekStyle}>
            <span>^</span>
            <span>^</span>
          </div>
        )
      case 'closed':
        return (
          <div className="pet-eyes pet-eyes-closed" style={peekStyle}>
            <span className="pet-eye-line">—</span>
            <span className="pet-eye-line">—</span>
          </div>
        )
      case 'surprised':
        return (
          <div className="pet-eyes pet-eyes-surprised" style={peekStyle}>
            <span className="pet-eye-big-dot">●</span>
            <span className="pet-eye-big-dot">●</span>
          </div>
        )
      case 'scared':
        return (
          <div className="pet-eyes pet-eyes-scared" style={peekStyle}>
            <span>·</span>
            <span>·</span>
          </div>
        )
      case 'curious':
        return (
          <div className="pet-eyes pet-eyes-curious" style={peekStyle}>
            <span className="pet-eye-big-dot">●</span>
            <span className="pet-eye-big-dot">●</span>
          </div>
        )
      case 'sleepy':
        return (
          <div className="pet-eyes pet-eyes-sleepy" style={peekStyle}>
            <span className="pet-eye-sleepy">﹀</span>
            <span className="pet-eye-sleepy">﹀</span>
          </div>
        )
      case 'excited':
        return (
          <div className="pet-eyes pet-eyes-excited" style={peekStyle}>
            <span>☆</span>
            <span>☆</span>
          </div>
        )
      case 'dizzy':
        return (
          <div className="pet-eyes pet-eyes-dizzy" style={peekStyle}>
            <span>×</span>
            <span>×</span>
          </div>
        )
      case 'loving':
        return (
          <div className="pet-eyes pet-eyes-loving" style={peekStyle}>
            <span>♥</span>
            <span>♥</span>
          </div>
        )
      case 'thinking':
        return (
          <div className="pet-eyes pet-eyes-thinking" style={peekStyle}>
            <span className="pet-eye-thinking-l">◟</span>
            <span className="pet-eye-thinking-r">◞</span>
          </div>
        )
      case 'moving': {
        const ox = Math.cos(lookAngle) * 3.5
        const oy = Math.sin(lookAngle) * 3.5
        return (
          <div className="pet-eyes pet-eyes-moving" style={peekStyle}>
            <span
              className="pet-eye-moving-dot"
              style={{ transform: `translate(${ox}px, ${oy}px)` }}
            >•</span>
            <span
              className="pet-eye-moving-dot"
              style={{ transform: `translate(${ox}px, ${oy}px)` }}
            >•</span>
          </div>
        )
      }
      default: {
        const maxOffset = 3
        const ox = Math.cos(lookAngle) * maxOffset
        const oy = Math.sin(lookAngle) * maxOffset
        return (
          <div
            className="pet-eyes pet-eyes-default"
            style={{
              '--look-x': `${ox}px`,
              '--look-y': `${oy}px`,
              ...peekStyle,
            } as React.CSSProperties}
          >
            <span className="pet-eye-dot">•</span>
            <span className="pet-eye-dot">•</span>
          </div>
        )
      }
    }
  }

  const orbColor = settings.orbColor
  const glowColor = orbColor
  const glowIntensity = settings.glowIntensity / 100
  const isRotate = settings.colorMode === 'rotate'

  // Compute peek-aware visual position (only when actually idle/peeking)
  let visualX = pos.x
  let visualY = pos.y
  if (peekEdge && !draggingRef.current && phaseRef.current !== 'wandering') {
    const peekCenter = size * 0.12
    if (peekEdge === 'left') visualX = -(peekCenter)
    else if (peekEdge === 'right') visualX = (containerSizeRef.current.w) + peekCenter
    else if (peekEdge === 'top') visualY = -(peekCenter)
    else if (peekEdge === 'bottom') visualY = (containerSizeRef.current.h) + peekCenter
  }

  return (
    <>
      <div
        className={`pet-orb ${glowIntensity > 0.5 ? 'pet-glow-boost' : ''} ${peekEdge ? 'pet-peeking' : ''} ${isDragging ? 'is-dragging' : ''} ${isRotate ? 'pet-rotate-glow' : ''}`}
        style={{
          left: visualX,
          top: visualY,
          width: size,
          height: size,
          '--orb-color': orbColor,
          '--orb-glow': glowColor,
          '--glow-intensity': String(glowIntensity),
        } as React.CSSProperties}
        onMouseDown={(e) => {
          if (peekEdge) handlePeekHover()
          handleMouseDown(e)
        }}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        onMouseEnter={handlePeekHover}
      >
        {/* Chromatic edge ring */}
        <div className="pet-orb-chromatic" />
        {/* Outer glow ring */}
        <div className="pet-orb-glow" />
        {/* Glass body */}
        <div className="pet-orb-body">
          {settings.colorMode === 'rotate' && (
            <div className="pet-orb-rotate-fill" />
          )}
          {settings.colorMode === 'single' && (
            <div
              className="pet-orb-fill"
              style={{
                background: `radial-gradient(circle at 38% 32%, ${lightenColor(orbColor, 40)}, ${orbColor} 50%, ${darkenColor(orbColor, 30)} 100%)`,
              }}
            />
          )}
          {/* Caustic light patterns */}
          <div className="pet-orb-caustics" />
          {/* Inner highlight/shine */}
          <div className="pet-orb-highlight" />
          {/* Secondary reflection */}
          <div className="pet-orb-reflection" />
        </div>
        {/* Eyes on top */}
        <div className="pet-orb-eyes-wrap">
          {renderEyes()}
        </div>
      </div>
      {showSpeech && speechLine && (
        <PetSpeechBubble
          text={speechLine}
          orbX={pos.x}
          orbY={pos.y}
          orbSize={size}
        />
      )}
      <PetContextMenu
        onResume={resumeMovement}
        onPause={pauseMovement}
        onSpeak={onSpeak}
        onToggleMute={onToggleMute}
        onChat={onChat}
      />
    </>
  )
}

function lightenColor(hex: string, amount: number): string {
  try {
    const c = hex.replace('#', '')
    const r = Math.min(255, parseInt(c.slice(0, 2), 16) + amount)
    const g = Math.min(255, parseInt(c.slice(2, 4), 16) + amount)
    const b = Math.min(255, parseInt(c.slice(4, 6), 16) + amount)
    return `rgb(${r},${g},${b})`
  } catch { return hex }
}

function darkenColor(hex: string, amount: number): string {
  try {
    const c = hex.replace('#', '')
    const r = Math.max(0, parseInt(c.slice(0, 2), 16) - amount)
    const g = Math.max(0, parseInt(c.slice(2, 4), 16) - amount)
    const b = Math.max(0, parseInt(c.slice(4, 6), 16) - amount)
    return `rgb(${r},${g},${b})`
  } catch { return hex }
}
