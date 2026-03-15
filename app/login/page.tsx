'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const router = useRouter()

  async function signIn(pw: string, setLoad: (v: boolean) => void) {
    setError('')
    setLoad(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Incorrect password.')
        setLoad(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Connection error. Try again.')
      setLoad(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await signIn(password, setLoading)
  }

  async function handleDemo() {
    setError('')
    setDemoLoading(true)
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Demo not available.')
        setDemoLoading(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Connection error. Try again.')
      setDemoLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1f2d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Logo / wordmark */}
      <div style={{ marginBottom: '36px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: '#1a2e44', borderRadius: '12px', padding: '12px 20px',
          marginBottom: '14px',
        }}>
          <span style={{ fontSize: '22px' }}>✦</span>
          <span style={{ fontSize: '17px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
            RankReady
          </span>
        </div>
        <p style={{ color: '#8492a6', fontSize: '13px' }}>AI Blog Engine for Real Estate Agents</p>
      </div>

      {/* Card */}
      <div style={{
        background: '#1a2e44',
        borderRadius: '14px',
        padding: '36px 40px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: '13px', color: '#8492a6', marginBottom: '28px' }}>
          Enter your password to access the dashboard.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c8a96e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '11px 14px',
                background: '#0d1f2d',
                border: error ? '1.5px solid #e74c3c' : '1.5px solid #2a3a4a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '12px', color: '#e74c3c', margin: '0' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || demoLoading || !password}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#8a7040' : '#c8a96e',
              color: '#1a2e44',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: (loading || demoLoading || !password) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(26,46,68,0.3)', borderTopColor: '#1a2e44', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Signing in…
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Demo divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#2a3a4a' }} />
          <span style={{ fontSize: '11px', color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#2a3a4a' }} />
        </div>

        <button
          onClick={handleDemo}
          disabled={loading || demoLoading}
          style={{
            width: '100%',
            padding: '11px',
            background: 'transparent',
            border: '1.5px solid #2a3a4a',
            borderRadius: '8px',
            color: '#8492a6',
            fontSize: '13px',
            fontWeight: 600,
            cursor: (loading || demoLoading) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {demoLoading ? (
            <>
              <span style={{ display: 'inline-block', width: '13px', height: '13px', border: '2px solid rgba(132,146,166,0.3)', borderTopColor: '#8492a6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Loading demo…
            </>
          ) : '👀 Try the Demo'}
        </button>
      </div>

      <p style={{ marginTop: '24px', fontSize: '12px', color: '#4a5a6a', textAlign: 'center' }}>
        Not a member?{' '}
        <a href="/#pricing" style={{ color: '#c8a96e', textDecoration: 'none' }}>
          Learn more about RankReady
        </a>
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
