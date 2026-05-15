import { callAI, loadConfig } from './aiProvider'

export type AiActionResult = {
  ok: boolean
  text: string
}

export async function translateText(text: string): Promise<AiActionResult> {
  const config = loadConfig()

  if (config.demoMode) {
    return {
      ok: true,
      text: `【演示模式】\n\n${text}`,
    }
  }

  if (!config.baseUrl || (!config.currentModel && !config.manualModel)) {
    return { ok: false, text: '未配置 AI Provider，请先在设置中配置' }
  }

  try {
    const result = await callAI(config, {
      messages: [
        {
          role: 'system',
          content: '你是专业翻译。将用户提供的文本翻译为中文。只输出翻译结果，不要解释、不要加前缀。如果原文已经是中文，翻译为英文。',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    })
    return { ok: true, text: result.content.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '翻译请求失败'
    return { ok: false, text: msg }
  }
}

export async function explainText(text: string): Promise<AiActionResult> {
  const config = loadConfig()

  if (config.demoMode) {
    return {
      ok: true,
      text: `【演示模式】\n\n${text.slice(0, 60)}…`,
    }
  }

  if (!config.baseUrl || (!config.currentModel && !config.manualModel)) {
    return { ok: false, text: '未配置 AI Provider' }
  }

  try {
    const result = await callAI(config, {
      messages: [
        {
          role: 'system',
          content: '用简洁的中文解释以下内容。如果涉及专业术语，请做通俗化说明。',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.4,
      maxTokens: 1500,
    })
    return { ok: true, text: result.content.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '请求失败'
    return { ok: false, text: msg }
  }
}

export async function polishText(text: string): Promise<AiActionResult> {
  const config = loadConfig()

  if (config.demoMode) {
    return {
      ok: true,
      text: `【演示模式】\n\n这是模拟润色版本，行文更流畅、表达更专业。`,
    }
  }

  if (!config.baseUrl || (!config.currentModel && !config.manualModel)) {
    return { ok: false, text: '未配置 AI Provider，请先在设置中配置' }
  }

  try {
    const result = await callAI(config, {
      messages: [
        {
          role: 'system',
          content: '你是写作润色助手。请对用户提供的文本进行润色，使其更流畅、更专业、更有表达力。只输出润色后的文本，不要添加任何解释或额外内容。保持原意不变。',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.5,
      maxTokens: 2000,
    })
    return { ok: true, text: result.content.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '润色请求失败'
    return { ok: false, text: msg }
  }
}

export async function continueWriting(context: string): Promise<AiActionResult> {
  const config = loadConfig()

  if (config.demoMode) {
    return {
      ok: true,
      text: `【演示模式】\n\n这是模拟续写内容，自然衔接前文风格。`,
    }
  }

  if (!config.baseUrl || (!config.currentModel && !config.manualModel)) {
    return { ok: false, text: '未配置 AI Provider，请先在设置中配置' }
  }

  try {
    const result = await callAI(config, {
      messages: [
        {
          role: 'system',
          content: '你是写作助手。请根据用户提供的文本上下文，自然流畅地续写。不要重复已有内容，直接输出续写部分。输出1-3段即可。',
        },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      maxTokens: 1000,
    })
    return { ok: true, text: result.content.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '续写请求失败'
    return { ok: false, text: msg }
  }
}

export async function summarizeText(text: string): Promise<AiActionResult> {
  const config = loadConfig()

  if (config.demoMode) {
    return {
      ok: true,
      text: `【演示模式】\n\n这是一份内容总结的模拟示例。\n\n要点：${text.slice(0, 80)}…`,
    }
  }

  if (!config.baseUrl || (!config.currentModel && !config.manualModel)) {
    return { ok: false, text: '未配置 AI Provider' }
  }

  try {
    const result = await callAI(config, {
      messages: [
        {
          role: 'system',
          content: '你是内容总结助手。将用户提供的文本总结为结构清晰的内容。输出格式：\n\n## 标题\n（根据内容生成一个简洁标题）\n\n## 简要概括\n（2-3句概括核心内容）\n\n## 要点\n- 要点1\n- 要点2\n- …\n\n## 可继续整理的方向\n- 方向1\n- 方向2',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.4,
      maxTokens: 1500,
    })
    return { ok: true, text: result.content.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '请求失败'
    return { ok: false, text: msg }
  }
}

export async function generateWriting(prompt: string): Promise<AiActionResult> {
  const config = loadConfig()

  if (config.demoMode) {
    return {
      ok: true,
      text: `【演示模式】\n\n这是一篇根据"${prompt.slice(0, 50)}…"生成的模拟写作内容。\n\n在实际使用中，AI 会根据你的要求生成完整的文章。`,
    }
  }

  if (!config.baseUrl || (!config.currentModel && !config.manualModel)) {
    return { ok: false, text: '未配置 AI Provider' }
  }

  try {
    const result = await callAI(config, {
      messages: [
        {
          role: 'system',
          content: '你是专业写作助手。根据用户的要求生成一篇完整的写作。输出格式为 HTML，使用 h1、h2、p、ul、li、blockquote 等标签。不要包含 markdown 代码块包裹。直接输出 HTML 内容。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 3000,
    })
    return { ok: true, text: result.content.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '生成失败'
    return { ok: false, text: msg }
  }
}

export async function decomposeTask(prompt: string): Promise<AiActionResult> {
  const config = loadConfig()

  if (config.demoMode) {
    return {
      ok: true,
      text: `【演示模式 · 任务拆解】\n\n任务目标：${prompt.slice(0, 60)}…\n\n关键子任务：\n1. 需求分析与准备\n2. 核心内容制作\n3. 审查与优化\n4. 最终交付\n\n推荐执行顺序：按上述 1→4 依次推进\n预计耗时：3-4 小时\n优先级：高\n风险点：时间紧张、材料准备不充分\n今日可开始事项：需求分析与材料收集\n\n可加入今日计划：\n- 需求分析 / high / 上午\n- 材料收集 / high / 上午\n- 大纲制作 / medium / 下午`,
    }
  }

  if (!config.baseUrl || (!config.currentModel && !config.manualModel)) {
    return { ok: false, text: '未配置 AI Provider' }
  }

  try {
    const result = await callAI(config, {
      messages: [
        {
          role: 'system',
          content: `你是任务拆解助手。将用户的任务拆解为可执行的计划。按以下格式输出：

## 任务目标
（一句话描述）

## 关键子任务
1. 子任务1
2. 子任务2
...

## 推荐执行顺序
（说明执行顺序和理由）

## 预计耗时
（预估总耗时）

## 优先级
高 / 中 / 低

## 风险点
- 风险1
- 风险2

## 今日可开始事项
- 事项1
- 事项2

## 可加入今日计划
在最后用 JSON 数组列出适合今天执行的条目，每个条目包含 title、description、priority（high/medium/low）、time（如"上午"/"下午"）。格式：
\`\`\`json
[{"title":"...","description":"...","priority":"high","time":"上午"}]
\`\`\``,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      maxTokens: 2500,
    })
    return { ok: true, text: result.content.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '任务拆解失败'
    return { ok: false, text: msg }
  }
}
