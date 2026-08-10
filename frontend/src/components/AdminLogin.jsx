import { useState } from 'react'
import logoLight from '../assets/logo.jpg'

const AUTH_KEY = 'customer-encoder-admin-auth'
const ADMIN_USER = 'alatas'
const ADMIN_PASS = 'Alatas@2026'

export function isAdminLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

export function clearAdminSession() {
  sessionStorage.removeItem(AUTH_KEY)
}

function SeatbeltRail() {
  return (
    <div className="login-seatbelt-rail" aria-hidden="true">
      <svg
        className="login-seatbelt"
        viewBox="0 0 400 28"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <pattern
            id="seatbelt-weave"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-38)"
          >
            <rect width="8" height="8" fill="#1c1c1c" />
            <rect width="4" height="8" fill="#2f2f2f" />
            <rect width="8" height="1.5" fill="#3a3a3a" />
            <rect y="4" width="8" height="1" fill="#141414" />
          </pattern>
          <linearGradient id="seatbelt-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <rect width="400" height="28" fill="url(#seatbelt-weave)" />
        <rect width="400" height="28" fill="url(#seatbelt-depth)" />
        <rect y="0" width="400" height="1.5" fill="#0a0a0a" opacity="0.55" />
        <rect y="26.5" width="400" height="1.5" fill="#000" opacity="0.45" />
      </svg>
    </div>
  )
}

export default function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)

    // Short loading animation for sign-in feedback
    window.setTimeout(() => {
      if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
        sessionStorage.setItem(AUTH_KEY, '1')
        onSuccess()
        return
      }
      setLoading(false)
      setError('Invalid username or password.')
    }, 900)
  }

  return (
    <main className="login-card">
      <div className="login-brand">
        <SeatbeltRail />
        <div className="login-logo-plate">
          <img
            src={logoLight}
            alt="Alatas Car Rental Services"
            className="login-logo"
          />
        </div>
      </div>

      <div className="login-copy">
        <h1>Admin Login</h1>
        <p>Sign in to manage the fleet dashboard.</p>
      </div>

      {loading ? (
        <div className="login-loading" aria-live="polite" aria-busy="true">
          <div className="loader" aria-hidden="true" />
          <p>Signing you in…</p>
        </div>
      ) : (
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError('')
              }}
              autoComplete="username"
              disabled={loading}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>

          {error && <span className="error-msg">{error}</span>}

          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            Sign In
          </button>
        </form>
      )}
    </main>
  )
}
