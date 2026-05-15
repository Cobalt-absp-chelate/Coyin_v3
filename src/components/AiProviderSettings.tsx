import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_ANTHROPIC_CONFIG,
  DEFAULT_OPENAI_CONFIG,
  type AiAuthMethod,
  type AiProtocol,
  type AiProviderConfig,
  type AiProviderState,
} from '../types/ai'
import {
  fetchModels,
  loadConfig,
  saveConfig,
  testConnection,
  type TestResult,
} from '../services/aiProvider'
import { ModelSelector } from './ModelSelector'

const PROTOCOL_OPTIONS: { value: AiProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic Compatible' },
]

const AUTH_OPTIONS: { value: AiAuthMethod; label: string }[] = [
  { value: 'bearer', label: 'Authorization Bearer' },
  { value: 'x-api-key', label: 'x-api-key' },
  { value: 'custom', label: 'Custom Header' },
]

function toState(config: AiProviderConfig): AiProviderState {
  return { ...config, modelsLoading: false, modelsError: null }
}

function statusLabel(state: AiProviderState): string {
  if (state.demoMode) return 'Demo'
  if (!state.baseUrl || !state.apiKey) return '未配置'
  return state.enabled ? '已启用' : '已禁用'
}

function statusClass(state: AiProviderState): string {
  if (state.demoMode) return 'ai-status-demo'
  if (!state.baseUrl || !state.apiKey) return 'ai-status-none'
  return state.enabled ? 'ai-status-on' : 'ai-status-off'
}

export function AiProviderSettings() {
  const [state, setState] = useState<AiProviderState>(() => toState(loadConfig()))
  const [editing, setEditing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const update = useCallback((patch: Partial<AiProviderState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveConfig(next), 400)
      return next
    })
  }, [])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const handleProtocolChange = useCallback((protocol: AiProtocol) => {
    const defaults = protocol === 'anthropic' ? DEFAULT_ANTHROPIC_CONFIG : DEFAULT_OPENAI_CONFIG
    update({
      protocol,
      authMethod: defaults.authMethod ?? 'bearer',
      modelsPath: defaults.modelsPath ?? '/models',
      chatPath: defaults.chatPath ?? '/chat/completions',
    })
  }, [update])

  const effectiveModel = state.currentModel || state.manualModel

  const handleFetchModels = useCallback(async () => {
    setState((s) => ({ ...s, modelsLoading: true, modelsError: null }))
    const result = await fetchModels(state)
    setState((s) => {
      const next = {
        ...s,
        modelsList: result.models,
        modelsLoading: false,
        modelsError: result.error,
      }
      if (!result.error) {
        clearTimeout(saveTimer.current)
        saveConfig(next)
      }
      return next
    })
    if (!result.error) {
      setLastFetchTime(new Date().toLocaleTimeString())
    }
  }, [state])

  const handleTest = useCallback(async () => {
    setTestLoading(true)
    setTestResult(null)
    const result = await testConnection(state)
    setTestResult(result)
    setTestLoading(false)
  }, [state])

  const handleModelSelect = useCallback((model: string) => {
    update({ currentModel: model })
  }, [update])

  return (
    <article className="content-panel ai-settings-card">
      {/* ── Compact summary (default) ── */}
      <div className="ai-settings-header">
        <div className="setting-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a2 2 0 0 1-2 2h-1l1 5H7l1-5H7a2 2 0 0 1-2-2v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" />
            <circle cx="9.5" cy="9" r="1" fill="currentColor" />
            <circle cx="14.5" cy="9" r="1" fill="currentColor" />
          </svg>
        </div>
        <div className="ai-settings-header-text">
          <h2>AI 引擎</h2>
          <span className={`ai-status-badge ${statusClass(state)}`}>{statusLabel(state)}</span>
        </div>
      </div>

      <div className="ai-summary">
        <div className="ai-summary-grid">
          <div className="ai-summary-item">
            <span className="ai-summary-label">Provider</span>
            <span className="ai-summary-value">{state.name || '—'}</span>
          </div>
          <div className="ai-summary-item">
            <span className="ai-summary-label">模型</span>
            <ModelSelector
              currentModel={effectiveModel}
              modelsList={state.modelsList}
              demoMode={state.demoMode}
              onSelect={handleModelSelect}
            />
          </div>
          <div className="ai-summary-item">
            <span className="ai-summary-label">模型数量</span>
            <span className="ai-summary-value">{state.modelsList.length || '—'}</span>
          </div>
          <div className="ai-summary-item">
            <span className="ai-summary-label">最近获取</span>
            <span className="ai-summary-value">{lastFetchTime || '—'}</span>
          </div>
        </div>

        <div className="ai-summary-actions">
          <button type="button" className="ai-btn" onClick={() => setEditing((v) => !v)}>
            {editing ? '收起配置' : '编辑配置'}
          </button>
          <button
            type="button"
            className="ai-btn"
            onClick={handleFetchModels}
            disabled={state.modelsLoading || !state.baseUrl}
          >
            {state.modelsLoading ? '获取中...' : '获取模型'}
          </button>
          <button
            type="button"
            className="ai-btn"
            onClick={handleTest}
            disabled={testLoading || !state.baseUrl}
          >
            {testLoading ? '测试中...' : '测试连接'}
          </button>
        </div>

        {state.modelsError && <p className="ai-hint ai-hint-warn">{state.modelsError}</p>}
        {testResult && (
          <p className={`ai-hint ${testResult.ok ? 'ai-hint-ok' : 'ai-hint-warn'}`}>
            {testResult.message}
          </p>
        )}
      </div>

      {/* ── Expanded config ── */}
      {editing && (
        <div className="ai-config-expanded">
          <div className="ai-settings-grid">
            <label className="ai-field">
              <span className="ai-field-label">Provider 名称</span>
              <input className="ai-input" type="text" placeholder="自定义名称" value={state.name} onChange={(e) => update({ name: e.target.value })} />
            </label>

            <label className="ai-field">
              <span className="ai-field-label">协议类型</span>
              <select className="ai-select" value={state.protocol} onChange={(e) => handleProtocolChange(e.target.value as AiProtocol)}>
                {PROTOCOL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <label className="ai-field ai-field-wide">
              <span className="ai-field-label">Base URL</span>
              <input className="ai-input" type="text" placeholder="https://api.example.com/v1" value={state.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} />
            </label>

            <label className="ai-field ai-field-wide">
              <span className="ai-field-label">API Key</span>
              <input className="ai-input" type="password" placeholder="sk-..." value={state.apiKey} onChange={(e) => update({ apiKey: e.target.value })} autoComplete="off" />
            </label>

            <label className="ai-field">
              <span className="ai-field-label">认证方式</span>
              <select className="ai-select" value={state.authMethod} onChange={(e) => update({ authMethod: e.target.value as AiAuthMethod })}>
                {AUTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <div className="ai-field ai-field-row">
              <label className="ai-toggle-label">
                <input type="checkbox" checked={state.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
                <span>启用</span>
              </label>
              <label className="ai-toggle-label">
                <input type="checkbox" checked={state.demoMode} onChange={(e) => update({ demoMode: e.target.checked })} />
                <span>Demo 模式</span>
              </label>
            </div>
          </div>

          {/* Advanced (collapsed) */}
          <button type="button" className="ai-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
            <svg width="12" height="12" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ transform: showAdvanced ? 'rotate(180deg)' : undefined }}>
              <path d="M1 1L5 5L9 1" />
            </svg>
            <span>高级配置</span>
          </button>

          {showAdvanced && (
            <div className="ai-settings-grid ai-advanced-grid">
              {state.authMethod === 'custom' && (
                <label className="ai-field">
                  <span className="ai-field-label">Header 名称</span>
                  <input className="ai-input" type="text" placeholder="X-Custom-Auth" value={state.customHeaderName} onChange={(e) => update({ customHeaderName: e.target.value })} />
                </label>
              )}
              <label className="ai-field">
                <span className="ai-field-label">Models Path</span>
                <input className="ai-input" type="text" placeholder="/models" value={state.modelsPath} onChange={(e) => update({ modelsPath: e.target.value })} />
              </label>
              <label className="ai-field">
                <span className="ai-field-label">Chat Path</span>
                <input className="ai-input" type="text" placeholder="/chat/completions" value={state.chatPath} onChange={(e) => update({ chatPath: e.target.value })} />
              </label>
              <label className="ai-field ai-field-wide">
                <span className="ai-field-label">手动模型名 (fallback)</span>
                <input className="ai-input" type="text" placeholder="当列表无模型时使用" value={state.manualModel} onChange={(e) => update({ manualModel: e.target.value })} />
              </label>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
