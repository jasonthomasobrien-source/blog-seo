import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile, getConfig } from '../storage'

const SYSTEM_PROMPT = `You are Jason O'Brien, a REALTOR® at PREMIERE Group at Real Broker, LLC in Kalamazoo, Michigan. You write your own real estate blog posts for jobrienhomes.com. You are a Homes for Heroes® affiliate.

SERVICE AREA: Kalamazoo, Portage, Plainwell, Otsego, Allegan, Paw Paw, Mattawan, Vicksburg, Schoolcraft, Richland, Grand Rapids, Battle Creek, South Haven, and surrounding West Michigan communities.

WRITE EXACTLY LIKE THIS:
- Casual, direct, first-person. Like a knowledgeable neighbor who happens to sell houses.
- Short sentences. Punchy. Conversational paragraph breaks.
- Use "you" and "your" — talk directly to the reader.
- Local references are gold: mention actual neighborhoods, streets, landmarks, restaurants.
- Opinions are welcome: "I think this market is going to stay competitive through summer" > "The market may remain competitive."
- Humor is fine when it's natural. Don't force it.

NEVER USE THESE WORDS/PHRASES:
- "landscape" (when not talking about actual landscaping)
- "navigate" (when not giving directions)
- "ever-changing"
- "dive in" / "let's dive in" / "deep dive"
- "in today's market" as an opener
- "whether you're a first-time buyer or seasoned investor"
- "it's important to note"
- "at the end of the day"
- "game-changer" / "game changer"
- "robust"
- "streamline" / "streamlined"
- "stay tuned"
- "exciting times"
- "without further ado"
- "buckle up"

STRUCTURAL RULES:
- Title (H1): Under 60 characters. Include primary keyword. Specific > clever.
- Opening line: Start with a specific fact, observation, or opinion. NEVER start with a greeting.
- H2 sections: 3-5 subheadings. At least one with a city/geo keyword.
- CTA: One per post, at the very end. Soft and natural. Examples:
  "If you've been thinking about making a move this spring, I'm always happy to talk it through — no pressure, no pitch."
  "Browse homes for sale in Kalamazoo or Portage."
  "Want a list of homes under $400k in Kalamazoo? Reach out anytime."
- Sign-off: "— Jason" or "Talk soon, Jason"
- Max 1 exclamation point in the entire post.
- Do not start two consecutive sentences with "I".

SEO RULES:
- Primary keyword must appear in: title, first 100 words, at least one H2
- Include city + "Michigan" or "MI" at least once
- Mention 2-3 cities from the service area naturally
- Include at least 2 internal links using relative paths like [browse homes in Kalamazoo](/search) or [contact me](/contact)
- Include at least 1 external source link for any stats (open in new format: [source name](url))
- Image alt text must be descriptive and location-aware

TARGET LENGTH BY POST TYPE:
- Community guides / pillar content: 1,200–2,500 words
- Standard posts: 800–1,200 words
- Market updates: 500–1,000 words
- Cost of living guides: 1,000–1,500 words

OUTPUT FORMAT — you must return ONLY the markdown file content, starting with front matter:

---
title: [Post title — under 60 chars]
slug: [url-slug-lowercase-hyphenated]
seo_title: [Same as title or slight variation — under 60 chars]
seo_description: [CRITICAL: exactly 140-155 characters. Must contain the primary keyword verbatim. Written as a hook. Count carefully — no more than 155 chars total. Example at 148 chars: "Thinking about moving to Portage Michigan? Here are 10 honest things to know — from home prices to schools — before you make the move."]
keyword: [primary SEO keyword]
dek: [1-2 sentence subheadline / deck for the post]
cluster: [community-guides | market-updates | buyer-education | homes-for-heroes]
image_prompt: [Specific image generation prompt — describe a real West Michigan scene, neighborhood, or home style that fits the post topic. Be specific about location.]
date: [today's date YYYY-MM-DD]
---

[Full blog post in Markdown, starting with # H1 title]`

export async function generateDraft(
  onLog: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey || apiKey.startsWith('sk-ant-YOUR')) {
    return { success: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  try {
    // Read inputs
    const topic = await getConfig('topic')
    const keyword = await getConfig('keyword')
    // Read sources from Redis first (no CDN layer), fall back to Blob
    let sourcesMd = await getConfig('pipeline_sources')
    if (!sourcesMd) sourcesMd = await readFile('sources.md')

    if (!topic) {
      return { success: false, error: 'No topic set. Save a topic first.' }
    }

    onLog(`▶ generate_draft / Topic: ${topic}`)
    onLog(`  Keyword: ${keyword || '(from topic)'}`)
    onLog(`  Sources: ${sourcesMd.length} chars`)

    // Build prompt
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const kwLine = keyword ? `\nPRIMARY SEO KEYWORD: ${keyword}` : ''

    const userPrompt = `Today is ${dateStr}.

TOPIC / TITLE IDEA: ${topic}${kwLine}

RESEARCH DATA:
${sourcesMd.length > 0 ? sourcesMd.substring(0, 8000) : '(No research data found — write the post using your general knowledge of the West Michigan market. Do not fabricate specific stats.)'}

Write the complete blog post now. Return ONLY the markdown content starting with the --- front matter block. No explanation before or after.`

    // Call Claude API with streaming
    const client = new Anthropic({ apiKey })
    let fullText = ''

    onLog('▶ Calling Claude API…')

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        fullText += chunk.delta.text
        onLog(chunk.delta.text.replace(/\n/g, ' '))
      }
    }

    if (!fullText) {
      return { success: false, error: 'No content returned from Claude API' }
    }

    // Ensure front matter has today's date
    const todayStr = now.toISOString().split('T')[0]
    let draftContent = fullText.trim()
    if (!draftContent.substring(0, 500).includes('date:')) {
      if (draftContent.startsWith('---')) {
        draftContent = draftContent.replace('---\n', `---\ndate: ${todayStr}\n`)
      }
    }

    // Auto-fix meta description: trim to 155 chars at word boundary if over
    draftContent = draftContent.replace(
      /^(seo_description:\s*)(.+)$/m,
      (_match, prefix, desc) => {
        let fixed = desc.trim()
        if (fixed.length > 155) {
          fixed = fixed.substring(0, 155).replace(/\s\S*$/, '').trim()
          onLog(`⚠ seo_description trimmed to ${fixed.length} chars to fit 140-155 limit.`)
        }
        return `${prefix}${fixed}`
      }
    )

    // Save draft to Supabase Storage
    onLog('Saving draft.md to storage…')
    await writeFile('draft.md', draftContent)

    onLog('✓ Draft saved successfully.')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ generate_draft failed: ${msg}`)
    return { success: false, error: msg }
  }
}

// ── Auto-fix voice issues ────────────────────────────────────────────────────

export async function autoFixDraft(
  flagDescriptions: string[],
  onLog: (line: string) => void
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey || apiKey.startsWith('sk-ant-YOUR')) return

  try {
    const currentDraft = await readFile('draft.md')
    if (!currentDraft) return

    onLog('▶ Auto-fixing voice issues…')

    const client = new Anthropic({ apiKey })

    const fixPrompt = `You are editing a real estate blog post draft. The following voice/tone issues were detected. Fix ONLY the flagged sentences — do not change anything else, do not rewrite sections, do not add content.

ISSUES TO FIX:
${flagDescriptions.map((f, i) => `${i + 1}. ${f}`).join('\n')}

RULES:
- Replace banned phrases with natural, human alternatives
- Keep the same meaning and sentence structure where possible
- Do not add new content or change any unflagged sentences
- Preserve all front matter, headings, links, and formatting exactly
- Return the COMPLETE draft with ONLY the flagged sentences changed

DRAFT:
${currentDraft}

Return ONLY the fixed markdown — no explanation, no preamble.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: fixPrompt }],
    })

    const fixed = (message.content[0] as { type: string; text: string }).text.trim()
    if (fixed && fixed.length > 100) {
      await writeFile('draft.md', fixed)
      onLog('✓ Voice issues auto-fixed and draft saved.')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`Warning: Auto-fix pass failed: ${msg}`)
  }
}
