import { Client } from '@notionhq/client'
import { readFile } from '../storage'

const NOTION_CHUNK_SIZE = 1900 // Stay under the 2000-char limit

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

type NotionBlock = {
  object: 'block'
  type: string
  [key: string]: unknown
}

function mdToNotionBlocks(mdText: string): NotionBlock[] {
  const blocks: NotionBlock[] = []
  const lines = mdText.split('\n')

  for (const line of lines) {
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: line.substring(2).trim() } }] },
      })
    } else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: line.substring(3).trim() } }] },
      })
    } else if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: line.substring(4).trim() } }] },
      })
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.substring(2).trim() } }] },
      })
    } else if (['---', '***', '___'].includes(line.trim())) {
      blocks.push({ object: 'block', type: 'divider', divider: {} })
    } else if (line.trim()) {
      // Strip basic markdown formatting for display
      let clean = line.replace(/\*\*(.+?)\*\*/g, '$1')
      clean = clean.replace(/\*(.+?)\*/g, '$1')
      clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      if (clean.length > 1990) clean = clean.substring(0, 1990) + '…'
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: clean } }] },
      })
    }
  }

  return blocks
}

export async function sendToNotion(
  onLog: (line: string) => void
): Promise<{ success: boolean; pageUrl?: string; error?: string }> {
  const apiKey = process.env.NOTION_API_KEY || ''
  const dbId = process.env.NOTION_DATABASE_ID || ''

  if (!apiKey || apiKey === 'secret_...') {
    return { success: false, error: 'NOTION_API_KEY not set' }
  }
  if (!dbId || dbId === 'your_notion_database_id') {
    return { success: false, error: 'NOTION_DATABASE_ID not set' }
  }

  try {
    onLog('Reading draft.md from storage…')
    const rawText = await readFile('draft.md')
    if (!rawText) {
      return { success: false, error: 'draft.md not found in storage. Run Steps 1 & 2 first.' }
    }

    const { meta, body: bodyMd } = parseFrontMatter(rawText)

    const today = new Date().toISOString().split('T')[0]
    const title = meta['seo_title'] || meta['title'] || `Blog Post — ${today}`
    const slug = meta['slug'] || ''
    const keyword = meta['keyword'] || meta['primary_keyword'] || ''

    onLog(`Publishing to Notion: "${title}"`)

    // Convert markdown to Notion blocks
    const contentBlocks = mdToNotionBlocks(bodyMd)

    // Also store raw markdown in code blocks
    const rawChunks: string[] = []
    for (let i = 0; i < bodyMd.length; i += NOTION_CHUNK_SIZE) {
      rawChunks.push(bodyMd.substring(i, i + NOTION_CHUNK_SIZE))
    }
    const rawCodeBlocks: NotionBlock[] = rawChunks.map(chunk => ({
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{ type: 'text', text: { content: chunk } }],
        language: 'markdown',
      },
    }))

    const divider: NotionBlock = { object: 'block', type: 'divider', divider: {} }
    const sourceHeading: NotionBlock = {
      object: 'block',
      type: 'heading_3',
      heading_3: { rich_text: [{ type: 'text', text: { content: 'Raw Markdown (for copy/paste)' } }] },
    }

    let children = [...contentBlocks, divider, sourceHeading, ...rawCodeBlocks]
    // Notion API limit: 100 blocks per request
    children = children.slice(0, 100)

    const notion = new Client({ auth: apiKey })

    // Get database properties to discover what's available
    const dbInfo = await notion.databases.retrieve({ database_id: dbId })
    const dbProps = (dbInfo as { properties: Record<string, { type: string }> }).properties || {}

    const properties: Record<string, unknown> = {}

    // Title property (required) — find the title-type property
    let titlePropName = 'title'
    for (const [propName, propInfo] of Object.entries(dbProps)) {
      if (propInfo.type === 'title') {
        titlePropName = propName
        break
      }
    }
    properties[titlePropName] = {
      title: [{ type: 'text', text: { content: title } }],
    }

    // Date
    if (dbProps['Date']?.type === 'date') {
      properties['Date'] = { date: { start: today } }
    }

    // Status
    if (dbProps['Status']?.type === 'select') {
      properties['Status'] = { select: { name: 'Draft' } }
    }

    // Slug
    if (slug && dbProps['Slug']?.type === 'rich_text') {
      properties['Slug'] = { rich_text: [{ type: 'text', text: { content: slug } }] }
    }

    // Keyword
    if (keyword && dbProps['Keyword']?.type === 'rich_text') {
      properties['Keyword'] = { rich_text: [{ type: 'text', text: { content: keyword } }] }
    }

    onLog('Creating Notion page…')
    const response = await notion.pages.create({
      parent: { database_id: dbId },
      properties: properties as Parameters<typeof notion.pages.create>[0]['properties'],
      children: children as Parameters<typeof notion.pages.create>[0]['children'],
    })

    const pageUrl = (response as { url?: string }).url || ''
    onLog(`✓ Published to Notion: ${pageUrl}`)

    return { success: true, pageUrl }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ Notion publish failed: ${msg}`)
    return { success: false, error: msg }
  }
}
