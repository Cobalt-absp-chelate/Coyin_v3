import {
  ArrowLeft,
  ArrowUpRight,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileText,
  Import,
  Library,
  LoaderCircle,
  PenLine,
  Search,
  Settings,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import './app.css'
import { DayNightToggleGlass } from './components/DayNightToggleGlass'
import { GlassSurface } from './components/GlassSurface'
import { GlowParticles } from './components/GlowParticles'
import { AiInputCard } from './components/AiInputCard'
import { AiProviderSettings } from './components/AiProviderSettings'
import { TodayPlanOrbit } from './components/TodayPlanOrbit'
import { FocusCapsule } from './components/FocusCapsule'
import { ChatPanel } from './components/ChatPanel'
import { PetOrb } from './components/PetOrb'
import { PetInfoPanel } from './components/PetInfoPanel'
import { PetSettingsCard } from './components/PetSettingsCard'
import { HomeInfoPanel } from './components/HomeInfoPanel'
import { HomeLayoutEditor } from './components/HomeLayoutEditor'
import { PetChatDialog } from './components/PetChatDialog'
import { showPetContextMenu } from './components/PetContextMenu'
import {
  loadPetSettings,
  loadHomeLayout,
  saveHomeLayout,
  pickSpeechLine,
} from './services/petStorageService'
import { generatePetSpeech, type PetContext } from './services/petAiService'
import type { PetSettings, HomeLayout } from './types/pet'

import type { TodayPlan } from './types/plan'
import type { ActiveFocusSession, FocusCategory } from './types/focus'
import {
  checkAndArchiveIfNeeded,
  loadTodayPlans,
  saveTodayPlans,
  updatePlanStatus,
  removePlan,
  isDuplicatePlan,
} from './services/planService'
import {
  loadActiveFocus,
  startFocus,
  saveActiveFocus,
} from './services/focusService'
import { PdfReaderPage, type PdfReaderDocument } from './components/PdfReaderPage'
import { WritingModule } from './components/WritingModule'
import { HelpPanel } from './components/HelpPanel'
import { createDocument, updateDocument, saveActiveDocId } from './services/writingService'
import { runMigrations, loadLibraryItems, saveLibraryItems, loadMemoItems, saveMemoItems, DEFAULT_LIBRARY_ITEMS, DEFAULT_MEMO_ITEMS } from './services/storageService'
import { importPdfFile, deleteStoredPdf, detectStorageBackend, downloadPaperViaTauri, importDownloadedPaper } from './services/documentStorageService'
import type { DownloadPaperResult } from './services/documentStorageService'
import { appFetch } from './services/httpClient'
import type { ChatSession, ChatMessage } from './types/chat'
import { streamChatCompletion, loadConfig } from './services/aiProvider'
import { createSession, listSessions, getMessages, addMessage, deleteSession as deleteChatSession } from './services/chatStorageService'
import {
  INITIAL_PAPER_RESULTS_PER_SOURCE,
  paperSources,
  PAPER_RESULTS_PER_SOURCE,
  resolvePdfUrl,
  searchPapers,
  type PaperSearchResult,
  type PaperSourceId,
} from './services/paperSearch'

type Page = 'workbench' | 'library' | 'settings' | 'writing'
type ResultTab = 'all' | 'pdf'
type Theme = 'light' | 'dark'
type WorkbenchMode = 'console' | 'search'
type LibraryMode = 'list' | 'reader' | 'help'
type MemoItem = {
  id: string
  text: string
  completing?: boolean
  entering?: boolean
}

type LibraryItem = {
  id: string
  title: string
  type: string
  meta: string
  status: string
  filePath: string
  deleting?: boolean
  storageBackend?: string
  storedPath?: string
  originalName?: string
  importedAt?: number
  size?: number
  mime?: string
  sourceUrl?: string
}

type InspirationEntry = {
  id: string
  image: string
  alt: string
  scene: string
  quote: string
  author: string
  source: string
  photoCredit: string
}

const SEARCH_PAGE_SIZE = 8
const INSPIRATION_ROTATION_MS = 45000

const navItems = [
  { id: 'workbench', label: '今日', icon: Brain },
  { id: 'library', label: '阅读', icon: Library },
  { id: 'settings', label: '设置', icon: Settings },
] satisfies Array<{ id: Page; label: string; icon: typeof Brain }>

const pageOrder: Record<Page, number> = {
  workbench: 0,
  library: 1,
  settings: 2,
  writing: 3,
}

const resultTabs = [
  { id: 'all', label: '全部' },
  { id: 'pdf', label: '可下载' },
] satisfies Array<{ id: ResultTab; label: string }>


const settingsSections = [
  { title: '外观', value: '液态玻璃 / 自动主题', detail: '浅色与深色保持统一。' },
  { title: '关于', value: '知页', detail: '研究工作台。' },
]


const inspirationEntries: InspirationEntry[] = [
  {
    id: 'inspiration-1',
    image: '/inspiration/seaside-cliffs.jpg',
    alt: 'Sausalito 海岸悬崖与海面',
    scene: 'Sausalito, United States',
    quote: '我们怎样度过一天，当然也就怎样度过一生。',
    author: 'Annie Dillard',
    source: '《The Writing Life》',
    photoCredit: 'Josh Aarons · CC0',
  },
  {
    id: 'inspiration-2',
    image: '/inspiration/mountain-lake.jpg',
    alt: '斯洛文尼亚博希尼湖的山湖倒影',
    scene: 'Lake Bohinj, Slovenia',
    quote: '有终点固然好，但归根结底，重要的是走这一程。',
    author: 'Ursula K. Le Guin',
    source: '《The Left Hand of Darkness》',
    photoCredit: 'Ales Krivec · CC0',
  },
  {
    id: 'inspiration-3',
    image: '/inspiration/desert-dunes.jpg',
    alt: '摩洛哥梅尔祖卡沙丘日落前的沙漠风景',
    scene: 'Merzouga Desert, Morocco',
    quote: '在隆冬深处，我终于知道，我心中自有一个不可战胜的夏天。',
    author: 'Albert Camus',
    source: '《Return to Tipasa》',
    photoCredit: 'FuriousYogi · CC BY-SA 4.0',
  },
  {
    id: 'inspiration-4',
    image: '/inspiration/mountain-lake.jpg',
    alt: '斯洛文尼亚博希尼湖上空的云与山湖倒影',
    scene: 'Lake Bohinj, Slovenia',
    quote: '把自己交给未来，正是这种对未来的承诺，让现在变得可以居住。',
    author: 'Rebecca Solnit',
    source: '《Hope in the Dark》',
    photoCredit: 'Ales Krivec · CC0',
  },
  {
    id: 'inspiration-5',
    image: '/inspiration/forest-mist.jpg',
    alt: '晨雾中的松林小径',
    scene: 'Pacific Northwest, United States',
    quote: '林中有两条路，我选择了人迹更少的一条。',
    author: 'Robert Frost',
    source: '《The Road Not Taken》',
    photoCredit: 'Unsplash · CC0',
  },
  {
    id: 'inspiration-6',
    image: '/inspiration/ocean-sunset.jpg',
    alt: '海边日落时分的金色沙滩',
    scene: 'Tulum, Mexico',
    quote: '真正的发现之旅不在于寻找新风景，而在于拥有新眼光。',
    author: 'Marcel Proust',
    source: '《In Search of Lost Time》',
    photoCredit: 'Unsplash · CC0',
  },
  {
    id: 'inspiration-7',
    image: '/inspiration/starry-sky.jpg',
    alt: '雪山之上的璀璨星空',
    scene: 'Swiss Alps, Switzerland',
    quote: '仰望星空的人，不会被脚下的石子绊倒。',
    author: 'Immanuel Kant',
    source: '《Critique of Practical Reason》',
    photoCredit: 'Unsplash · CC0',
  },
  {
    id: 'inspiration-8',
    image: '/inspiration/autumn-forest.jpg',
    alt: '秋日森林中的金色落叶',
    scene: 'Vermont, United States',
    quote: '每一片落叶都是大树写给大地的信。',
    author: 'Rabindranath Tagore',
    source: '《Stray Birds》',
    photoCredit: 'Unsplash · CC0',
  },
  {
    id: 'inspiration-9',
    image: '/inspiration/mountain-lake.jpg',
    alt: '阿尔卑斯山脚下的静谧湖泊',
    scene: 'Lake Bohinj, Slovenia',
    quote: '水面上的倒影比山本身更安静。',
    author: 'Matsuo Basho',
    source: '《The Narrow Road to the Deep North》',
    photoCredit: 'Ales Krivec · CC0',
  },
  {
    id: 'inspiration-10',
    image: '/inspiration/desert-dunes.jpg',
    alt: '撒哈拉沙漠的流沙纹理',
    scene: 'Sahara Desert, Morocco',
    quote: '沙漠之所以美丽，是因为它在某处藏着一口井。',
    author: 'Antoine de Saint-Exupery',
    source: '《The Little Prince》',
    photoCredit: 'FuriousYogi · CC BY-SA 4.0',
  },
]

export function App() {
  // Run migrations synchronously before state init so loaders see clean data
  runMigrations()

  const [activePage, setActivePage] = useState<Page>('workbench')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSources] = useState<PaperSourceId[]>(paperSources.map((source) => source.id))
  const [activeTab, setActiveTab] = useState<ResultTab>('all')
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>('console')
  const [theme, setTheme] = useState<Theme>('dark')
  const [libraryView, setLibraryView] = useState<'list' | 'stream'>('list')
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('list')
  const [readerDocument, setReaderDocument] = useState<PdfReaderDocument | null>(null)
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => {
    const stored = loadLibraryItems()
    return stored.length > 0 ? stored : DEFAULT_LIBRARY_ITEMS
  })
  const [memoItems, setMemoItems] = useState<MemoItem[]>(() => {
    const stored = loadMemoItems()
    return stored.length > 0 ? stored : DEFAULT_MEMO_ITEMS
  })
  const [memoDraft, setMemoDraft] = useState('')
  const [libraryToast, setLibraryToast] = useState<string | null>(null)
  const [inspirationIndex, setInspirationIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<PaperSearchResult[]>([])
  const [, setSearchErrors] = useState<Array<{ sourceId: string; sourceLabel: string; message: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [lastSearchQuery, setLastSearchQuery] = useState('')
  const [searchPage, setSearchPage] = useState(1)
  const [downloadingPaper, setDownloadingPaper] = useState<Set<string>>(new Set())
  const [paperFeedback, setPaperFeedback] = useState<string | null>(null)
  const [paperFeedbackLink, setPaperFeedbackLink] = useState<{ label: string; onClick: () => void } | null>(null)
  const [todayPlans, setTodayPlans] = useState<TodayPlan[]>(() => {
    checkAndArchiveIfNeeded()
    return loadTodayPlans()
  })
  const [activeFocus, setActiveFocus] = useState<ActiveFocusSession | null>(() => loadActiveFocus())
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatStreaming, setIsChatStreaming] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(false)
  const [isChatFullScreen, setIsChatFullScreen] = useState(false)
  const [showSessionList, setShowSessionList] = useState(false)

  // ── Pet state ──
  const [petSettings, setPetSettings] = useState<PetSettings>(() => loadPetSettings())

  // Sync pet settings from PetSettingsCard changes
  useEffect(() => {
    const handler = () => setPetSettings(loadPetSettings())
    window.addEventListener('pet-settings-changed', handler)
    return () => window.removeEventListener('pet-settings-changed', handler)
  }, [])

  // Handle navigation from pet info panel
  useEffect(() => {
    const handler = (e: Event) => {
      const { page } = (e as CustomEvent).detail
      if (page === 'library') setActivePage('library')
      else if (page === 'writing') setActivePage('writing')
      else if (page === 'workbench') setActivePage('workbench')
    }
    window.addEventListener('pet-nav-to', handler)
    return () => window.removeEventListener('pet-nav-to', handler)
  }, [])
  const [homeLayout, setHomeLayout] = useState<HomeLayout>(() => loadHomeLayout())
  const [layoutEditing, setLayoutEditing] = useState(false)
  const [showPetInfo, setShowPetInfo] = useState(false)
  const [showPetChat, setShowPetChat] = useState(false)
  const [petSpeechLine, setPetSpeechLine] = useState<string | null>(null)
  const [showPetSpeech, setShowPetSpeech] = useState(false)
  const [petMuted, setPetMuted] = useState(false)
  const petContainerRef = useRef<HTMLDivElement>(null)
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechStoppedRef = useRef(false)
  const sessionStartRef = useRef(Date.now());
  (globalThis as Record<string, unknown>).__sessionStart = sessionStartRef.current

  // ── Pet speech timer ──
  useEffect(() => {
    const clearTimer = () => {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current)
        speechTimerRef.current = null
      }
    }
    clearTimer()
    speechStoppedRef.current = false

    if (!petSettings.enabled || !petSettings.allowSpeech || petSettings.speakFrequency === 'silent' || petMuted) {
      return
    }

    // ── Non-AI mode: fixed interval ──
    if (!petSettings.aiSpeechEnabled) {
      const intervals: Record<string, number> = {
        rare: 45000,
        moderate: 25000,
      }
      const interval = intervals[petSettings.speakFrequency] || 60000

      const tick = () => {
        const line = pickSpeechLine(petSettings.userName, petSettings.customLines, Math.round((Date.now() - sessionStartRef.current) / 60000))
        setPetSpeechLine(line)
        setShowPetSpeech(true)
        setTimeout(() => setShowPetSpeech(false), 6000)
      }

      // Use setInterval but track with a setTimeout-like ref
      const id = setInterval(tick, interval)
      speechTimerRef.current = id as unknown as ReturnType<typeof setTimeout>
      return () => clearInterval(id)
    }

    // ── AI mode: distribute speeches randomly within the window ──
    const avgInterval = (petSettings.aiSpeechWindow * 60000) / petSettings.aiSpeechCount

    const scheduleNext = () => {
      if (speechStoppedRef.current) return
      const jitter = 0.5 + Math.random()
      const delay = Math.max(15000, avgInterval * jitter)

      speechTimerRef.current = setTimeout(async () => {
        if (speechStoppedRef.current) return
        const ctx: PetContext = {
          userName: petSettings.userName,
          currentPage: activePage,
          timeOfDay: getTimeOfDay(),
          sessionMinutes: Math.round((Date.now() - sessionStartRef.current) / 60000),
        }
        const aiLine = await generatePetSpeech(ctx)
        if (aiLine) {
          setPetSpeechLine(aiLine)
          setShowPetSpeech(true)
          setTimeout(() => setShowPetSpeech(false), 7000)
        } else {
          const line = pickSpeechLine(petSettings.userName, petSettings.customLines, Math.round((Date.now() - sessionStartRef.current) / 60000))
          setPetSpeechLine(line)
          setShowPetSpeech(true)
          setTimeout(() => setShowPetSpeech(false), 6000)
        }
        scheduleNext()
      }, delay)
    }

    scheduleNext()
    return () => { speechStoppedRef.current = true; clearTimer() }
  }, [petSettings.enabled, petSettings.allowSpeech, petSettings.speakFrequency, petSettings.userName, petSettings.customLines, petMuted, petSettings.aiSpeechEnabled, petSettings.aiSpeechWindow, petSettings.aiSpeechCount, activePage])

  const handlePetContextMenu = useCallback((x: number, y: number, paused: boolean) => {
    showPetContextMenu(x, y, paused, petMuted)
  }, [petMuted])

  const handleToggleMute = useCallback(() => {
    setPetMuted((prev) => !prev)
  }, [])

  const handlePetSpeak = useCallback(() => {
    const line = pickSpeechLine(petSettings.userName, petSettings.customLines, Math.round((Date.now() - sessionStartRef.current) / 60000))
    setPetSpeechLine(line)
    setShowPetSpeech(true)
    setTimeout(() => setShowPetSpeech(false), 6000)
  }, [petSettings.userName, petSettings.customLines])

  const handlePetClick = useCallback(() => {
    setShowPetInfo(true)
  }, [])

  const handlePetChat = useCallback(() => {
    setShowPetChat(true)
  }, [])

  const handleEnterLayoutEdit = useCallback(() => {
    setLayoutEditing(true)
    setActivePage('workbench')
    if (workbenchMode !== 'console') {
      setWorkbenchMode('console')
    }
  }, [workbenchMode])

  const handleSaveLayout = useCallback((layout: HomeLayout) => {
    setHomeLayout(layout)
    saveHomeLayout(layout)
    setLayoutEditing(false)
  }, [])

  const handleCancelLayout = useCallback(() => {
    setLayoutEditing(false)
  }, [])

  const searchTokenRef = useRef(0)
  const switchLibraryModeRef = useRef<(nextMode: LibraryMode, nextDocument?: PdfReaderDocument | null) => void>(undefined)
  const switchWorkbenchModeRef = useRef<(nextMode: WorkbenchMode) => void>(undefined)

  const filteredResults = useMemo(() => {
    if (activeTab === 'pdf') {
      return searchResults.filter((result) => result.isDownloadable)
    }
    return searchResults
  }, [activeTab, searchResults])

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / SEARCH_PAGE_SIZE))
  const visibleResults = useMemo(() => {
    const pageIndex = Math.min(searchPage, totalPages) - 1
    const start = pageIndex * SEARCH_PAGE_SIZE
    return filteredResults.slice(start, start + SEARCH_PAGE_SIZE)
  }, [filteredResults, searchPage, totalPages])
  const visibleInspirations = useMemo(() => {
    const cardCount = Math.min(2, inspirationEntries.length)
    return Array.from({ length: cardCount }, (_, offset) => inspirationEntries[(inspirationIndex + offset) % inspirationEntries.length])
  }, [inspirationIndex])

  useEffect(() => {
    setSearchPage(1)
  }, [activeTab, lastSearchQuery])

  useEffect(() => {
    if (searchPage > totalPages) {
      setSearchPage(totalPages)
    }
  }, [searchPage, totalPages])

  useEffect(() => {
    if (activePage !== 'workbench' || workbenchMode !== 'console' || inspirationEntries.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setInspirationIndex((current) => (current + 1) % inspirationEntries.length)
    }, INSPIRATION_ROTATION_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [activePage, workbenchMode])
  // Persist library items on change
  useEffect(() => {
    saveLibraryItems(libraryItems)
  }, [libraryItems])

  // Persist memo items on change
  useEffect(() => {
    saveMemoItems(memoItems)
  }, [memoItems])

  // Auto-dismiss library toast
  useEffect(() => {
    if (!libraryToast) return
    const timer = window.setTimeout(() => setLibraryToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [libraryToast])

  // Load chat sessions on mount
  useEffect(() => {
    listSessions().then(setChatSessions).catch(() => {})
  }, [])

  // ── Chat handlers ──

  const handleChatMessage = useCallback(async (text: string) => {
    try {
      const config = loadConfig()
      if (!config.baseUrl && !config.demoMode) {
        setShowChatPanel(true)
        const errorMsg: ChatMessage = {
          id: `msg-error-${Date.now()}`,
          session_id: activeChatSessionId || 'no-session',
          role: 'assistant',
          content: '未配置 AI 接口，请在设置中填写 Base URL 和 API Key，或开启 Demo 模式。',
          thinking: null,
          timestamp: Date.now(),
        }
        setChatMessages((prev) => [...prev, errorMsg])
        return
      }

      setShowChatPanel(true)

      let sessionId = activeChatSessionId
      if (!sessionId) {
        const session = await createSession(text.slice(0, 30) + (text.length > 30 ? '…' : ''))
        sessionId = session.id
        setActiveChatSessionId(sessionId)
        setChatSessions((prev) => [session, ...prev])
      }

      const userMsg = await addMessage(sessionId, 'user', text)
      setChatMessages((prev) => [...prev, userMsg])

      setIsChatStreaming(true)

      // Add placeholder assistant message before streaming
      const placeholderId = `msg-${Date.now()}-assistant`
      const placeholder: ChatMessage = {
        id: placeholderId,
        session_id: sessionId!,
        role: 'assistant',
        content: '',
        thinking: null,
        timestamp: Date.now(),
      }
      setChatMessages((prev) => [...prev, placeholder])

      await streamChatCompletion(config, {
        messages: [{ role: 'user', content: text }],
        maxTokens: 2048,
      }, {
        onToken(token) {
          setChatMessages((prev) => prev.map((m) =>
            m.id === placeholderId ? { ...m, content: m.content + token } : m
          ))
        },
        onThinking(thinkingToken) {
          setChatMessages((prev) => prev.map((m) =>
            m.id === placeholderId ? { ...m, thinking: (m.thinking || '') + thinkingToken } : m
          ))
        },
        async onDone(fullContent, fullThinking) {
          setIsChatStreaming(false)
          if (fullContent || fullThinking) {
            const aiMsg = await addMessage(sessionId!, 'assistant', fullContent, fullThinking || null)
            setChatMessages((prev) => prev.map((m) =>
              m.id === placeholderId ? aiMsg : m
            ))
          } else {
            setChatMessages((prev) => prev.filter((m) => m.id !== placeholderId))
          }
        },
        onError(error) {
          setIsChatStreaming(false)
          setChatMessages((prev) => prev.map((m) =>
            m.id === placeholderId
              ? { ...m, content: `错误: ${error}` }
              : m
          ))
        },
      })
    } catch (err) {
      setIsChatStreaming(false)
      const errorMsg: ChatMessage = {
        id: `msg-error-${Date.now()}`,
        session_id: activeChatSessionId || 'no-session',
        role: 'assistant',
        content: `系统错误: ${err instanceof Error ? err.message : String(err)}`,
        thinking: null,
        timestamp: Date.now(),
      }
      setChatMessages((prev) => [...prev, errorMsg])
      setShowChatPanel(true)
    }
  }, [activeChatSessionId])

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setActiveChatSessionId(sessionId)
    const msgs = await getMessages(sessionId)
    setChatMessages(msgs)
    setShowChatPanel(true)
  }, [])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteChatSession(sessionId)
    setChatSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (activeChatSessionId === sessionId) {
      const remaining = chatSessions.filter((s) => s.id !== sessionId)
      const next = remaining[0]
      if (next) {
        setActiveChatSessionId(next.id)
        const msgs = await getMessages(next.id)
        setChatMessages(msgs)
      } else {
        setActiveChatSessionId(null)
        setChatMessages([])
        setShowChatPanel(false)
      }
    }
  }, [activeChatSessionId, chatSessions])

  const handleNewSession = useCallback(() => {
    setActiveChatSessionId(null)
    setChatMessages([])
    setShowChatPanel(true)
    setShowSessionList(false)
  }, [])

  const handleToggleFullScreen = useCallback(() => {
    setIsChatFullScreen((prev) => !prev)
  }, [])

  const handleCloseFullScreen = useCallback(() => {
    setIsChatFullScreen(false)
  }, [])

  const handleToggleSessionList = useCallback(() => {
    setShowSessionList((prev) => !prev)
  }, [])

  const handleCloseSessionList = useCallback(() => {
    setShowSessionList(false)
  }, [])

  const switchPage = (nextPage: Page) => {
    if (nextPage === activePage) {
      return
    }

    const direction = pageOrder[nextPage] > pageOrder[activePage] ? 'up' : 'down'
    document.documentElement.dataset.pageDirection = direction

    const startViewTransition = document.startViewTransition?.bind(document)
    if (!startViewTransition) {
      setActivePage(nextPage)
      return
    }

    startViewTransition(() => {
      flushSync(() => {
        setActivePage(nextPage)
      })
    })
  }

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      void openUrl(url)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const downloadAndImportPaper = useCallback(async (paper: PaperSearchResult) => {
    const PREFIX = '[dl-import]'

    console.log(`${PREFIX} ====== start ======`)
    console.log(`${PREFIX} paper:`, {
      title: paper.title,
      sourceLabel: paper.sourceLabel,
      venue: paper.venue,
      year: paper.year,
      doi: paper.doi,
      arxivId: paper.arxivId,
      pdfUrl: paper.pdfUrl,
      resolvedPdfUrl: paper.resolvedPdfUrl,
      isDownloadable: paper.isDownloadable,
      downloadReason: paper.downloadReason,
    })

    // ── Stage 0: Resolve PDF URL ──
    setPaperFeedback('正在解析 PDF 下载链接……')
    console.log(`${PREFIX} stage 0: resolving PDF URL…`)

    let targetUrl: string | null = null
    try {
      targetUrl = await resolvePdfUrl(paper)
    } catch (resolveErr) {
      console.log(`${PREFIX} resolvePdfUrl threw:`, resolveErr)
    }

    if (!targetUrl) {
      console.log(`${PREFIX} FAIL: no resolved PDF URL`)
      console.error(`${PREFIX} failed`, {
        title: paper.title,
        stage: 'resolve-url',
        status: 'no-url',
        pdfUrl: paper.pdfUrl,
        resolvedPdfUrl: paper.resolvedPdfUrl,
        sourceUrl: paper.landingUrl,
        downloadReason: paper.downloadReason,
      })
      setPaperFeedback(`《${paper.title.slice(0, 40)}》未找到可直接下载的 PDF 链接。该结果可能只有网页，可点击"网页"按钮打开来源页面。`)
      setTimeout(() => setPaperFeedback(null), 6000)
      return
    }

    console.log(`${PREFIX} stage 0 done: resolved URL = ${targetUrl}`)

    // ── Dedup check ──
    const dupKey = paper.doi || targetUrl || `${paper.title}::${paper.year}`
    let alreadyExists = false
    let existingTitle = ''
    setLibraryItems((current) => {
      const found = current.find((item) => {
        if (dupKey && (item.sourceUrl === dupKey || (paper.doi && item.sourceUrl === paper.doi))) return true
        if (item.sourceUrl === targetUrl) return true
        return false
      })
      if (found) { alreadyExists = true; existingTitle = found.title }
      return current
    })
    if (alreadyExists) {
      console.log(`${PREFIX} SKIP: already in library ("${existingTitle}")`)
      setPaperFeedback(`该论文已在阅读库中: ${existingTitle}`)
      setTimeout(() => setPaperFeedback(null), 4000)
      return
    }

    setDownloadingPaper((prev) => new Set(prev).add(paper.id))

    const backend = detectStorageBackend()
    const isTauri = backend === 'tauri'
    console.log(`${PREFIX} storage backend: ${backend}`)

    const docId = `doc-paper-${Date.now()}`
    let localPath = ''
    let fileSize = 0
    let downloadResult: DownloadPaperResult | null = null

    try {
      if (isTauri) {
        // ── Tauri path ──
        setPaperFeedback('正在连接下载地址……')
        console.log(`${PREFIX} stage 1: Tauri download via Rust command`)

        const safeFilename = paper.title
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, '_')
          .slice(0, 100)
          .trim() || 'paper'

        try {
          setPaperFeedback('正在下载 PDF……')
          downloadResult = await downloadPaperViaTauri(targetUrl, paper.title, safeFilename)
        } catch (tauriErr) {
          const errMsg = tauriErr instanceof Error ? tauriErr.message : String(tauriErr)
          console.log(`${PREFIX} Tauri command failed:`, errMsg)
          console.error(`${PREFIX} failed`, {
            title: paper.title,
            stage: 'tauri-download',
            status: 'error',
            pdfUrl: targetUrl,
            resolvedPdfUrl: paper.resolvedPdfUrl,
            sourceUrl: paper.landingUrl,
            error: errMsg,
          })

          if (errMsg.includes('403') || errMsg.includes('401') || errMsg.includes('Forbidden')) {
            setPaperFeedback(`《${paper.title.slice(0, 40)}》下载失败：目标站点拒绝访问 (HTTP 403)。该链接可能不是 PDF 直链，已停止入库。可点击"网页"按钮打开来源页面手动下载。`)
          } else {
            setPaperFeedback(`《${paper.title.slice(0, 40)}》下载失败: ${errMsg}`)
          }
          setDownloadingPaper((prev) => {
            const next = new Set(prev)
            next.delete(paper.id)
            return next
          })
          return
        }

        if (!downloadResult?.success) {
          const errMsg = downloadResult?.error || '未知错误'
          console.log(`${PREFIX} FAIL: Rust command returned error:`, errMsg)
          console.error(`${PREFIX} failed`, {
            title: paper.title,
            stage: 'tauri-save',
            status: 'error',
            pdfUrl: targetUrl,
            resolvedPdfUrl: paper.resolvedPdfUrl,
            sourceUrl: paper.landingUrl,
            error: errMsg,
          })
          setPaperFeedback(`《${paper.title.slice(0, 40)}》保存失败: ${errMsg}`)
          setDownloadingPaper((prev) => {
            const next = new Set(prev)
            next.delete(paper.id)
            return next
          })
          return
        }

        localPath = downloadResult.local_path
        fileSize = downloadResult.file_size
        console.log(`${PREFIX} stage 1 done: ${fileSize} bytes → ${localPath}`)
      } else {
        // ── Browser / fallback path ──
        setPaperFeedback('正在连接下载地址……')
        console.log(`${PREFIX} stage 1 (fallback): downloading via appFetch…`)

        let response: Response
        try {
          response = await appFetch(targetUrl)
        } catch (fetchErr) {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
          console.log(`${PREFIX} FAIL: fetch error:`, errMsg)
          console.error(`${PREFIX} failed`, {
            title: paper.title,
            stage: 'fetch',
            status: 'network-error',
            pdfUrl: targetUrl,
            resolvedPdfUrl: paper.resolvedPdfUrl,
            sourceUrl: paper.landingUrl,
            error: errMsg,
          })
          setPaperFeedback(`《${paper.title.slice(0, 40)}》网络请求失败: ${errMsg}`)
          setDownloadingPaper((prev) => {
            const next = new Set(prev)
            next.delete(paper.id)
            return next
          })
          return
        }

        const status = response.status
        const contentType = response.headers.get('content-type') || ''
        console.log(`${PREFIX} response: status=${status} content-type=${contentType}`)

        if (!response.ok) {
          console.error(`${PREFIX} failed`, {
            title: paper.title,
            stage: 'download',
            status,
            pdfUrl: targetUrl,
            resolvedPdfUrl: paper.resolvedPdfUrl,
            sourceUrl: paper.landingUrl,
            contentType,
            error: `HTTP ${status}`,
          })

          if (status === 403 || status === 401) {
            setPaperFeedback(`《${paper.title.slice(0, 40)}》下载失败：目标站点拒绝访问 HTTP ${status}。该链接可能不是 PDF 直链，已停止入库。你可以点击"网页"打开来源页面手动查看。`)
          } else if (status === 404) {
            setPaperFeedback(`《${paper.title.slice(0, 40)}》下载失败：文件未找到 HTTP 404。PDF 链接可能已失效。`)
          } else {
            setPaperFeedback(`《${paper.title.slice(0, 40)}》下载失败: HTTP ${status}，已停止入库。`)
          }
          setDownloadingPaper((prev) => {
            const next = new Set(prev)
            next.delete(paper.id)
            return next
          })
          return
        }

        // Check content-type before treating as PDF
        if (contentType && contentType.includes('text/html')) {
          console.log(`${PREFIX} FAIL: response is HTML, not PDF`)
          console.error(`${PREFIX} failed`, {
            title: paper.title,
            stage: 'validate-content-type',
            status,
            pdfUrl: targetUrl,
            resolvedPdfUrl: paper.resolvedPdfUrl,
            sourceUrl: paper.landingUrl,
            contentType,
            error: 'content-type is text/html',
          })
          setPaperFeedback(`《${paper.title.slice(0, 40)}》下载到的内容是网页而非 PDF。该链接可能是论文页面而非文件直链，已停止入库。建议点击"网页"按钮手动下载。`)
          setDownloadingPaper((prev) => {
            const next = new Set(prev)
            next.delete(paper.id)
            return next
          })
          return
        }

        setPaperFeedback('正在下载 PDF……')
        const blob = await response.blob()
        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        fileSize = bytes.length
        console.log(`${PREFIX} downloaded ${fileSize} bytes, first bytes: ${Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`)

        if (bytes.length < 4 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
          console.log(`${PREFIX} FAIL: not a valid PDF`)
          console.error(`${PREFIX} failed`, {
            title: paper.title,
            stage: 'validate-magic-bytes',
            status,
            pdfUrl: targetUrl,
            resolvedPdfUrl: paper.resolvedPdfUrl,
            sourceUrl: paper.landingUrl,
            contentType,
            byteLength: bytes.length,
            firstBytes: Array.from(bytes.slice(0, 8)),
            error: 'magic bytes mismatch',
          })
          setPaperFeedback(`《${paper.title.slice(0, 40)}》下载到的内容不是 PDF（可能是网页或权限页面），已停止入库。`)
          setDownloadingPaper((prev) => {
            const next = new Set(prev)
            next.delete(paper.id)
            return next
          })
          return
        }

        // Save to disk
        setPaperFeedback('正在保存到本地……')
        console.log(`${PREFIX} stage 2: saving to disk…`)
        const safeTitle = paper.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').trim() || 'paper'
        const fileName = `${safeTitle.slice(0, 80)}.pdf`
        const file = new File([bytes], fileName, { type: 'application/pdf' })

        try {
          const ref = await importDownloadedPaper(file, docId)
          localPath = ref.localPath
          fileSize = ref.size
          console.log(`${PREFIX} stage 2 done: saved → ${localPath || '(browser storage)'}`)
        } catch (saveErr) {
          console.log(`${PREFIX} FAIL: save error`, saveErr)
          console.error(`${PREFIX} failed`, {
            title: paper.title,
            stage: 'save-to-disk',
            status,
            pdfUrl: targetUrl,
            resolvedPdfUrl: paper.resolvedPdfUrl,
            error: saveErr instanceof Error ? saveErr.message : String(saveErr),
          })
          setPaperFeedback(`《${paper.title.slice(0, 40)}》PDF 下载成功但保存到本地失败: ${saveErr instanceof Error ? saveErr.message : '未知错误'}`)
          setDownloadingPaper((prev) => {
            const next = new Set(prev)
            next.delete(paper.id)
            return next
          })
          return
        }
      }
    } catch (err) {
      console.log(`${PREFIX} FAIL: unexpected exception`, err)
      console.error(`${PREFIX} failed`, {
        title: paper.title,
        stage: 'unknown',
        pdfUrl: targetUrl,
        error: err instanceof Error ? err.message : String(err),
      })
      setPaperFeedback(`《${paper.title.slice(0, 40)}》下载过程发生异常: ${err instanceof Error ? err.message : '未知错误'}`)
      setDownloadingPaper((prev) => {
        const next = new Set(prev)
        next.delete(paper.id)
        return next
      })
      return
    }

    // ── Stage 3: Insert into library ──
    setPaperFeedback('正在写入资料库……')
    console.log(`${PREFIX} stage 3: inserting into library…`)

    const newItem: LibraryItem = {
      id: docId,
      title: paper.title,
      type: 'PDF',
      meta: `${paper.authors.slice(0, 2).join(' · ') || '未知作者'} / ${paper.year || '未知年份'}`,
      status: '已入库',
      filePath: localPath,
      storageBackend: isTauri ? 'tauri' : detectStorageBackend(),
      storedPath: localPath,
      originalName: `${paper.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80)}.pdf`,
      importedAt: Date.now(),
      size: fileSize,
      mime: 'application/pdf',
      sourceUrl: targetUrl,
    }

    setLibraryItems((current) => {
      console.log(`${PREFIX} stage 3 done: library count ${current.length} → ${current.length + 1}`)
      console.log(`${PREFIX} stage 4: SUCCESS localPath=${localPath} fileSize=${fileSize}`)
      return [...current, newItem]
    })

    setPaperFeedback(`下载并入库成功: ${localPath || '已保存'}`)
    setPaperFeedbackLink({
      label: '立即阅读',
      onClick: () => {
        setPaperFeedback('')
        setPaperFeedbackLink(null)
        switchLibraryModeRef.current?.('reader', {
          id: newItem.id,
          title: newItem.title,
          filePath: localPath,
          storageBackend: newItem.storageBackend,
          storedPath: localPath,
          mime: newItem.mime,
          originalName: newItem.originalName,
        })
        switchWorkbenchModeRef.current?.('console')
        setActivePage('library')
      },
    })

    setDownloadingPaper((prev) => {
      const next = new Set(prev)
      next.delete(paper.id)
      return next
    })
    setTimeout(() => setPaperFeedback(null), 8000)
  }, [])

  const switchWorkbenchMode = (nextMode: WorkbenchMode) => {
    if (nextMode === workbenchMode) {
      return
    }

    document.documentElement.dataset.pageDirection = nextMode === 'search' ? 'up' : 'down'
    const startViewTransition = document.startViewTransition?.bind(document)
    if (!startViewTransition) {
      setWorkbenchMode(nextMode)
      return
    }

    startViewTransition(() => {
      flushSync(() => {
        setWorkbenchMode(nextMode)
      })
    })
  }

  const switchLibraryMode = (nextMode: LibraryMode, nextDocument?: PdfReaderDocument | null) => {
    if (nextMode === libraryMode && (nextMode !== 'reader' || nextDocument?.id === readerDocument?.id)) {
      return
    }

    document.documentElement.dataset.pageDirection = (nextMode === 'reader' || nextMode === 'help') ? 'up' : 'down'
    const startViewTransition = document.startViewTransition?.bind(document)
    if (!startViewTransition) {
      setLibraryMode(nextMode)
      setReaderDocument(nextDocument ?? null)
      return
    }

    startViewTransition(() => {
      flushSync(() => {
        setLibraryMode(nextMode)
        setReaderDocument(nextDocument ?? null)
      })
    })
  }

  switchLibraryModeRef.current = switchLibraryMode
  switchWorkbenchModeRef.current = switchWorkbenchMode

  const runSearch = async () => {
    const normalizedQuery = searchQuery.trim()
    if (!normalizedQuery || isSearching || selectedSources.length === 0) {
      return
    }

    const searchToken = searchTokenRef.current + 1
    searchTokenRef.current = searchToken
    switchWorkbenchMode('search')
    setIsSearching(true)
    setSearchPage(1)
    setLastSearchQuery(normalizedQuery)
    setSearchErrors([])

    try {
      const initial = await searchPapers(normalizedQuery, selectedSources, INITIAL_PAPER_RESULTS_PER_SOURCE)
      if (searchTokenRef.current !== searchToken) {
        return
      }

      setSearchResults(initial.results)
      setSearchErrors(initial.errors)
      switchWorkbenchMode('search')
      setIsSearching(false)

      void searchPapers(normalizedQuery, selectedSources, PAPER_RESULTS_PER_SOURCE)
        .then((prefetched) => {
          if (searchTokenRef.current !== searchToken) {
            return
          }
          setSearchResults(prefetched.results)
          setSearchErrors(prefetched.errors)
        })
        .catch(() => {})
    } catch (error) {
      setSearchResults([])
      setSearchErrors([
        {
          sourceId: selectedSources[0] ?? 'arxiv',
          sourceLabel: '检索服务',
          message: error instanceof Error ? error.message : '检索暂时失败',
        },
      ])
      setIsSearching(false)
    } finally {
      if (searchTokenRef.current === searchToken) {
        setIsSearching(false)
      }
    }
  }

  const completeMemoItem = (memoId: string) => {
    setMemoItems((current) => current.map((item) => (item.id === memoId ? { ...item, completing: true } : item)))

    window.setTimeout(() => {
      setMemoItems((current) => current.filter((item) => item.id !== memoId))
    }, 520)
  }

  const addMemoItem = () => {
    const value = memoDraft.trim()
    if (!value) {
      return
    }

    const memoId = `memo-${Date.now()}`
    setMemoItems((current) => [
      {
        id: memoId,
        text: value,
        entering: true,
      },
      ...current,
    ])
    setMemoDraft('')

    window.setTimeout(() => {
      setMemoItems((current) => current.map((item) => (item.id === memoId ? { ...item, entering: false } : item)))
    }, 32)
  }

  const handleMemoAdd = useCallback((text: string) => {
    const memoId = `memo-${Date.now()}`
    setMemoItems((current) => [
      { id: memoId, text, entering: true },
      ...current,
    ])
    window.setTimeout(() => {
      setMemoItems((current) => current.map((item) => (item.id === memoId ? { ...item, entering: false } : item)))
    }, 32)
  }, [])

  const handleWriteDocSave = useCallback((title: string, contentHtml: string, group?: string): string | null => {
    try {
      const doc = createDocument()
      if (!doc) return null
      updateDocument(doc.id, {
        title,
        contentHtml,
        group: group || '默认',
      })
      return doc.id
    } catch {
      return null
    }
  }, [])

  const handleAddTaskPlans = useCallback((tasks: Array<{ title: string; description: string; priority: string; time: string }>): TodayPlan[] => {
    const today = new Date().toISOString().slice(0, 10)
    const newPlans: TodayPlan[] = tasks.map((t, i) => ({
      id: `plan-${Date.now() + i}`,
      date: today,
      time: t.time || '待定',
      title: t.title,
      description: t.description || t.title,
      category: 'work' as const,
      priority: (['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium') as 'high' | 'medium' | 'low',
      status: 'pending' as const,
      source: 'ai',
    }))
    handlePlanGenerated(newPlans)
    return newPlans
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for open-writing-doc events from AiInputCard
  useEffect(() => {
    const handler = (e: Event) => {
      const { docId } = (e as CustomEvent).detail
      if (docId) {
        saveActiveDocId(docId)
        switchPage('writing')
      }
    }
    window.addEventListener('open-writing-doc', handler)
    return () => window.removeEventListener('open-writing-doc', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const removeLibraryItem = (itemId: string) => {
    setLibraryItems((current) => {
      const item = current.find((i) => i.id === itemId)
      // Delete stored PDF copy if it exists
      if (item?.storageBackend && item.storedPath) {
        void deleteStoredPdf({ id: item.id, storageBackend: item.storageBackend, storedPath: item.storedPath })
      }
      return current.map((item) => (item.id === itemId ? { ...item, deleting: true } : item))
    })

    window.setTimeout(() => {
      setLibraryItems((current) => current.filter((item) => item.id !== itemId))
      if (readerDocument?.id === itemId) {
        setReaderDocument(null)
        setLibraryMode('list')
      }
      if (libraryMode === 'help' && itemId === 'guide-coyin-usage') {
        setLibraryMode('list')
      }
    }, 620)
  }

  const handleImportFile = useCallback(async () => {
    const backend = detectStorageBackend()

    if (backend === 'tauri') {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const selected = await open({
          multiple: false,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
        if (!selected) return
        const filePath = typeof selected === 'string' ? selected : (selected as { path: string }).path
        if (!filePath) return

        const { readFile } = await import('@tauri-apps/plugin-fs')
        const { basename } = await import('@tauri-apps/api/path')
        const data = await readFile(filePath)
        const name = await basename(filePath)
        const file = new File([data], name, { type: 'application/pdf' })

        const docId = `doc-${Date.now()}`
        const ref = await importPdfFile(file, docId)
        const newItem: LibraryItem = {
          id: docId,
          title: name.replace(/\.pdf$/i, ''),
          type: 'PDF',
          meta: `${Math.round(ref.size / 1024)} KB / 刚刚导入`,
          status: '已入库',
          filePath: '',
          storageBackend: ref.storageBackend,
          storedPath: ref.storedPath,
          originalName: ref.originalName,
          importedAt: ref.importedAt,
          size: ref.size,
          mime: ref.mime,
        }
        setLibraryItems((current) => [...current, newItem])
        setLibraryToast('已导入 PDF')
      } catch (err) {
        setLibraryToast('导入失败，请重试')
        console.error('Tauri import error:', err)
      }
      return
    }

    // Browser fallback: use hidden file input
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setLibraryToast('暂不支持此文件类型')
        return
      }

      const docId = `doc-${Date.now()}`
      const ref = await importPdfFile(file, docId)
      const newItem: LibraryItem = {
        id: docId,
        title: file.name.replace(/\.pdf$/i, ''),
        type: 'PDF',
        meta: `${Math.round(ref.size / 1024)} KB / 刚刚导入`,
        status: ref.storageBackend === 'indexeddb' ? '已入库' : '本地',
        filePath: '',
        storageBackend: ref.storageBackend,
        storedPath: ref.storedPath,
        originalName: ref.originalName,
        importedAt: ref.importedAt,
        size: ref.size,
        mime: ref.mime,
      }
      setLibraryItems((current) => [...current, newItem])
      setLibraryToast(ref.storageBackend === 'metadata-only'
        ? '当前环境只保存记录，桌面版可保存文件副本'
        : '已导入 PDF')
    }
    input.click()
  }, [])

  const handlePlanGenerated = (newPlans: TodayPlan[]): number => {
    const existing = loadTodayPlans()
    const maxId = existing.reduce((max, p) => {
      const n = parseInt(p.id.replace('plan-', ''), 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)

    let nextId = maxId + 1
    const toAdd: TodayPlan[] = []
    for (const p of newPlans) {
      if (isDuplicatePlan(existing, p)) continue
      toAdd.push({ ...p, id: `plan-${nextId}` })
      nextId++
    }

    if (toAdd.length > 0) {
      const merged = [...existing, ...toAdd]
      setTodayPlans(merged)
      saveTodayPlans(merged)
    }
    return toAdd.length
  }

  const handlePlanStart = (planId: string) => {
    setTodayPlans((current) => {
      const next = updatePlanStatus(current, planId, 'active')
      saveTodayPlans(next)
      const plan = next.find((p) => p.id === planId)
      if (plan) {
        setActiveFocus(startFocus(planId, plan.title))
      }
      return next
    })
  }

  const handlePlanComplete = (planId: string) => {
    setTodayPlans((current) => {
      const next = updatePlanStatus(current, planId, 'done')
      saveTodayPlans(next)
      return next
    })
  }

  const handlePlanUncomplete = (planId: string) => {
    setTodayPlans((current) => {
      const next = updatePlanStatus(current, planId, 'pending')
      saveTodayPlans(next)
      return next
    })
  }

  const handleFocusUpdate = (session: ActiveFocusSession | null) => {
    setActiveFocus(session)
  }

  const handleFocusComplete = (planId: string, _category: FocusCategory) => {
    setTodayPlans((current) => {
      const next = updatePlanStatus(current, planId, 'done')
      saveTodayPlans(next)
      return next
    })
  }

  const handlePlanDelete = (planId: string) => {
    setTodayPlans((current) => {
      const next = removePlan(current, planId)
      saveTodayPlans(next)
      return next
    })
    if (activeFocus?.planId === planId) {
      saveActiveFocus(null)
      setActiveFocus(null)
    }
  }

  return (
    <div className={`app-shell theme-${theme}`} data-theme={theme}>
      <div className="ambient-bg" />
      <GlowParticles theme={theme} />

      <div className={`app-content ${activePage === 'writing' ? 'has-writing' : ''}`}>
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-mark">知</div>
            <div>
              <strong>知页</strong>
            </div>
          </div>

          <nav className="nav-list" aria-label="主导航">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <GlassSurface
                  key={item.id}
                  className="nav-glass"
                  contentClassName="nav-content"
                  theme={theme}
                  radius={18}
                  active={activePage === item.id}
                  onClick={() => switchPage(item.id)}
                  elasticity={0.84}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <ChevronRight className="nav-arrow" size={16} />
                </GlassSurface>
              )
            })}
          </nav>
        </aside>

        <main className="main-area" ref={petContainerRef}>
          <header className="topbar topbar-compact">
            <div className="tool-strip">
              <TopTool icon={Import} label="导入" theme={theme} onClick={() => void handleImportFile()} />
              <TopTool icon={PenLine} label="写作" theme={theme} onClick={() => switchPage('writing')} />
              <DayNightToggleGlass theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
            </div>
          </header>

          <div className="page-stage">
            {activePage === 'workbench' ? (
              layoutEditing ? (
                <HomeLayoutEditor
                  layout={homeLayout}
                  onSave={handleSaveLayout}
                  onCancel={handleCancelLayout}
                  theme={theme}
                />
              ) : (
              <WorkbenchPage
                mode={workbenchMode}
                searchQuery={searchQuery}
                lastSearchQuery={lastSearchQuery}
                activeTab={activeTab}
                searchResults={visibleResults}
                isSearching={isSearching}
                searchPage={Math.min(searchPage, totalPages)}
                totalPages={totalPages}
                memoItems={memoItems}
                memoDraft={memoDraft}
                onQueryChange={setSearchQuery}
                onSearch={runSearch}
                onTabChange={setActiveTab}
                onResumeSearch={() => switchWorkbenchMode('search')}
                onBackToConsole={() => switchWorkbenchMode('console')}
                onPageChange={setSearchPage}
                downloadAndImportPaper={downloadAndImportPaper}
                openExternalUrl={openExternalUrl}
                downloadingPaper={downloadingPaper}
                paperFeedback={paperFeedback}
                paperFeedbackLink={paperFeedbackLink}
                onCompleteMemo={completeMemoItem}
                onMemoDraftChange={setMemoDraft}
                onAddMemo={addMemoItem}
                inspirations={visibleInspirations}
                todayPlans={todayPlans}
                onPlanGenerated={handlePlanGenerated}
                onPlanStart={handlePlanStart}
                onPlanComplete={handlePlanComplete}
                onPlanUncomplete={handlePlanUncomplete}
                onPlanDelete={handlePlanDelete}
                onMemoAddFromCommand={handleMemoAdd}
                onWriteDocSave={handleWriteDocSave}
                onAddTaskPlans={handleAddTaskPlans}
                onChatMessage={handleChatMessage}
                chatSessions={chatSessions}
                activeChatSessionId={activeChatSessionId}
                chatMessages={chatMessages}
                isChatStreaming={isChatStreaming}
                showChatPanel={showChatPanel}
                isChatFullScreen={isChatFullScreen}
                showChatSessionList={showSessionList}
                onChatSend={handleChatMessage}
                onChatSelectSession={handleSelectSession}
                onChatDeleteSession={handleDeleteSession}
                onChatToggleFullScreen={handleToggleFullScreen}
                onChatCloseFullScreen={handleCloseFullScreen}
                onChatToggleSessionList={handleToggleSessionList}
                onChatCloseSessionList={handleCloseSessionList}
                onChatNewSession={handleNewSession}
                theme={theme}
                showInfoPanel={!petSettings.enabled}
                homeLayout={homeLayout}
              />
              )
            ) : null}
            {activePage === 'library' ? (
              libraryMode === 'reader' && readerDocument ? (
                <PdfReaderPage document={readerDocument} onBack={() => switchLibraryMode('list', null)} theme={theme} />
              ) : libraryMode === 'help' ? (
                <HelpPanel theme={theme} onBack={() => switchLibraryMode('list', null)} />
              ) : (
                <>
                  <LibraryPage
                    view={libraryView}
                    onViewChange={setLibraryView}
                    onOpenDocument={(item) => {
                      if (item.type === 'GUIDE') {
                        switchLibraryMode('help', null)
                        return
                      }

                      if (item.type === 'PDF') {
                        const hasStoredCopy = item.storageBackend && item.storageBackend !== 'metadata-only' && item.storedPath
                        if (hasStoredCopy || item.filePath) {
                          switchLibraryMode('reader', {
                            id: item.id,
                            title: item.title,
                            filePath: item.filePath || item.storedPath || '',
                            storageBackend: item.storageBackend,
                            storedPath: item.storedPath,
                            mime: item.mime,
                            originalName: item.originalName,
                          })
                        } else {
                          setLibraryToast('文件记录已保存，但需要重新选择本地文件。')
                        }
                        return
                      }

                      if (['MD', 'TXT', 'DOC', 'CSV', 'TEX'].includes(item.type)) {
                        setLibraryToast('暂不支持预览，但已保存记录')
                        return
                      }

                      setLibraryToast('暂不支持此文件类型')
                    }}
                    onDeleteDocument={removeLibraryItem}
                    items={libraryItems}
                    theme={theme}
                  />
                  {libraryToast && (
                    <div className="library-toast">{libraryToast}</div>
                  )}
                </>
              )
            ) : null}
            {activePage === 'settings' ? (
              <SettingsPage
                theme={theme}
                onEnterLayoutEdit={handleEnterLayoutEdit}
              />
            ) : null}
            {activePage === 'writing' ? <WritingModule theme={theme} onBack={() => switchPage('workbench')} /> : null}
          </div>

          {/* ── Pet Orb (visible on all pages when enabled) ── */}
          {petSettings.enabled && (
            <PetOrb
              settings={petSettings}
              containerRef={petContainerRef}
              onContextMenu={(x, y, paused) => handlePetContextMenu(x, y, paused)}
              onClickOrb={handlePetClick}
              onSpeak={handlePetSpeak}
              onToggleMute={handleToggleMute}
              onChat={handlePetChat}
              speechLine={petSpeechLine}
              showSpeech={showPetSpeech}
            />
          )}

          {/* ── Pet Info Panel Overlay ── */}
          {showPetInfo && (
            <PetInfoPanel
              theme={theme}
              onClose={() => setShowPetInfo(false)}
            />
          )}

          {/* ── Pet Chat Dialog ── */}
          {showPetChat && (
            <PetChatDialog
              userName={petSettings.userName}
              currentPage={activePage}
              theme={theme}
              onClose={() => setShowPetChat(false)}
            />
          )}
        </main>
      </div>

      {activeFocus && (
        <FocusCapsule
          session={activeFocus}
          theme={theme}
          onUpdate={handleFocusUpdate}
          onComplete={handleFocusComplete}
        />
      )}
    </div>
  )
}

function TopTool({ icon: Icon, label, theme, onClick }: { icon: typeof Import; label: string; theme: Theme; onClick?: () => void }) {
  return (
    <GlassSurface
      className="tool-glass"
      contentClassName="tool-content"
      theme={theme}
      radius={18}
      elasticity={0.88}
      onClick={onClick}
    >
      <Icon size={17} />
      <span>{label}</span>
    </GlassSurface>
  )
}

function WorkbenchPage({
  mode,
  searchQuery,
  lastSearchQuery,
  activeTab,
  searchResults,
  isSearching,
  searchPage,
  totalPages,
  memoItems,
  memoDraft,
  onQueryChange,
  onSearch,
  onTabChange,
  onResumeSearch,
  onBackToConsole,
  onPageChange,
  downloadAndImportPaper,
  openExternalUrl,
  downloadingPaper,
  paperFeedback,
  paperFeedbackLink,
  onCompleteMemo,
  onMemoDraftChange,
  onAddMemo,
  inspirations,
  todayPlans,
  onPlanGenerated,
  onPlanStart,
  onPlanComplete,
  onPlanUncomplete,
  onPlanDelete,
  onMemoAddFromCommand,
  onWriteDocSave,
  onAddTaskPlans,
  onChatMessage,
  chatSessions,
  activeChatSessionId,
  chatMessages,
  isChatStreaming,
  showChatPanel,
  isChatFullScreen,
  showChatSessionList,
  onChatSend,
  onChatSelectSession,
  onChatDeleteSession,
  onChatToggleFullScreen,
  onChatCloseFullScreen,
  onChatToggleSessionList,
  onChatCloseSessionList,
  onChatNewSession,
  theme,
  showInfoPanel,
  homeLayout,
}: {
  mode: WorkbenchMode
  searchQuery: string
  lastSearchQuery: string
  activeTab: ResultTab
  searchResults: PaperSearchResult[]
  isSearching: boolean
  searchPage: number
  totalPages: number
  memoItems: MemoItem[]
  memoDraft: string
  onQueryChange: (value: string) => void
  onSearch: () => void
  onTabChange: (value: ResultTab) => void
  onResumeSearch: () => void
  onBackToConsole: () => void
  onPageChange: (value: number) => void
  downloadAndImportPaper: (paper: PaperSearchResult) => Promise<void>
  openExternalUrl: (url: string) => void
  downloadingPaper: Set<string>
  paperFeedback: string | null
  paperFeedbackLink: { label: string; onClick: () => void } | null
  onCompleteMemo: (memoId: string) => void
  onMemoDraftChange: (value: string) => void
  onAddMemo: () => void
  inspirations: InspirationEntry[]
  todayPlans: TodayPlan[]
  onPlanGenerated: (plans: TodayPlan[]) => number
  onPlanStart: (planId: string) => void
  onPlanComplete: (planId: string) => void
  onPlanUncomplete: (planId: string) => void
  onPlanDelete: (planId: string) => void
  onMemoAddFromCommand: (text: string) => void
  onWriteDocSave: (title: string, contentHtml: string, group?: string) => string | null
  onAddTaskPlans: (tasks: Array<{ title: string; description: string; priority: string; time: string }>) => TodayPlan[]
  onChatMessage: (text: string) => void
  chatSessions: ChatSession[]
  activeChatSessionId: string | null
  chatMessages: ChatMessage[]
  isChatStreaming: boolean
  showChatPanel: boolean
  isChatFullScreen: boolean
  showChatSessionList: boolean
  onChatSend: (text: string) => void
  onChatSelectSession: (sessionId: string) => void
  onChatDeleteSession: (sessionId: string) => void
  onChatToggleFullScreen: () => void
  onChatCloseFullScreen: () => void
  onChatToggleSessionList: () => void
  onChatCloseSessionList: () => void
  onChatNewSession: () => void
  theme: Theme
  showInfoPanel: boolean
  homeLayout: HomeLayout
}) {
  const showResume = mode === 'console' && Boolean(lastSearchQuery)

  return (
    <section className="workspace-grid workbench-grid">
      <div className="workbench-main page-primary">
        {mode === 'search' && (
          <button type="button" className="search-back-button" aria-label="返回今日" onClick={onBackToConsole}>
            <ArrowLeft size={16} />
            <span>返回</span>
          </button>
        )}

        {/* ── Compact search bar ── */}
        <div className="search-shell search-shell-compact">
          <div className="search-slot search-slot-compact">
            <Search size={16} />
            <input
              aria-label="搜索论文"
              value={searchQuery}
              placeholder="搜索论文、作者、DOI"
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void onSearch()
              }}
            />
          </div>
          {showResume && (
            <button type="button" className="search-resume-btn" onClick={onResumeSearch}>
              <span>{lastSearchQuery}</span>
              <ChevronRight size={14} />
            </button>
          )}
          <GlassSurface
            className="search-button-glass"
            contentClassName="search-button-content"
            theme={theme}
            radius={16}
            elasticity={0.96}
            onClick={() => void onSearch()}
          >
            {isSearching ? <LoaderCircle className="spin-loop" size={16} /> : <Search size={16} />}
            <span>{isSearching ? '检索中' : '搜索'}</span>
          </GlassSurface>
        </div>

        {mode === 'console' ? (
          <div className="workbench-console">
            <div className="console-grid">
              {homeLayout.order.map((cardId) => {
                switch (cardId) {
                  case 'ai-input':
                    return (
                      <AiInputCard
                        key="ai-input"
                        onPlanGenerated={onPlanGenerated}
                        onMemoAdd={onMemoAddFromCommand}
                        onWriteDocSave={onWriteDocSave}
                        onAddTaskPlans={onAddTaskPlans}
                        onChatMessage={onChatMessage}
                      />
                    )
                  case 'today-plan':
                    return todayPlans.length > 0 ? (
                      <TodayPlanOrbit
                        key="today-plan"
                        plans={todayPlans}
                        onStart={onPlanStart}
                        onComplete={onPlanComplete}
                        onUncomplete={onPlanUncomplete}
                        onDelete={onPlanDelete}
                      />
                    ) : (
                      <div key="today-plan" className="today-plan-empty">
                        <span className="today-plan-empty-hint">输入 <kbd>/plan</kbd> 创建今日计划</span>
                      </div>
                    )
                  case 'memo-card':
                    return (
                      <article key="memo-card" className="content-panel console-card memo-card">
                        <span className="eyebrow">备忘</span>
                        <div className="memo-compose">
                          <input
                            aria-label="新增待办"
                            value={memoDraft}
                            placeholder="添加待办事项"
                            onChange={(event) => onMemoDraftChange(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') onAddMemo()
                            }}
                          />
                          <button type="button" className="memo-add-button" onClick={onAddMemo}>
                            添加
                          </button>
                        </div>
                        <div className="memo-list" role="list">
                          {memoItems.map((item) => (
                            <div
                              key={item.id}
                              className={`memo-item ${item.completing ? 'is-completing' : ''} ${item.entering ? 'is-entering' : ''}`}
                              role="listitem"
                            >
                              <button
                                type="button"
                                className={`memo-toggle ${item.completing ? 'is-checked' : ''}`}
                                aria-label={`完成 ${item.text}`}
                                onClick={() => onCompleteMemo(item.id)}
                                disabled={item.completing}
                              >
                                {item.completing ? (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" /></svg>
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                                )}
                              </button>
                              <span className="memo-text">{item.text}</span>
                              {item.completing ? (
                                <span className="memo-burst" aria-hidden="true">
                                  <span /><span /><span /><span /><span /><span />
                                  <span /><span /><span /><span /><span /><span />
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </article>
                    )
                  case 'info-panel':
                    return <HomeInfoPanel key="info-panel" visible={showInfoPanel} theme={theme} />
                  default:
                    return null
                }
              })}
            </div>
          </div>
        ) : (
          <div className="search-results-view">
            <div className="content-panel results-panel">
              <div className="results-toolbar">
                <div>
                  <h2>检索结果</h2>
                </div>
                <div className="tabs">
                  {resultTabs.map((tab) => (
                    <GlassSurface
                      key={tab.id}
                      className="tab-glass"
                      contentClassName={`tab-content ${activeTab === tab.id ? 'is-active' : ''}`}
                      theme={theme}
                      radius={14}
                      elasticity={0.88}
                      onClick={() => onTabChange(tab.id)}
                    >
                      {tab.label}
                    </GlassSurface>
                  ))}
                </div>
              </div>

              <div className="result-list">
                {paperFeedback && (
                  <div className="paper-feedback-bar">
                    <span>{paperFeedback}</span>
                    {paperFeedbackLink && (
                      <button className="paper-feedback-link" onClick={paperFeedbackLink.onClick}>
                        {paperFeedbackLink.label}
                      </button>
                    )}
                  </div>
                )}
                {isSearching
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <article key={`loading-${index}`} className="result-item paper-result-item is-loading">
                        <div className="loading-lines">
                          <span className="loading-line wide" />
                          <span className="loading-line mid" />
                          <span className="loading-line narrow" />
                        </div>
                        <div className="loading-tags">
                          <span className="loading-pill" />
                          <span className="loading-pill" />
                        </div>
                      </article>
                    ))
                  : searchResults.length
                    ? searchResults.map((item) => (
                        <article key={item.id} className="result-item paper-result-item">
                          <div className="paper-result-copy">
                            <span>{[item.venue || item.itemType, item.year].filter(Boolean).join(' / ')}</span>
                            <h2>{item.title}</h2>
                            <p className="paper-authors">{item.authors.slice(0, 6).join(' · ') || '作者信息待补充'}</p>
                            <p>{item.abstract || '暂无摘要'}</p>
                          </div>
                          <div className="paper-result-side">
                            <GlassSurface className="tag-glass paper-source-tag" contentClassName="tag-content" theme={theme} radius={999} elasticity={0.74}>
                              {item.sourceLabel}
                            </GlassSurface>
                            {item.citedByCount ? (
                              <GlassSurface className="tag-glass paper-cite-tag" contentClassName="tag-content" theme={theme} radius={999} elasticity={0.74}>
                                {item.citedByCount} 引用
                              </GlassSurface>
                            ) : null}
                            <div className="paper-actions">
                              {item.landingUrl && (
                                <button type="button" onClick={() => openExternalUrl(item.landingUrl)}>
                                  <ArrowUpRight size={14} />
                                  <span>网页</span>
                                </button>
                              )}
                              {item.isDownloadable && (
                                <button
                                  type="button"
                                  onClick={() => void downloadAndImportPaper(item)}
                                  disabled={downloadingPaper.has(item.id)}
                                >
                                  {downloadingPaper.has(item.id) ? (
                                    <LoaderCircle size={14} className="spin-loop" />
                                  ) : (
                                    <FileDown size={14} />
                                  )}
                                  <span>{downloadingPaper.has(item.id) ? '入库中' : '下载并入库'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))
                    : lastSearchQuery ? (
                        activeTab === 'pdf' ? (
                          <div className="search-empty">
                            <strong>当前搜索结果中没有可直接下载的 PDF</strong>
                            <p>可尝试切换回"全部"查看，或点击论文的"网页"按钮打开来源页面手动下载。</p>
                          </div>
                        ) : (
                          <div className="search-empty">
                            <strong>未找到相关论文</strong>
                            <p>试试其他关键词</p>
                          </div>
                        )
                      ) : (
                        <div className="search-empty">
                          <strong>输入关键词开始检索</strong>
                        </div>
                      )}
              </div>

              {searchResults.length ? (
                <div className="search-pagination">
                  <GlassSurface
                    className="pager-glass"
                    contentClassName={`pager-content ${searchPage <= 1 ? 'is-disabled' : ''}`}
                    theme={theme}
                    radius={16}
                    elasticity={0.76}
                    onClick={searchPage <= 1 ? undefined : () => onPageChange(searchPage - 1)}
                  >
                    <ChevronLeft size={16} />
                    <span>上一页</span>
                  </GlassSurface>
                  <span className="pager-copy">{searchPage} / {totalPages}</span>
                  <GlassSurface
                    className="pager-glass"
                    contentClassName={`pager-content ${searchPage >= totalPages ? 'is-disabled' : ''}`}
                    theme={theme}
                    radius={16}
                    elasticity={0.76}
                    onClick={searchPage >= totalPages ? undefined : () => onPageChange(searchPage + 1)}
                  >
                    <span>下一页</span>
                    <ChevronRight size={16} />
                  </GlassSurface>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* ── Inspiration side panel ── */}
      <aside className="inspiration-side page-secondary">
        <InspirationPanel inspirations={inspirations} />
        <ChatPanel
          sessions={chatSessions}
          activeSessionId={activeChatSessionId}
          messages={chatMessages}
          isStreaming={isChatStreaming}
          visible={showChatPanel}
          isFullScreen={isChatFullScreen}
          showSessionList={showChatSessionList}
          theme={theme}
          onSend={onChatSend}
          onSelectSession={onChatSelectSession}
          onDeleteSession={onChatDeleteSession}
          onToggleFullScreen={onChatToggleFullScreen}
          onCloseFullScreen={onChatCloseFullScreen}
          onToggleSessionList={onChatToggleSessionList}
          onCloseSessionList={onChatCloseSessionList}
          onNewSession={onChatNewSession}
        />
      </aside>
    </section>
  )
}

function InspirationPanel({
  inspirations,
}: {
  inspirations: InspirationEntry[]
}) {
  return (
    <article className="content-panel inspiration-panel">
      <div className="inspiration-panel-head">
        <div>
          <h2>摘句</h2>
        </div>
      </div>

      <div className="inspiration-track" role="list" aria-label="风景与引语轮播卡片">
        {inspirations.map((item) => (
          <article key={item.id} className="inspiration-card" role="listitem" aria-label={`${item.author} 引语配图`}>
            <div className="inspiration-media" style={{ backgroundImage: `url(${item.image})` }} aria-hidden="true" />
            <div className="inspiration-scrim" />
            <div className="inspiration-meta">
              <span>{item.scene}</span>
              <span>{item.photoCredit}</span>
            </div>

            <div className="inspiration-copy">
              <p className="inspiration-quote">“{item.quote}”</p>
              <div className="inspiration-author">
                <strong>{item.author}</strong>
                <span>{item.source}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </article>
  )
}

function LibraryPage({
  items,
  view,
  onViewChange,
  onOpenDocument,
  onDeleteDocument,
  theme,
}: {
  items: LibraryItem[]
  view: 'list' | 'stream'
  onViewChange: (value: 'list' | 'stream') => void
  onOpenDocument: (item: LibraryItem) => void
  onDeleteDocument: (itemId: string) => void
  theme: Theme
}) {
  return (
    <section className="workspace-grid library-grid is-single-column">
      <div className="content-panel library-panel page-primary">
        <div className="library-toolbar">
          <div>
            <h2>阅读</h2>
          </div>
          <div className="segmented">
            <GlassSurface
              className="segment-glass"
              contentClassName={`segment-content ${view === 'list' ? 'is-active' : ''}`}
              theme={theme}
              radius={14}
              elasticity={0.88}
              onClick={() => onViewChange('list')}
            >
              列表
            </GlassSurface>
            <GlassSurface
              className="segment-glass"
              contentClassName={`segment-content ${view === 'stream' ? 'is-active' : ''}`}
              theme={theme}
              radius={14}
              elasticity={0.88}
              onClick={() => onViewChange('stream')}
            >
              流式
            </GlassSurface>
          </div>
        </div>

        <div className={view === 'stream' ? 'library-items stream' : 'library-items'}>
          {items.map((item) => (
            <article
              key={item.id}
              className={`library-item is-clickable ${item.deleting ? 'is-deleting' : ''}`}
              onClick={() => onOpenDocument(item)}
            >
              <div className="library-item-main">
                <div className="file-badge">{item.type}</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.meta}</p>
                </div>
                <GlassSurface className="tag-glass" contentClassName="tag-content" theme={theme} radius={999} elasticity={0.74}>
                  {item.status}
                </GlassSurface>
              </div>
              <div className="library-item-delete-wrap">
                <GlassSurface
                  className="library-delete-glass"
                  contentClassName="library-delete-content"
                  theme={theme}
                  radius={999}
                  elasticity={0.78}
                >
                  <button
                    type="button"
                    className="library-delete-button"
                    aria-label={`删除 ${item.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteDocument(item.id)
                    }}
                  >
                    <span className="trash-icon">
                      <span className="trash-lid" />
                      <span className="trash-body" />
                    </span>
                  </button>
                </GlassSurface>
                {item.deleting ? (
                  <span className="library-delete-burst" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function SettingsPage({ theme, onEnterLayoutEdit }: { theme: Theme; onEnterLayoutEdit: () => void }) {
  return (
    <section className="settings-page page-primary">
      {settingsSections.map((section) => (
        <article key={section.title} className="content-panel setting-card">
          <div className="setting-icon"><FileText size={20} /></div>
          <div>
            <h2>{section.title}</h2>
            <GlassSurface
              className="setting-pill-glass"
              contentClassName={`setting-pill-content ${section.title === '外观' ? 'is-active' : ''}`}
              theme={theme}
              radius={999}
              elasticity={0.78}
            >
              {section.value}
            </GlassSurface>
            <p>{section.detail}</p>
          </div>
        </article>
      ))}
      <AiProviderSettings />
      <PetSettingsCard />
      {/* ── Layout editor - standalone card ── */}
      <article className="content-panel pet-settings-card">
        <div className="pet-settings-header">
          <div className="setting-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div>
            <h2>主页布局</h2>
            <p>调整工作台卡片排列顺序</p>
          </div>
        </div>
        <button
          className="ai-btn pet-layout-edit-btn"
          onClick={onEnterLayoutEdit}
        >
          进入布局编辑模式
        </button>
      </article>
    </section>
  )
}

function getTimeOfDay(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 8) return '清晨'
  if (h >= 8 && h < 12) return '上午'
  if (h >= 12 && h < 14) return '中午'
  if (h >= 14 && h < 18) return '下午'
  if (h >= 18 && h < 22) return '晚上'
  return '深夜'
}
