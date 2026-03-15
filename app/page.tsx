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
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number | null>(null)
  const [topicsLoading, setSuggestLoading] = useState(false)
  const [topicsError, setTopicsError] = useState<string>('')
  const [topicsLoaded, setTopicsLoaded] = useState(false)

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

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadTopic()
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
          <h1>West Michigan Blog Dashboard</h1>
          <p>Jason O&apos;Brien — SEO Blog Post Generator · jobrienhomes.com</p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          style={{ borderColor: '#555', color: '#ccc' }}
          onClick={refreshStatus}
          disabled={running}
        >
          ↻ Refresh
        </button>
      </div>

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
            </div>
            <button
              className="btn btn-gold btn-sm"
              id="btn-suggest"
              onClick={handleSuggestTopics}
              disabled={running || topicsLoading}
              style={{ marginLeft: 'auto', flexShrink: 0 }}
            >
              {topicsLoading
                ? <><span className="spinner" style={{ borderTopColor: '#1a2e44' }}></span> Generating…</>
                : '✦ Suggest Topics'}
            </button>
          </div>
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
                    <div className="topic-card-rationale">{escHtml(t.rationale || '')}</div>
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
              <p className="card-desc">Claude AI writes the full SEO blog post using the research and your topic — in your voice, following all the rules from CLAUDE.md. Review and edit before moving on.</p>
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

              {/* Quality checks */}
              <div className="row">
                <button
                  className="btn btn-outline btn-sm"
                  id="btn-voice"
                  onClick={() => runPhase('voice_check', 'Voice Check')}
                  disabled={running}
                >
                  {running && runningBtn === 'Voice Check'
                    ? <><span className="spinner"></span> Running…</>
                    : 'Voice Check'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  id="btn-spell"
                  onClick={() => runPhase('spellcheck', 'Spell Check')}
                  disabled={running}
                >
                  {running && runningBtn === 'Spell Check'
                    ? <><span className="spinner"></span> Running…</>
                    : 'Spell Check'}
                </button>
              </div>

              <hr className="divider" />

              {/* Publish */}
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
            </div>
          </div>

        </div>{/* /.steps */}

        {/* SEO / Copy Fields */}
        <div className="seo-fields">
          <div className="seo-fields-header">
            <div className="step-num" style={{ background: '#c8a96e' }}>4</div>
            <div><h2 style={{ fontSize: '14px', fontWeight: 600 }}>Blog Fields</h2><p style={{ fontSize: '11px', color: '#c8a96e' }}>Copy into your CMS when publishing</p></div>
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
              <div id="seo-title" style={{ fontSize: '13px', fontWeight: 600, color: '#1a2e44', marginBottom: '8px', lineHeight: 1.4 }}>{seoTitle}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoTitle, e.currentTarget)}>Copy</button>
            </div>
            <div className="seo-field-cell">
              <div className="section-label" style={{ marginBottom: '6px' }}>URL Slug</div>
              <div id="seo-slug" style={{ fontSize: '12px', fontFamily: 'monospace', color: '#1a6b9e', marginBottom: '8px', wordBreak: 'break-all' }}>{seoSlug}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoSlug, e.currentTarget)}>Copy</button>
            </div>
            <div className="seo-field-cell" style={{ borderRight: 'none' }}>
              <div className="section-label" style={{ marginBottom: '6px' }}>Primary Keyword</div>
              <div id="seo-keyword" style={{ fontSize: '12px', fontFamily: 'monospace', color: '#1a2e44', marginBottom: '8px' }}>{seoKeyword}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoKeyword, e.currentTarget)}>Copy</button>
            </div>
          </div>
          <div className="seo-field-cell2">
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Meta Description (140–155 chars)</div>
              <div id="seo-desc" style={{ fontSize: '12px', color: '#3a4a5a', marginBottom: '4px', lineHeight: 1.5 }}>{seoDesc}</div>
              <div id="seo-desc-len" style={{ fontSize: '10px', color: '#8492a6', marginBottom: '6px' }}>{seoDescLen}</div>
              <button className="btn btn-outline btn-sm" onClick={e => copyField(seoDesc, e.currentTarget)}>Copy</button>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Image Alt Text + Download</div>
              <div id="seo-alt" style={{ fontSize: '12px', color: '#3a4a5a', marginBottom: '8px' }}>{seoAlt}</div>
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
    </>
  )
}
