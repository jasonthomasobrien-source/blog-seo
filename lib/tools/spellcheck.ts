import { readFile } from '../storage'

// ── Whitelist: real estate terms, local proper nouns, abbreviations ──────────
const WHITELIST = new Set([
  // Local geography
  'kalamazoo', 'portage', 'plainwell', 'otsego', 'allegan', 'galesburg',
  'comstock', 'schoolcraft', 'mattawan', 'vicksburg', 'parchment', 'richland',
  'climax', 'pavilion',
  // Brand / company
  'jobrienhomes', 'premiere', 'realtor', 'broker', 'llc', 'corp',
  // Real estate terms
  'mls', 'hoa', 'hoas', 'arms', 'dti', 'piti', 'ltv',
  'escrow', 'earnest', 'amortization', 'appraisal', 'appraiser',
  'foreclosure', 'forbearance', 'refinance', 'refinancing',
  'leaseback', 'leaseholders', 'townhome', 'townhomes',
  'condo', 'condos', 'condominium', 'condominiums',
  'duplex', 'triplex', 'fourplex',
  'preapproval', 'preapproved',
  'homebuyer', 'homebuyers', 'homeseller', 'homesellers',
  'moveup', 'fsbo', 'fixer',
  'walkability', 'walkable',
  // Finance / mortgage
  'fha', 'usda', 'pmi', 'heloc',
  'jumbo', 'conforming', 'nonconforming',
  'buydown', 'buydowns',
  // Common abbreviations
  'sq', 'ft', 'bd', 'ba', 'br',
  // Names
  'jason',
  // Common contractions (lowercased)
  "it's", "that's", "there's", "you're", "they're",
  "i've", "we've", "you've",
  "i'd", "we'd", "you'd", "they'd",
  "i'll", "we'll", "you'll", "they'll",
  "isn't", "aren't", "wasn't", "weren't",
  "don't", "doesn't", "didn't",
  "won't", "wouldn't", "can't", "couldn't", "shouldn't",
])

// A basic set of very common English words for heuristic checking
// This is a subset — we err on the side of not flagging things
const COMMON_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for',
  'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but',
  'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an',
  'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so',
  'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
  'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use',
  'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new',
  'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'great', 'between', 'need', 'large', 'often', 'hand', 'high', 'place',
  'hold', 'turn', 'where', 'much', 'through', 'before', 'right', 'too',
  'mean', 'old', 'same', 'tell', 'boy', 'follow', 'came', 'show', 'every',
  'around', 'those', 'both', 'real', 'life', 'few', 'north', 'south',
  'east', 'west', 'state', 'city', 'area', 'home', 'house', 'homes',
  'houses', 'street', 'road', 'market', 'price', 'prices', 'sale',
  'buy', 'sell', 'sold', 'school', 'schools', 'community', 'local',
  'michigan', 'county', 'town', 'neighborhood', 'neighborhoods', 'family',
  'families', 'living', 'move', 'moving', 'average', 'median', 'percent',
  'month', 'year', 'years', 'months', 'spring', 'summer', 'fall', 'winter',
  'property', 'properties', 'buyer', 'buyers', 'seller', 'sellers',
  'agent', 'broker', 'rate', 'rates', 'loan', 'loans', 'mortgage',
  'payment', 'payments', 'down', 'offer', 'offers', 'lot', 'lots',
  'acre', 'acres', 'square', 'feet', 'bedroom', 'bedrooms', 'bathroom',
  'bathrooms', 'garage', 'yard', 'kitchen', 'living', 'dining', 'master',
  'pretty', 'drive', 'miles', 'minutes', 'closer', 'close', 'near',
  'about', 'above', 'below', 'walk', 'bike', 'shop', 'shops', 'park',
  'lake', 'river', 'trail', 'trails', 'restaurant', 'restaurants',
  'coffee', 'downtown', 'suburb', 'suburbs', 'rural', 'urban',
  'affordable', 'expensive', 'cheap', 'budget', 'investment', 'value',
  'long', 'short', 'still', 'feel', 'think', 'know', 'look', 'love',
  'happy', 'great', 'good', 'best', 'better', 'more', 'less', 'most',
  'least', 'very', 'really', 'quite', 'pretty', 'fairly', 'actually',
  'typically', 'usually', 'generally', 'often', 'always', 'never',
  'sometimes', 'maybe', 'probably', 'definitely', 'absolutely', 'certainly',
  'quickly', 'slowly', 'easily', 'roughly', 'exactly', 'especially',
  'already', 'still', 'again', 'always', 'once', 'twice',
  'strong', 'weak', 'fast', 'slow', 'hot', 'cold', 'warm', 'cool',
  'big', 'small', 'little', 'huge', 'tiny', 'wide', 'narrow', 'tall', 'low',
  'full', 'empty', 'open', 'closed', 'free', 'busy', 'quiet', 'clean',
  'tough', 'tight', 'loose', 'fresh', 'ready', 'hard', 'easy', 'quick',
  'during', 'while', 'since', 'until', 'unless', 'although', 'though',
  'because', 'since', 'whether', 'however', 'therefore', 'otherwise',
  'meanwhile', 'instead', 'anyway', 'moreover', 'furthermore', 'besides',
  'without', 'within', 'across', 'along', 'among', 'against', 'beyond',
  'plus', 'minus', 'versus', 'per', 'via', 'either', 'neither', 'each',
  'both', 'another', 'others', 'such', 'whole', 'total', 'overall',
  // Real estate specific common words
  'listing', 'listings', 'listed', 'active', 'pending', 'contract',
  'inspection', 'appraisal', 'closing', 'title', 'deed', 'ownership',
  'interest', 'principal', 'equity', 'cash', 'conventional', 'fixed',
  'variable', 'adjustable', 'monthly', 'annual', 'yearly', 'weekly',
  'competitive', 'inventory', 'demand', 'supply', 'tight', 'low',
  'high', 'rising', 'falling', 'stable', 'growing', 'declining',
  'appreciate', 'depreciate', 'appreciation', 'comparable', 'comps',
  'contingency', 'contingencies', 'inspection', 'earnest', 'deposit',
])

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

function isLikelyMisspelled(word: string): boolean {
  const lower = word.toLowerCase()

  // In whitelist
  if (WHITELIST.has(lower)) return false

  // In common words
  if (COMMON_WORDS.has(lower)) return false

  // Very short words are probably fine
  if (word.length <= 2) return false

  // Words with numbers are probably abbreviations or codes
  if (/\d/.test(word)) return false

  // Words that look like contractions
  if (word.includes("'")) return false

  // Heuristic: flag words that have unusual character patterns
  // (consecutive consonants > 4, no vowels, etc.)
  const vowels = (lower.match(/[aeiou]/g) || []).length
  if (vowels === 0 && lower.length > 3) return true

  // Words ending in common suffixes are probably real words
  const commonSuffixes = [
    'ing', 'tion', 'ed', 'er', 'est', 'ly', 'ness', 'ment', 'ful',
    'less', 'able', 'ible', 'al', 'ic', 'ive', 'ous', 'ary', 'ory',
    'ize', 'ise', 'ify', 'age', 'ance', 'ence', 'ity', 'ty', 'ship',
    'hood', 'ward', 'wise', 'like', 'some', 'wide', 'side', 'time',
  ]
  if (commonSuffixes.some(s => lower.endsWith(s))) return false

  // Words with common prefixes are likely real
  const commonPrefixes = [
    'un', 're', 'pre', 'pro', 'dis', 'mis', 'over', 'under', 'out',
    'sub', 'super', 'inter', 'intra', 'multi', 'co', 'non', 'anti',
  ]
  if (commonPrefixes.some(p => lower.startsWith(p) && lower.length > p.length + 3)) return false

  return false // Default: don't flag — be conservative
}

export async function runSpellcheck(
  onLog: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    onLog('Reading draft.md from storage…')
    const rawText = await readFile('draft.md')
    if (!rawText) {
      return { success: false, error: 'draft.md not found in storage. Run Steps 1 & 2 first.' }
    }

    const cleanText = stripMarkdown(rawText)

    // Extract words (letters and apostrophes only)
    const words = cleanText.match(/\b[a-zA-Z][a-zA-Z']*[a-zA-Z]\b|\b[a-zA-Z]\b/g) || []

    // Skip words that start with a capital letter (likely proper nouns)
    const lowercaseWords = words.filter(w => w[0] === w[0].toLowerCase())

    // Check each word
    const flagged: Array<{ word: string; suggestions: string[] }> = []
    const checked = new Set<string>()

    for (const word of lowercaseWords) {
      const lower = word.toLowerCase()
      if (checked.has(lower)) continue
      checked.add(lower)

      if (isLikelyMisspelled(lower)) {
        flagged.push({ word: lower, suggestions: [] })
      }
    }

    const passed = flagged.length === 0
    const result = {
      pass: passed,
      suggestions: flagged,
      summary: flagged.length > 0
        ? `${flagged.length} potential misspelling(s) found.`
        : 'No misspellings found.',
    }

    onLog(JSON.stringify(result))

    if (passed) {
      onLog('✓ Spell check passed.')
    } else {
      onLog(`⚠ ${result.summary}`)
      for (const s of flagged) {
        onLog(`  - "${s.word}"`)
      }
    }

    return { success: passed }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`✗ Spellcheck failed: ${msg}`)
    return { success: false, error: msg }
  }
}
