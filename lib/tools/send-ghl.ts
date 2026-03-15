import { readFile, getFileUrl } from '../storage'

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
  const apiKey = process.env.GHL_API_KEY || ''
  const locationId = process.env.GHL_LOCATION_ID || ''
  const blogId = process.env.GHL_BLOG_ID || ''

  if (!apiKey) return { success: false, error: 'GHL_API_KEY not set in environment variables.' }
  if (!locationId) return { success: false, error: 'GHL_LOCATION_ID not set in environment variables.' }
  if (!blogId) return { success: false, error: 'GHL_BLOG_ID not set in environment variables.' }

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
    const imageUrl = meta['image_url'] || await getFileUrl('hero_image.jpg')

    onLog(`Publishing to GHL: "${title}"`)

    const bodyHtml = mdToHtml(bodyMd)

    const payload: Record<string, unknown> = {
      locationId,
      blogId,
      title,
      rawHTML: bodyHtml,
      status: 'DRAFT',
      description,
      ...(slug && { urlSlug: slug }),
      ...(imageUrl && { featuredImage: imageUrl }),
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

    const postId = data?.id || data?.post?.id || ''
    const postUrl = postId
      ? `https://app.gohighlevel.com/location/${locationId}/blogs/posts/${postId}`
      : ''

    onLog(`✓ Published to GHL as draft${postUrl ? `: ${postUrl}` : ''}`)
    onLog('Open GHL → Blogs to review and publish.')

    return { success: true, postUrl }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ GHL publish failed: ${msg}`)
    return { success: false, error: msg }
  }
}
