import { readFile } from '../storage'

// ── Banned phrases (case-insensitive exact match) ────────────────────────────
const BANNED_PHRASES = [
  'ever-changing',
  'dive in',
  "let's dive in",
  'deep dive',
  "in today's market",
  "whether you're a first-time buyer",
  'whether you are a first-time buyer',
  "it's important to note",
  'it is important to note',
  'at the end of the day',
  'game-changer',
  'game changer',
  'robust',
  'streamline',
  'streamlined',
  'stay tuned',
  'exciting times',
  'without further ado',
  'buckle up',
]

// Context-sensitive phrases
const CONTEXT_SENSITIVE: Array<{ phrase: string; note: string }> = [
  { phrase: 'landscape', note: 'Only banned when not referring to actual landscaping or geography.' },
  { phrase: 'navigate', note: 'Only banned when not giving literal directions.' },
  { phrase: 'leverage', note: 'Only banned when used as a verb (e.g. "leverage your equity").' },
]

interface VoiceFlag {
  type: string
  phrase?: string
  context?: string
  note?: string
  count?: number
  message?: string
  sentences?: string[]
  line?: string
  emojis?: string[]
}

function checkBannedPhrases(text: string): VoiceFlag[] {
  const flagged: VoiceFlag[] = []
  const textLower = text.toLowerCase()
  for (const phrase of BANNED_PHRASES) {
    const idx = textLower.indexOf(phrase.toLowerCase())
    if (idx !== -1) {
      const start = Math.max(0, idx - 60)
      const end = Math.min(text.length, idx + phrase.length + 60)
      const context = '…' + text.substring(start, end).trim() + '…'
      flagged.push({ type: 'banned_phrase', phrase, context })
    }
  }
  return flagged
}

function checkContextSensitive(text: string): VoiceFlag[] {
  const flagged: VoiceFlag[] = []
  const textLower = text.toLowerCase()
  for (const { phrase, note } of CONTEXT_SENSITIVE) {
    const idx = textLower.indexOf(phrase.toLowerCase())
    if (idx === -1) continue

    // For "leverage", only flag when followed by a direct object (verb usage)
    if (phrase === 'leverage') {
      const pattern = /\bleverag(?:e|es|ed|ing)\b\s+(?:your|the|a|an|our|this|that|their|its|my)\b/i
      if (!pattern.test(text)) continue
    }

    const start = Math.max(0, idx - 60)
    const end = Math.min(text.length, idx + phrase.length + 60)
    const context = '…' + text.substring(start, end).trim() + '…'
    flagged.push({ type: 'context_sensitive', phrase, context, note })
  }
  return flagged
}

function checkExclamationPoints(text: string): VoiceFlag[] {
  const count = (text.match(/!/g) || []).length
  if (count > 1) {
    return [{
      type: 'too_many_exclamations',
      count,
      message: `Found ${count} exclamation points. Max allowed: 1.`,
    }]
  }
  return []
}

function checkConsecutiveISentences(text: string): VoiceFlag[] {
  const sentences = text.trim().split(/(?<=[.!?])\s+/)
  const flagged: VoiceFlag[] = []
  for (let i = 0; i < sentences.length - 1; i++) {
    const a = sentences[i].trim()
    const b = sentences[i + 1].trim()
    if (/^I\b/.test(a) && /^I\b/.test(b)) {
      flagged.push({
        type: 'consecutive_i_sentences',
        sentences: [a.substring(0, 120), b.substring(0, 120)],
        message: "Two consecutive sentences starting with 'I'.",
      })
    }
  }
  return flagged
}

function checkGreetingOpener(text: string): VoiceFlag[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (!lines.length) return []
  const first = lines[0].toLowerCase()
  const greetings = ['hey there', 'happy ', 'hello ', 'hi there', 'good morning', 'good afternoon']
  for (const g of greetings) {
    if (first.startsWith(g)) {
      return [{
        type: 'greeting_opener',
        line: lines[0].substring(0, 120),
        message: 'Newsletter opens with a greeting. Start with a fact, observation, or opinion instead.',
      }]
    }
  }
  return []
}

function checkEmojiInBody(text: string): VoiceFlag[] {
  // Strip front matter and first H1 heading before checking
  const stripped = text.replace(/^---[\s\S]*?---\n?/, '').replace(/^#[^\n]*\n/m, '')
  // Use Extended_Pictographic to match actual emoji only (not digits/# which also have Emoji property)
  const matches = stripped.match(/\p{Extended_Pictographic}/gu) || []
  if (matches.length) {
    return [{
      type: 'emoji_in_body',
      emojis: matches,
      message: 'Emojis found in newsletter body. Remove them (one in subject line is OK).',
    }]
  }
  return []
}

// Pure check — takes text, returns flags. No storage or logging.
export function runVoiceChecks(text: string): VoiceFlag[] {
  return [
    ...checkBannedPhrases(text),
    ...checkContextSensitive(text),
    ...checkExclamationPoints(text),
    ...checkConsecutiveISentences(text),
    ...checkGreetingOpener(text),
    ...checkEmojiInBody(text),
  ]
}

export async function runVoiceCheck(
  onLog: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    onLog('Reading draft.md from storage…')
    const text = await readFile('draft.md')
    if (!text) {
      return { success: false, error: 'draft.md not found in storage. Run Steps 1 & 2 first.' }
    }

    const allFlags: VoiceFlag[] = [
      ...checkBannedPhrases(text),
      ...checkContextSensitive(text),
      ...checkExclamationPoints(text),
      ...checkConsecutiveISentences(text),
      ...checkGreetingOpener(text),
      ...checkEmojiInBody(text),
    ]

    const passed = allFlags.length === 0
    const result = {
      pass: passed,
      flagged: allFlags,
      summary: allFlags.length > 0 ? `${allFlags.length} issue(s) found.` : 'All checks passed.',
    }

    onLog(JSON.stringify(result))

    if (passed) {
      onLog('✓ Voice check passed. No banned phrases or structural issues.')
    } else {
      onLog(`⚠ Voice check found ${allFlags.length} issue(s):`)
      for (const flag of allFlags) {
        if (flag.phrase) onLog(`  - ${flag.type}: "${flag.phrase}"${flag.context ? ` (${flag.context.substring(0, 80)})` : ''}`)
        else if (flag.message) onLog(`  - ${flag.type}: ${flag.message}`)
      }
    }

    return { success: passed }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ Voice check failed: ${msg}`)
    return { success: false, error: msg }
  }
}
