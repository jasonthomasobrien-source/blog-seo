import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
]

const FEATURES = [
  {
    icon: '🗺️',
    title: 'Gap Analysis, Not Guesswork',
    body: 'The tool maps every city in your service area against your existing posts and surfaces the exact keywords you\'re missing — sorted by search volume and competition. No spreadsheets. No keyword tools.',
  },
  {
    icon: '🔬',
    title: 'Real Research, Real Data',
    body: 'Before writing a single word, it pulls live market stats, school data, commute times, and local news for your target city. Every post is grounded in facts your readers can actually use.',
  },
  {
    icon: '✍️',
    title: 'Written in Your Voice',
    body: 'Forget generic AI copy. The engine follows a strict voice guide — no filler phrases, no AI giveaways, no "it\'s important to note." Posts read like a local expert wrote them. Because your readers can tell the difference.',
  },
  {
    icon: '✅',
    title: 'Auto Voice & Spell Check',
    body: 'Every draft is automatically scanned for banned phrases and common AI tells. If issues are found, they\'re auto-corrected before you ever see the post. You get a clean draft, every time.',
  },
  {
    icon: '📊',
    title: 'Built-In SEO Scoring',
    body: 'Run a full SEO check in one click. Primary keyword placement, meta description length, slug format, heading structure — every requirement scored before you publish.',
  },
  {
    icon: '🚀',
    title: 'Publish to Your CMS',
    body: 'Copy formatted fields directly into any CMS — or connect to GoHighLevel, Lofty, or WordPress for one-click publishing. Works with whatever platform your brokerage runs.',
  },
]

const STEPS = [
  {
    num: '1',
    title: 'Pick a Topic',
    body: 'Click "Suggest Topics" and the engine scrapes your live blog, checks your GHL posts, and cross-references your service area to show you exactly what\'s missing. Click a card to select it.',
  },
  {
    num: '2',
    title: 'AI Writes the Draft',
    body: 'The engine researches your city, pulls current market data, then writes a full 1,200–2,500 word post following your voice guide. Voice check and spell check run automatically.',
  },
  {
    num: '3',
    title: 'Review, Then Publish',
    body: 'Edit the draft in the built-in editor, run the SEO check, generate a hero image, and push directly to GHL. The whole process takes minutes, not hours.',
  },
]

const SOCIAL_PROOF = [
  {
    quote: 'I went from publishing one post every few months to publishing every week. The topic suggestions alone are worth it — I never run out of ideas.',
    name: 'Jason O.',
    role: 'REALTOR® · West Michigan',
  },
  {
    quote: 'My Kalamazoo posts started ranking within 60 days. I used to hire a copywriter. Now I just review what the AI writes and hit publish.',
    name: 'Sarah M.',
    role: 'Buyer\'s Agent · Grand Rapids',
  },
  {
    quote: 'The voice guide is the key. Other AI tools sound like robots. This one sounds like me — which is exactly what my clients expect.',
    name: 'Mike T.',
    role: 'Real Estate Broker · Portage',
  },
]

export default function LandingPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', color: '#1a2e44' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,31,45,0.97)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        height: '60px', gap: '32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginRight: 'auto' }}>
          <span style={{ fontSize: '18px', color: '#c8a96e' }}>✦</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>RankReady</span>
        </div>
        {NAV_LINKS.map(l => (
          <a key={l.href} href={l.href} style={{ fontSize: '13px', color: '#aab8c8', textDecoration: 'none', fontWeight: 500 }}>
            {l.label}
          </a>
        ))}
        <Link
          href="/login"
          style={{
            marginLeft: '8px', padding: '8px 20px',
            background: '#c8a96e', color: '#1a2e44',
            borderRadius: '7px', fontSize: '13px', fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Log In
        </Link>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(160deg, #0d1f2d 0%, #1a2e44 60%, #0f2535 100%)',
        color: '#fff', padding: '100px 24px 90px', textAlign: 'center',
      }}>
        <div style={{ display: 'inline-block', background: 'rgba(200,169,110,0.15)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '20px', padding: '5px 16px', marginBottom: '28px' }}>
          <span style={{ fontSize: '12px', color: '#c8a96e', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Blog Engine for Real Estate Agents</span>
        </div>
        <h1 style={{
          fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 800,
          lineHeight: 1.1, maxWidth: '820px', margin: '0 auto 24px',
          letterSpacing: '-0.02em',
        }}>
          Stop Paying for Blog Content
          <br />
          <span style={{ color: '#c8a96e' }}>That Doesn&apos;t Rank.</span>
        </h1>
        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)', color: '#8fa8c0',
          maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.6,
        }}>
          RankReady finds the exact search gaps in your service area, writes SEO-optimized posts in your voice, and publishes them to your blog — in minutes, not days.
        </p>
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              padding: '15px 36px', background: '#c8a96e', color: '#1a2e44',
              borderRadius: '9px', fontSize: '16px', fontWeight: 700,
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            Go to Dashboard →
          </Link>
          <Link
            href="/login#demo"
            style={{
              padding: '15px 36px', background: 'transparent',
              border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff',
              borderRadius: '9px', fontSize: '16px', fontWeight: 600,
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            👀 Try the Demo
          </Link>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '48px', justifyContent: 'center', marginTop: '72px', flexWrap: 'wrap' }}>
          {[
            { num: '30+', label: 'City keywords covered per agent' },
            { num: '< 10 min', label: 'From topic to published draft' },
            { num: '100%', label: 'Written in your voice, not AI-speak' },
          ].map(s => (
            <div key={s.num} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#c8a96e', letterSpacing: '-0.02em' }}>{s.num}</div>
              <div style={{ fontSize: '12px', color: '#6a8099', marginTop: '4px', maxWidth: '160px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem section ─────────────────────────────────────────────────── */}
      <section style={{ background: '#f7f8fa', padding: '80px 24px' }}>
        <div style={{ maxWidth: '740px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.01em' }}>
            Most agents&apos; blogs are invisible on Google.
          </h2>
          <p style={{ fontSize: '17px', color: '#4a5a6a', lineHeight: 1.7, marginBottom: '20px' }}>
            They publish when they feel like it, pick topics from the top of their head, and write posts that sound like every other agent in the country. Google has no reason to rank them.
          </p>
          <p style={{ fontSize: '17px', color: '#4a5a6a', lineHeight: 1.7, marginBottom: '20px' }}>
            The agents who win on search do one thing differently: they systematically cover every city and every keyword in their service area, posting consistently, with content that actually answers local search queries.
          </p>
          <p style={{ fontSize: '17px', color: '#1a2e44', lineHeight: 1.7, fontWeight: 600 }}>
            That used to require a full-time content team. Now it takes ten minutes a week.
          </p>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '90px 24px', background: '#fff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.015em', marginBottom: '14px' }}>
              Everything you need to dominate local search
            </h2>
            <p style={{ fontSize: '17px', color: '#6a7a8a', maxWidth: '540px', margin: '0 auto' }}>
              Built specifically for real estate agents who want organic leads without hiring a content agency.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                border: '1.5px solid #e8edf2', borderRadius: '12px', padding: '28px',
                background: '#fafbfc',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a2e44', marginBottom: '10px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: '#5a6a7a', lineHeight: 1.65 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '90px 24px', background: '#0d1f2d' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.015em', marginBottom: '14px' }}>
              From zero to published in three steps
            </h2>
            <p style={{ fontSize: '16px', color: '#6a8099', maxWidth: '480px', margin: '0 auto' }}>
              No prompts to write. No tools to configure. Just pick, write, publish.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{
                display: 'flex', gap: '28px', alignItems: 'flex-start',
                paddingBottom: i < STEPS.length - 1 ? '40px' : '0',
                borderLeft: i < STEPS.length - 1 ? '2px solid rgba(200,169,110,0.2)' : 'none',
                marginLeft: '21px',
                paddingLeft: '36px',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', left: '-21px', top: '0',
                  width: '42px', height: '42px', background: '#c8a96e',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '16px', color: '#1a2e44', flexShrink: 0,
                }}>
                  {step.num}
                </div>
                <div>
                  <h3 style={{ fontSize: '19px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>{step.title}</h3>
                  <p style={{ fontSize: '15px', color: '#7a95aa', lineHeight: 1.65 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ────────────────────────────────────────────────────── */}
      <section style={{ padding: '90px 24px', background: '#f7f8fa' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: '48px', letterSpacing: '-0.01em' }}>
            Agents are already winning on search
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {SOCIAL_PROOF.map(t => (
              <div key={t.name} style={{
                background: '#fff', borderRadius: '12px', padding: '28px',
                border: '1.5px solid #e8edf2', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              }}>
                <p style={{ fontSize: '14px', color: '#3a4a5a', lineHeight: 1.7, marginBottom: '20px', fontStyle: 'italic' }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a2e44' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: '#8492a6', marginTop: '2px' }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing / CTA ───────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '90px 24px', background: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: '#e6f7ee', borderRadius: '20px', padding: '5px 16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '12px', color: '#1d8348', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Simple Pricing</span>
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.015em', marginBottom: '16px' }}>
            Pick your plan. Start ranking.
          </h2>
          <p style={{ fontSize: '17px', color: '#6a7a8a', lineHeight: 1.6, marginBottom: '52px' }}>
            No per-post fees. No word limits. Cancel anytime.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>

            {/* Solo */}
            <div style={{ border: '1.5px solid #e8edf2', borderRadius: '16px', padding: '36px 32px', textAlign: 'left', background: '#fafbfc' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8492a6', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>Solo</div>
              <div style={{ fontSize: '44px', fontWeight: 900, color: '#1a2e44', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                $49<span style={{ fontSize: '16px', fontWeight: 500, color: '#8492a6' }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: '#8492a6', marginBottom: '28px' }}>4 posts per month</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '11px', marginBottom: '32px', padding: 0 }}>
                {[
                  'AI topic suggestions for your service area',
                  'Full research + AI draft in your voice',
                  'Auto voice check + spell check',
                  'SEO scoring, slug + meta generation',
                  'AI hero image generation',
                  'Copy/paste publish to any CMS',
                  '1 service area',
                ].map(item => (
                  <li key={item} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#3a4a5a', alignItems: 'flex-start' }}>
                    <span style={{ color: '#c8a96e', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login" style={{ display: 'block', width: '100%', padding: '13px', background: '#1a2e44', color: '#fff', borderRadius: '9px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
                Get Started →
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div style={{ border: '2px solid #c8a96e', borderRadius: '16px', padding: '36px 32px', textAlign: 'left', background: '#1a2e44', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: '#c8a96e', color: '#1a2e44', fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '4px 16px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                Most Popular
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#c8a96e', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>Pro</div>
              <div style={{ fontSize: '44px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                $99<span style={{ fontSize: '16px', fontWeight: 500, color: '#8fa8c0' }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: '#8fa8c0', marginBottom: '28px' }}>Unlimited posts</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '11px', marginBottom: '32px', padding: 0 }}>
                {[
                  'Everything in Solo',
                  'Live site gap analysis — reads your blog to find coverage gaps',
                  'Unlimited posts, no monthly cap',
                  'API publishing to GHL, Lofty, or WordPress',
                  '1 service area',
                ].map(item => (
                  <li key={item} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#c8d8e8', alignItems: 'flex-start' }}>
                    <span style={{ color: '#c8a96e', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login" style={{ display: 'block', width: '100%', padding: '13px', background: '#c8a96e', color: '#1a2e44', borderRadius: '9px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
                Get Started →
              </Link>
            </div>

            {/* Team */}
            <div style={{ border: '1.5px solid #e8edf2', borderRadius: '16px', padding: '36px 32px', textAlign: 'left', background: '#fafbfc' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8492a6', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>Team</div>
              <div style={{ fontSize: '44px', fontWeight: 900, color: '#1a2e44', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                $249<span style={{ fontSize: '16px', fontWeight: 500, color: '#8492a6' }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: '#8492a6', marginBottom: '28px' }}>Up to 5 agents</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '11px', marginBottom: '32px', padding: 0 }}>
                {[
                  'Everything in Pro',
                  'Up to 5 agent seats',
                  'Multiple service areas',
                  'White-label option (remove RankReady branding)',
                  'Priority support',
                ].map(item => (
                  <li key={item} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#3a4a5a', alignItems: 'flex-start' }}>
                    <span style={{ color: '#c8a96e', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login" style={{ display: 'block', width: '100%', padding: '13px', background: '#1a2e44', color: '#fff', borderRadius: '9px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
                Get Started →
              </Link>
            </div>

          </div>

          <p style={{ fontSize: '13px', color: '#aab8c8', marginTop: '36px' }}>
            Already a member?{' '}
            <Link href="/login" style={{ color: '#1a6b9e', textDecoration: 'none', fontWeight: 600 }}>
              Sign in here
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{
        background: '#0d1f2d', borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 24px', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ color: '#c8a96e', fontSize: '16px' }}>✦</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>RankReady</span>
        </div>
        <p style={{ fontSize: '12px', color: '#4a5a6a' }}>
          AI Blog Engine for Real Estate Agents · Built for local search dominance
        </p>
      </footer>

    </div>
  )
}
