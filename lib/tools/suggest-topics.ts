import Anthropic from '@anthropic-ai/sdk'
import { getPublishedKeywords } from '../storage'

const SYSTEM_PROMPT = `You are an SEO content strategist for Jason O'Brien, a REALTOR® at PREMIERE Group at Real Broker, LLC, serving the Kalamazoo/West Michigan area. Jason's website is jobrienhomes.com.

Your job is to suggest SEO blog post topics that will rank on Google for local real estate searches.

SERVICE AREA:
- Tier 1 (highest priority): Kalamazoo, Portage, Grand Rapids, Battle Creek, South Haven, Kalamazoo County
- Tier 2: Plainwell, Otsego, Allegan, Paw Paw, Mattawan, Vicksburg, Schoolcraft, Richland, Wayland
- Tier 3 (long-tail): Parchment, Comstock, Oshtemo, Texas Township, Saugatuck, Three Rivers, Sturgis, and others

CONTENT CLUSTERS (priority order):
1. Community Guides — "Moving to [City] Michigan", "Living in [City]", "Best Neighborhoods in [City]" — HIGHEST PRIORITY
2. Market Updates — Monthly/seasonal market snapshots, inventory reports
3. Buyer Education — Buyer's agent guides, first-time buyer programs, closing costs
4. Homes for Heroes — Teacher/firefighter/military homebuyer programs (max 1 per 5 posts)

SEO KEYWORD FORMULA: [City] + [Real Estate Topic]

HIGH-PERFORMING FORMATS:
- "Moving to [City] Michigan: X Things to Know"
- "Cost of Living in [City] MI (2026 Guide)"
- "Best Neighborhoods in [City] for Families"
- "[City] Housing Market Forecast"
- "Living in [City] Michigan: Pros and Cons"
- "[City] vs [City]: Which Is Better for Families?"

RULES:
- Each topic must target ONE primary search keyword
- Primary keyword must include a city name + real estate topic
- Titles must be under 60 characters
- No keyword that already exists in the published list
- Mix clusters: don't suggest all community guides or all market updates
- Today's date matters — seasonal context helps (spring market, summer, etc.)`

export async function suggestTopics(
  count: number
): Promise<{ success: boolean; topics?: Array<Record<string, string>>; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey || apiKey.startsWith('sk-ant-YOUR')) {
    return { success: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  try {
    // Load published keywords to avoid cannibalization
    const publishedEntries = await getPublishedKeywords()
    const publishedKeywords = publishedEntries.map(e => e.keyword)

    const client = new Anthropic({ apiKey })

    const now = new Date()
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

    const alreadyPublished = publishedKeywords.length > 0
      ? '\n\nALREADY PUBLISHED (DO NOT REPEAT THESE KEYWORDS):\n' +
        publishedKeywords.map(kw => `- ${kw}`).join('\n')
      : ''

    const userPrompt = `Today is ${monthYear}. Suggest ${count} SEO blog post topics for Jason O'Brien's West Michigan real estate blog.${alreadyPublished}

Return ONLY valid JSON — no markdown, no explanation. Format:
{
  "topics": [
    {
      "title": "Moving to Kalamazoo Michigan: 12 Things to Know",
      "keyword": "moving to kalamazoo michigan",
      "slug": "moving-to-kalamazoo-michigan",
      "cluster": "community-guides",
      "tier": "tier-1",
      "target_length": "1200-2500 words",
      "rationale": "High-volume relocation query, strong buyer intent, no competing post yet"
    }
  ]
}

Make exactly ${count} topics. Mix clusters and cities. Prioritize community guides for Tier 1 and Tier 2 cities first.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
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
