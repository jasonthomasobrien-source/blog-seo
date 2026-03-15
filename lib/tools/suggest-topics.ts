import Anthropic from '@anthropic-ai/sdk'
import { getPublishedKeywords } from '../storage'

// Full city list across all tiers — used for gap analysis
const ALL_CITIES = {
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

async function fetchGhlPosts(): Promise<string[]> {
  const apiKey = process.env.GHL_API_KEY || ''
  const locationId = process.env.GHL_LOCATION_ID || ''
  const blogId = process.env.GHL_BLOG_ID || ''

  if (!apiKey || !locationId || !blogId) return []

  const titles: string[] = []

  // Fetch both DRAFT and PUBLISHED posts to catch everything
  for (const status of ['DRAFT', 'PUBLISHED']) {
    try {
      const resp = await fetch(
        `https://services.leadconnectorhq.com/blogs/posts?locationId=${locationId}&blogId=${blogId}&limit=100&status=${status}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Version: '2021-07-28',
          },
        }
      )
      if (!resp.ok) continue
      const data = await resp.json() as { posts?: Array<{ title?: string }> }
      for (const p of data.posts || []) {
        if (p.title && !titles.includes(p.title)) titles.push(p.title)
      }
    } catch {
      // ignore — continue with other status
    }
  }

  return titles
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
): Promise<{ success: boolean; topics?: Array<Record<string, string>>; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey || apiKey.startsWith('sk-ant-YOUR')) {
    return { success: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  try {
    // Load published keywords from Redis
    const publishedEntries = await getPublishedKeywords()
    const publishedKeywords = publishedEntries.map(e => e.keyword)

    // Fetch actual GHL posts for a real gap picture
    const ghlTitles = await fetchGhlPosts()

    const client = new Anthropic({ apiKey })

    const now = new Date()
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

    // Build the full city×content matrix for gap context
    const allCities = [...ALL_CITIES.tier1, ...ALL_CITIES.tier2, ...ALL_CITIES.tier3]
    const coveredBlock = [
      ...(ghlTitles.length > 0
        ? [`\nEXISTING GHL BLOG POSTS (${ghlTitles.length} total — do NOT suggest semantically equivalent topics):\n` +
           ghlTitles.map(t => `- ${t}`).join('\n')]
        : []),
      ...(publishedKeywords.length > 0
        ? ['\nADDITIONAL TRACKED KEYWORDS (do not repeat):\n' +
           publishedKeywords.map(kw => `- ${kw}`).join('\n')]
        : []),
    ].join('\n')

    const hasExistingContent = ghlTitles.length > 0 || publishedKeywords.length > 0

    const gapContext = `
CITIES WITH NO COVERAGE YET (prioritize these):
${allCities.filter(city => {
  const cityLower = city.toLowerCase().replace(' mi', '').trim()
  const allCovered = [...ghlTitles, ...publishedKeywords]
  return !allCovered.some(t => t.toLowerCase().includes(cityLower))
}).map(c => `- ${c}`).join('\n') || '(all cities have at least one post)'}

CONTENT TYPE GAPS TO IDENTIFY:
${CONTENT_TYPES.map(t => `- ${t}`).join('\n')}`

    const userPrompt = `Today is ${monthYear}. Perform a gap analysis and suggest the ${count} highest-priority SEO blog topics for Jason O'Brien's West Michigan real estate blog.
${coveredBlock}
${hasExistingContent ? gapContext : ''}

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

Make exactly ${count} topics. Sort from highest-priority gap to lowest. Fill uncovered cities before adding more content types to already-covered cities.`

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

    return { success: true, topics }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}
