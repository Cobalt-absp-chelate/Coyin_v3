import { useEffect, useRef, useState } from 'react'

interface PetContextMenuProps {
  onResume: () => void
  onPause: () => void
  onSpeak: () => void
  onToggleMute?: () => void
  onChat?: () => void
}

// We manage this through a module-level event system since the context menu
// needs coordinates that come from the PetOrb component

type MenuState = {
  visible: boolean
  x: number
  y: number
  paused: boolean
  muted: boolean
}

let menuState: MenuState = { visible: false, x: 0, y: 0, paused: false, muted: false }
const listeners = new Set<() => void>()

export function showPetContextMenu(x: number, y: number, paused: boolean, muted: boolean) {
  menuState = { visible: true, x, y, paused, muted }
  listeners.forEach((fn) => fn())
}

export function hidePetContextMenu() {
  menuState = { ...menuState, visible: false }
  listeners.forEach((fn) => fn())
}

export function getPetMenuState(): MenuState {
  return { ...menuState }
}

export function PetContextMenu({ onResume, onPause, onSpeak, onToggleMute, onChat }: PetContextMenuProps) {
  const [, setTick] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setTick((n) => n + 1)
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  useEffect(() => {
    if (!menuState.visible) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hidePetContextMenu()
      }
    }
    // Delay to avoid immediate close from the same right-click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [menuState.visible])

  if (!menuState.visible) return null

  return (
    <div
      ref={menuRef}
      className="pet-context-menu"
      style={{ left: menuState.x, top: menuState.y }}
    >
      <button
        className="pet-menu-item"
        onClick={() => {
          if (menuState.paused) {
            onResume()
          } else {
            onPause()
          }
          hidePetContextMenu()
        }}
      >
        {menuState.paused ? '恢复移动' : '暂停移动'}
      </button>
      <button
        className="pet-menu-item"
        onClick={() => {
          onSpeak()
          hidePetContextMenu()
        }}
      >
        立即说一句
      </button>
      {onChat && (
        <button
          className="pet-menu-item pet-menu-item-chat"
          onClick={() => {
            onChat()
            hidePetContextMenu()
          }}
        >
          和小知对话
        </button>
      )}
      <button
        className="pet-menu-item"
        onClick={() => {
          onToggleMute?.()
          hidePetContextMenu()
        }}
      >
        {menuState.muted ? '恢复发言' : '静音'}
      </button>
      <button
        className="pet-menu-item"
        onClick={() => {
          hidePetContextMenu()
        }}
      >
        关闭菜单
      </button>
    </div>
  )
}
