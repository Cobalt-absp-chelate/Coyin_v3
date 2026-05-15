import { useState } from 'react'

type ThinkingBlockProps = {
  thinking: string
  isStreaming?: boolean
}

export function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)

  if (!thinking) return null

  return (
    <div className="thinking-block">
      <button
        type="button"
        className="thinking-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`thinking-chevron ${expanded ? 'is-open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>思考过程{isStreaming ? '…' : ''}</span>
      </button>
      <div
        className={`thinking-body ${expanded ? 'is-expanded' : ''}`}
      >
        <div className="thinking-content">{thinking}</div>
      </div>
    </div>
  )
}
