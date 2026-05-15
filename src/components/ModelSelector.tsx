import { useCallback, useEffect, useRef, useState } from 'react'

type ModelSelectorProps = {
  currentModel: string
  modelsList: string[]
  demoMode: boolean
  onSelect: (model: string) => void
  className?: string
}

export function ModelSelector({ currentModel, modelsList, demoMode, onSelect, className = '' }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const displayLabel = currentModel || (demoMode ? 'Demo' : '选择模型')

  const filtered = filter.trim()
    ? modelsList.filter((m) => m.toLowerCase().includes(filter.toLowerCase()))
    : modelsList

  const handleSelect = useCallback((model: string) => {
    onSelect(model)
    setOpen(false)
    setFilter('')
  }, [onSelect])

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setFilter('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className={`model-selector ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className={`model-selector-trigger ${currentModel ? 'has-model' : 'no-model'}`}
        onClick={() => setOpen((v) => !v)}
        title={displayLabel}
      >
        <span className="model-selector-label">{displayLabel}</span>
        <svg width="10" height="10" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1L5 5L9 1" />
        </svg>
      </button>

      {open && (
        <div className="model-selector-panel" ref={panelRef}>
          {modelsList.length > 0 && (
            <input
              className="model-selector-filter"
              type="text"
              placeholder="搜索模型..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
          )}
          <div className="model-selector-list">
            {filtered.length > 0 ? (
              filtered.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`model-selector-item ${m === currentModel ? 'is-active' : ''}`}
                  onClick={() => handleSelect(m)}
                >
                  {m}
                </button>
              ))
            ) : (
              <p className="model-selector-empty">
                {modelsList.length === 0 ? '暂无模型，请先获取模型列表' : '无匹配模型'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
