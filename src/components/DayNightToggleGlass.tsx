import { useState } from 'react'
import { GlassSurface } from './GlassSurface'

type DayNightToggleGlassProps = {
  theme: 'light' | 'dark'
  onToggle: () => void
}

export function DayNightToggleGlass({ theme, onToggle }: DayNightToggleGlassProps) {
  const [pressed, setPressed] = useState(false)

  return (
    <GlassSurface
      className="theme-toggle-glass"
      contentClassName="theme-toggle-shell"
      theme={theme}
      radius={22}
      elasticity={1.02}
      onClick={onToggle}
      style={{
        opacity: pressed ? 0.98 : 1,
      }}
    >
      <button
        type="button"
        className={`day-night-toggle ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
        aria-label="主题切换"
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
      >
        <span className="toggle-sky" />
        <span className="toggle-sky toggle-sky-mid" />
        <span className="toggle-sky toggle-sky-far" />

        <span className="toggle-knob">
          <span className="toggle-crater toggle-crater-1" />
          <span className="toggle-crater toggle-crater-2" />
          <span className="toggle-crater toggle-crater-3" />
        </span>

        <span className="toggle-cloud toggle-cloud-back">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="toggle-cloud toggle-cloud-front">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>

        <span className="toggle-stars">
          <span className="toggle-star big" />
          <span className="toggle-star big" />
          <span className="toggle-star medium" />
          <span className="toggle-star medium" />
          <span className="toggle-star small" />
          <span className="toggle-star small" />
        </span>
      </button>
    </GlassSurface>
  )
}
