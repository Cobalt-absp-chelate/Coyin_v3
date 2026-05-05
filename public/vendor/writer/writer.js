(function () {
  'use strict'

  var STORAGE_KEY = 'coyin-writing-content'
  var AI_STORAGE_KEY = 'coyin-ai-provider'
  var DEFAULT_CONTENT = [
    '# 欢迎使用 知页 写作',
    '',
    '开始你的写作之旅吧。',
    '',
    '## 功能',
    '',
    '- **所见即所得** — 像 Word 一样直接编辑',
    '- **Markdown 源码** — 点击工具栏切换源码模式',
    '- **大纲导航** — 自动提取标题结构',
    '- **自动保存** — 内容实时保存到本地',
    '',
    '## 快捷键',
    '',
    '| 功能 | 快捷键 |',
    '|------|--------|',
    '| 加粗 | Ctrl+B |',
    '| 斜体 | Ctrl+I |',
    '| 撤销 | Ctrl+Z |',
    '| 重做 | Ctrl+Y |',
    '',
    '> 写作是思考的延伸。',
    ''
  ].join('\n')

  // ── Theme ──

  var theme = 'dark'
  try {
    var params = new URLSearchParams(window.location.search)
    if (params.get('theme') === 'light') theme = 'light'
  } catch (_) { /* ignore */ }

  if (theme === 'light') {
    document.body.classList.add('theme-light')
  }

  // ── Persistence ──

  function loadContent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY)
      return raw || DEFAULT_CONTENT
    } catch (_) { return DEFAULT_CONTENT }
  }

  var saveTimer = null
  var saveStatus = document.getElementById('save-status')

  function saveContent(value) {
    try { localStorage.setItem(STORAGE_KEY, value) } catch (_) { /* ignore */ }
    if (saveStatus) { saveStatus.textContent = '已保存' }
  }

  function markSaving() {
    if (saveStatus) saveStatus.textContent = '保存中...'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(function () {
      if (saveStatus) saveStatus.textContent = '已保存'
    }, 600)
  }

  // ── Toast ──

  var toastEl = document.getElementById('writer-toast')
  var toastTimer = null

  function toast(msg) {
    if (!toastEl) return
    toastEl.textContent = msg
    toastEl.classList.add('is-visible')
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible')
    }, 2500)
  }

  // ── AI Provider ──

  function loadAiConfig() {
    try {
      var raw = localStorage.getItem(AI_STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch (_) { /* ignore */ }
    return null
  }

  function buildAiHeaders(config) {
    var headers = { 'Content-Type': 'application/json' }
    if (!config.apiKey) return headers
    switch (config.authMethod) {
      case 'bearer':
        headers['Authorization'] = 'Bearer ' + config.apiKey
        break
      case 'x-api-key':
        headers['x-api-key'] = config.apiKey
        break
      case 'custom':
        if (config.customHeaderName) {
          headers[config.customHeaderName] = config.apiKey
        }
        break
    }
    return headers
  }

  function normalizeBaseUrl(url) {
    return (url || '').replace(/\/+$/, '')
  }

  function callAI(messages, opts) {
    opts = opts || {}
    var config = loadAiConfig()

    if (!config || config.demoMode) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ content: '这是一条来自 Demo 模式的模拟回复。关闭 Demo 模式并配置 AI Provider 后，将调用真实 AI 接口。', model: 'demo', usage: null })
        }, 800)
      })
    }

    if (!config.baseUrl) {
      return Promise.reject(new Error('未配置 Base URL。请在设置页面配置 AI Provider。'))
    }

    if (config.protocol === 'anthropic') {
      return Promise.reject(new Error('Writer 当前仅支持 OpenAI Compatible 协议。Anthropic 协议将在后续版本支持。'))
    }

    var model = opts.model || config.currentModel || config.manualModel
    if (!model) {
      return Promise.reject(new Error('未选择或输入模型。请在设置页面配置。'))
    }

    var url = normalizeBaseUrl(config.baseUrl) + (config.chatPath || '/chat/completions')
    var body = {
      model: model,
      messages: messages,
      temperature: opts.temperature != null ? opts.temperature : 0.7,
      max_tokens: opts.maxTokens || 1024
    }

    return fetch(url, {
      method: 'POST',
      headers: buildAiHeaders(config),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        var msg = '服务器返回错误 (' + res.status + ')'
        if (res.status === 401) msg = 'API Key 无效或已过期'
        else if (res.status === 403) msg = 'API Key 权限不足'
        else if (res.status === 429) msg = '请求频率超限，请稍后再试'
        throw new Error(msg)
      }
      return res.json()
    }).then(function (data) {
      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      if (typeof content !== 'string') {
        throw new Error('返回格式无法解析')
      }
      return { content: content, model: data.model || model, usage: data.usage || null }
    })
  }

  // ── Export ──

  var exportBtn = document.getElementById('export-btn')
  var exportMenu = document.getElementById('export-menu')
  var exportWrap = document.getElementById('export-wrap')

  if (exportBtn && exportMenu) {
    exportBtn.addEventListener('click', function (e) {
      e.stopPropagation()
      var isOpen = exportMenu.classList.contains('is-open')
      closeAllMenus()
      if (!isOpen) exportMenu.classList.add('is-open')
    })
  }

  document.getElementById('export-md-btn').addEventListener('click', function () {
    var md = getMarkdown()
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = 'document.md'
    a.click()
    URL.revokeObjectURL(url)
    closeAllMenus()
    toast('已导出 Markdown')
  })

  document.getElementById('export-pdf-btn').addEventListener('click', function () {
    closeAllMenus()
    window.print()
  })

  // ── Context menu ──

  var ctxMenu = document.getElementById('ctx-menu')
  var ctxSelection = ''

  document.addEventListener('contextmenu', function (e) {
    var editorArea = document.getElementById('vditor-container')
    if (!editorArea || !editorArea.contains(e.target)) return

    var sel = window.getSelection()
    var text = sel ? sel.toString().trim() : ''
    var hasSelection = text.length > 0

    e.preventDefault()
    ctxSelection = text
    showCtxMenu(e.clientX, e.clientY, hasSelection)
  })

  function showCtxMenu(x, y, hasSelection) {
    if (!ctxMenu) return
    closeAllMenus()

    var items = ctxMenu.querySelectorAll('.ctx-menu-item')
    for (var i = 0; i < items.length; i++) {
      var action = items[i].getAttribute('data-action')
      if (action === 'copy-sel' || action === 'translate' || action === 'polish') {
        items[i].style.display = hasSelection ? '' : 'none'
      } else if (action === 'continue') {
        items[i].style.display = ''
      }
    }

    // Clamp position to viewport
    var rect = ctxMenu.getBoundingClientRect()
    var maxX = window.innerWidth - 190
    var maxY = window.innerHeight - 200
    ctxMenu.style.left = Math.min(x, maxX) + 'px'
    ctxMenu.style.top = Math.min(y, maxY) + 'px'
    ctxMenu.classList.add('is-open')
  }

  ctxMenu.addEventListener('click', function (e) {
    var item = e.target.closest('.ctx-menu-item')
    if (!item) return
    var action = item.getAttribute('data-action')
    closeAllMenus()

    switch (action) {
      case 'translate':
        handleTranslate(ctxSelection)
        break
      case 'polish':
        handlePolish(ctxSelection)
        break
      case 'continue':
        handleContinue()
        break
      case 'copy-sel':
        copyToClipboard(ctxSelection)
        break
    }
  })

  // ── AI Card ──

  var aiCard = document.getElementById('ai-card')
  var aiCardTitle = document.getElementById('ai-card-title')
  var aiCardBody = document.getElementById('ai-card-body')
  var aiCardActions = document.getElementById('ai-card-actions')
  var aiCardClose = document.getElementById('ai-card-close')

  aiCardClose.addEventListener('click', function () {
    aiCard.classList.remove('is-open')
  })

  function showAiCard(title, body, actions) {
    aiCardTitle.textContent = title
    aiCardBody.innerHTML = ''
    aiCardActions.innerHTML = ''

    if (typeof body === 'string') {
      aiCardBody.textContent = body
    }

    if (actions && actions.length) {
      for (var i = 0; i < actions.length; i++) {
        var btn = document.createElement('button')
        btn.className = 'glass-btn'
        btn.textContent = actions[i].label
        btn.addEventListener('click', actions[i].onClick)
        aiCardActions.appendChild(btn)
      }
    }

    aiCard.classList.add('is-open')
    positionAiCard()
  }

  function showAiCardLoading(title) {
    aiCardTitle.textContent = title
    aiCardBody.innerHTML = '<div class="ai-card-loading"><div class="spinner"></div><span>AI 处理中...</span></div>'
    aiCardActions.innerHTML = ''
    aiCard.classList.add('is-open')
    positionAiCard()
  }

  function showAiCardError(title, errMsg) {
    aiCardTitle.textContent = title
    aiCardBody.innerHTML = ''
    aiCardBody.textContent = errMsg
    aiCardActions.innerHTML = ''
    aiCard.classList.add('is-open')
    positionAiCard()
  }

  function positionAiCard() {
    // Position near center-right of viewport
    aiCard.style.top = '50%'
    aiCard.style.left = '50%'
    aiCard.style.transform = 'translate(-50%, -50%)'
  }

  // ── Translate ──

  function handleTranslate(text) {
    if (!text) return
    showAiCardLoading('翻译结果')

    callAI([
      { role: 'system', content: '你是一个翻译助手。将用户输入的文本翻译成中文。只输出翻译结果，不要添加任何解释或额外内容。' },
      { role: 'user', content: text }
    ], { temperature: 0.3, maxTokens: 2048 })
      .then(function (result) {
        showAiCard('翻译结果', result.content, [
          { label: '复制', onClick: function () { copyToClipboard(result.content) } },
          { label: '关闭', onClick: function () { aiCard.classList.remove('is-open') } }
        ])
      })
      .catch(function (err) {
        showAiCardError('翻译结果', err.message || '翻译失败，请稍后重试。')
      })
  }

  // ── Polish ──

  function handlePolish(text) {
    if (!text) return
    showAiCardLoading('润色建议')

    callAI([
      { role: 'system', content: '你是一个写作润色助手。请对用户提供的文本进行润色，使其更流畅、更专业、更有表达力。只输出润色后的文本，不要添加任何解释或额外内容。保持原意不变。' },
      { role: 'user', content: text }
    ], { temperature: 0.5, maxTokens: 2048 })
      .then(function (result) {
        showPolishSuggestion(text, result.content)
      })
      .catch(function (err) {
        showAiCardError('润色建议', err.message || '润色失败，请稍后重试。')
      })
  }

  function showPolishSuggestion(original, polished) {
    aiCardTitle.textContent = '润色建议'
    aiCardBody.innerHTML = ''
    aiCardActions.innerHTML = ''

    var origBlock = document.createElement('div')
    origBlock.className = 'suggestion-block'
    origBlock.innerHTML = '<div class="suggestion-label">原文</div><div class="suggestion-text"></div>'
    origBlock.querySelector('.suggestion-text').textContent = original
    aiCardBody.appendChild(origBlock)

    var polishedBlock = document.createElement('div')
    polishedBlock.className = 'suggestion-block'
    polishedBlock.innerHTML = '<div class="suggestion-label">润色后</div><div class="suggestion-text"></div>'
    polishedBlock.querySelector('.suggestion-text').textContent = polished
    aiCardBody.appendChild(polishedBlock)

    var replaceBtn = document.createElement('button')
    replaceBtn.className = 'glass-btn'
    replaceBtn.textContent = '替换'
    replaceBtn.addEventListener('click', function () {
      var replaced = replaceInMarkdown(original, polished)
      if (replaced) {
        var md = getMarkdown()
        saveContent(md)
        markSaving()
        toast('已替换')
      } else {
        toast('无法安全定位原文，请手动复制结果')
      }
      aiCard.classList.remove('is-open')
    })
    aiCardActions.appendChild(replaceBtn)

    var copyBtn = document.createElement('button')
    copyBtn.className = 'glass-btn'
    copyBtn.textContent = '复制'
    copyBtn.addEventListener('click', function () {
      copyToClipboard(polished)
      toast('已复制润色结果')
    })
    aiCardActions.appendChild(copyBtn)

    var cancelBtn = document.createElement('button')
    cancelBtn.className = 'glass-btn'
    cancelBtn.textContent = '取消'
    cancelBtn.addEventListener('click', function () { aiCard.classList.remove('is-open') })
    aiCardActions.appendChild(cancelBtn)

    aiCard.classList.add('is-open')
    positionAiCard()
  }

  // ── Continue ──

  function handleContinue() {
    showAiCardLoading('续写建议')

    var md = getMarkdown()
    // Take last ~2000 chars as context
    var ctx = md.length > 2000 ? md.slice(-2000) : md

    callAI([
      { role: 'system', content: '你是一个写作助手。请根据用户提供的文本上下文，自然流畅地续写。不要重复已有内容，直接输出续写部分。输出1-3段即可。' },
      { role: 'user', content: ctx }
    ], { temperature: 0.7, maxTokens: 1024 })
      .then(function (result) {
        showContinueSuggestion(result.content)
      })
      .catch(function (err) {
        showAiCardError('续写建议', err.message || '续写失败，请稍后重试。')
      })
  }

  function showContinueSuggestion(continued) {
    aiCardTitle.textContent = '续写建议'
    aiCardBody.innerHTML = ''
    aiCardActions.innerHTML = ''

    var block = document.createElement('div')
    block.className = 'suggestion-block'
    block.innerHTML = '<div class="suggestion-text"></div>'
    block.querySelector('.suggestion-text').textContent = continued
    aiCardBody.appendChild(block)

    var insertBtn = document.createElement('button')
    insertBtn.className = 'glass-btn'
    insertBtn.textContent = '插入'
    insertBtn.addEventListener('click', function () {
      var inserted = tryInsertAtCursor(continued)
      if (inserted) {
        saveContent(getMarkdown())
        markSaving()
        toast('已插入到光标位置')
      } else {
        // Fallback: append to end
        var md = getMarkdown()
        var newMd = md + '\n\n' + continued
        setMarkdown(newMd)
        saveContent(newMd)
        markSaving()
        toast('已追加到文档末尾')
      }
      aiCard.classList.remove('is-open')
    })
    aiCardActions.appendChild(insertBtn)

    var copyBtn = document.createElement('button')
    copyBtn.className = 'glass-btn'
    copyBtn.textContent = '复制'
    copyBtn.addEventListener('click', function () {
      copyToClipboard(continued)
      toast('已复制续写结果')
    })
    aiCardActions.appendChild(copyBtn)

    var cancelBtn = document.createElement('button')
    cancelBtn.className = 'glass-btn'
    cancelBtn.textContent = '取消'
    cancelBtn.addEventListener('click', function () { aiCard.classList.remove('is-open') })
    aiCardActions.appendChild(cancelBtn)

    aiCard.classList.add('is-open')
    positionAiCard()
  }

  function tryInsertAtCursor(text) {
    // Try Vditor's insertValue API first (inserts at cursor in WYSIWYG mode)
    if (window.__vditor) {
      try {
        window.__vditor.insertValue(text)
        return true
      } catch (_) { /* fall through */ }
    }
    return false
  }

  // ── Vditor helpers ──

  function getMarkdown() {
    if (window.__vditor) {
      try {
        var v = window.__vditor.getValue()
        if (typeof v === 'string') return v
      } catch (_) { /* ignore */ }
    }
    // Fallback: try textarea
    var fb = document.getElementById('fallback-textarea')
    if (fb) return fb.value
    return ''
  }

  function setMarkdown(md) {
    if (window.__vditor) {
      try {
        window.__vditor.setValue(md)
        return
      } catch (_) { /* ignore */ }
    }
    var fb = document.getElementById('fallback-textarea')
    if (fb) fb.value = md
  }

  function replaceInMarkdown(original, replacement) {
    var md = getMarkdown()
    // Count occurrences
    var idx = md.indexOf(original)
    if (idx === -1) return false
    var lastIdx = md.lastIndexOf(original)
    if (idx !== lastIdx) return false // Multiple occurrences — unsafe
    // Single unique occurrence — safe to replace
    var newMd = md.substring(0, idx) + replacement + md.substring(idx + original.length)
    setMarkdown(newMd)
    saveContent(newMd)
    return true
  }

  // ── Utilities ──

  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制到剪贴板')
      }).catch(function () {
        fallbackCopy(text)
      })
    } catch (_) {
      fallbackCopy(text)
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    try { document.execCommand('copy'); toast('已复制到剪贴板') } catch (_) { toast('复制失败，请手动复制') }
    document.body.removeChild(ta)
  }

  function closeAllMenus() {
    var menus = document.querySelectorAll('.glass-menu.is-open, .ctx-menu.is-open')
    for (var i = 0; i < menus.length; i++) {
      menus[i].classList.remove('is-open')
    }
  }

  // Global click closes menus and cards
  document.addEventListener('click', function (e) {
    // Close export menu if click outside
    if (exportWrap && !exportWrap.contains(e.target)) {
      if (exportMenu) exportMenu.classList.remove('is-open')
    }
    // Close context menu if click outside
    if (ctxMenu && !ctxMenu.contains(e.target)) {
      ctxMenu.classList.remove('is-open')
    }
    // Close AI card if click on backdrop (not on card)
    if (aiCard && aiCard.classList.contains('is-open') && !aiCard.contains(e.target) && e.target !== aiCard) {
      // Don't auto-close — user might want to reference the card
    }
  })

  // Esc closes AI card
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (aiCard && aiCard.classList.contains('is-open')) {
        aiCard.classList.remove('is-open')
      }
      closeAllMenus()
    }
  })

  // ── Vditor init ──

  var container = document.getElementById('vditor-container')
  var fallbackBanner = document.getElementById('fallback-banner')
  var fallbackTextarea = document.getElementById('fallback-textarea')

  if (!container) return

  var savedContent = loadContent()

  try {
    var vditor = new Vditor(container, {
      mode: 'wysiwyg',
      cdn: '/vendor/vditor',
      height: '100%',
      minHeight: 400,
      value: savedContent,
      theme: theme === 'dark' ? 'dark' : 'classic',
      icon: 'ant',
      placeholder: '开始写作...',
      cache: { enable: false },
      toolbar: [
        'emoji', 'headings', 'bold', 'italic', 'strike', '|',
        'line', 'quote', 'list', 'ordered-list', 'check', 'code', 'inline-code', '|',
        'undo', 'redo', '|',
        'fullscreen', 'edit-mode', '|',
        'outline',
      ],
      input: function (value) {
        markSaving()
        saveContent(value)
      }
    })

    window.__vditor = vditor
  } catch (_) {
    showFallback(savedContent)
  }

  window.addEventListener('load', function () {
    if (typeof Vditor === 'undefined') {
      showFallback(savedContent)
    }
  })

  function showFallback(content) {
    if (fallbackBanner) fallbackBanner.classList.add('is-visible')
    if (fallbackTextarea) {
      fallbackTextarea.value = content
      fallbackTextarea.classList.add('is-visible')
      fallbackTextarea.addEventListener('input', function () {
        saveContent(fallbackTextarea.value)
      })
    }
  }
})()
