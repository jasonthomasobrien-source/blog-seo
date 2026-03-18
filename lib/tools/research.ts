import * as cheerio from 'cheerio'
import Anthropic from '@anthropic-ai/sdk'
import { writeFile, readFile, setConfig } from '../storage'

const ZILLOW_CSVS: Record<string, string> = {
  median_sale_price:
    'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  days_on_market:
    'https://files.zillowstatic.com/research/public_csvs/dom/Metro_median_dom_uc_sfrcondo_sm_month.csv',
  inventory:
    'https://files.zillowstatic.com/research/public_csvs/invt/Metro_invt_fs_uc_sfrcondo_sm_month.csv',
}

const GKAR_URL = 'https://www.gkar.com/market-statistics/'
const KALAMAZOO_MSA = 'Kalamazoo'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

interface NewsItem {
  title: string
  url: string
  snippet: string
  query: string
  date: string
  score: number
  source: string
}

interface StatItem {
  metric: string
  value: string
  region: string
  date: string
  freshness: string
  source: string
}

interface SourceItem {
  type: string
  title?: string
  url?: string
  query?: string
  metric?: string
  region?: string
  date?: string
  scraped_at?: string
  note?: string
}

// ── Layer 1: Tavily Search ──────────────────────────────────────────────────

async function fetchTavilyNews(
  area: string,
  topic: string | null,
  onLog: (line: string) => void
): Promise<{ news: NewsItem[]; sources: SourceItem[] }> {
  const apiKey = process.env.TAVILY_API_KEY || ''
  if (!apiKey || apiKey === 'your_tavily_api_key_here') {
    onLog('Warning: TAVILY_API_KEY not set — skipping news search.')
    return { news: [], sources: [] }
  }

  const now = new Date()
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const queries = [
    `Kalamazoo real estate market ${monthYear}`,
    `Portage Michigan home prices housing market ${monthYear}`,
    `Plainwell Otsego Richland Michigan real estate ${monthYear}`,
    `West Michigan housing inventory days on market ${monthYear}`,
    `Kalamazoo County mortgage rates home buyers ${monthYear}`,
  ]

  if (topic) {
    queries.unshift(`${topic} Kalamazoo Portage West Michigan real estate ${monthYear}`)
  }

  const newsItems: NewsItem[] = []
  const sources: SourceItem[] = []
  const seenUrls = new Set<string>()

  for (const query of queries) {
    try {
      onLog(`Searching: ${query}`)
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'advanced',
          max_results: 5,
          days: 7,
        }),
      })

      if (!resp.ok) {
        onLog(`Warning: Tavily search failed for "${query}": HTTP ${resp.status}`)
        continue
      }

      const data = await resp.json()
      for (const item of data.results || []) {
        const url = item.url || ''
        if (seenUrls.has(url)) continue
        seenUrls.add(url)

        const entry: NewsItem = {
          title: item.title || '',
          url,
          snippet: (item.content || '').substring(0, 400),
          query,
          date: item.published_date || '',
          score: item.score || 0,
          source: 'tavily_search',
        }
        newsItems.push(entry)
        sources.push({ type: 'web', title: entry.title, url, query })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      onLog(`Warning: Tavily search failed for "${query}": ${msg}`)
    }
  }

  // Sort by relevance score
  newsItems.sort((a, b) => b.score - a.score)

  return { news: newsItems, sources }
}

// ── Layer 2: Zillow Research CSVs ────────────────────────────────────────────

function parseSimpleCsv(text: string): Array<Record<string, string>> {
  const lines = text.split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    rows.push(row)
  }
  return rows
}

async function fetchZillowStats(
  onLog: (line: string) => void
): Promise<{ stats: StatItem[]; sources: SourceItem[] }> {
  const stats: StatItem[] = []
  const sources: SourceItem[] = []

  for (const [metric, url] of Object.entries(ZILLOW_CSVS)) {
    try {
      onLog(`Fetching Zillow ${metric}…`)
      const resp = await fetch(url, { headers: BROWSER_HEADERS })
      if (!resp.ok) {
        onLog(`Warning: Zillow CSV fetch failed for ${metric}: HTTP ${resp.status}`)
        continue
      }
      const text = await resp.text()
      const rows = parseSimpleCsv(text)

      for (const row of rows) {
        const region = row['RegionName'] || ''
        if (!region.toLowerCase().includes(KALAMAZOO_MSA.toLowerCase())) continue

        // Find most recent date column
        const dateCols = Object.keys(row).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
        if (!dateCols.length) break
        dateCols.sort()
        const latestDate = dateCols[dateCols.length - 1]
        const value = row[latestDate] || ''

        if (value && !['', 'NA', 'N/A'].includes(value)) {
          stats.push({
            metric,
            value,
            region,
            date: latestDate,
            freshness: 'monthly',
            source: 'zillow_research',
          })
          sources.push({ type: 'zillow_csv', metric, url, region, date: latestDate })
        }
        break // Only need the Kalamazoo row
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      onLog(`Warning: Zillow CSV fetch failed for ${metric}: ${msg}`)
    }
  }

  return { stats, sources }
}

// ── Layer 3: GKAR Scrape ────────────────────────────────────────────────────

async function fetchGkarStats(
  onLog: (line: string) => void
): Promise<{ stats: StatItem[]; sources: SourceItem[] }> {
  try {
    onLog('Scraping GKAR market statistics…')
    const resp = await fetch(GKAR_URL, { headers: BROWSER_HEADERS })
    if (!resp.ok) {
      onLog(`Warning: GKAR scrape failed: HTTP ${resp.status}`)
      return { stats: [], sources: [] }
    }

    const html = await resp.text()
    const $ = cheerio.load(html)

    const stats: StatItem[] = []
    const sources: SourceItem[] = []

    const statLabels: Record<string, string> = {
      median: 'median_sale_price_gkar',
      average: 'average_sale_price_gkar',
      sold: 'units_sold_gkar',
      listed: 'new_listings_gkar',
      days: 'days_on_market_gkar',
      inventory: 'months_supply_gkar',
    }

    for (const [label, metricKey] of Object.entries(statLabels)) {
      let found = false
      $('*').each((_, el) => {
        if (found) return
        const text = $(el).text()
        if (!text.toLowerCase().includes(label.toLowerCase())) return

        // Look for nearby numeric value
        const nextText = $(el).next().text() || $(el).parent().next().text() || ''
        const match = nextText.match(/\$[\d,]+|\d+[\.,]\d+|\d{2,}/)
        if (match) {
          stats.push({
            metric: metricKey,
            value: match[0],
            region: 'Greater Kalamazoo (GKAR)',
            date: new Date().toISOString().split('T')[0],
            freshness: 'monthly',
            source: 'gkar_scrape',
          })
          found = true
        }
      })
    }

    sources.push({ type: 'gkar_website', url: GKAR_URL, scraped_at: new Date().toISOString() })
    return { stats, sources }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`Warning: GKAR scrape failed: ${msg}. Continuing without GKAR data.`)
    return { stats: [], sources: [] }
  }
}

// ── Build sources.md ────────────────────────────────────────────────────────

function buildSourcesMd(
  area: string,
  topic: string,
  news: NewsItem[],
  stats: StatItem[],
  sources: SourceItem[]
): string {
  const now = new Date().toISOString()
  const lines: string[] = [
    `# Research Data — ${area}`,
    `Generated: ${now}`,
    topic ? `Topic: ${topic}` : '',
    '',
    '## Market Statistics',
  ]

  if (stats.length === 0) {
    lines.push('No stats retrieved.')
  } else {
    for (const s of stats) {
      lines.push(`- **${s.metric}**: ${s.value} (${s.region}, ${s.date}, via ${s.source})`)
    }
  }

  lines.push('', '## Recent News & Articles')

  if (news.length === 0) {
    lines.push('No recent news retrieved.')
  } else {
    for (const n of news) {
      lines.push(`### ${n.title}`)
      lines.push(`URL: ${n.url}`)
      if (n.date) lines.push(`Date: ${n.date}`)
      lines.push(`Query: ${n.query}`)
      lines.push('')
      lines.push(n.snippet)
      lines.push('')
    }
  }

  lines.push('## Sources')
  for (const s of sources) {
    if (s.url) lines.push(`- [${s.type}] ${s.title || s.metric || s.type}: ${s.url}`)
  }

  return lines.filter(l => l !== undefined).join('\n')
}

// ── Layer 4: Claude Community Research Fallback ──────────────────────────────

async function fetchClaudeCommunityResearch(
  topic: string,
  onLog: (line: string) => void
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey || apiKey.startsWith('sk-ant-YOUR')) return ''

  try {
    onLog('No news data from Tavily — using Claude to generate community research context…')
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a local real estate research assistant. Generate a detailed research brief for this blog post topic:

TOPIC: ${topic}

Provide specific, accurate information about:
1. The city/community itself — population, character, location relative to Kalamazoo, major employers, school districts
2. Real estate market — typical home price ranges (be specific with $ figures), market conditions, housing stock types
3. Neighborhood highlights — specific street names, parks, landmarks, downtown areas, local businesses
4. Schools — district name, notable schools, ratings if known
5. Commute — drive times to Kalamazoo, major routes, traffic considerations
6. What makes this community unique — something that would resonate with someone relocating from out of state
7. Any recent developments, new construction, or growth trends

Be specific and accurate. Use real place names. If you're not certain of a specific figure, give a reasonable range and note it's approximate. Do NOT fabricate statistics — if you don't know, say "approximately" or omit it.

Format as a research brief with clear sections. This will be used by a blog writer to write an authentic local real estate guide.`
      }],
    })

    const text = (message.content[0] as { type: string; text: string }).text
    onLog(`✓ Claude community research: ${text.length} chars of context`)
    return text
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`Warning: Claude research fallback failed: ${msg}`)
    return ''
  }
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function runResearch(
  area: string,
  topic: string,
  onLog: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    onLog(`▶ Research started for area: ${area}${topic ? `, topic: ${topic}` : ''}`)

    // Layer 1: Tavily
    const { news, sources: newsSources } = await fetchTavilyNews(area, topic || null, onLog)
    onLog(`✓ Tavily: ${news.length} articles found`)

    // Layer 2: Zillow
    const { stats: zillowStats, sources: zillowSources } = await fetchZillowStats(onLog)
    onLog(`✓ Zillow: ${zillowStats.length} stats found`)

    // Layer 3: GKAR
    const { stats: gkarStats, sources: gkarSources } = await fetchGkarStats(onLog)
    onLog(`✓ GKAR: ${gkarStats.length} stats found`)

    const allStats = [...zillowStats, ...gkarStats]
    const allSources = [...newsSources, ...zillowSources, ...gkarSources]

    // Layer 4: Claude community research fallback when no news data
    let claudeResearch = ''
    if (news.length === 0 && topic) {
      claudeResearch = await fetchClaudeCommunityResearch(topic, onLog)
    }

    // Build sources.md
    let sourcesMd = buildSourcesMd(area, topic, news, allStats, allSources)
    if (claudeResearch) {
      sourcesMd += '\n\n## Community Research Brief\n' + claudeResearch
    }

    // Build research.json
    const researchJson = JSON.stringify(
      {
        area,
        topic: topic || null,
        timestamp: new Date().toISOString(),
        stats: allStats,
        news,
        sources: allSources,
      },
      null,
      2
    )

    // Save to Supabase Storage
    onLog('Saving research.json to storage…')
    await writeFile('research.json', researchJson)

    onLog('Saving sources.md to storage…')
    await writeFile('sources.md', sourcesMd)
    await setConfig('pipeline_sources', sourcesMd)

    onLog(`✓ Research complete. ${news.length} articles, ${allStats.length} stats.`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ Research failed: ${msg}`)
    return { success: false, error: msg }
  }
}
