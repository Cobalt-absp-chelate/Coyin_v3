import { useEffect, useRef } from 'react'

type Theme = 'light' | 'dark'

type GlowParticlesProps = {
  theme: Theme
}

type Particle = {
  x: number
  y: number
  homeX: number
  homeY: number
  vx: number
  vy: number
  driftX: number
  driftY: number
  r: number
  color: string
  alpha: number
}

type PointerState = {
  x: number
  y: number
  px: number
  py: number
  active: boolean
}

const sharedMotionConfig = {
  count: 330,
  minRadius: 1.4,
  maxRadius: 3.3,
  baseSpeed: 0.13,
  friction: 0.978,
  mouseRadius: 220,
  attractStrength: 0.082,
  shockRadius: 132,
  shockPower: 4.1,
  glowBlur: 9,
  composite: 'source-over' as GlobalCompositeOperation,
}

const themes = {
  dark: {
    ...sharedMotionConfig,
    hueSaturation: 95,
    lightnessMin: 62,
    lightnessMax: 76,
    alphaMin: 0.55,
    alphaMax: 0.9,
  },
  light: {
    ...sharedMotionConfig,
    hueSaturation: 82,
    lightnessMin: 44,
    lightnessMax: 58,
    alphaMin: 0.24,
    alphaMax: 0.52,
  },
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function GlowParticles({ theme }: GlowParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const particles: Particle[] = []
    const mouse: PointerState = {
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      active: false,
    }

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0

    const config = () => themes[theme]

    const randomColor = () => {
      const t = config()
      const hue = Math.floor(Math.random() * 360)
      const lightness = randomBetween(t.lightnessMin, t.lightnessMax)
      return `hsla(${hue}, ${t.hueSaturation}%, ${lightness}%, 1)`
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const createParticle = (): Particle => {
      const t = config()
      const angle = Math.random() * Math.PI * 2
      const speed = t.baseSpeed * (0.5 + Math.random())
      const homeX = Math.random() * width
      const homeY = Math.random() * height

      return {
        x: homeX + randomBetween(-18, 18),
        y: homeY + randomBetween(-18, 18),
        homeX,
        homeY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        driftX: Math.cos(angle) * t.baseSpeed,
        driftY: Math.sin(angle) * t.baseSpeed,
        r: randomBetween(t.minRadius, t.maxRadius),
        color: randomColor(),
        alpha: randomBetween(t.alphaMin, t.alphaMax),
      }
    }

    const initParticles = () => {
      particles.length = 0
      for (let index = 0; index < config().count; index += 1) {
        particles.push(createParticle())
      }
    }

    const updateParticle = (particle: Particle) => {
      const t = config()
      particle.vx += particle.driftX * 0.015
      particle.vy += particle.driftY * 0.015

      if (mouse.active) {
        const dx = mouse.x - particle.x
        const dy = mouse.y - particle.y
        const distSq = dx * dx + dy * dy

        if (distSq < t.mouseRadius * t.mouseRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq)
          const influence = 1 - dist / t.mouseRadius
          const force = influence * influence * t.attractStrength

          particle.vx += (dx / dist) * force
          particle.vy += (dy / dist) * force
        }
      } else {
        const homeDx = particle.homeX - particle.x
        const homeDy = particle.homeY - particle.y
        particle.vx += homeDx * 0.0011
        particle.vy += homeDy * 0.0011
      }

      particle.vx *= t.friction
      particle.vy *= t.friction
      particle.x += particle.vx
      particle.y += particle.vy

      if (particle.x < -20) {
        particle.x = width + 20
      }
      if (particle.x > width + 20) {
        particle.x = -20
      }
      if (particle.y < -20) {
        particle.y = height + 20
      }
      if (particle.y > height + 20) {
        particle.y = -20
      }
    }

    const drawParticle = (particle: Particle) => {
      const t = config()
      ctx.save()
      ctx.globalAlpha = particle.alpha
      ctx.shadowBlur = t.glowBlur
      ctx.shadowColor = particle.color
      ctx.fillStyle = particle.color

      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
      ctx.fill()

      if (theme === 'light') {
        ctx.shadowBlur = 0
        ctx.globalAlpha = particle.alpha * 0.82
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, Math.max(0.8, particle.r * 0.58), 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    const applyShockwave = (x: number, y: number) => {
      const t = config()
      for (const particle of particles) {
        const dx = particle.x - x
        const dy = particle.y - y
        const distSq = dx * dx + dy * dy

        if (distSq < t.shockRadius * t.shockRadius && distSq > 0.01) {
          const dist = Math.sqrt(distSq)
          const influence = 1 - dist / t.shockRadius
          const force = influence * influence * t.shockPower

          particle.vx += (dx / dist) * force
          particle.vy += (dy / dist) * force
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = config().composite

      for (const particle of particles) {
        updateParticle(particle)
        drawParticle(particle)
      }

      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(animate)
    }

    const handleResize = () => {
      resize()
      initParticles()
    }

    const applyTrailAttraction = (fromX: number, fromY: number, toX: number, toY: number) => {
      const t = config()
      const dx = toX - fromX
      const dy = toY - fromY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(2, Math.min(10, Math.ceil(distance / 24)))
      const trailRadius = t.mouseRadius * 1.08
      const boostBase = t.attractStrength * 2.9

      for (let step = 0; step <= steps; step += 1) {
        const ratio = step / steps
        const cx = fromX + dx * ratio
        const cy = fromY + dy * ratio

        for (const particle of particles) {
          const pdx = cx - particle.x
          const pdy = cy - particle.y
          const distSq = pdx * pdx + pdy * pdy

          if (distSq < trailRadius * trailRadius && distSq > 0.01) {
            const dist = Math.sqrt(distSq)
            const influence = 1 - dist / trailRadius
            const force = influence * influence * boostBase
            particle.vx += (pdx / dist) * force
            particle.vy += (pdy / dist) * force
          }
        }
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const wasActive = mouse.active
      const prevX = wasActive ? mouse.x : event.clientX
      const prevY = wasActive ? mouse.y : event.clientY

      mouse.px = prevX
      mouse.py = prevY
      mouse.x = event.clientX
      mouse.y = event.clientY
      mouse.active = true

      applyTrailAttraction(prevX, prevY, mouse.x, mouse.y)
    }

    const handlePointerLeave = () => {
      mouse.active = false
    }

    const handleBlur = () => {
      mouse.active = false
    }

    const handlePointerDown = (event: PointerEvent) => {
      mouse.px = mouse.x
      mouse.py = mouse.y
      mouse.x = event.clientX
      mouse.y = event.clientY
      mouse.active = true
      applyShockwave(event.clientX, event.clientY)
    }

    resize()
    initParticles()
    animate()

    window.addEventListener('resize', handleResize)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [theme])

  return <canvas id="glow-particles" ref={canvasRef} aria-hidden="true" />
}
