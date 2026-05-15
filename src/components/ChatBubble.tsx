import type { ChatMessage } from '../types/chat'
import { ThinkingBlock } from './ThinkingBlock'
import { renderMarkdown } from '../services/markdown'

type ChatBubbleProps = {
  message: ChatMessage
  isStreaming?: boolean
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function ChatBubble({ message, isStreaming }: ChatBubbleProps) {
  const isUser = message.role === 'user'

  const contentHtml = isUser
    ? null
    : message.content
      ? renderMarkdown(message.content)
      : null

  return (
    <div className={`chat-bubble ${isUser ? 'is-user' : 'is-assistant'}`}>
      <div className="chat-bubble-avatar">
        {isUser ? 'U' : 'AI'}
      </div>
      <div className="chat-bubble-body">
        {!isUser && message.thinking && (
          <ThinkingBlock
            thinking={message.thinking}
            isStreaming={isStreaming && !message.content}
          />
        )}
        <div className="chat-bubble-content">
          {isUser ? (
            message.content || '…'
          ) : contentHtml ? (
            <span dangerouslySetInnerHTML={{ __html: contentHtml }} />
          ) : isStreaming ? (
            <span className="chat-cursor" />
          ) : (
            '…'
          )}
        </div>
        <div className="chat-bubble-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  )
}
