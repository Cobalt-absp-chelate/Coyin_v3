import { useCallback, useEffect, useRef, useState } from 'react'
import type { PetSettings } from '../types/pet'
import { loadPetSettings, savePetSettings } from '../services/petStorageService'

const SPEAK_FREQ_OPTIONS = [
  { value: 'silent', label: '保持沉默' },
  { value: 'rare', label: '很少' },
  { value: 'moderate', label: '适度' },
] as const

const PRESET_COLORS = [
  '#68bdd3', '#f0a46a', '#a78bfa', '#f472b6',
  '#34d399', '#60a5fa', '#fb923c', '#e879f9',
]

export function PetSettingsCard() {
  const [settings, setSettings] = useState<PetSettings>(() => loadPetSettings())
  const [customLineDraft, setCustomLineDraft] = useState('')
  const [showCard, setShowCard] = useState(true)
  const [showAppearance, setShowAppearance] = useState(false)
  const [showSpeech, setShowSpeech] = useState(false)
  const [showBehavior, setShowBehavior] = useState(false)
  const settingsRef = useRef(settings)

  // Keep ref in sync and notify App of changes
  useEffect(() => {
    settingsRef.current = settings
    savePetSettings(settings)
    window.dispatchEvent(new CustomEvent('pet-settings-changed'))
  }, [settings])

  const update = useCallback((patch: Partial<PetSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const addCustomLine = useCallback(() => {
    const line = customLineDraft.trim()
    if (!line) return
    setSettings((prev) => ({ ...prev, customLines: [...prev.customLines, line] }))
    setCustomLineDraft('')
  }, [customLineDraft])

  const removeCustomLine = useCallback((idx: number) => {
    setSettings((prev) => ({ ...prev, customLines: prev.customLines.filter((_, i) => i !== idx) }))
  }, [])

  const SectionToggle = ({ expanded, label, onClick, children }: { expanded: boolean; label: string; onClick: () => void; children?: React.ReactNode }) => (
    <button type="button" className="ai-advanced-toggle" onClick={onClick}>
      <svg width="12" height="12" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ transform: expanded ? 'rotate(180deg)' : undefined }}>
        <path d="M1 1L5 5L9 1" />
      </svg>
      <span>{label}</span>
      {children}
    </button>
  )

  const cardSummary = [
    settings.enabled ? '已启用' : '已禁用',
    `${settings.orbSize}px`,
    settings.colorMode === 'rotate' ? '多色' : '单色',
    settings.allowSpeech ? (SPEAK_FREQ_OPTIONS.find(o => o.value === settings.speakFrequency)?.label ?? '') : '静默',
    settings.aiSpeechEnabled ? 'AI发言' : '',
  ].filter(Boolean).join(' · ')

  return (
    <article className="content-panel pet-settings-card">
      <button
        className="pet-settings-card-toggle"
        onClick={() => setShowCard((v) => !v)}
        type="button"
      >
        <div className="pet-settings-header">
          <div className="setting-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="9" cy="9" r="1.5" fill="currentColor" />
              <circle cx="15" cy="9" r="1.5" fill="currentColor" />
              <path d="M8 14c0 0 1.5 2 4 2s4-2 4-2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <h2>桌宠设置</h2>
            <p>配置桌宠小球外观与行为</p>
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 10 6" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round"
          style={{ transform: showCard ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', flexShrink: 0, marginRight: 4 }}
        >
          <path d="M1 1L5 5L9 1" />
        </svg>
      </button>

      {!showCard && (
        <span className="pet-section-summary" style={{ paddingLeft: 54 }}>{cardSummary}</span>
      )}

      {showCard && (
        <>
          {/* ── Basic (always visible) ── */}
          <div className="pet-settings-section">
            <h3 className="pet-settings-section-title">基础设置</h3>
            <div className="pet-settings-row">
              <label className="ai-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => update({ enabled: e.target.checked })}
                />
                <span>显示桌宠小球</span>
              </label>
            </div>
            <label className="ai-field">
              <span className="ai-field-label">用户名</span>
              <input
                className="ai-input"
                type="text"
                placeholder="你的名字"
                value={settings.userName}
                onChange={(e) => update({ userName: e.target.value })}
              />
            </label>
          </div>

          {/* ── Appearance (collapsible) ── */}
          <div className="pet-settings-section">
            <SectionToggle expanded={showAppearance} label="外观设置" onClick={() => setShowAppearance((v) => !v)}>
              {!showAppearance && (
                <span className="pet-section-summary">
                  {settings.orbSize}px · {settings.colorMode === 'rotate' ? '多色轮转' : '单色'} · 发光{settings.glowIntensity}%
                </span>
              )}
            </SectionToggle>
            {showAppearance && (
              <div className="pet-settings-expanded">
                <div className="pet-settings-row">
                  <label className="ai-field">
                    <span className="ai-field-label">小球大小</span>
                    <input
                      className="ai-input"
                      type="range"
                      min={32}
                      max={80}
                      value={settings.orbSize}
                      onChange={(e) => update({ orbSize: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{settings.orbSize}px</span>
                  </label>
                </div>
                <div className="pet-settings-row">
                  <label className="ai-toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.colorMode === 'rotate'}
                      onChange={(e) => update({ colorMode: e.target.checked ? 'rotate' : 'single' })}
                    />
                    <span>多颜色轮转</span>
                  </label>
                </div>
                {settings.colorMode === 'single' && (
                  <div className="pet-color-picker">
                    <span className="ai-field-label">主颜色</span>
                    <div className="pet-color-options">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`pet-color-swatch ${settings.orbColor === c ? 'is-active' : ''}`}
                          style={{ background: c }}
                          onClick={() => update({ orbColor: c })}
                        />
                      ))}
                      <input
                        type="color"
                        value={settings.orbColor}
                        onChange={(e) => update({ orbColor: e.target.value })}
                        className="pet-color-input"
                      />
                    </div>
                  </div>
                )}
                <div className="pet-settings-row">
                  <label className="ai-field">
                    <span className="ai-field-label">发光强度</span>
                    <input
                      className="ai-input"
                      type="range"
                      min={0}
                      max={100}
                      value={settings.glowIntensity}
                      onChange={(e) => update({ glowIntensity: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{settings.glowIntensity}%</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ── Speech (collapsible) ── */}
          <div className="pet-settings-section">
            <SectionToggle expanded={showSpeech} label="说话设置" onClick={() => setShowSpeech((v) => !v)}>
              {!showSpeech && (
                <span className="pet-section-summary">
                  {settings.allowSpeech ? SPEAK_FREQ_OPTIONS.find(o => o.value === settings.speakFrequency)?.label : '已关闭'} · {settings.customLines.length}条自定义
                </span>
              )}
            </SectionToggle>
            {showSpeech && (
              <div className="pet-settings-expanded">
                <label className="ai-toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.allowSpeech}
                    onChange={(e) => update({ allowSpeech: e.target.checked })}
                  />
                  <span>允许桌宠说话</span>
                </label>
                <label className="ai-field" style={{ marginTop: 10 }}>
                  <span className="ai-field-label">说话频率</span>
                  <select
                    className="ai-select"
                    value={settings.speakFrequency}
                    onChange={(e) => update({ speakFrequency: e.target.value as typeof settings.speakFrequency })}
                  >
                    {SPEAK_FREQ_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <div className="pet-custom-lines">
                  <span className="ai-field-label">自定义文案</span>
                  <div className="pet-custom-lines-input">
                    <input
                      className="ai-input"
                      type="text"
                      placeholder="输入一句桌宠台词..."
                      value={customLineDraft}
                      onChange={(e) => setCustomLineDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addCustomLine() }}
                      style={{ flex: 1 }}
                    />
                    <button className="ai-btn" onClick={addCustomLine}>添加</button>
                  </div>
                  {settings.customLines.length > 0 && (
                    <div className="pet-custom-lines-list">
                      {settings.customLines.map((line, i) => (
                        <div key={i} className="pet-custom-line-item">
                          <span>{line}</span>
                          <button
                            className="pet-custom-line-remove"
                            onClick={() => removeCustomLine(i)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* ── AI Speech ── */}
                <div className="pet-ai-speech-section">
                  <label className="ai-toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.aiSpeechEnabled}
                      onChange={(e) => update({ aiSpeechEnabled: e.target.checked })}
                    />
                    <span>AI 智能发言</span>
                  </label>
                  {settings.aiSpeechEnabled && (
                    <div style={{ marginTop: 8 }}>
                      <label className="ai-field">
                        <span className="ai-field-label">时间窗口（分钟）</span>
                        <input
                          className="ai-input"
                          type="range"
                          min={15}
                          max={180}
                          step={15}
                          value={settings.aiSpeechWindow}
                          onChange={(e) => update({ aiSpeechWindow: Number(e.target.value) })}
                        />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{settings.aiSpeechWindow}分钟</span>
                      </label>
                      <label className="ai-field" style={{ marginTop: 6 }}>
                        <span className="ai-field-label">发言次数</span>
                        <input
                          className="ai-input"
                          type="range"
                          min={1}
                          max={10}
                          value={settings.aiSpeechCount}
                          onChange={(e) => update({ aiSpeechCount: Number(e.target.value) })}
                        />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{settings.aiSpeechCount}次</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Behavior (collapsible) ── */}
          <div className="pet-settings-section">
            <SectionToggle expanded={showBehavior} label="行为设置" onClick={() => setShowBehavior((v) => !v)}>
              {!showBehavior && (
                <span className="pet-section-summary">
                  {[
                    settings.autoWander && '自动游走',
                    settings.allowSnap && '贴边',
                    settings.watchMouse && '看鼠标',
                    settings.autoBlink && '眨眼',
                  ].filter(Boolean).join(' · ') || '全部关闭'}
                </span>
              )}
            </SectionToggle>
            {showBehavior && (
              <div className="pet-settings-expanded">
                <div className="pet-settings-checks">
                  <label className="ai-toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.autoWander}
                      onChange={(e) => update({ autoWander: e.target.checked })}
                    />
                    <span>自动游走</span>
                  </label>
                  <label className="ai-toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.allowSnap}
                      onChange={(e) => update({ allowSnap: e.target.checked })}
                    />
                    <span>允许贴边</span>
                  </label>
                  <label className="ai-toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.watchMouse}
                      onChange={(e) => update({ watchMouse: e.target.checked })}
                    />
                    <span>看鼠标效果</span>
                  </label>
                  <label className="ai-toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.autoBlink}
                      onChange={(e) => update({ autoBlink: e.target.checked })}
                    />
                    <span>自动眨眼</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  )
}
