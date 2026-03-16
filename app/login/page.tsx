'use client'

import { useState, FormEvent, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) setError(urlError)
  }, [searchParams])

  const googleConfigured = true // always show — server will redirect if not configured

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Incorrect password.')
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Connection error. Try again.')
      setLoading(false)
    }
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

  function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    window.location.href = '/api/auth/google'
  }

  const anyLoading = loading || demoLoading || googleLoading

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
      {/* Logo */}
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
          Sign in to access your dashboard.
        </p>

        {/* Google Sign In */}
        {googleConfigured && (
          <button
            onClick={handleGoogleSignIn}
            disabled={anyLoading}
            style={{
              width: '100%',
              padding: '11px 14px',
              background: googleLoading ? '#e8e8e8' : '#ffffff',
              border: '1.5px solid #dadce0',
              borderRadius: '8px',
              color: '#3c4043',
              fontSize: '14px',
              fontWeight: 600,
              cursor: anyLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '20px',
              transition: 'background 0.15s',
            }}
          >
            {googleLoading ? (
              <>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(60,64,67,0.2)', borderTopColor: '#3c4043', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Signing in…
              </>
            ) : (
              <>
                {/* Google G logo */}
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: '#2a3a4a' }} />
          <span style={{ fontSize: '11px', color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or use password</span>
          <div style={{ flex: 1, height: '1px', background: '#2a3a4a' }} />
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c8a96e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
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
            disabled={anyLoading || !password}
            style={{
              width: '100%',
              padding: '12px',
              background: (anyLoading || !password) ? '#6a5830' : '#c8a96e',
              color: '#1a2e44',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: (anyLoading || !password) ? 'not-allowed' : 'pointer',
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
          disabled={anyLoading}
          style={{
            width: '100%',
            padding: '11px',
            background: 'transparent',
            border: '1.5px solid #2a3a4a',
            borderRadius: '8px',
            color: '#8492a6',
            fontSize: '13px',
            fontWeight: 600,
            cursor: anyLoading ? 'not-allowed' : 'pointer',
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
