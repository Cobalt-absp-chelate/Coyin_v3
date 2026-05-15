import { useEffect, useRef } from 'react'

type WavyLinesProps = {
  theme: 'light' | 'dark'
}

type Cursor = {
  x: number
  y: number
  vx: number
  vy: number
}

type Point = {
  x: number
  y: number
  cursor: Cursor
}

type Mouse = {
  x: number
  y: number
  lx: number
  ly: number
  sx: number
  sy: number
  v: number
  vs: number
  a: number
}

export function WavyLines({ theme }: WavyLinesProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const mouseRef = useRef<Mouse>({
    x: 0,
    y: 0,
    lx: 0,
    ly: 0,
    sx: 0,
    sy: 0,
    v: 0,
    vs: 0,
    a: 0,
  })
  const linesRef = useRef<Point[][]>([])
  const pathsRef = useRef<SVGPathElement[]>([])
  const rafRef = useRef(0)
  const boundsRef = useRef({ width: 0, height: 0, left: 0, top: 0 })

  useEffect(() => {
    const host = hostRef.current
    const svg = svgRef.current
    if (!host || !svg) {
      return
    }

    const updateMousePosition = (x: number, y: number) => {
      const bounds = boundsRef.current
      const mouse = mouseRef.current
      mouse.x = x - bounds.left
      mouse.y = y - bounds.top + window.scrollY
    }

    const setSize = () => {
      const bounds = host.getBoundingClientRect()
      boundsRef.current = bounds
      svg.style.width = `${bounds.width}px`
      svg.style.height = `${bounds.height}px`
      svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`)
    }

    const setLines = () => {
      const { width, height } = boundsRef.current

      linesRef.current = []
      for (const path of pathsRef.current) {
        path.remove()
      }
      pathsRef.current = []

      const xGap = 10
      const yGap = 32
      const oWidth = width + 200
      const oHeight = height + 30
      const totalLines = Math.ceil(oWidth / xGap)
      const totalPoints = Math.ceil(oHeight / yGap)
      const xStart = (width - xGap * totalLines) / 2
      const yStart = (height - yGap * totalPoints) / 2

      for (let i = 0; i <= totalLines; i += 1) {
        const points: Point[] = []
        for (let j = 0; j <= totalPoints; j += 1) {
          points.push({
            x: xStart + xGap * i,
            y: yStart + yGap * j,
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          })
        }
        linesRef.current.push(points)

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('fill', 'none')
        path.setAttribute('stroke-width', '1')
        path.setAttribute('stroke', theme === 'dark' ? 'rgba(119, 199, 221, 0.48)' : 'rgba(49, 136, 181, 0.26)')
        svg.appendChild(path)
        pathsRef.current.push(path)
      }
    }

    const moved = (point: Point, withCursorForce = true) => {
      const coords = {
        x: point.x + (withCursorForce ? point.cursor.x : 0),
        y: point.y + (withCursorForce ? point.cursor.y : 0),
      }

      coords.x = Math.round(coords.x * 10) / 10
      coords.y = Math.round(coords.y * 10) / 10

      return coords
    }

    const movePoints = () => {
      const lines = linesRef.current
      const mouse = mouseRef.current

      for (const points of lines) {
        for (const point of points) {
          const dx = point.x - mouse.sx
          const dy = point.y - mouse.sy
          const d = Math.hypot(dx, dy)
          const l = Math.max(175, mouse.vs)

          if (d < l) {
            const f = 1 - d / l
            point.cursor.vx += Math.cos(mouse.a) * f * mouse.vs * 0.08
            point.cursor.vy += Math.sin(mouse.a) * f * mouse.vs * 0.08
          }

          point.cursor.vx += (0 - point.cursor.x) * 0.005
          point.cursor.vy += (0 - point.cursor.y) * 0.005
          point.cursor.vx *= 0.925
          point.cursor.vy *= 0.925
          point.cursor.x += point.cursor.vx * 2
          point.cursor.y += point.cursor.vy * 2
          point.cursor.x = Math.min(100, Math.max(-100, point.cursor.x))
          point.cursor.y = Math.min(100, Math.max(-100, point.cursor.y))
        }
      }
    }

    const drawLines = () => {
      const lines = linesRef.current
      const paths = pathsRef.current

      lines.forEach((points, lineIndex) => {
        const first = moved(points[0], false)
        let d = `M ${first.x} ${first.y}`

        points.forEach((point, pointIndex) => {
          const isLast = pointIndex === points.length - 1
          const next = moved(point, !isLast)
          d += `L ${next.x} ${next.y}`
        })

        paths[lineIndex].setAttribute('d', d)
      })
    }

    const tick = () => {
      const mouse = mouseRef.current
      mouse.sx += (mouse.x - mouse.sx) * 0.1
      mouse.sy += (mouse.y - mouse.sy) * 0.1

      const dx = mouse.x - mouse.lx
      const dy = mouse.y - mouse.ly
      const distance = Math.hypot(dx, dy)

      mouse.v = distance
      mouse.vs += (distance - mouse.vs) * 0.1
      mouse.vs = Math.min(100, mouse.vs)
      mouse.lx = mouse.x
      mouse.ly = mouse.y
      mouse.a = Math.atan2(dy, dx)

      movePoints()
      drawLines()
      rafRef.current = requestAnimationFrame(tick)
    }

    const handleResize = () => {
      setSize()
      setLines()
    }

    const handleMouseMove = (event: MouseEvent) => {
      updateMousePosition(event.pageX, event.pageY)
    }

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      updateMousePosition(touch.clientX, touch.clientY)
    }

    handleResize()
    tick()

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)
    host.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      host.removeEventListener('touchmove', handleTouchMove)
    }
  }, [theme])

  return (
    <div ref={hostRef} className={`wavy-lines ${theme === 'light' ? 'is-light' : 'is-dark'}`} aria-hidden="true">
      <svg ref={svgRef} />
    </div>
  )
}
