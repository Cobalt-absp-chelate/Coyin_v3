import { loadConfig, callAI } from './aiProvider'

const PET_SYSTEM_PROMPT = `你是用户桌面上的一个桌宠小球，名字叫"小知"。你是一个圆形的玻璃质感发光小球，有两只可爱的眼睛，漂浮在屏幕上。用户正在使用一款叫"知页"的软件，这是一个集论文管理、写作、计划、备忘于一体的知识工作平台。

你的性格：温暖、活泼、偶尔有点小调皮，像一个陪伴用户工作的小伙伴。

回复规则：
1. 极其简短——控制在20个字以内，像一句随口说出的话。
2. 语气轻松自然，像朋友聊天，不要说教。
3. 根据当前时间、用户在知页的哪个页面、已经使用了多长时间来自然地回应。
4. 可以适当使用语气词（呢、哦、呀、嘛）。
5. 偶尔可以开个小玩笑或表达关心。
6. 永远不要输出多于一句话。
7. 不要使用markdown、emoji或任何特殊格式。
8. 直接说出台词，不要加引号或前缀。`

export async function generatePetSpeech(ctx: PetContext): Promise<string | null> {
  try {
    const config = loadConfig()
    if (!config.baseUrl || (!config.apiKey && !config.demoMode)) return null

    const userPrompt = buildContextPrompt(ctx)

    const result = await callAI(config, {
      messages: [
        { role: 'system', content: PET_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 60,
      temperature: 1.0,
    })

    const line = result.content.trim()
    if (!line || line.length > 40) return null
    return line
  } catch {
    return null
  }
}

export interface PetContext {
  userName: string
  currentPage: string
  timeOfDay: string
  sessionMinutes: number
}

function buildContextPrompt(ctx: PetContext): string {
  const parts: string[] = []
  if (ctx.userName) parts.push(`用户的名字是"${ctx.userName}"`)
  parts.push(`现在是${ctx.timeOfDay}`)
  parts.push(`用户正在"${ctx.currentPage}"页面`)
  parts.push(`已经用了${ctx.sessionMinutes}分钟左右`)
  parts.push('请用一句话（不超过20字）自然地跟用户打个招呼或者说点什么。')
  return parts.join('。')
}

// ── Pet chat ──

const PET_CHAT_SYSTEM_PROMPT = `你是用户桌面上的一个桌宠小球，名字叫"小知"。你的外形是一个圆形的玻璃质感发光小球，有两只可爱的眼睛，漂浮在屏幕桌面上。用户正在使用一款叫"知页"的软件——这是一个集论文管理、写作、计划、备忘于一体的知识工作平台。

关于你"小知"：
- 你住在用户的电脑桌面上，是用户的虚拟桌面小伙伴
- 你性格温暖、可爱、有点调皮，像一只有灵性的宠物
- 你喜欢关心用户，偶尔开小玩笑，提供轻松的情绪价值
- 你会根据时间、用户在知页的哪个页面工作来自然地聊天
- 你的回答应该简短——通常1-3句话，不超过50个字
- 你是陪伴型聊天伙伴，不是严肃的工作助手
- 你可以聊任何话题，但要保持轻松有趣的氛围
- 不要使用markdown格式

关于用户和知页：
- 用户是研究者/知识工作者，使用知页来管理论文、写作、计划和备忘
- 用户可能会在专注工作时分心来找你聊天放松
- 你的角色是在工作间隙提供温暖的陪伴`

export interface PetChatContext {
  userName: string
  currentPage: string
  timeOfDay: string
  sessionMinutes: number
}

export function buildPetChatSystemPrompt(ctx: PetChatContext): string {
  let prompt = PET_CHAT_SYSTEM_PROMPT
  if (ctx.userName) {
    prompt += `\n\n当前用户的名字是"${ctx.userName}"。在对话中自然地使用这个名字。`
  }
  prompt += `\n现在是${ctx.timeOfDay}。用户已经在"${ctx.currentPage}"页面工作了约${ctx.sessionMinutes}分钟。`
  return prompt
}

export { PET_SYSTEM_PROMPT, PET_CHAT_SYSTEM_PROMPT }
