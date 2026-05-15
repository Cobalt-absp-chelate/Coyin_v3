export type PaperSourceId = 'arxiv' | 'openalex' | 'crossref' | 'dblp'

export type PaperSourceMeta = {
  id: PaperSourceId
  label: string
  detail: string
}

export type PaperSearchResult = {
  id: string
  sourceId: PaperSourceId
  sourceLabel: string
  title: string
  authors: string[]
  year: string
  itemType: string
  abstract: string
  venue: string
  landingUrl: string
  pdfUrl: string
  doi: string
  citedByCount: number | null
  isOpenAccess: boolean
  // Computed after normalization
  isDownloadable?: boolean
  downloadReason?: string
  resolvedPdfUrl?: string
  arxivId?: string
}

export type PaperSearchError = {
  sourceId: PaperSourceId
  sourceLabel: string
  message: string
}

export const paperSources: PaperSourceMeta[] = [
  { id: 'arxiv', label: 'arXiv', detail: '预印本' },
  { id: 'openalex', label: 'OpenAlex', detail: '开放索引' },
  { id: 'crossref', label: 'Crossref', detail: '期刊 DOI' },
  { id: 'dblp', label: 'DBLP', detail: '计算机领域' },
]

import { appFetch } from './httpClient'

const ATOM_NAMESPACE = 'http://www.w3.org/2005/Atom'
export const PAPER_RESULTS_PER_SOURCE = 18
export const INITIAL_PAPER_RESULTS_PER_SOURCE = 6

const endpointMap: Record<PaperSourceId, string> = {
  arxiv: import.meta.env.DEV ? '/api/arxiv' : 'https://export.arxiv.org/api/query',
  openalex: import.meta.env.DEV ? '/api/openalex' : 'https://api.openalex.org/works',
  crossref: import.meta.env.DEV ? '/api/crossref' : 'https://api.crossref.org/works',
  dblp: import.meta.env.DEV ? '/api/dblp' : 'https://dblp.org/search/publ/api',
}

function sourceMeta(sourceId: PaperSourceId) {
  return paperSources.find((source) => source.id === sourceId) ?? paperSources[0]
}

function sanitizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function decodeHtml(value: string) {
  const host = document.createElement('textarea')
  host.innerHTML = value
  return host.value
}

function shortId(sourceId: PaperSourceId, seed: string) {
  return `${sourceId}-${seed.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 48) || 'result'}`
}

function buildAbstractFromInvertedIndex(invertedIndex: Record<string, number[]> | undefined) {
  if (!invertedIndex) {
    return ''
  }

  const words = Object.entries(invertedIndex)
    .flatMap(([word, positions]) => positions.map((position) => ({ position, word })))
    .sort((left, right) => left.position - right.position)
    .slice(0, 220)
    .map((item) => item.word)

  return sanitizeText(words.join(' '))
}

// ── PDF URL resolution ──

function looksLikePdfUrl(url: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return lower.endsWith('.pdf') || lower.includes('/pdf/') || lower.includes('pdf?')
}

function looksLikeWebUrl(url: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  // Common non-PDF patterns
  return /zenodo\.org\/records\/\d+$/i.test(lower) ||
    /doi\.org\/[^/]+\/[^/]+$/i.test(lower) ||
    /arxiv\.org\/abs\//i.test(lower) ||
    /openalex\.org\//i.test(lower) ||
    /crossref\.org\//i.test(lower) ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm')
}

function extractArxivId(paper: PaperSearchResult): string {
  // From landing URL: https://arxiv.org/abs/2501.12345 → 2501.12345
  if (paper.landingUrl) {
    const m = paper.landingUrl.match(/arxiv\.org\/abs\/([\w.-]+)/i)
    if (m) return m[1]
  }
  // From pdf URL
  if (paper.pdfUrl) {
    const m = paper.pdfUrl.match(/arxiv\.org\/pdf\/([\w.-]+)/i)
    if (m) return m[1]
  }
  return ''
}

function computeOpenAlexPdfUrl(item: Record<string, unknown>): string {
  // 1. primary_location.pdf_url
  const primaryLocation = (item.primary_location as Record<string, unknown> | null) ?? {}
  const primaryPdf = String(primaryLocation.pdf_url ?? '')

  // 2. best_oa_location — often has the real PDF URL
  const bestOa = item.best_oa_location as Record<string, unknown> | null | undefined
  const bestOaPdf = bestOa ? String(bestOa.pdf_url ?? '') : ''

  // 3. open_access.oa_url
  const openAccess = item.open_access as Record<string, unknown> | null | undefined
  const oaUrl = openAccess ? String(openAccess.oa_url ?? '') : ''

  // Pick the best one: prefer actual PDF URLs over landing pages
  const candidates = [primaryPdf, bestOaPdf, oaUrl].filter(Boolean)
  for (const url of candidates) {
    if (looksLikePdfUrl(url)) return url
  }
  // Fall back to first candidate that isn't clearly a webpage
  for (const url of candidates) {
    if (!looksLikeWebUrl(url)) return url
  }
  return candidates[0] || ''
}

export function normalizePaperResult(paper: PaperSearchResult): PaperSearchResult {
  let resolvedPdfUrl = ''
  let isDownloadable = false
  let downloadReason = ''
  let arxivId = ''

  // ── arXiv ──
  if (paper.sourceId === 'arxiv') {
    arxivId = extractArxivId(paper)
    if (arxivId) {
      resolvedPdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`
      isDownloadable = true
      downloadReason = `arXiv PDF: ${resolvedPdfUrl}`
    } else if (paper.pdfUrl && looksLikePdfUrl(paper.pdfUrl)) {
      resolvedPdfUrl = paper.pdfUrl
      isDownloadable = true
      downloadReason = `arXiv 直链`
    }
  }

  // ── OpenAlex ──
  if (paper.sourceId === 'openalex') {
    if (paper.pdfUrl && looksLikePdfUrl(paper.pdfUrl)) {
      resolvedPdfUrl = paper.pdfUrl
      isDownloadable = true
      downloadReason = 'OpenAlex PDF URL'
    } else if (paper.pdfUrl && !looksLikeWebUrl(paper.pdfUrl)) {
      resolvedPdfUrl = paper.pdfUrl
      isDownloadable = true
      downloadReason = 'OpenAlex 候选 PDF URL'
    } else if (paper.isOpenAccess && paper.doi) {
      // Might be downloadable via Unpaywall or similar, but not guaranteed
      isDownloadable = false
      downloadReason = 'Open Access 但无直链'
    } else {
      isDownloadable = false
      downloadReason = paper.pdfUrl ? 'URL 不是 PDF 直链' : '无 PDF 链接'
    }
  }

  // ── Crossref ──
  if (paper.sourceId === 'crossref') {
    if (paper.pdfUrl && looksLikePdfUrl(paper.pdfUrl)) {
      resolvedPdfUrl = paper.pdfUrl
      isDownloadable = true
      downloadReason = 'Crossref PDF 直链'
    } else if (paper.pdfUrl && !looksLikeWebUrl(paper.pdfUrl)) {
      resolvedPdfUrl = paper.pdfUrl
      isDownloadable = true
      downloadReason = 'Crossref 候选 PDF'
    } else {
      isDownloadable = false
      downloadReason = paper.pdfUrl ? 'Crossref URL 不是 PDF 直链' : '无 PDF 链接'
    }
  }

  // ── DBLP (never has PDF) ──
  if (paper.sourceId === 'dblp') {
    isDownloadable = false
    downloadReason = 'DBLP 不提供 PDF'
  }

  return {
    ...paper,
    isDownloadable,
    downloadReason,
    resolvedPdfUrl: resolvedPdfUrl || paper.pdfUrl || '',
    arxivId: arxivId || '',
  }
}

export async function resolvePdfUrl(paper: PaperSearchResult): Promise<string | null> {
  // 1. Already have a good resolved PDF URL
  if (paper.resolvedPdfUrl && looksLikePdfUrl(paper.resolvedPdfUrl)) {
    return paper.resolvedPdfUrl
  }

  // 2. arXiv: construct from ID
  if (paper.sourceId === 'arxiv') {
    const arxivId = paper.arxivId || extractArxivId(paper)
    if (arxivId) {
      return `https://arxiv.org/pdf/${arxivId}.pdf`
    }
  }

  // 3. Have a candidate URL — try HEAD to check content-type
  if (paper.resolvedPdfUrl || paper.pdfUrl) {
    const candidateUrl = paper.resolvedPdfUrl || paper.pdfUrl

    if (looksLikeWebUrl(candidateUrl)) {
      console.log(`[resolve-pdf] URL looks like a webpage, not PDF: ${candidateUrl}`)
      return null
    }

    // Quick check: if URL ends with .pdf, trust it
    if (candidateUrl.toLowerCase().endsWith('.pdf')) {
      return candidateUrl
    }

    // Otherwise try HEAD request
    try {
      const { appFetch } = await import('./httpClient')
      const headResp = await appFetch(candidateUrl, { method: 'HEAD' })
      const contentType = headResp.headers.get('content-type') || ''
      console.log(`[resolve-pdf] HEAD ${candidateUrl} → content-type: ${contentType}`)
      if (contentType.includes('application/pdf')) {
        return candidateUrl
      }
      if (contentType.includes('text/html')) {
        console.log(`[resolve-pdf] URL returns HTML, not PDF: ${candidateUrl}`)
        return null
      }
    } catch {
      // HEAD failed, try GET with range to minimize data
    }

    // Last resort: if we can't verify, return the URL but log a warning
    console.log(`[resolve-pdf] could not verify content-type, using URL as-is: ${candidateUrl}`)
    return candidateUrl
  }

  return null
}

function mergeResult(preferred: PaperSearchResult, incoming: PaperSearchResult) {
  return {
    ...preferred,
    authors: preferred.authors.length >= incoming.authors.length ? preferred.authors : incoming.authors,
    abstract: preferred.abstract.length >= incoming.abstract.length ? preferred.abstract : incoming.abstract,
    venue: preferred.venue || incoming.venue,
    landingUrl: preferred.landingUrl || incoming.landingUrl,
    pdfUrl: preferred.pdfUrl || incoming.pdfUrl,
    doi: preferred.doi || incoming.doi,
    citedByCount: preferred.citedByCount ?? incoming.citedByCount,
    isOpenAccess: preferred.isOpenAccess || incoming.isOpenAccess,
    isDownloadable: preferred.isDownloadable || incoming.isDownloadable,
    downloadReason: preferred.downloadReason || incoming.downloadReason,
    resolvedPdfUrl: preferred.resolvedPdfUrl || incoming.resolvedPdfUrl,
    arxivId: preferred.arxivId || incoming.arxivId,
  }
}

function dedupeResults(results: PaperSearchResult[]) {
  const unique = new Map<string, PaperSearchResult>()

  for (const result of results) {
    const key = result.doi || `${sanitizeText(result.title).toLowerCase()}::${result.year}`
    const existing = unique.get(key)

    if (!existing) {
      unique.set(key, result)
      continue
    }

    unique.set(key, mergeResult(existing, result))
  }

  return Array.from(unique.values()).sort((left, right) => {
    const citationGap = (right.citedByCount ?? -1) - (left.citedByCount ?? -1)
    if (citationGap !== 0) {
      return citationGap
    }

    const yearGap = Number.parseInt(right.year || '0', 10) - Number.parseInt(left.year || '0', 10)
    if (yearGap !== 0) {
      return yearGap
    }

    return left.title.localeCompare(right.title)
  })
}

async function searchArxiv(query: string, perSourceLimit: number) {
  const url = new URL(endpointMap.arxiv, window.location.origin)
  url.searchParams.set('search_query', `all:${query}`)
  url.searchParams.set('start', '0')
  url.searchParams.set('max_results', String(perSourceLimit))

  const response = await appFetch(url.toString(), {
    headers: { Accept: 'application/atom+xml' },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const xml = await response.text()
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const entries = Array.from(doc.getElementsByTagNameNS(ATOM_NAMESPACE, 'entry'))
  const source = sourceMeta('arxiv')

  return entries.map<PaperSearchResult>((entry) => {
    const title = sanitizeText(entry.getElementsByTagNameNS(ATOM_NAMESPACE, 'title')[0]?.textContent ?? '未命名条目')
    const abstract = sanitizeText(entry.getElementsByTagNameNS(ATOM_NAMESPACE, 'summary')[0]?.textContent ?? '')
    const authors = Array.from(entry.getElementsByTagNameNS(ATOM_NAMESPACE, 'author'))
      .map((author) => sanitizeText(author.getElementsByTagNameNS(ATOM_NAMESPACE, 'name')[0]?.textContent ?? ''))
      .filter(Boolean)
    const published = entry.getElementsByTagNameNS(ATOM_NAMESPACE, 'published')[0]?.textContent ?? ''
    const links = Array.from(entry.getElementsByTagNameNS(ATOM_NAMESPACE, 'link'))
    const landingUrl = links.find((link) => link.getAttribute('rel') === 'alternate')?.getAttribute('href') ?? ''
    const pdfUrl = links.find((link) => link.getAttribute('title') === 'pdf')?.getAttribute('href') ?? ''
    const doi = sanitizeText(entry.getElementsByTagNameNS('http://arxiv.org/schemas/atom', 'doi')[0]?.textContent ?? '')

    return {
      id: shortId('arxiv', landingUrl || title),
      sourceId: 'arxiv',
      sourceLabel: source.label,
      title,
      authors,
      year: published.slice(0, 4),
      itemType: '预印本',
      abstract,
      venue: 'arXiv',
      landingUrl,
      pdfUrl,
      doi,
      citedByCount: null,
      isOpenAccess: true,
    }
  })
}

async function searchOpenAlex(query: string, perSourceLimit: number) {
  const url = new URL(endpointMap.openalex, window.location.origin)
  url.searchParams.set('search', query)
  url.searchParams.set('per-page', String(perSourceLimit))

  const response = await appFetch(url.toString())
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  const source = sourceMeta('openalex')

  return (payload.results ?? []).map((item: Record<string, unknown>) => {
    const primaryLocation = (item.primary_location as Record<string, unknown> | null) ?? {}
    const sourceInfo = (primaryLocation.source as Record<string, unknown> | null) ?? {}
    const authorships = Array.isArray(item.authorships) ? item.authorships : []

    return {
      id: shortId('openalex', String(item.id ?? item.display_name ?? 'result')),
      sourceId: 'openalex' as const,
      sourceLabel: source.label,
      title: sanitizeText(String(item.display_name ?? item.title ?? '未命名条目')),
      authors: authorships
        .map((entry) => {
          const author = (entry as Record<string, unknown>).author as Record<string, unknown> | undefined
          return sanitizeText(String(author?.display_name ?? ''))
        })
        .filter(Boolean),
      year: String(item.publication_year ?? ''),
      itemType: sanitizeText(String(item.type ?? '文献')),
      abstract: buildAbstractFromInvertedIndex(item.abstract_inverted_index as Record<string, number[]> | undefined),
      venue: sanitizeText(String(sourceInfo.display_name ?? '')),
      landingUrl: sanitizeText(String(primaryLocation.landing_page_url ?? item.id ?? '')),
      pdfUrl: sanitizeText(computeOpenAlexPdfUrl(item)),
      doi: sanitizeText(String(item.doi ?? '')).replace('https://doi.org/', ''),
      citedByCount: typeof item.cited_by_count === 'number' ? item.cited_by_count : null,
      isOpenAccess: Boolean((item.open_access as Record<string, unknown> | undefined)?.is_oa),
    }
  })
}

async function searchCrossref(query: string, perSourceLimit: number) {
  const url = new URL(endpointMap.crossref, window.location.origin)
  url.searchParams.set('query', query)
  url.searchParams.set('rows', String(perSourceLimit))
  url.searchParams.set('select', 'DOI,title,author,type,issued,URL,container-title,abstract,link')

  const response = await appFetch(url.toString())
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  const items = payload.message?.items ?? []
  const source = sourceMeta('crossref')

  return items.map((item: Record<string, unknown>) => {
    const titleList = Array.isArray(item.title) ? item.title : []
    const venueList = Array.isArray(item['container-title']) ? item['container-title'] : []
    const linkList = Array.isArray(item.link) ? item.link : []
    const authors = Array.isArray(item.author)
      ? item.author
          .map((author) => {
            const record = author as Record<string, unknown>
            return sanitizeText([String(record.given ?? ''), String(record.family ?? '')].filter(Boolean).join(' '))
          })
          .filter(Boolean)
      : []
    const yearParts = (item.issued as { 'date-parts'?: number[][] } | undefined)?.['date-parts'] ?? []
    const pdfLink = linkList.find((link) => (link as Record<string, unknown>)['content-type'] === 'application/pdf') as
      | Record<string, unknown>
      | undefined

    return {
      id: shortId('crossref', String(item.DOI ?? titleList[0] ?? 'result')),
      sourceId: 'crossref' as const,
      sourceLabel: source.label,
      title: sanitizeText(String(titleList[0] ?? '未命名条目')),
      authors,
      year: yearParts[0]?.[0] ? String(yearParts[0][0]) : '',
      itemType: sanitizeText(String(item.type ?? '文献')),
      abstract: sanitizeText(decodeHtml(String(item.abstract ?? '')).replace(/<\/?jats:[^>]+>/g, '')),
      venue: sanitizeText(String(venueList[0] ?? '')),
      landingUrl: sanitizeText(String(item.URL ?? '')),
      pdfUrl: sanitizeText(String(pdfLink?.URL ?? '')),
      doi: sanitizeText(String(item.DOI ?? '')),
      citedByCount: null,
      isOpenAccess: Boolean(pdfLink?.URL),
    }
  })
}

async function searchDblp(query: string, perSourceLimit: number) {
  const url = new URL(endpointMap.dblp, window.location.origin)
  url.searchParams.set('q', query)
  url.searchParams.set('h', String(perSourceLimit))
  url.searchParams.set('format', 'json')

  const response = await appFetch(url.toString())
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  const hits = payload.result?.hits?.hit ?? []
  const source = sourceMeta('dblp')

  return hits.map((hit: Record<string, unknown>) => {
    const info = (hit.info as Record<string, unknown> | undefined) ?? {}
    const authorsField = (info.authors as Record<string, unknown> | undefined)?.author
    const authors = Array.isArray(authorsField)
      ? authorsField.map((entry) => sanitizeText(String((entry as Record<string, unknown>).text ?? entry))).filter(Boolean)
      : authorsField
        ? [sanitizeText(String((authorsField as Record<string, unknown>).text ?? authorsField))]
        : []

    return {
      id: shortId('dblp', String(info.url ?? info.title ?? 'result')),
      sourceId: 'dblp' as const,
      sourceLabel: source.label,
      title: sanitizeText(String(info.title ?? '未命名条目')),
      authors,
      year: sanitizeText(String(info.year ?? '')),
      itemType: sanitizeText(String(info.type ?? '文献')),
      abstract: sanitizeText(String(info.venue ?? '')),
      venue: sanitizeText(String(info.venue ?? '')),
      landingUrl: sanitizeText(String(info.url ?? '')),
      pdfUrl: '',
      doi: '',
      citedByCount: null,
      isOpenAccess: false,
    }
  })
}

const sourceSearchers: Record<PaperSourceId, (query: string, perSourceLimit: number) => Promise<PaperSearchResult[]>> = {
  arxiv: searchArxiv,
  openalex: searchOpenAlex,
  crossref: searchCrossref,
  dblp: searchDblp,
}

export async function searchPapers(query: string, sourceIds: PaperSourceId[], perSourceLimit = PAPER_RESULTS_PER_SOURCE) {
  const normalizedQuery = sanitizeText(query)
  if (!normalizedQuery) {
    return { results: [], errors: [] as PaperSearchError[] }
  }

  const settled = await Promise.allSettled(
    sourceIds.map(async (sourceId) => {
      const results = await sourceSearchers[sourceId](normalizedQuery, perSourceLimit)
      return { sourceId, results }
    }),
  )

  const results: PaperSearchResult[] = []
  const errors: PaperSearchError[] = []

  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results.push(...item.value.results)
      continue
    }

    const failedSource = sourceIds[settled.indexOf(item)]
    const source = sourceMeta(failedSource)
    errors.push({
      sourceId: failedSource,
      sourceLabel: source.label,
      message: item.reason instanceof Error ? item.reason.message : '检索暂时失败',
    })
  }

  const deduped = dedupeResults(results)
  const normalized = deduped.map(normalizePaperResult)

  if (import.meta.env.DEV) {
    console.log('[search] normalized results:',
      normalized.map((r) => ({
        title: r.title.slice(0, 60),
        sourceLabel: r.sourceLabel,
        venue: r.venue,
        isDownloadable: r.isDownloadable,
        downloadReason: r.downloadReason,
        resolvedPdfUrl: r.resolvedPdfUrl?.slice(0, 80),
        pdfUrl: r.pdfUrl?.slice(0, 80),
        doi: r.doi,
      })),
    )
  }

  return {
    results: normalized,
    errors,
  }
}
