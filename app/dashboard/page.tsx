'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Topic {
  title: string
  keyword: string
  slug?: string
  cluster?: string
  tier?: string
  target_length?: string
  rationale?: string
  gap_analysis?: string
}

interface TopicDebug {
  ghl_posts_found?: number
  site_scraped?: number
  redis_keywords?: number
  total_excluded?: number
  covered_cities?: number
  uncovered_cities?: number
}

interface SeoCheck {
  check: string
  pass: boolean
  required: boolean
  detail: string
}

interface SeoResult {
  pass: boolean
  keyword: string
  score: string
  required_score: string
  checks: SeoCheck[]
  failed_required: string[]
  summary: string
}

interface LogLine {
  text: string
  cls: string
}

const CLUSTER_CLASS: Record<string, string> = {
  'community-guides': 'tag-community',
  'market-updates': 'tag-market',
  'buyer-education': 'tag-buyer',
  'homes-for-heroes': 'tag-heroes',
}

const CLUSTER_LABEL: Record<string, string> = {
  'community-guides': 'Community Guide',
  'market-updates': 'Market Update',
  'buyer-education': 'Buyer Education',
  'homes-for-heroes': 'Homes for Heroes',
}

const TIER_CLASS: Record<string, string> = {
  'tier-1': 'tag-tier1',
  'tier-2': 'tag-tier2',
  'tier-3': 'tag-tier3',
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function classForLine(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes('failed') || l.includes('✗')) return 'err'
  if (l.includes('warning') || l.includes('warn') || l.includes('⚠')) return 'warn'
  if (l.includes('✓') || l.includes('success') || l.includes('done')) return 'ok'
  return 'info'
}

export default function Dashboard() {
  const [isDemo, setIsDemo] = useState(false)
  const [logLines, setLogLines] = useState<LogLine[]>([{ text: 'Ready. Suggest topics above, or set a topic and run Step 1.', cls: 'info' }])
  const [consoleBadge, setConsoleBadge] = useState<string>('')
  const [consoleStatus, setConsoleStatus] = useState<string>('Idle')
  const [activeTask, setActiveTask] = useState<boolean>(false)

  // Status bar
  const [pillSources, setPillSources] = useState<{ ok: boolean; mtime: string }>({ ok: false, mtime: '' })
  const [pillDraft, setPillDraft] = useState<{ ok: boolean; mtime: string }>({ ok: false, mtime: '' })
  const [pillImage, setPillImage] = useState<{ ok: boolean; mtime: string }>({ ok: false, mtime: '' })

  // Topic suggestions
  const [suggestedTopics, setSuggestedTopics] = useState<Topic[]>([])
  const [topicsDebug, setTopicsDebug] = useState<TopicDebug | null>(null)
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number | null>(null)
  const [topicsLoading, setSuggestLoading] = useState(false)
  const [topicsError, setTopicsError] = useState<string>('')
  const [topicsLoaded, setTopicsLoaded] = useState(false)
  const [showCustomTopic, setShowCustomTopic] = useState(false)
  const [customTopicValue, setCustomTopicValue] = useState('')
  const [customKeywordValue, setCustomKeywordValue] = useState('')

  // Service area
  type ServiceArea = { tier1: string[]; tier2: string[]; tier3: string[] }
  const [serviceArea, setServiceArea] = useState<ServiceArea>({ tier1: [], tier2: [], tier3: [] })
  const [showServiceArea, setShowServiceArea] = useState(false)
  const [serviceAreaSaving, setServiceAreaSaving] = useState(false)
  const [serviceAreaSaved, setServiceAreaSaved] = useState(false)
  const [newCityTier1, setNewCityTier1] = useState('')
  const [newCityTier2, setNewCityTier2] = useState('')
  const [newCityTier3, setNewCityTier3] = useState('')

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // Profile dropdown + settings modal
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [cfgGhlApiKey, setCfgGhlApiKey] = useState('')
  const [cfgGhlLocationId, setCfgGhlLocationId] = useState('')
  const [cfgGhlBlogId, setCfgGhlBlogId] = useState('')
  const [cfgLoftyApiKey, setCfgLoftyApiKey] = useState('')
  const [cfgWpSiteUrl, setCfgWpSiteUrl] = useState('')
  const [cfgWpUsername, setCfgWpUsername] = useState('')
  const [cfgWpAppPassword, setCfgWpAppPassword] = useState('')
  const [showGhlKey, setShowGhlKey] = useState(false)
  const [showLoftyKey, setShowLoftyKey] = useState(false)
  const [showWpPassword, setShowWpPassword] = useState(false)

  // Topic & keyword inputs
  const [topicValue, setTopicValue] = useState('')
  const [keywordValue, setKeywordValue] = useState('')
  const [topicFlash, setTopicFlash] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)

  // Draft
  const [draftContent, setDraftContent] = useState('')
  const [wordCount, setWordCount] = useState(0)

  // Sources
  const [sourcesText, setSourcesText] = useState('Run Step 1 to see data here.')

  // Image
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageLocalExists, setImageLocalExists] = useState(false)
  const [imageTs, setImageTs] = useState(0)

  // SEO check
  const [seoResult, setSeoResult] = useState<SeoResult | null>(null)
  const [seoResultVisible, setSeoResultVisible] = useState(false)

  // SEO fields
  const [seoTitle, setSeoTitle] = useState('(run steps 1–3 first)')
  const [seoSlug, setSeoSlug] = useState('—')
  const [seoKeyword, setSeoKeyword] = useState('—')
  const [seoDesc, setSeoDesc] = useState('—')
  const [seoAlt, setSeoAlt] = useState('—')
  const [seoDescLen, setSeoDescLen] = useState('')

  // API key warning
  const [apiKeyMissing, setApiKeyMissing] = useState(false)

  // Button disabled states (all disabled during a run)
  const [running, setRunning] = useState(false)

  // Button label overrides while running
  const [runningBtn, setRunningBtn] = useState<string | null>(null)

  const consoleRef = useRef<HTMLDivElement>(null)

  // ── Scroll console to bottom whenever logLines change ──────────────────────
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logLines])

  // ── Keyboard shortcut: Cmd+S to save draft ─────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveDraft()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── Theme init & toggle ─────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('rr_theme') as 'dark' | 'light' | null
    if (saved) {
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('rr_theme', next)
  }

  // ── Close profile menu when clicking outside ────────────────────────────────
  useEffect(() => {
    if (!showProfileMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('#profile-menu-wrapper')) setShowProfileMenu(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [showProfileMenu])

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      if (d.type === 'demo') setIsDemo(true)
    }).catch(() => {})
    loadTopic()
    loadServiceArea()
    loadDraft()
    loadSeoFields()
    refreshStatus()
    checkApiKey()
    const interval = setInterval(refreshStatus, 12000)
    return () => clearInterval(interval)
  }, [])

  // ── Console helpers ────────────────────────────────────────────────────────
  const appendLog = useCallback((text: string, cls = 'info') => {
    setLogLines(prev => [...prev, { text, cls }])
    setConsoleStatus(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }, [])

  const clearConsole = useCallback(() => {
    setLogLines([])
    setConsoleBadge('')
  }, [])

  const setBadge = useCallback((type: string) => {
    setConsoleBadge(type)
  }, [])

  // ── Status ─────────────────────────────────────────────────────────────────
  async function refreshStatus() {
    try {
      const r = await fetch('/api/status')
      const s = await r.json()
      setPillSources({ ok: !!s.sources, mtime: s.sources_mtime || '' })
      setPillDraft({ ok: !!s.draft, mtime: s.draft_mtime || '' })
      setPillImage({ ok: !!s.image, mtime: s.image_mtime || '' })
      if (s.sources) loadSources()
      loadImageInfo()
    } catch {
      // silently fail on refresh
    }
  }

  // ── Topic & Keyword ────────────────────────────────────────────────────────
  async function loadTopic() {
    try {
      const r = await fetch('/api/topic')
      const d = await r.json()
      if (d.topic) setTopicValue(d.topic)
      if (d.keyword) setKeywordValue(d.keyword)
    } catch {
      // ignore
    }
  }

  async function saveTopic() {
    try {
      await fetch('/api/topic', {
        method: 'POST',
        body: JSON.stringify({ topic: topicValue.trim(), keyword: keywordValue.trim() }),
        headers: { 'Content-Type': 'application/json' },
      })
      setTopicFlash(true)
      setTimeout(() => setTopicFlash(false), 1600)
    } catch {
      // ignore
    }
  }

  // ── Service Area ───────────────────────────────────────────────────────────
  async function loadServiceArea() {
    try {
      const r = await fetch('/api/service-area')
      const d = await r.json()
      if (d.serviceArea) setServiceArea(d.serviceArea)
    } catch {
      // ignore — defaults remain
    }
  }

  async function saveServiceArea() {
    setServiceAreaSaving(true)
    try {
      const r = await fetch('/api/service-area', {
        method: 'POST',
        body: JSON.stringify({ serviceArea }),
        headers: { 'Content-Type': 'application/json' },
      })
      const d = await r.json()
      if (d.error) {
        appendLog(`✗ Service area save failed: ${d.error}`, 'err')
      } else {
        setServiceAreaSaved(true)
        setTimeout(() => setServiceAreaSaved(false), 2000)
        // Clear stale suggestions so next run uses updated city list
        setSuggestedTopics([])
        setTopicsLoaded(false)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      appendLog(`✗ ${msg}`, 'err')
    } finally {
      setServiceAreaSaving(false)
    }
  }

  function addCityToTier(tier: keyof ServiceArea, city: string) {
    const trimmed = city.trim()
    if (!trimmed) return
    setServiceArea(prev => ({
      ...prev,
      [tier]: prev[tier].includes(trimmed) ? prev[tier] : [...prev[tier], trimmed],
    }))
  }

  function removeCityFromTier(tier: keyof ServiceArea, city: string) {
    setServiceArea(prev => ({
      ...prev,
      [tier]: prev[tier].filter(c => c !== city),
    }))
  }

  // ── Integration Settings ───────────────────────────────────────────────────
  async function loadSettings() {
    try {
      const r = await fetch('/api/settings')
      const d = await r.json()
      setCfgGhlApiKey(d.ghl_api_key || '')
      setCfgGhlLocationId(d.ghl_location_id || '')
      setCfgGhlBlogId(d.ghl_blog_id || '')
      setCfgLoftyApiKey(d.lofty_api_key || '')
      setCfgWpSiteUrl(d.wp_site_url || '')
      setCfgWpUsername(d.wp_username || '')
      setCfgWpAppPassword(d.wp_app_password || '')
    } catch {
      // ignore
    }
  }

  async function saveSettings() {
    setSettingsSaving(true)
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          ghl_api_key: cfgGhlApiKey,
          ghl_location_id: cfgGhlLocationId,
          ghl_blog_id: cfgGhlBlogId,
          lofty_api_key: cfgLoftyApiKey,
          wp_site_url: cfgWpSiteUrl,
          wp_username: cfgWpUsername,
          wp_app_password: cfgWpAppPassword,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const d = await r.json()
      if (d.error) {
        appendLog(`✗ Settings save failed: ${d.error}`, 'err')
      } else {
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2000)
        // Also save service area changes
        await saveServiceArea()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      appendLog(`✗ ${msg}`, 'err')
    } finally {
      setSettingsSaving(false)
    }
  }

  // ── Draft ──────────────────────────────────────────────────────────────────
  async function loadDraft() {
    try {
      const r = await fetch('/api/draft')
      const text = await r.text()
      setDraftContent(text)
      updateWordCount(text)
    } catch {
      // ignore
    }
  }

  async function saveDraft() {
    try {
      await fetch('/api/draft', {
        method: 'POST',
        body: draftContent,
        headers: { 'Content-Type': 'text/plain' },
      })
      setSaveFlash(true)
      setTimeout(() => setSaveFlash(false), 1600)
      refreshStatus()
    } catch {
      // ignore
    }
  }

  function updateWordCount(text?: string) {
    const v = text !== undefined ? text : draftContent
    const words = v.trim() ? v.trim().split(/\s+/).length : 0
    setWordCount(words)
  }

  // ── Sources ────────────────────────────────────────────────────────────────
  async function loadSources() {
    try {
      const r = await fetch('/api/sources')
      const text = await r.text()
      setSourcesText(text || 'No research data yet.')
    } catch {
      // ignore
    }
  }

  // ── Image ──────────────────────────────────────────────────────────────────
  async function loadImageInfo() {
    try {
      const r = await fetch('/api/image-info')
      const data = await r.json()
      setImageUrl(data.image_url || '')
      setImageLocalExists(!!data.local_exists)
      setImageTs(Date.now())
    } catch {
      // ignore
    }
  }

  // ── SEO Fields ─────────────────────────────────────────────────────────────
  async function loadSeoFields() {
    try {
      const r = await fetch('/api/seo-fields')
      const d = await r.json()
      if (!d.title) return
      setSeoTitle(d.title || '—')
      setSeoSlug(d.slug || '—')
      setSeoKeyword(d.keyword || '—')
      setSeoDesc(d.description || '—')
      setSeoAlt(d.alt_text || '—')
      const descLen = (d.description || '').length
      if (descLen) {
        setSeoDescLen(`${descLen} chars ${descLen < 140 ? '⚠ too short' : descLen > 155 ? '⚠ too long' : '✓ good length'}`)
      } else {
        setSeoDescLen('')
      }
      if (d.keyword && !keywordValue) {
        setKeywordValue(d.keyword)
      }
    } catch {
      // ignore
    }
  }

  // ── API key check ──────────────────────────────────────────────────────────
  async function checkApiKey() {
    try {
      const r = await fetch('/api/status')
      const d = await r.json()
      setApiKeyMissing(!d.anthropic_key_set)
    } catch {
      // ignore
    }
  }

  // ── Copy field ─────────────────────────────────────────────────────────────
  function copyField(text: string, btnEl: HTMLButtonElement | null) {
    if (!text || text === '—') return
    navigator.clipboard.writeText(text).then(() => {
      if (btnEl) {
        const orig = btnEl.textContent || ''
        btnEl.textContent = 'Copied!'
        setTimeout(() => { btnEl.textContent = orig }, 1500)
      }
    })
  }

  // ── SEO Check render ───────────────────────────────────────────────────────
  function renderSeoResults(result: SeoResult) {
    setSeoResult(result)
    setSeoResultVisible(true)
  }

  // ── Core streaming runner ──────────────────────────────────────────────────
  async function runPhaseAsync(
    phase: string,
    btnLabel: string,
    onDone?: (success: boolean) => void
  ): Promise<boolean> {
    if (activeTask) {
      appendLog('⚠ Another task is already running.', 'warn')
      return false
    }

    setActiveTask(true)
    setRunning(true)
    setRunningBtn(btnLabel)
    setBadge('running')

    let success = false
    let fullOutput = ''
    const isSeoPhase = phase === 'seo_check'

    try {
      const r = await fetch(`/api/run/${phase}`, { method: 'POST' })
      if (!r.body) throw new Error('No response body')

      const reader = r.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const msg = line.slice(6)
          if (msg.startsWith('__EXIT__')) {
            const code = parseInt(msg.replace('__EXIT__', ''), 10)
            success = code === 0
            if (isSeoPhase) {
              try {
                const result = JSON.parse(fullOutput)
                renderSeoResults(result)
              } catch {
                appendLog('Could not parse SEO check output.', 'warn')
              }
              if (success) {
                appendLog('✓ SEO check passed.', 'ok')
                setBadge('done')
              } else {
                appendLog('⚠ SEO check found issues. See results above.', 'warn')
                setBadge('done')
              }
            } else {
              if (success) {
                appendLog('✓ Done.', 'ok')
                setBadge('done')
              } else {
                appendLog(`✗ Failed (exit ${code}).`, 'err')
                setBadge('error')
              }
            }
            break
          } else {
            if (isSeoPhase && msg.trimStart().startsWith('{')) {
              fullOutput = msg  // capture only the JSON line, not all log output
            }
            appendLog(msg, classForLine(msg))
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      appendLog(`✗ Network error: ${msg}`, 'err')
      setBadge('error')
    }

    setActiveTask(false)
    setRunning(false)
    setRunningBtn(null)
    refreshStatus()
    if (onDone) onDone(success)
    return success
  }

  // ── Run Research ────────────────────────────────────────────────────────────
  async function runResearch() {
    await saveTopic()
    clearConsole()
    appendLog('▶ Pull Research…', 'ok')
    const ok = await runPhaseAsync('research', 'Pull Research')
    if (ok) {
      appendLog('─────────────────────────────────────', 'info')
      appendLog("Research ready. Click 'Write Draft with AI' to generate the post.", 'ok')
      loadSources()
    }
  }

  // ── Run generic phase ───────────────────────────────────────────────────────
  async function runPhase(phase: string, label: string) {
    clearConsole()
    appendLog(`▶ ${label}…`, 'ok')
    const ok = await runPhaseAsync(phase, label)
    if (ok) {
      if (phase === 'write_draft') {
        appendLog('─────────────────────────────────────', 'info')
        appendLog("Draft written. Review and edit in the editor above, then run the SEO Check.", 'ok')
        loadDraft()
        loadSeoFields()
      } else if (phase === 'image') {
        appendLog('Image generated. Check the preview panel.', 'ok')
        loadImageInfo()
        loadSeoFields()
      } else if (phase === 'publish') {
        appendLog("Sent to GHL as draft! Open GHL → Blogs to review and publish.", 'ok')
      }
    }
  }

  // ── Run SEO Check ──────────────────────────────────────────────────────────
  async function runSeoCheck() {
    clearConsole()
    appendLog('▶ Running SEO check…', 'ok')
    await runPhaseAsync('seo_check', 'Run SEO Check')
  }

  // ── Suggest Topics ─────────────────────────────────────────────────────────
  async function handleSuggestTopics() {
    if (activeTask) {
      appendLog('⚠ Another task is already running.', 'warn')
      return
    }
    setSuggestLoading(true)
    setTopicsError('')
    setTopicsLoaded(false)

    try {
      const r = await fetch('/api/suggest-topics', { method: 'POST' })
      const data = await r.json()
      if (data.error) {
        setTopicsError(data.error)
      } else {
        setSuggestedTopics(data.topics || [])
        setTopicsDebug(data.debug || null)
        setTopicsLoaded(true)
        setSelectedTopicIdx(null)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setTopicsError(`Failed: ${msg}`)
    } finally {
      setSuggestLoading(false)
    }
  }

  // ── Select Topic → auto-run pipeline ──────────────────────────────────────
  async function selectTopic(i: number) {
    const t = suggestedTopics[i]
    if (!t) return
    setSelectedTopicIdx(i)
    setTopicValue(t.title || '')
    setKeywordValue(t.keyword || '')

    // Save then run full pipeline
    await fetch('/api/topic', {
      method: 'POST',
      body: JSON.stringify({ topic: t.title || '', keyword: t.keyword || '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    setTopicFlash(true)
    setTimeout(() => setTopicFlash(false), 1600)

    clearConsole()
    appendLog('▶ Topic selected — pulling research, then writing draft…', 'ok')

    const researchOk = await runPhaseAsync('research', 'Pull Research')
    if (!researchOk) {
      appendLog('✗ Research failed. Check the log and retry from Step 1.', 'err')
      return
    }
    loadSources()
    appendLog('──────────────────────────────────────', 'info')
    appendLog('Research done. Writing draft now…', 'ok')

    const draftOk = await runPhaseAsync('write_draft', 'Write Draft with AI')
    if (!draftOk) {
      appendLog("✗ Draft failed. Click 'Write Draft with AI' to retry.", 'err')
      return
    }
    loadDraft()
    loadSeoFields()
    appendLog('──────────────────────────────────────', 'info')
    appendLog('✓ Draft ready! Review it in the editor, then run the SEO Check.', 'ok')
  }

  // ── Run custom / manual topic through pipeline ─────────────────────────────
  async function runCustomTopic(topic: string, keyword: string) {
    if (!topic.trim()) return
    setTopicValue(topic)
    setKeywordValue(keyword)
    setShowCustomTopic(false)

    await fetch('/api/topic', {
      method: 'POST',
      body: JSON.stringify({ topic: topic.trim(), keyword: keyword.trim() }),
      headers: { 'Content-Type': 'application/json' },
    })
    setTopicFlash(true)
    setTimeout(() => setTopicFlash(false), 1600)

    clearConsole()
    appendLog(`▶ Custom topic: "${topic.trim()}" — pulling research…`, 'ok')

    const researchOk = await runPhaseAsync('research', 'Pull Research')
    if (!researchOk) {
      appendLog('✗ Research failed. Check the log and retry from Step 1.', 'err')
      return
    }
    loadSources()
    appendLog('──────────────────────────────────────', 'info')
    appendLog('Research done. Writing draft now…', 'ok')

    const draftOk = await runPhaseAsync('write_draft', 'Write Draft with AI')
    if (!draftOk) {
      appendLog("✗ Draft failed. Click 'Write Draft with AI' to retry.", 'err')
      return
    }
    loadDraft()
    loadSeoFields()
    appendLog('──────────────────────────────────────', 'info')
    appendLog('✓ Draft ready! Review it in the editor, then run the SEO Check.', 'ok')
  }

  // ── Mark Published ─────────────────────────────────────────────────────────
  async function markPublished() {
    try {
      const r = await fetch('/api/mark-published', { method: 'POST' })
      const data = await r.json()
      if (data.error) appendLog(`✗ ${data.error}`, 'err')
      else appendLog(`✓ Keyword "${data.keyword}" added to published keywords`, 'ok')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      appendLog(`✗ ${msg}`, 'err')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#f59e0b', fontSize: '16px' }}>✦</span>
            <h1 style={{ margin: 0 }}>RankReady</h1>
          </div>
          <p>Jason O&apos;Brien — SEO Blog Post Generator · jobrienhomes.com</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ borderColor: '#555', color: '#ccc' }}
            onClick={refreshStatus}
            disabled={running}
          >
            ↻ Refresh
          </button>
          {/* Theme toggle */}
          <button
            className="btn btn-outline btn-sm"
            style={{ width: '34px', height: '34px', padding: 0, borderRadius: '50%', fontSize: '15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          {/* Profile dropdown */}
          <div id="profile-menu-wrapper" style={{ position: 'relative' }}>
            <button
              className="btn btn-outline btn-sm"
              style={{
                borderColor: showProfileMenu ? '#f59e0b' : '#2a3d57',
                color: showProfileMenu ? '#f59e0b' : '#94a3b8',
                width: '34px', height: '34px', padding: 0,
                borderRadius: '50%', fontSize: '15px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
              onClick={() => {
                setShowProfileMenu(v => !v)
              }}
              title="Account & Settings"
            >
              ⊙
            </button>
            {showProfileMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: theme === 'light' ? '#ffffff' : '#0b1117',
                border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`,
                borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                minWidth: '170px', zIndex: 200, overflow: 'hidden',
              }}>
                <button
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', background: 'none', border: 'none',
                    color: theme === 'light' ? '#1a2e44' : '#f1f5f9',
                    fontSize: '13px', cursor: 'pointer',
                    borderBottom: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = theme === 'light' ? '#f1f5f9' : '#162032')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); loadSettings(); loadServiceArea() }}
                >
                  ⚙ Settings
                </button>
                <button
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', background: 'none', border: 'none',
                    color: '#94a3b8', fontSize: '13px', cursor: 'default',
                    borderBottom: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`,
                  }}
                  disabled
                >
                  💳 Billing <span style={{ fontSize: '10px', color: theme === 'light' ? '#cbd5e1' : '#2a3d57' }}>coming soon</span>
                </button>
                <form action="/api/auth/logout" method="POST" style={{ margin: 0 }}>
                  <button
                    type="submit"
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', background: 'none', border: 'none',
                      color: '#ef4444', fontSize: '13px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = theme === 'light' ? '#fef2f2' : '#162032')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    ↪ Log Out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div style={{
          background: '#f59e0b', color: '#f1f5f9',
          padding: '9px 28px', display: 'flex', alignItems: 'center',
          gap: '12px', fontSize: '13px', fontWeight: 600,
        }}>
          <span>👀 Demo Mode</span>
          <span style={{ fontWeight: 400 }}>You can explore all features. Publishing to GHL is disabled in demo mode.</span>
          <a href="/#pricing" style={{ marginLeft: 'auto', color: '#f1f5f9', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
            Get Full Access →
          </a>
        </div>
      )}

      {/* Status bar */}
      <div className="status-bar">
        <span className="status-label">Files:</span>
        <span className={`pill ${pillSources.ok ? 'ok' : 'missing'}`}>
          <span className="dot"></span>Research
          {pillSources.mtime && <span style={{ color: '#888', fontWeight: 400 }}>{pillSources.mtime}</span>}
        </span>
        <span className={`pill ${pillDraft.ok ? 'ok' : 'missing'}`}>
          <span className="dot"></span>Draft
          {pillDraft.mtime && <span style={{ color: '#888', fontWeight: 400 }}>{pillDraft.mtime}</span>}
        </span>
        <span className={`pill ${pillImage.ok ? 'ok' : 'missing'}`}>
          <span className="dot"></span>Image
          {pillImage.mtime && <span style={{ color: '#888', fontWeight: 400 }}>{pillImage.mtime}</span>}
        </span>
      </div>

      <div className="main">

        {/* Topic Ideas */}
        <div className="topics-section">
          <div className="topics-header">
            <div>
              <h2>SEO Topic Ideas</h2>
              <p>AI-generated topics ranked by search opportunity — click one to select it</p>
              {topicsDebug && (
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Excluded {topicsDebug.total_excluded ?? 0} existing posts
                  ({topicsDebug.site_scraped ?? 0} scraped from site · {topicsDebug.redis_keywords ?? 0} tracked · {topicsDebug.ghl_posts_found ?? 0} from GHL) ·
                  {topicsDebug.uncovered_cities ?? 0} cities uncovered
                </p>
              )}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
              <button
                className="btn btn-outline btn-sm"
                style={{ borderColor: '#1e2d45', color: showServiceArea ? '#f59e0b' : '#64748b' }}
                onClick={() => setShowServiceArea(v => !v)}
                title="Configure service area cities"
              >
                ⚙ Service Area
              </button>
              <button
                className="btn btn-outline btn-sm"
                style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                onClick={() => setShowCustomTopic(v => !v)}
                disabled={running}
              >
                ✏️ Write Your Own
              </button>
              <button
                className="btn btn-gold btn-sm"
                id="btn-suggest"
                onClick={handleSuggestTopics}
                disabled={running || topicsLoading}
              >
                {topicsLoading
                  ? <><span className="spinner" style={{ borderTopColor: '#0b1117' }}></span> Generating…</>
                  : '✦ Suggest Topics'}
              </button>
            </div>
          </div>
          {showCustomTopic && (
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #1e2d45', background: '#0b1117' }}>
              <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '12px', fontWeight: 600 }}>
                Have a specific topic in mind? Type it in and the AI will research and write it for you.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <div style={{ flex: '2', minWidth: '240px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Topic / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Best Neighborhoods in Otsego Michigan for Families"
                    value={customTopicValue}
                    onChange={e => setCustomTopicValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customTopicValue.trim()) runCustomTopic(customTopicValue, customKeywordValue) }}
                    style={{ width: '100%', background: '#162032', color: '#f1f5f9', border: '1px solid #1e2d45', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>
                <div style={{ flex: '1', minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Primary Keyword <span style={{ color: '#475569' }}>(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. otsego michigan neighborhoods"
                    value={customKeywordValue}
                    onChange={e => setCustomKeywordValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customTopicValue.trim()) runCustomTopic(customTopicValue, customKeywordValue) }}
                    style={{ width: '100%', background: '#162032', color: '#f1f5f9', border: '1px solid #1e2d45', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn btn-gold btn-sm"
                  onClick={() => runCustomTopic(customTopicValue, customKeywordValue)}
                  disabled={running || !customTopicValue.trim()}
                >
                  {running ? <><span className="spinner" style={{ borderTopColor: '#0b1117' }}></span> Running…</> : '▶ Research & Write This Post'}
                </button>
                <button className="btn btn-outline btn-sm" style={{ borderColor: '#2a3d57', color: '#64748b' }} onClick={() => { setShowCustomTopic(false); setCustomTopicValue(''); setCustomKeywordValue('') }}>Cancel</button>
              </div>
            </div>
          )}
          {showServiceArea && (
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #1e2d45', background: '#0b1117' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600, marginBottom: '3px' }}>
                    Service Area Configuration
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b' }}>
                    Cities used for gap analysis when suggesting topics.
                    {topicsDebug && (
                      <> &nbsp;·&nbsp; <strong style={{ color: '#f59e0b' }}>{topicsDebug.uncovered_cities ?? 0} uncovered</strong> of {serviceArea.tier1.length + serviceArea.tier2.length + serviceArea.tier3.length} total cities</>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {serviceAreaSaved && <span style={{ fontSize: '11px', color: '#4caf50', fontWeight: 600 }}>✓ Saved!</span>}
                  <button
                    className="btn btn-gold btn-sm"
                    onClick={saveServiceArea}
                    disabled={running || serviceAreaSaving}
                  >
                    {serviceAreaSaving
                      ? <><span className="spinner" style={{ borderTopColor: '#0b1117' }}></span> Saving…</>
                      : '💾 Save Coverage Area'}
                  </button>
                </div>
              </div>

              {(['tier1', 'tier2', 'tier3'] as const).map((tier, ti) => {
                const tierLabels = ['Tier 1 — Primary Markets', 'Tier 2 — Secondary Markets', 'Tier 3 — Extended Coverage']
                const inputValues = [newCityTier1, newCityTier2, newCityTier3]
                const inputSetters = [setNewCityTier1, setNewCityTier2, setNewCityTier3]
                const chipBg = ['#2a1a1a', '#1a2a1a', '#1a1a2a']
                const chipColor = ['#e07070', '#70c090', '#8090e0']
                const chipBorder = ['#e0707044', '#70c09044', '#8090e044']

                return (
                  <div key={tier} style={{ marginBottom: ti < 2 ? '18px' : 0 }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>
                      {tierLabels[ti]} <span style={{ color: '#475569', fontWeight: 400 }}>({serviceArea[tier].length})</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {serviceArea[tier].map(city => (
                        <span
                          key={city}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: chipBg[ti], color: chipColor[ti],
                            fontSize: '11px', fontWeight: 600, padding: '3px 8px 3px 9px',
                            borderRadius: '20px', border: `1px solid ${chipBorder[ti]}`,
                          }}
                        >
                          {city}
                          <button
                            onClick={() => removeCityFromTier(tier, city)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: chipColor[ti], fontSize: '13px', lineHeight: 1,
                              padding: '0 1px', opacity: 0.7,
                            }}
                            title={`Remove ${city}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {serviceArea[tier].length === 0 && (
                        <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>No cities in this tier</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder={`Add city to ${tierLabels[ti].split(' — ')[0]}…`}
                        value={inputValues[ti]}
                        onChange={e => inputSetters[ti](e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && inputValues[ti].trim()) {
                            addCityToTier(tier, inputValues[ti])
                            inputSetters[ti]('')
                          }
                        }}
                        style={{
                          background: '#162032', color: '#f1f5f9',
                          border: '1px solid #1e2d45', borderRadius: '6px',
                          padding: '5px 10px', fontSize: '12px', outline: 'none', width: '200px',
                        }}
                      />
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ borderColor: '#1e2d45', color: '#f59e0b' }}
                        onClick={() => {
                          if (inputValues[ti].trim()) {
                            addCityToTier(tier, inputValues[ti])
                            inputSetters[ti]('')
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="topics-body">
            {topicsLoaded && suggestedTopics.length > 0 ? (
              <div className="topics-grid" style={{ display: 'grid' }}>
                {suggestedTopics.map((t, i) => (
                  <div
                    key={i}
                    className={`topic-card${selectedTopicIdx === i ? ' selected' : ''}`}
                    onClick={() => !running && selectTopic(i)}
                  >
                    <div className="topic-card-title">{escHtml(t.title)}</div>
                    <div className="topic-card-keyword">{escHtml(t.keyword || '')}</div>
                    <div className="topic-card-meta">
                      {t.cluster && (
                        <span className={`topic-tag ${CLUSTER_CLASS[t.cluster] || 'tag-market'}`}>
                          {CLUSTER_LABEL[t.cluster] || t.cluster}
                        </span>
                      )}
                      {t.tier && (
                        <span className={`topic-tag ${TIER_CLASS[t.tier] || ''}`}>
                          {t.tier.replace('-', ' ')}
                        </span>
                      )}
                    </div>
                    <div className="topic-card-rationale">{escHtml(t.gap_analysis || t.rationale || '')}</div>
                    {t.target_length && (
                      <div className="topic-card-length">🎯 {escHtml(t.target_length)}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="topics-placeholder">
                {topicsError
                  ? <><span>⚠</span>{topicsError}</>
                  : topicsLoading
                  ? <><span>⏳</span>Asking Claude to suggest topics for your service area…</>
                  : <><span>✦</span>Click &quot;Suggest Topics&quot; to get 6 SEO-optimized topic ideas for your service area.<br />Click any card to select it, then run the workflow below.</>
                }
              </div>
            )}
          </div>
        </div>

        {/* Topic & Keyword bar */}
        <div className="topic-bar">
          <div className="topic-bar-row">
            <label>Topic:</label>
            <div className="topic-input-wrap">
              <input
                id="topic-input"
                type="text"
                placeholder="e.g. Moving to Kalamazoo Michigan: 12 Things to Know"
                autoComplete="off"
                value={topicValue}
                onChange={e => setTopicValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTopic() }}
              />
            </div>
            <label style={{ whiteSpace: 'nowrap' }}>Primary Keyword:</label>
            <div className="keyword-input-wrap">
              <input
                id="keyword-input"
                type="text"
                placeholder="e.g. moving to kalamazoo michigan"
                autoComplete="off"
                value={keywordValue}
                onChange={e => setKeywordValue(e.target.value)}
              />
            </div>
            <button className="btn btn-outline btn-sm" onClick={saveTopic} disabled={running}>Save</button>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => runCustomTopic(topicValue, keywordValue)}
              disabled={running || !topicValue.trim()}
              title="Research and write a draft for this topic"
            >
              ▶ Run Pipeline
            </button>
            <span className={`save-flash${topicFlash ? ' show' : ''}`}>Saved!</span>
          </div>
        </div>

        {/* Steps */}
        <div className="steps">

          {/* Step 1: Research */}
          <div className="card">
            <div className="card-header">
              <div className="step-num">1</div>
              <div><h2>Pull Research</h2><p>Market data + local news</p></div>
            </div>
            <div className="card-body">
              <p className="card-desc">Pulls current market data from Tavily Search, Zillow Research, and GKAR for the topic and cities in your service area.</p>
              <button
                className="btn btn-primary btn-full"
                id="btn-research"
                onClick={runResearch}
                disabled={running}
              >
                {running && runningBtn === 'Pull Research'
                  ? <><span className="spinner"></span> Running…</>
                  : 'Pull Research'}
              </button>
              <div className="section-label">Research Data</div>
              <div className="sources-panel">{sourcesText}</div>
            </div>
          </div>

          {/* Step 2: Write Draft */}
          <div className="card">
            <div className="card-header">
              <div className="step-num">2</div>
              <div><h2>Write the Draft</h2><p>AI writes · you review · you edit</p></div>
            </div>
            <div className="card-body">
              <p className="card-desc">Claude AI writes the full SEO blog post using the research and your topic — in your voice, following all the rules from CLAUDE.md. Voice and spell checks run automatically. Review and edit before moving on.</p>
              {apiKeyMissing && (
                <div style={{ display: 'block', background: '#fff8e1', border: '1px solid #f9a825', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#6d4c00', lineHeight: 1.5 }}>
                  <strong>ANTHROPIC_API_KEY not set.</strong> Add it to your environment variables.
                </div>
              )}
              <button
                className="btn btn-gold btn-full"
                id="btn-write"
                onClick={() => runPhase('write_draft', 'Write Draft with AI')}
                disabled={running}
              >
                {running && runningBtn === 'Write Draft with AI'
                  ? <><span className="spinner"></span> Running…</>
                  : 'Write Draft with AI'}
              </button>
              <hr className="divider" />
              <div className="draft-toolbar">
                <span className="section-label" style={{ alignSelf: 'center' }}>Draft Editor</span>
                <button className="btn btn-outline btn-sm" onClick={saveDraft} disabled={running}>💾 Save</button>
                <button className="btn btn-outline btn-sm" onClick={loadDraft} disabled={running}>↻ Reload</button>
                <span className={`save-flash${saveFlash ? ' show' : ''}`}>Saved!</span>
                <span className="draft-hint">{wordCount} words</span>
              </div>
              <textarea
                id="draft-editor"
                className="draft-area"
                placeholder="Click 'Write Draft with AI' or paste your draft here. Cmd+S to save."
                value={draftContent}
                onChange={e => {
                  setDraftContent(e.target.value)
                  updateWordCount(e.target.value)
                }}
              />
            </div>
          </div>

          {/* Step 3: Review & Publish */}
          <div className="card">
            <div className="card-header">
              <div className="step-num">3</div>
              <div><h2>Review &amp; Publish</h2><p>SEO check · image · Notion</p></div>
            </div>
            <div className="card-body">

              {/* SEO Check */}
              <div className="section-label">SEO Check</div>
              <button
                className="btn btn-primary btn-full"
                id="btn-seo"
                onClick={runSeoCheck}
                disabled={running}
              >
                {running && runningBtn === 'Run SEO Check'
                  ? <><span className="spinner"></span> Running…</>
                  : 'Run SEO Check'}
              </button>
              {seoResultVisible && seoResult && (
                <div>
                  <div className={`seo-score-bar${seoResult.pass ? '' : ' fail'}`}>
                    {seoResult.pass ? '✓ PASS' : '✗ FAIL'} — {seoResult.required_score} required checks · {seoResult.score} total
                  </div>
                  <div className="seo-results">
                    {(seoResult.checks || []).map((c, i) => (
                      <div key={i} className="seo-check-item">
                        <span className="seo-icon">{c.pass ? '✓' : (c.required ? '✗' : '○')}</span>
                        <span className="seo-check-name">{c.check.replace(/_/g, ' ')}</span>
                        <span className="seo-check-detail">{c.detail || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <hr className="divider" />

              {/* Hero Image */}
              <div className="section-label">Hero Image</div>
              <div className="image-panel" id="image-panel">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Hero image"
                    onError={e => {
                      ;(e.target as HTMLImageElement).parentElement!.innerHTML =
                        '<div class="image-placeholder"><span>⚠</span>Image URL found but preview failed.</div>'
                    }}
                  />
                ) : imageLocalExists ? (
                  <img src={`/api/hero-image?t=${imageTs}`} alt="Hero image" />
                ) : (
                  <div className="image-placeholder"><span>🖼</span>Click &quot;Generate Image&quot; in Step 3.</div>
                )}
              </div>
              <div className="row">
                <button
                  className="btn btn-outline btn-sm btn-full"
                  id="btn-image"
                  onClick={() => runPhase('image', 'Generate Image')}
                  disabled={running}
                >
                  {running && runningBtn === 'Generate Image'
                    ? <><span className="spinner"></span> Running…</>
                    : 'Generate Image'}
                </button>
              </div>

              <hr className="divider" />

              {/* Publish */}
              {isDemo ? (
                <div style={{ background: '#0d1520', border: '1px solid #1e2d45', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Publishing is disabled in demo mode.</p>
                  <a href="/#pricing" className="btn btn-gold btn-sm" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                    Get Full Access →
                  </a>
                </div>
              ) : (
                <>
                  <button
                    className="btn btn-success btn-full"
                    id="btn-publish"
                    onClick={() => runPhase('publish', 'Publish to GHL')}
                    disabled={running}
                  >
                    {running && runningBtn === 'Publish to GHL'
                      ? <><span className="spinner"></span> Running…</>
                      : 'Publish to GHL'}
                  </button>
                  <button
                    className="btn btn-outline btn-sm btn-full"
                    id="btn-mark"
                    onClick={markPublished}
                    disabled={running}
                  >
                    ✓ Mark Keyword as Published
                  </button>
                </>
              )}
            </div>
          </div>

        </div>{/* /.steps */}

        {/* SEO / Copy Fields */}
        <div className="seo-fields">
          <div className="seo-fields-header">
            <div className="step-num" style={{ background: '#f59e0b' }}>4</div>
            <div><h2 style={{ fontSize: '14px', fontWeight: 600 }}>Blog Fields</h2><p style={{ fontSize: '11px', color: '#f59e0b' }}>Copy into your CMS when publishing</p></div>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto', borderColor: '#555', color: '#aaa' }}
              onClick={loadSeoFields}
              disabled={running}
            >
              ↻ Refresh
            </button>
          </div>
          <div className="seo-fields-grid">
            <div className="seo-field-cell">
              <div className="section-label" style={{ marginBottom: '6px' }}>Title (H1 / Page Title)</div>
              <div id="seo-title" style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px', lineHeight: 1.4 }}>{seoTitle}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoTitle, e.currentTarget)}>Copy</button>
            </div>
            <div className="seo-field-cell">
              <div className="section-label" style={{ marginBottom: '6px' }}>URL Slug</div>
              <div id="seo-slug" style={{ fontSize: '12px', fontFamily: 'monospace', color: '#60a5fa', marginBottom: '8px', wordBreak: 'break-all' }}>{seoSlug}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoSlug, e.currentTarget)}>Copy</button>
            </div>
            <div className="seo-field-cell" style={{ borderRight: 'none' }}>
              <div className="section-label" style={{ marginBottom: '6px' }}>Primary Keyword</div>
              <div id="seo-keyword" style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f1f5f9', marginBottom: '8px' }}>{seoKeyword}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoKeyword, e.currentTarget)}>Copy</button>
            </div>
          </div>
          <div className="seo-field-cell2">
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Meta Description (140–155 chars)</div>
              <div id="seo-desc" style={{ fontSize: '12px', color: '#2a3d57', marginBottom: '4px', lineHeight: 1.5 }}>{seoDesc}</div>
              <div id="seo-desc-len" style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>{seoDescLen}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoDesc, e.currentTarget)}>Copy</button>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Image Alt Text + Download</div>
              <div id="seo-alt" style={{ fontSize: '12px', color: '#2a3d57', marginBottom: '8px' }}>{seoAlt}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={e => copyField(seoAlt, e.currentTarget)}>Copy Alt Text</button>
                <a className="btn btn-success btn-sm" href="/api/hero-image" download="hero_image.jpg">Download Image</a>
              </div>
            </div>
          </div>
        </div>

        {/* Log Console */}
        <div className="console-card">
          <div className="console-header">
            <span>Live Log</span>
            <span id="run-badge">
              {consoleBadge && (
                <span className={`badge badge-${consoleBadge}`}>
                  {{ running: 'Running', done: 'Done', error: 'Error' }[consoleBadge] || consoleBadge}
                </span>
              )}
            </span>
            <span id="console-status" style={{ fontSize: '11px', color: '#aaa', marginLeft: 'auto' }}>{consoleStatus}</span>
            <button
              className="btn btn-outline btn-sm"
              style={{ borderColor: '#444', color: '#aaa', marginLeft: '8px' }}
              onClick={clearConsole}
            >
              Clear
            </button>
          </div>
          <div id="console" ref={consoleRef}>
            {logLines.map((l, i) => (
              <div key={i} className={`line-${l.cls}`}>{l.text}</div>
            ))}
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 16px', overflowY: 'auto',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettingsModal(false) }}
        >
          <div style={{
            background: theme === 'light' ? '#ffffff' : '#0b1117',
            border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`,
            borderRadius: '12px',
            width: '100%', maxWidth: '580px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`,
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: theme === 'light' ? '#1a2e44' : '#f1f5f9', margin: 0 }}>Settings</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>Configure your integrations and service area</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {settingsSaved && <span style={{ fontSize: '12px', color: '#4caf50', fontWeight: 600 }}>✓ Saved!</span>}
                <button
                  className="btn btn-gold btn-sm"
                  onClick={saveSettings}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? <><span className="spinner" style={{ borderTopColor: '#0b1117' }}></span> Saving…</> : '💾 Save'}
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}
                  onClick={() => setShowSettingsModal(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: '24px' }}>

              {/* ── GoHighLevel ── */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>⚡</span> GoHighLevel (GHL)
                </div>
                <SettingsField label="API Key" type={showGhlKey ? 'text' : 'password'} value={cfgGhlApiKey} onChange={setCfgGhlApiKey} placeholder="Bearer token from GHL" onToggle={() => setShowGhlKey(v => !v)} showToggle theme={theme} />
                <SettingsField label="Location ID" type="text" value={cfgGhlLocationId} onChange={setCfgGhlLocationId} placeholder="e.g. abc123XYZ" theme={theme} />
                <SettingsField label="Blog ID" type="text" value={cfgGhlBlogId} onChange={setCfgGhlBlogId} placeholder="e.g. xyz789" last theme={theme} />
              </div>

              {/* ── Lofty ── */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🏠</span> Lofty (Real Broker / eXp)
                </div>
                <SettingsField label="API Key" type={showLoftyKey ? 'text' : 'password'} value={cfgLoftyApiKey} onChange={setCfgLoftyApiKey} placeholder="Lofty API token" onToggle={() => setShowLoftyKey(v => !v)} showToggle last theme={theme} />
              </div>

              {/* ── WordPress ── */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📝</span> WordPress
                </div>
                <SettingsField label="Site URL" type="text" value={cfgWpSiteUrl} onChange={setCfgWpSiteUrl} placeholder="https://yoursite.com" theme={theme} />
                <SettingsField label="Username" type="text" value={cfgWpUsername} onChange={setCfgWpUsername} placeholder="WordPress username" theme={theme} />
                <SettingsField label="Application Password" type={showWpPassword ? 'text' : 'password'} value={cfgWpAppPassword} onChange={setCfgWpAppPassword} placeholder="xxxx xxxx xxxx xxxx" onToggle={() => setShowWpPassword(v => !v)} showToggle last theme={theme} />
              </div>

              {/* ── Service Area ── */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📍</span> Service Area
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>
                  Cities used for gap analysis when suggesting topics.
                </p>
                {(['tier1', 'tier2', 'tier3'] as const).map((tier, ti) => {
                  const tierLabels = ['Tier 1 — Primary Markets', 'Tier 2 — Secondary', 'Tier 3 — Extended']
                  const inputValues = [newCityTier1, newCityTier2, newCityTier3]
                  const inputSetters = [setNewCityTier1, setNewCityTier2, setNewCityTier3]
                  const chipColors = ['#e07070', '#70c090', '#8090e0']
                  const chipBg = theme === 'light'
                    ? ['#fef2f2', '#ecfdf5', '#eff6ff']
                    : ['#2a1a1a', '#1a2a1a', '#1a1a2a']

                  return (
                    <div key={tier} style={{ marginBottom: ti < 2 ? '16px' : 0 }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>
                        {tierLabels[ti]} <span style={{ color: '#475569', fontWeight: 400 }}>({serviceArea[tier].length})</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {serviceArea[tier].map(city => (
                          <span key={city} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: chipBg[ti], color: chipColors[ti],
                            fontSize: '11px', fontWeight: 600, padding: '3px 8px 3px 9px',
                            borderRadius: '20px', border: `1px solid ${chipColors[ti]}33`,
                          }}>
                            {city}
                            <button onClick={() => removeCityFromTier(tier, city)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: chipColors[ti], fontSize: '13px', lineHeight: 1, padding: '0 1px', opacity: 0.7 }}>×</button>
                          </span>
                        ))}
                        {serviceArea[tier].length === 0 && <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>No cities</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder={`Add to ${tierLabels[ti].split(' — ')[0]}…`}
                          value={inputValues[ti]}
                          onChange={e => inputSetters[ti](e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && inputValues[ti].trim()) { addCityToTier(tier, inputValues[ti]); inputSetters[ti]('') } }}
                          style={{ background: theme === 'light' ? '#f8fafc' : '#162032', color: theme === 'light' ? '#1a2e44' : '#f1f5f9', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`, borderRadius: '6px', padding: '5px 10px', fontSize: '12px', outline: 'none', flex: 1 }}
                        />
                        <button className="btn btn-outline btn-sm" style={{ borderColor: '#1e2d45', color: '#f59e0b' }} onClick={() => { if (inputValues[ti].trim()) { addCityToTier(tier, inputValues[ti]); inputSetters[ti]('') } }}>+ Add</button>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Settings field helper component ───────────────────────────────────────────
function SettingsField({
  label, type, value, onChange, placeholder, showToggle, onToggle, last, theme = 'dark',
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  showToggle?: boolean
  onToggle?: () => void
  last?: boolean
  theme?: 'dark' | 'light'
}) {
  return (
    <div style={{ marginBottom: last ? 0 : '12px' }}>
      <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: theme === 'light' ? '#f8fafc' : '#162032',
            color: theme === 'light' ? '#1a2e44' : '#f1f5f9',
            border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`,
            borderRadius: '6px',
            padding: '7px 10px', fontSize: '12px', fontFamily: 'monospace',
            outline: 'none',
          }}
        />
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            style={{
              background: 'none',
              border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e2d45'}`,
              borderRadius: '6px', color: '#64748b', cursor: 'pointer', padding: '6px 8px', fontSize: '13px',
            }}
            title={type === 'password' ? 'Show' : 'Hide'}
          >
            {type === 'password' ? '👁' : '🙈'}
          </button>
        )}
      </div>
    </div>
  )
}
