import type { CSSProperties, ReactNode } from 'react'
import LiquidGlass from '../vendor/liquid-glass'

const SHARED_GLASS_CONFIG = {
  mode: 'standard' as const,
  displacementScale: 76,
  blurAmount: 0.034,
  saturation: 120,
  aberrationIntensity: 0.48,
  disableRefraction: true,
}

type GlassSurfaceProps = {
  children: ReactNode
  className?: string
  contentClassName?: string
  radius?: number
  active?: boolean
  onClick?: () => void
  theme?: 'light' | 'dark'
  elasticity?: number
  overLight?: boolean
  style?: CSSProperties
}

export function GlassSurface({
  children,
  className = '',
  contentClassName = '',
  radius = 24,
  active = false,
  onClick,
  elasticity = 0.72,
  overLight = false,
  style,
}: GlassSurfaceProps) {
  return (
    <div className={`glass-host ${className}`} style={style}>
      <LiquidGlass
        displacementScale={SHARED_GLASS_CONFIG.displacementScale}
        blurAmount={SHARED_GLASS_CONFIG.blurAmount}
        saturation={SHARED_GLASS_CONFIG.saturation}
        aberrationIntensity={SHARED_GLASS_CONFIG.aberrationIntensity}
        elasticity={elasticity}
        disableRefraction={SHARED_GLASS_CONFIG.disableRefraction}
        cornerRadius={radius}
        overLight={overLight}
        mode={SHARED_GLASS_CONFIG.mode}
        padding="0"
        onClick={onClick}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
        }}
      >
        <div className={`glass-content ${active ? 'is-selected' : ''} ${contentClassName}`}>
          {children}
        </div>
      </LiquidGlass>
    </div>
  )
}
