import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import { getPublishedKeywords, getConfig } from '../storage'

// Default city list — used as fallback when no service area is saved in Redis
const DEFAULT_CITIES = {
  tier1: ['Kalamazoo', 'Portage', 'Grand Rapids', 'Battle Creek', 'South Haven', 'Kalamazoo County'],
  tier2: ['Plainwell', 'Otsego', 'Allegan', 'Paw Paw', 'Mattawan', 'Vicksburg', 'Schoolcraft', 'Richland', 'Wayland', 'Kentwood', 'Wyoming MI', 'Grandville'],
  tier3: ['Parchment', 'Comstock', 'Oshtemo', 'Texas Township', 'Saugatuck', 'Douglas', 'Three Rivers', 'Sturgis', 'Galesburg', 'Augusta', 'Delton', 'Lawton', 'Hartford', 'Gobles'],
}

// Content types per cluster — for gap analysis
const CONTENT_TYPES = [
  'moving to [city] michigan',
  'living in [city] michigan',
  'cost of living [city] mi',
  'best neighborhoods in [city]',
  '[city] housing market',
  '[city] homes for sale',
  'things to do in [city] mi',
  '[city] schools and family life',
  'buying a home in [city] michigan',
]

// ── Live blog scraper ─────────────────────────────────────────────────────────

async function fetchBlogPostsFromSite(): Promise<string[]> {
  const baseUrl = (process.env.BLOG_SITE_URL || 'https://joissellingwestmichigan.com/west-mi-blog').replace(/\/$/, '')
  const titles: string[] = []

  // Selectors that commonly wrap post titles in GHL and other blog platforms
  const TITLE_SELECTORS = [
    'h1', 'h2', 'h3',
    '[class*="post-title"]', '[class*="blog-title"]', '[class*="entry-title"]',
    '[class*="card-title"]', '[class*="article-title"]',
    'article h2', 'article h3', '.post h2', '.post h3',
  ]

  async function scrapePage(url: string): Promise<string[]> {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogSEO/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) return []
      const html = await resp.text()
      const $ = cheerio.load(html)

      const found: string[] = []
      const seen = new Set<string>()

      for (const sel of TITLE_SELECTORS) {
        $(sel).each((_, el) => {
          const text = $(el).text().trim()
          // Filter: must be a plausible blog title (10–120 chars, not nav/button text)
          if (text.length >= 10 && text.length <= 120 && !seen.has(text.toLowerCase())) {
            seen.add(text.toLowerCase())
            found.push(text)
          }
        })
      }

      return found
    } catch (e) {
      console.log(`[suggest-topics] Blog scrape error for ${url}: ${e}`)
      return []
    }
  }

  // Scrape first page, then check for pagination (up to 5 pages)
  const firstPage = await scrapePage(baseUrl)
  titles.push(...firstPage)

  for (let page = 2; page <= 5; page++) {
    const pageUrl = `${baseUrl}?page=${page}`
    const pageTitles = await scrapePage(pageUrl)
    if (pageTitles.length === 0) break // no more pages
    // Only continue if we got new titles
    const newOnes = pageTitles.filter(t => !titles.includes(t))
    if (newOnes.length === 0) break
    titles.push(...newOnes)
  }

  console.log(`[suggest-topics] Scraped ${titles.length} titles from ${baseUrl}`)
  return titles
}

interface GhlFetchResult {
  titles: string[]
  fetchedCount: number
  attempted: number
}

async function fetchGhlPosts(): Promise<GhlFetchResult> {
  const apiKey = process.env.GHL_API_KEY || ''
  const locationId = process.env.GHL_LOCATION_ID || ''
  const blogId = process.env.GHL_BLOG_ID || ''

  if (!apiKey || !locationId || !blogId) return { titles: [], fetchedCount: 0, attempted: 0 }

  const titles: string[] = []
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  }

  // Extract titles from any response shape GHL might return
  function extractTitles(data: unknown): string[] {
    if (!data || typeof data !== 'object') return []
    const d = data as Record<string, unknown>
    const list = (
      Array.isArray(d.posts) ? d.posts :
      Array.isArray(d.data) ? d.data :
      Array.isArray(d.items) ? d.items :
      Array.isArray(d.blogPosts) ? d.blogPosts :
      Array.isArray(data) ? data as unknown[] : []
    ) as Array<Record<string, unknown>>
    return list.map(p => String(p.title || p.name || '')).filter(Boolean)
  }

  // Try all meaningful URL patterns — no filter first, then each status (including SCHEDULED)
  const urlPatterns = [
    `https://services.leadconnectorhq.com/blogs/posts?locationId=${locationId}&blogId=${blogId}&limit=100`,
    `https://services.leadconnectorhq.com/blogs/posts?locationId=${locationId}&blogId=${blogId}&limit=100&status=PUBLISHED`,
    `https://services.leadconnectorhq.com/blogs/posts?locationId=${locationId}&blogId=${blogId}&limit=100&status=SCHEDULED`,
    `https://services.leadconnectorhq.com/blogs/posts?locationId=${locationId}&blogId=${blogId}&limit=100&status=DRAFT`,
    `https://services.leadconnectorhq.com/blogs/posts?locationId=${locationId}&blogId=${blogId}&limit=100&status=ACTIVE`,
  ]

  let attempted = 0
  for (const url of urlPatterns) {
    try {
      attempted++
      const resp = await fetch(url, { headers })
      if (!resp.ok) {
        console.log(`[suggest-topics] GHL API HTTP ${resp.status} for: ${url}`)
        continue
      }
      const data = await resp.json()
      console.log(`[suggest-topics] GHL API 200 — keys: ${Object.keys(data as object).join(', ')}`)
      const found = extractTitles(data)
      console.log(`[suggest-topics] Found ${found.length} titles from this request`)
      for (const t of found) {
        if (!titles.includes(t)) titles.push(t)
      }

      // Paginate if the response indicates more pages
      const d = data as Record<string, unknown>
      const total = Number(d.total ?? d.count ?? 0)
      if (total > 100 && titles.length < total) {
        for (let offset = 100; offset < Math.min(total, 500); offset += 100) {
          try {
            const pageResp = await fetch(`${url}&offset=${offset}`, { headers })
            if (!pageResp.ok) break
            const pageData = await pageResp.json()
            for (const t of extractTitles(pageData)) {
              if (!titles.includes(t)) titles.push(t)
            }
          } catch { break }
        }
      }
    } catch (e) {
      console.log(`[suggest-topics] GHL fetch exception: ${e}`)
    }
  }

  console.log(`[suggest-topics] Total GHL titles found across all attempts: ${titles.length}`)
  return { titles, fetchedCount: titles.length, attempted }
}

const SYSTEM_PROMPT = `You are an SEO content strategist for Jason O'Brien, a REALTOR® at PREMIERE Group at Real Broker, LLC, serving the Kalamazoo/West Michigan area. Jason's website is jobrienhomes.com.

Your job is to perform a REAL GAP ANALYSIS and suggest topics that will fill the most important missing gaps in Jason's blog coverage.

SERVICE AREA TIERS:
- Tier 1 (highest priority, highest search volume): Kalamazoo, Portage, Grand Rapids, Battle Creek, South Haven, Kalamazoo County
- Tier 2 (solid volume, lower competition): Plainwell, Otsego, Allegan, Paw Paw, Mattawan, Vicksburg, Schoolcraft, Richland, Wayland, Kentwood, Wyoming MI, Grandville
- Tier 3 (long-tail, easy wins): Parchment, Comstock, Oshtemo, Texas Township, Saugatuck, Douglas, Three Rivers, Sturgis, Galesburg, Augusta, Delton, Lawton, Hartford, Gobles

CONTENT CLUSTERS (priority order):
1. Community Guides — "Moving to [City] Michigan", "Living in [City]", "Best Neighborhoods in [City]", "Cost of Living [City] MI" — HIGHEST PRIORITY
2. Market Updates — Monthly/seasonal snapshots, inventory reports, rate impact posts
3. Buyer Education — Buyer's agent guides, first-time buyer programs, closing costs, winning multiple offers
4. Homes for Heroes — Teacher/firefighter/military programs (max 1 per 5 posts)

GAP ANALYSIS RULES:
- A city is "uncovered" if no community guide exists for it yet — this is the highest-priority gap
- Within covered cities, identify missing content types (e.g., Kalamazoo has a moving guide but no cost of living post)
- Tier 1 cities with zero coverage are always the top priority
- Tier 2 cities with zero coverage rank next
- Never suggest a topic that is semantically equivalent to an existing post title

OUTPUT RULES:
- Sort suggestions from highest to lowest priority gap
- Each topic targets ONE primary search keyword
- Primary keyword must include a city name + real estate topic
- Titles must be under 60 characters
- Include a gap_analysis field explaining WHY this topic is a gap
- Today's date matters — weave in seasonal context where relevant`

export async function suggestTopics(
  count: number
): Promise<{ success: boolean; topics?: Array<Record<string, string>>; debug?: Record<string, unknown>; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey || apiKey.startsWith('sk-ant-YOUR')) {
    return { success: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  try {
    // Load service area from Redis, fall back to defaults
    const serviceAreaRaw = await getConfig('service_area')
    let ALL_CITIES = DEFAULT_CITIES
    if (serviceAreaRaw) {
      try {
        const parsed = JSON.parse(serviceAreaRaw)
        if (Array.isArray(parsed.tier1) && Array.isArray(parsed.tier2) && Array.isArray(parsed.tier3)) {
          ALL_CITIES = parsed
        }
      } catch { /* malformed JSON — use default */ }
    }

    // Load published keywords from Redis
    const publishedEntries = await getPublishedKeywords()
    const publishedKeywords = publishedEntries.map(e => e.keyword)

    // Fetch actual GHL posts — robust multi-pattern fetch
    const ghlResult = await fetchGhlPosts()
    const ghlTitles = ghlResult.titles

    // Scrape live blog for existing posts (most reliable source)
    const scrapedTitles = await fetchBlogPostsFromSite()

    const client = new Anthropic({ apiKey })

    const now = new Date()
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

    const allCities = [...ALL_CITIES.tier1, ...ALL_CITIES.tier2, ...ALL_CITIES.tier3]

    // All known titles + keywords for exclusion — deduplicated across sources
    const allTitlesAndKeywords = Array.from(new Set([
      ...ghlTitles,
      ...scrapedTitles,
      ...publishedKeywords,
      ...publishedEntries.map(e => e.title || '').filter(Boolean),
    ]))

    // Build the covered-city map — city-level dedup for community guides
    const communityGuideKeywords = [
      'moving', 'living', 'cost of living', 'neighborhood', 'community guide',
      'things to know', 'schools', 'pros and cons', 'guide to', 'life in',
    ]

    const coveredCityGuides: string[] = []
    for (const city of allCities) {
      const cityLower = city.toLowerCase().replace(/ mi$/i, '').trim()
      const hasGuide = allTitlesAndKeywords.some(t => {
        const tl = t.toLowerCase()
        return tl.includes(cityLower) && communityGuideKeywords.some(kw => tl.includes(kw))
      })
      if (hasGuide) coveredCityGuides.push(city)
    }

    const uncoveredCities = allCities.filter(c => !coveredCityGuides.includes(c))

    // Build per-city content-type coverage matrix
    // For each covered city, figure out which CONTENT_TYPES are already present
    const cityContentCoverage: Record<string, string[]> = {}
    for (const city of coveredCityGuides) {
      const cityLower = city.toLowerCase().replace(/ mi$/i, '').trim()
      cityContentCoverage[city] = CONTENT_TYPES.filter(ct => {
        const ctKw = ct.replace('[city]', cityLower)
        return allTitlesAndKeywords.some(t => t.toLowerCase().includes(ctKw.split(' ').filter(w => w.length > 3)[0] || ''))
      })
    }

    const coveredBlock = allTitlesAndKeywords.length > 0
      ? `\nEXISTING POSTS & KEYWORDS — HARD EXCLUSION LIST (${allTitlesAndKeywords.length} total):\n` +
        allTitlesAndKeywords.map(t => `- ${t}`).join('\n')
      : '\n(No existing posts found — all topics are available)'

    const hardExclusion = coveredCityGuides.length > 0
      ? `\nHARD RULE — NEVER suggest a community guide for these cities (already covered):\n${coveredCityGuides.map(c => `- ${c}`).join('\n')}`
      : ''

    const gapContext = `
UNCOVERED CITIES — zero community guide coverage (suggest these first, highest priority):
${uncoveredCities.slice(0, 20).map(c => `- ${c}`).join('\n') || '(all Tier 1/2 cities are covered — focus on Tier 3 or content-type gaps)'}
${hardExclusion}

CONTENT TYPE GAPS TO FILL within covered cities (only if a city has NO post of that type):
${CONTENT_TYPES.map(t => `- ${t}`).join('\n')}`

    const userPrompt = `Today is ${monthYear}. Perform a rigorous gap analysis and suggest the ${count} highest-priority SEO blog topics for Jason O'Brien's West Michigan real estate blog.

CRITICAL: Do NOT suggest any topic that is the same city + same content type as an existing post, even if the wording differs. For example, if "Moving to Portage Michigan" exists, do not suggest "Living in Portage" if that's also covered.
${coveredBlock}
${gapContext}

Return ONLY valid JSON — no markdown, no explanation. Format:
{
  "topics": [
    {
      "title": "Moving to Plainwell Michigan: 10 Things to Know",
      "keyword": "moving to plainwell michigan",
      "slug": "moving-to-plainwell-michigan",
      "cluster": "community-guides",
      "tier": "tier-2",
      "target_length": "1200-2500 words",
      "gap_analysis": "Plainwell has zero coverage. Tier 2 city, low competition, strong local search intent from Kalamazoo-area relocators.",
      "rationale": "Tier 2 city with zero blog coverage — biggest gap in the service area"
    }
  ]
}

Make exactly ${count} topics. Sort from highest-priority gap to lowest. Fill uncovered cities before adding content-type variants to already-covered cities.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    let raw = (message.content[0] as { type: string; text: string }).text.trim()

    // Strip markdown code fences if present
    if (raw.startsWith('```')) {
      const parts = raw.split('```')
      raw = parts[1] || parts[0]
      if (raw.startsWith('json')) raw = raw.substring(4)
    }
    raw = raw.trim()

    const data = JSON.parse(raw)
    const topics = data.topics || []

    return {
      success: true,
      topics,
      debug: {
        ghl_posts_found: ghlResult.fetchedCount,
        site_scraped: scrapedTitles.length,
        redis_keywords: publishedKeywords.length,
        total_excluded: allTitlesAndKeywords.length,
        covered_cities: coveredCityGuides.length,
        uncovered_cities: uncoveredCities.length,
      },
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}
