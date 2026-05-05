import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AiProviderState } from '../types/ai'
import type { TodayPlan } from '../types/plan'
import { loadConfig, saveConfig } from '../services/aiProvider'
import { generatePlans } from '../services/planService'
import { summarizeText, generateWriting, decomposeTask } from '../services/aiActions'
import { callAI } from '../services/aiProvider'
import { ModelSelector } from './ModelSelector'

type SlashCommand = {
  id: string
  label: string
  description: string
}

const PROMPTS = [
  '今天要做些什么？',
  '想先处理哪件事？',
  '把今天的想法整理一下。',
  '先从一个计划开始。',
  '有什么需要记录的吗？',
  '写点什么，或者安排一下今天。',
  '需要我帮你梳理哪件事？',
  '从一个问题开始也可以。',
  '今天准备推进什么？',
  '把零散想法收起来。',
]

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'plan', label: '/plan', description: '创建今日计划' },
  { id: 'task', label: '/task', description: '拆解任务' },
  { id: 'memo', label: '/memo', description: '添加备忘' },
  { id: 'sum', label: '/sum', description: '总结并保存' },
  { id: 'write', label: '/write', description: '生成写作' },
]

type TaskPlanItem = { title: string; description: string; priority: string; time: string }

type ResultCard = {
  type: 'task'
  content: string
  tasks: TaskPlanItem[]
} | null

type AiInputCardProps = {
  onPlanGenerated?: (plans: TodayPlan[]) => number
  onMemoAdd?: (text: string) => void
  onWriteDocSave?: (title: string, contentHtml: string, group?: string) => string | null
  onAddTaskPlans?: (tasks: TaskPlanItem[]) => TodayPlan[]
}

function extractTitleFromSummary(text: string): string {
  const match = text.match(/##\s*标题\s*\n+(.+)/)
  if (match) return match[1].trim().replace(/^#+\s*/, '')
  const firstLine = text.split('\n')[0]
  if (firstLine && firstLine.length < 40) return firstLine.replace(/^#+\s*/, '').trim()
  return '内容总结'
}

function extractTitleFromWriting(prompt: string, html: string): string {
  const h1Match = html.match(/<h1[^>]*>(.+?)<\/h1>/i)
  if (h1Match) return h1Match[1].replace(/<[^>]*>/g, '').trim()
  const firstLine = html.replace(/<[^>]*>/g, '').split('\n')[0].trim()
  if (firstLine && firstLine.length < 50) return firstLine
  return prompt.slice(0, 30).trim() || '写作'
}

function parseTaskPlans(content: string): TaskPlanItem[] {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[1]) as TaskPlanItem[]
  } catch {
    // Fallback: parse markdown list items
    const todaySection = content.split('可加入今日计划')[1] || ''
    const items: TaskPlanItem[] = []
    const lines = todaySection.split('\n')
    for (const line of lines) {
      const m = line.match(/[-*]\s*(.+?)\s*\/\s*(high|medium|low)\s*\/\s*(.+)/i)
      if (m) {
        items.push({ title: m[1].trim(), description: m[1].trim(), priority: m[2].toLowerCase(), time: m[3].trim() })
      }
    }
    return items
  }
}

function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // List items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br/>')
  // Remove code blocks
  html = html.replace(/```[\s\S]*?```/g, '')
  // Remove JSON blocks
  html = html.replace(/\[{[\s\S]*?}\]/g, '')
  return '<p>' + html + '</p>'
}

export function AiInputCard({ onPlanGenerated, onMemoAdd, onWriteDocSave, onAddTaskPlans }: AiInputCardProps) {
  const [input, setInput] = useState('')
  const [commandIndex, setCommandIndex] = useState(0)
  const [showCommands, setShowCommands] = useState(false)
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)])
  const [config, setConfig] = useState<AiProviderState>(() => ({ ...loadConfig(), modelsLoading: false, modelsError: null }))
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackLink, setFeedbackLink] = useState<{ label: string; onClick: () => void } | null>(null)
  const [resultCard, setResultCard] = useState<ResultCard>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handler = () => setConfig({ ...loadConfig(), modelsLoading: false, modelsError: null })
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [input, resizeTextarea])

  const effectiveModel = config.currentModel || config.manualModel || (config.demoMode ? 'Demo' : '')

  const filteredCommands = useMemo(() => {
    const slashMatch = input.match(/^\/(\w*)$/)
    if (!slashMatch) return []
    const query = slashMatch[1].toLowerCase()
    return SLASH_COMMANDS.filter((c) => c.id.includes(query))
  }, [input])

  useEffect(() => {
    setShowCommands(filteredCommands.length > 0)
    setCommandIndex(0)
  }, [filteredCommands])

  const insertCommand = useCallback((cmd: SlashCommand) => {
    setInput(cmd.label + ' ')
    setShowCommands(false)
    inputRef.current?.focus()
  }, [])

  const clearFeedback = useCallback(() => {
    setTimeout(() => {
      setFeedback('')
      setFeedbackLink(null)
    }, 3000)
  }, [])

  const handleSend = useCallback(async () => {
    const value = input.trim()
    if (!value) return

    // ── /plan ──
    const planMatch = value.match(/^\/plan\s*(.*)/i)
    if (planMatch) {
      const planInput = planMatch[1].trim() || '安排今天的工作'
      setGenerating(true)
      setFeedback('')
      setInput('')
      try {
        const plans = await generatePlans(planInput)
        const added = onPlanGenerated?.(plans) ?? 0
        if (added === 0) {
          setFeedback('计划已存在，已跳过重复')
        } else {
          setFeedback(`已追加 ${added} 项计划`)
        }
      } catch {
        setFeedback('计划生成失败，请重试')
      } finally {
        setGenerating(false)
        clearFeedback()
      }
      return
    }

    // ── /memo ──
    const memoMatch = value.match(/^\/memo\s+(.*)/i)
    if (memoMatch) {
      const memoText = memoMatch[1].trim()
      if (!memoText) {
        setFeedback('请输入备忘内容')
        clearFeedback()
        return
      }
      setInput('')
      onMemoAdd?.(memoText)
      setFeedback('已添加备忘')
      clearFeedback()
      return
    }

    // ── /sum ──
    const sumMatch = value.match(/^\/sum\s+(.*)/i)
    if (sumMatch) {
      const text = sumMatch[1].trim()
      if (!text) {
        setFeedback('请输入要总结的内容')
        clearFeedback()
        return
      }
      setGenerating(true)
      setFeedback('')
      setInput('')
      try {
        const result = await summarizeText(text)
        if (result.ok) {
          const title = extractTitleFromSummary(result.text)
          const html = simpleMarkdownToHtml(result.text)
          const docId = onWriteDocSave?.(title, html, '总结') ?? null
          if (docId) {
            setFeedback('已保存到写作库')
            setFeedbackLink({ label: '打开文档', onClick: () => {
              // Store docId for navigation — parent handles via window event
              window.dispatchEvent(new CustomEvent('open-writing-doc', { detail: { docId } }))
              setFeedback('')
              setFeedbackLink(null)
            }})
          } else {
            setFeedback('已生成总结')
          }
        } else {
          setFeedback(result.text)
        }
      } catch {
        setFeedback('总结失败，请重试')
      } finally {
        setGenerating(false)
        clearFeedback()
      }
      return
    }

    // ── /write ──
    const writeMatch = value.match(/^\/write\s+(.*)/i)
    if (writeMatch) {
      const prompt = writeMatch[1].trim()
      if (!prompt) {
        setFeedback('请输入写作要求')
        clearFeedback()
        return
      }
      setGenerating(true)
      setFeedback('')
      setInput('')
      try {
        const result = await generateWriting(prompt)
        if (result.ok) {
          const title = extractTitleFromWriting(prompt, result.text)
          const docId = onWriteDocSave?.(title, result.text, '写作') ?? null
          if (docId) {
            setFeedback('已保存到写作库')
            setFeedbackLink({ label: '打开文档', onClick: () => {
              window.dispatchEvent(new CustomEvent('open-writing-doc', { detail: { docId } }))
              setFeedback('')
              setFeedbackLink(null)
            }})
          } else {
            setFeedback('已生成写作')
          }
        } else {
          setFeedback(result.text)
        }
      } catch {
        setFeedback('生成失败，请重试')
      } finally {
        setGenerating(false)
        clearFeedback()
      }
      return
    }

    // ── /task ──
    const taskMatch = value.match(/^\/task\s+(.*)/i)
    if (taskMatch) {
      const prompt = taskMatch[1].trim()
      if (!prompt) {
        setFeedback('请输入要拆解的任务')
        clearFeedback()
        return
      }
      setGenerating(true)
      setFeedback('')
      setInput('')
      try {
        const result = await decomposeTask(prompt)
        if (result.ok) {
          const tasks = parseTaskPlans(result.text)
          setResultCard({ type: 'task', content: result.text, tasks })
        } else {
          setFeedback(result.text)
          clearFeedback()
        }
      } catch {
        setFeedback('任务拆解失败，请重试')
        clearFeedback()
      } finally {
        setGenerating(false)
      }
      return
    }

    // ── No command match: generic AI chat ──
    const chatInput = value
    setInput('')
    setGenerating(true)
    setFeedback('')
    try {
      const cfg = loadConfig()
      const result = await callAI(cfg, {
        messages: [{ role: 'user', content: chatInput }],
        maxTokens: 2048,
      })
      setFeedback(result.content)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请求失败'
      setFeedback(msg)
    } finally {
      setGenerating(false)
    }
  }, [input, onPlanGenerated, onMemoAdd, onWriteDocSave, clearFeedback])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showCommands) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setCommandIndex((i) => (i + 1) % filteredCommands.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setCommandIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length)
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          insertCommand(filteredCommands[commandIndex])
        } else if (e.key === 'Escape') {
          setShowCommands(false)
        }
        return
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [showCommands, filteredCommands, commandIndex, insertCommand, handleSend],
  )

  const handleModelSelect = useCallback(
    (model: string) => {
      const updated = { ...config, currentModel: model }
      setConfig(updated)
      saveConfig(updated)
    },
    [config],
  )

  const handleAddPlansFromTask = useCallback(() => {
    if (!resultCard || resultCard.tasks.length === 0) return
    onAddTaskPlans?.(resultCard.tasks)
    setFeedback('已加入今日计划')
    clearFeedback()
  }, [resultCard, onAddTaskPlans, clearFeedback])

  const handleSaveTaskToWriting = useCallback(() => {
    if (!resultCard) return
    const title = '任务拆解'
    const html = simpleMarkdownToHtml(resultCard.content)
    const docId = onWriteDocSave?.(title, html, '任务') ?? null
    if (docId) {
      setFeedback('已保存到写作库')
      setFeedbackLink({ label: '打开文档', onClick: () => {
        window.dispatchEvent(new CustomEvent('open-writing-doc', { detail: { docId } }))
        setFeedback('')
        setFeedbackLink(null)
      }})
    }
    clearFeedback()
  }, [resultCard, onWriteDocSave, clearFeedback])

  const handleCopyTask = useCallback(() => {
    if (!resultCard) return
    navigator.clipboard.writeText(resultCard.content).then(() => {
      setFeedback('已复制')
      clearFeedback()
    }).catch(() => {})
  }, [resultCard, clearFeedback])

  return (
    <div className="ai-input-card">
      <div className="ai-input-card-prompt">{prompt}</div>
      <div className="ai-input-row">
        <textarea
          ref={inputRef}
          className="ai-input-textarea"
          value={input}
          placeholder="输入 / 使用指令"
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={generating}
        />

        <div className="ai-input-actions">
          <ModelSelector
            currentModel={effectiveModel}
            modelsList={config.modelsList ?? []}
            demoMode={config.demoMode}
            onSelect={handleModelSelect}
            className="ai-input-model"
          />
          <button
            type="button"
            className="ai-send-btn"
            onClick={() => void handleSend()}
            disabled={!input.trim() || generating}
            title="发送"
          >
            {generating ? (
              <svg className="spin-loop" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="ai-input-feedback">
          <span>{feedback}</span>
          {feedbackLink && (
            <button className="ai-feedback-link" onClick={feedbackLink.onClick}>
              {feedbackLink.label}
            </button>
          )}
        </div>
      )}

      {showCommands && (
        <div className="ai-slash-menu">
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              className={`ai-slash-item ${i === commandIndex ? 'is-active' : ''}`}
              onClick={() => insertCommand(cmd)}
              onMouseEnter={() => setCommandIndex(i)}
            >
              <span className="ai-slash-label">{cmd.label}</span>
              <span className="ai-slash-desc">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Task decomposition result card */}
      {resultCard && (
        <div className="ai-task-result-overlay" onClick={() => setResultCard(null)}>
          <div className="ai-task-result-card" onClick={(e) => e.stopPropagation()}>
            <div className="ai-task-result-header">
              <h3>任务拆解</h3>
              <button className="ai-task-result-close" onClick={() => setResultCard(null)}>×</button>
            </div>
            <div
              className="ai-task-result-body"
              dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(resultCard.content) }}
            />
            <div className="ai-task-result-actions">
              {resultCard.tasks.length > 0 && (
                <button className="ai-task-btn ai-task-btn-primary" onClick={handleAddPlansFromTask}>
                  加入今日计划
                </button>
              )}
              <button className="ai-task-btn" onClick={handleSaveTaskToWriting}>
                保存到写作库
              </button>
              <button className="ai-task-btn" onClick={handleCopyTask}>
                复制
              </button>
              <button className="ai-task-btn ai-task-btn-close" onClick={() => setResultCard(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
