import { readFile, getPublishedKeywords } from '../storage'

export interface SeoCheck {
  check: string
  pass: boolean
  required: boolean
  detail: string
}

export interface SeoResult {
  pass: boolean
  keyword: string
  score: string
  required_score: string
  checks: SeoCheck[]
  failed_required: string[]
  summary: string
}

const SERVICE_AREA_CITIES = [
  // Tier 1
  'kalamazoo', 'portage', 'grand rapids', 'battle creek', 'south haven',
  // Tier 2
  'plainwell', 'otsego', 'allegan', 'paw paw', 'mattawan', 'vicksburg',
  'schoolcraft', 'richland', 'wayland', 'kentwood', 'wyoming',
  'grandville',
  // Tier 3
  'parchment', 'comstock', 'oshtemo', 'texas township', 'kalamazoo township',
  'lawton', 'decatur', 'hartford', 'gobles', 'bloomingdale', 'bangor',
  'pullman', 'saugatuck', 'douglas', 'bradley', 'moline', 'cutlerville',
  'jenison', 'galesburg', 'augusta', 'hickory corners', 'delton',
  'springfield', 'marshall', 'albion', 'scotts', 'three rivers',
  'centreville', 'constantine', 'white pigeon', 'sturgis', 'climax',
  'fulton', 'cooper township', 'alamo township',
]

function parseFrontMatter(text: string): { meta: Record<string, string>; body: string } {
  if (!text.trimStart().startsWith('---')) return { meta: {}, body: text }
  const parts = text.trimStart().split('---')
  if (parts.length < 3) return { meta: {}, body: text }
  const meta: Record<string, string> = {}
  for (const line of parts[1].trim().split('\n')) {
    if (line.includes(':')) {
      const colonIdx = line.indexOf(':')
      const key = line.substring(0, colonIdx).trim()
      const value = line.substring(colonIdx + 1).trim()
      meta[key] = value
    }
  }
  return { meta, body: parts.slice(2).join('---').replace(/^\n/, '') }
}

function stripMarkdown(text: string): string {
  text = text.replace(/^---[\s\S]*?---\n/, '')
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`[^`]+`/g, ' ')
  text = text.replace(/!\[.*?\]\(.*?\)/g, ' ')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/https?:\/\/\S+/g, ' ')
  text = text.replace(/[#*_~>|`]/g, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

function firstNWords(text: string, n = 100): string {
  return text.split(/\s+/).slice(0, n).join(' ')
}

function getHeadings(text: string, level: number): string[] {
  const prefix = '#'.repeat(level) + ' '
  return text.split('\n')
    .filter(l => l.startsWith(prefix))
    .map(l => l.substring(prefix.length).trim())
}

function countInternalLinks(text: string): number {
  const patterns = [
    /\(https?:\/\/jobrienhomes\.com[^)]*\)/g,
    /\(\/[^)]+\)/g,
    /\(#[^)]+\)/g,
  ]
  let count = 0
  for (const pat of patterns) {
    count += (text.match(pat) || []).length
  }
  return count
}

function countExternalLinks(text: string): number {
  const allLinks = text.match(/\(https?:\/\/[^)]+\)/g) || []
  return allLinks.filter(l => !l.includes('jobrienhomes.com')).length
}

function getImageAlts(text: string): string[] {
  return [...text.matchAll(/!\[([^\]]*)\]/g)].map(m => m[1])
}

// ── Individual checks ──────────────────────────────────────────────────────

function checkKeywordInTitle(keyword: string, h1s: string[]): SeoCheck {
  const kwLower = keyword.toLowerCase()
  for (const h1 of h1s) {
    if (h1.toLowerCase().includes(kwLower)) {
      return { check: 'keyword_in_title', pass: true, required: true, detail: `Found in H1: "${h1}"` }
    }
  }
  return { check: 'keyword_in_title', pass: false, required: true, detail: `Primary keyword "${keyword}" not found in any H1.` }
}

function checkTitleLength(h1s: string[]): SeoCheck {
  if (!h1s.length) {
    return { check: 'title_length', pass: false, required: true, detail: 'No H1 heading found.' }
  }
  const h1 = h1s[0]
  if (h1.length <= 60) {
    return { check: 'title_length', pass: true, required: true, detail: `H1 is ${h1.length} chars: "${h1}"` }
  }
  return { check: 'title_length', pass: false, required: true, detail: `H1 is ${h1.length} chars (max 60): "${h1}"` }
}

function checkKeywordInFirst100(keyword: string, bodyMd: string): SeoCheck {
  const opening = firstNWords(stripMarkdown(bodyMd), 100)
  if (opening.toLowerCase().includes(keyword.toLowerCase())) {
    return { check: 'keyword_in_first_100_words', pass: true, required: true, detail: 'Keyword found in first 100 words.' }
  }
  return { check: 'keyword_in_first_100_words', pass: false, required: true, detail: `Primary keyword "${keyword}" not found in first 100 words.` }
}

function checkMetaDescription(meta: Record<string, string>, keyword: string): SeoCheck {
  const desc = meta['seo_description'] || meta['meta_description'] || ''
  if (!desc) {
    return { check: 'meta_description', pass: false, required: true, detail: 'No seo_description in front matter.' }
  }
  const length = desc.length
  const hasKeyword = desc.toLowerCase().includes(keyword.toLowerCase())
  if (length >= 140 && length <= 155 && hasKeyword) {
    return { check: 'meta_description', pass: true, required: true, detail: `${length} chars, keyword present.` }
  }
  const issues: string[] = []
  if (length < 140 || length > 155) issues.push(`${length} chars (need 140-155)`)
  if (!hasKeyword) issues.push(`keyword "${keyword}" not found`)
  return { check: 'meta_description', pass: false, required: true, detail: `${issues.join('; ')}. Value: "${desc.substring(0, 100)}"` }
}

function checkSlug(meta: Record<string, string>, keyword: string): SeoCheck {
  const slug = meta['slug'] || ''
  if (!slug) {
    return { check: 'url_slug', pass: false, required: true, detail: 'No slug in front matter. Add: slug: your-keyword-slug' }
  }
  const issues: string[] = []
  if (slug !== slug.toLowerCase()) issues.push('not lowercase')
  if (slug.includes(' ')) issues.push('contains spaces (use hyphens)')
  if (!/^[a-z0-9-]+$/.test(slug)) issues.push('contains invalid characters')
  const kwWords = new Set(keyword.toLowerCase().split(/\s+/))
  const slugWords = new Set(slug.split('-'))
  const overlap = [...kwWords].filter(w => slugWords.has(w))
  if (!overlap.length) issues.push(`no keyword words found in slug`)
  if (issues.length) {
    return { check: 'url_slug', pass: false, required: true, detail: `Slug "${slug}": ${issues.join('; ')}` }
  }
  return { check: 'url_slug', pass: true, required: true, detail: `Slug OK: "${slug}"` }
}

function checkH2Count(bodyMd: string): SeoCheck {
  const h2s = getHeadings(bodyMd, 2)
  const count = h2s.length
  if (count >= 3 && count <= 12) {
    return { check: 'h2_count', pass: true, required: true, detail: `${count} H2 subheadings found.` }
  }
  return { check: 'h2_count', pass: false, required: true, detail: `${count} H2 subheadings (need 3-12). Found: ${JSON.stringify(h2s)}` }
}

function checkH2HasGeo(bodyMd: string): SeoCheck {
  const h2s = getHeadings(bodyMd, 2)
  for (const h2 of h2s) {
    if (SERVICE_AREA_CITIES.some(city => h2.toLowerCase().includes(city))) {
      return { check: 'h2_geo_keyword', pass: true, required: false, detail: `Geo keyword found in H2: "${h2}"` }
    }
  }
  return { check: 'h2_geo_keyword', pass: false, required: false, detail: 'No H2 contains a city/geo keyword. Consider adding one.' }
}

function checkInternalLinks(bodyMd: string): SeoCheck {
  const count = countInternalLinks(bodyMd)
  if (count >= 2) {
    return { check: 'internal_links', pass: true, required: true, detail: `${count} internal link(s) found.` }
  }
  return { check: 'internal_links', pass: false, required: true, detail: `${count} internal link(s) found (need at least 2). Add links to other posts, home search, or contact page.` }
}

function checkExternalLinks(bodyMd: string): SeoCheck {
  const count = countExternalLinks(bodyMd)
  if (count >= 1) {
    return { check: 'external_source_link', pass: true, required: true, detail: `${count} external source link(s) found.` }
  }
  return { check: 'external_source_link', pass: false, required: true, detail: 'No external source links found. Add at least 1 link to a stat source.' }
}

function checkImages(bodyMd: string): SeoCheck {
  const alts = getImageAlts(bodyMd)
  if (!alts.length) {
    return { check: 'images', pass: false, required: false, detail: 'No images in draft markdown. Hero image is generated separately — add an ![alt](url) tag when publishing to your CMS.' }
  }
  const weakAlts = alts.filter(alt => {
    const words = alt.split(/\s+/)
    const hasGeo = SERVICE_AREA_CITIES.some(city => alt.toLowerCase().includes(city)) ||
      alt.toLowerCase().includes('michigan') || alt.toLowerCase().includes(' mi')
    return words.length < 4 || !hasGeo
  })
  if (weakAlts.length) {
    return { check: 'images', pass: false, required: false, detail: `${alts.length} image(s) found but alt text needs improvement: ${JSON.stringify(weakAlts)}. Use descriptive, location-aware alt text.` }
  }
  return { check: 'images', pass: true, required: false, detail: `${alts.length} image(s) with descriptive alt text.` }
}

function checkMichiganMention(bodyMd: string): SeoCheck {
  const plain = stripMarkdown(bodyMd).toLowerCase()
  if (plain.includes('michigan') || plain.includes(' mi ') || plain.includes(', mi')) {
    return { check: 'michigan_mention', pass: true, required: true, detail: '"Michigan" or "MI" found in post.' }
  }
  return { check: 'michigan_mention', pass: false, required: true, detail: 'Post doesn\'t mention "Michigan" or "MI". Add state context for search engines.' }
}

function checkNoCannibalization(keyword: string, publishedKeywords: string[]): SeoCheck {
  const kwLower = keyword.toLowerCase()
  if (publishedKeywords.includes(kwLower)) {
    return { check: 'no_keyword_cannibalization', pass: false, required: true, detail: `Keyword "${keyword}" already used in a published post. Choose a different primary keyword.` }
  }
  const kwWords = new Set(kwLower.split(/\s+/))
  for (const existing of publishedKeywords) {
    const existingWords = new Set(existing.split(/\s+/))
    const overlap = [...kwWords].filter(w => existingWords.has(w))
    if (overlap.length / Math.max(kwWords.size, 1) > 0.6) {
      return { check: 'no_keyword_cannibalization', pass: false, required: true, detail: `Keyword "${keyword}" overlaps significantly with existing keyword "${existing}".` }
    }
  }
  return { check: 'no_keyword_cannibalization', pass: true, required: true, detail: 'No keyword cannibalization detected.' }
}

function checkNoOpeningGreeting(bodyMd: string): SeoCheck {
  const lines = bodyMd.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (!lines.length) return { check: 'no_greeting_opener', pass: true, required: false, detail: 'No body text found.' }
  const first = lines[0].toLowerCase()
  const greetings = ['hey there', 'happy ', 'hello ', 'hi there', 'good morning']
  for (const g of greetings) {
    if (first.startsWith(g)) {
      return { check: 'no_greeting_opener', pass: false, required: false, detail: `Post opens with a greeting: "${lines[0].substring(0, 80)}"` }
    }
  }
  return { check: 'no_greeting_opener', pass: true, required: false, detail: 'Post opens without a greeting.' }
}

function checkCta(bodyMd: string): SeoCheck {
  const ctaPhrases = [
    'happy to talk', 'feel free', 'give me a call', 'shoot me a text',
    'drop me a line', 'thinking about making a move', 'reach out',
    'ready to talk', 'text me', "let's talk", 'browse homes',
    'contact', 'get in touch',
  ]
  const totalWords = bodyMd.split(/\s+/).length
  const tailStart = Math.max(0, Math.floor(totalWords * 0.8))
  const tail = bodyMd.split(/\s+/).slice(tailStart).join(' ').toLowerCase()
  for (const phrase of ctaPhrases) {
    if (tail.includes(phrase)) {
      return { check: 'cta_present', pass: true, required: false, detail: `CTA found near end of post (contains "${phrase}").` }
    }
  }
  return { check: 'cta_present', pass: false, required: false, detail: 'No CTA found in last 20% of post. Add a soft call to action.' }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function runSeoCheck(
  onLog: (line: string) => void
): Promise<{ success: boolean; result?: SeoResult; error?: string }> {
  try {
    onLog('Reading draft.md from storage…')
    const rawText = await readFile('draft.md')
    if (!rawText) {
      return { success: false, error: 'draft.md not found in storage. Run Step 1 & 2 first.' }
    }

    const { meta, body: bodyMd } = parseFrontMatter(rawText)
    const h1s = getHeadings(bodyMd, 1)

    // Get keyword from front matter
    const keyword = (meta['keyword'] || meta['primary_keyword'] || '').trim()
    if (!keyword) {
      return { success: false, error: 'No keyword found in draft front matter.' }
    }

    onLog(`Running SEO check for keyword: "${keyword}"`)

    // Load published keywords
    const publishedEntries = await getPublishedKeywords()
    const publishedKeywords = publishedEntries.map(e => e.keyword.toLowerCase())

    const checks: SeoCheck[] = [
      checkKeywordInTitle(keyword, h1s),
      checkTitleLength(h1s),
      checkKeywordInFirst100(keyword, bodyMd),
      checkMetaDescription(meta, keyword),
      checkSlug(meta, keyword),
      checkH2Count(bodyMd),
      checkH2HasGeo(bodyMd),
      checkInternalLinks(bodyMd),
      checkExternalLinks(bodyMd),
      checkImages(bodyMd),
      checkMichiganMention(bodyMd),
      checkNoCannibalization(keyword, publishedKeywords),
      checkNoOpeningGreeting(bodyMd),
      checkCta(bodyMd),
    ]

    const requiredChecks = checks.filter(c => c.required)
    const optionalChecks = checks.filter(c => !c.required)

    const requiredPassed = requiredChecks.filter(c => c.pass).length
    const requiredTotal = requiredChecks.length
    const optionalPassed = optionalChecks.filter(c => c.pass).length
    const optionalTotal = optionalChecks.length

    const allRequiredPass = requiredPassed === requiredTotal
    const failedRequired = requiredChecks.filter(c => !c.pass)

    const summaryParts = [
      `Required: ${requiredPassed}/${requiredTotal}`,
      `Optional: ${optionalPassed}/${optionalTotal}`,
    ]
    if (failedRequired.length) {
      summaryParts.push(`FAILED: ${failedRequired.map(c => c.check).join(', ')}`)
    }

    const result: SeoResult = {
      pass: allRequiredPass,
      keyword,
      score: `${requiredPassed + optionalPassed}/${requiredTotal + optionalTotal}`,
      required_score: `${requiredPassed}/${requiredTotal}`,
      checks,
      failed_required: failedRequired.map(c => c.check),
      summary: summaryParts.join(' | '),
    }

    // Emit the JSON as a single log line so the frontend can parse it
    onLog(JSON.stringify(result))

    return { success: allRequiredPass, result }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ SEO check failed: ${msg}`)
    return { success: false, error: msg }
  }
}
