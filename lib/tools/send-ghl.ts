import { readFile, getFileUrl, addPublishedKeyword, getConfig } from '../storage'

// ── Category helpers ─────────────────────────────────────────────────────────

interface GhlCategory {
  id: string
  label?: string
  name?: string
  slug?: string
}

// Maps cluster values → keywords to match against category names
const CLUSTER_KEYWORDS: Record<string, string[]> = {
  'community-guides': ['community', 'guide', 'neighborhood', 'local', 'area'],
  'market-updates': ['market', 'update', 'trend', 'stat', 'report', 'news'],
  'buyer-education': ['buyer', 'buying', 'home buying', 'tips', 'education', 'first'],
  'homes-for-heroes': ['hero', 'heroes', 'teacher', 'military', 'veteran', 'first responder'],
}

async function fetchGhlCategories(
  apiKey: string,
  locationId: string,
  blogId: string,
  onLog: (line: string) => void
): Promise<GhlCategory[]> {
  // Try the most common GHL category endpoint patterns
  const endpoints = [
    `https://services.leadconnectorhq.com/blogs/categories?locationId=${locationId}&blogId=${blogId}`,
    `https://services.leadconnectorhq.com/blogs/posts/categories?locationId=${locationId}&blogId=${blogId}`,
    `https://services.leadconnectorhq.com/blogs/${blogId}/categories?locationId=${locationId}`,
  ]

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  }

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { headers })
      if (!resp.ok) continue
      const data = await resp.json() as { categories?: GhlCategory[]; data?: GhlCategory[] }
      const cats = data.categories || data.data || []
      if (cats.length > 0) {
        onLog(`✓ Found ${cats.length} GHL categories: ${cats.map(c => c.label || c.name || c.id).join(', ')}`)
        return cats
      }
    } catch {
      // try next endpoint
    }
  }

  onLog('Note: Could not fetch GHL categories — post will be created without category assignment.')
  return []
}

function matchCategories(cluster: string, categories: GhlCategory[]): string[] {
  if (!cluster || categories.length === 0) return []
  const keywords = CLUSTER_KEYWORDS[cluster] || [cluster.replace(/-/g, ' ')]
  const matched: string[] = []

  for (const cat of categories) {
    const catName = (cat.label || cat.name || cat.slug || '').toLowerCase()
    const isMatch = keywords.some(kw => catName.includes(kw))
    if (isMatch) matched.push(cat.id)
  }

  return matched
}

// ── Markdown parser ───────────────────────────────────────────────────────────

function parseFrontMatter(text: string): { meta: Record<string, string>; body: string } {
  if (!text.trimStart().startsWith('---')) return { meta: {}, body: text }
  const parts = text.trimStart().split('---')
  if (parts.length < 3) return { meta: {}, body: text }
  const meta: Record<string, string> = {}
  for (const line of parts[1].trim().split('\n')) {
    if (line.includes(':')) {
      const colonIdx = line.indexOf(':')
      meta[line.substring(0, colonIdx).trim()] = line.substring(colonIdx + 1).trim()
    }
  }
  return { meta, body: parts.slice(2).join('---').replace(/^\n/, '') }
}

function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const html: string[] = []
  let inList = false

  for (const raw of lines) {
    const line = raw

    if (line.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h1>${inline(line.substring(2).trim())}</h1>`)
    } else if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h2>${inline(line.substring(3).trim())}</h2>`)
    } else if (line.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h3>${inline(line.substring(4).trim())}</h3>`)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${inline(line.substring(2).trim())}</li>`)
    } else if (line.trim() === '' || line.trim() === '---') {
      if (inList) { html.push('</ul>'); inList = false }
      // blank line = paragraph break, skip
    } else {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<p>${inline(line.trim())}</p>`)
    }
  }

  if (inList) html.push('</ul>')
  return html.join('\n')
}

function inline(text: string): string {
  // bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  // inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  return text
}

export async function sendToGhl(
  onLog: (line: string) => void
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  const apiKey = process.env.GHL_API_KEY || await getConfig('ghl_api_key')
  const locationId = process.env.GHL_LOCATION_ID || await getConfig('ghl_location_id')
  const blogId = process.env.GHL_BLOG_ID || await getConfig('ghl_blog_id')

  if (!apiKey) return { success: false, error: 'GHL API Key not set. Add it in Settings → GoHighLevel.' }
  if (!locationId) return { success: false, error: 'GHL Location ID not set. Add it in Settings → GoHighLevel.' }
  if (!blogId) return { success: false, error: 'GHL Blog ID not set. Add it in Settings → GoHighLevel.' }

  try {
    onLog('Reading draft.md from storage…')
    const rawText = await readFile('draft.md')
    if (!rawText) {
      return { success: false, error: 'draft.md not found. Run Steps 1 & 2 first.' }
    }

    const { meta, body: bodyMd } = parseFrontMatter(rawText)
    const title = meta['title'] || meta['seo_title'] || 'Blog Post'
    const slug = meta['slug'] || ''
    const description = meta['seo_description'] || ''
    const cluster = meta['cluster'] || ''
    const imageUrl = meta['image_url'] || await getFileUrl('hero_image.jpg')
    const imageAltText = meta['image_alt'] || title

    onLog(`Publishing to GHL: "${title}"`)

    // Fetch categories and match to cluster
    const categories = await fetchGhlCategories(apiKey, locationId, blogId, onLog)
    const categoryIds = matchCategories(cluster, categories)
    if (cluster && categoryIds.length > 0) {
      onLog(`✓ Auto-assigned categories: ${categoryIds.join(', ')} (cluster: ${cluster})`)
    } else if (cluster && categories.length > 0) {
      onLog(`Note: No category matched cluster "${cluster}" — post will be uncategorized`)
    }

    const bodyHtml = mdToHtml(bodyMd)

    const payload: Record<string, unknown> = {
      locationId,
      blogId,
      title,
      rawHTML: bodyHtml,
      status: 'DRAFT',
      description,
      ...(slug && { urlSlug: slug }),
      ...(imageUrl && { imageUrl, imageAltText }),
      ...(categoryIds.length > 0 && { categoryIds }),
    }

    const resp = await fetch('https://services.leadconnectorhq.com/blogs/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify(payload),
    })

    let data: Record<string, unknown> = {}
    const rawBody = await resp.text()
    try { data = JSON.parse(rawBody) } catch { /* not JSON */ }

    if (!resp.ok) {
      const msg = data?.message || data?.error || rawBody.substring(0, 300) || `HTTP ${resp.status}`
      onLog(`✗ GHL API error (HTTP ${resp.status}): ${msg}`)
      onLog(`Raw response: ${rawBody.substring(0, 500)}`)
      return { success: false, error: `GHL API error: ${msg}` }
    }

    const postId = (data as { id?: string; post?: { id?: string } })?.id || (data as { post?: { id?: string } })?.post?.id || ''
    const postUrl = postId
      ? `https://app.gohighlevel.com/location/${locationId}/blogs/posts/${postId}`
      : ''

    onLog(`✓ Published to GHL as draft${postUrl ? `: ${postUrl}` : ''}`)
    onLog('Open GHL → Blogs to review and publish.')

    // Auto-save to Redis so topic suggestions exclude this post going forward
    const keyword = meta['keyword'] || ''
    if (keyword || title) {
      try {
        await addPublishedKeyword({
          keyword: keyword || title.toLowerCase(),
          title,
          url: postUrl || '',
          date: new Date().toISOString().split('T')[0],
          cluster: cluster || 'community-guides',
        })
        onLog(`✓ Saved "${title}" to published keywords list.`)
      } catch {
        // non-fatal — don't fail the publish
      }
    }

    return { success: true, postUrl }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ GHL publish failed: ${msg}`)
    return { success: false, error: msg }
  }
}
