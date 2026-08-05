import { useState } from 'react'

const AUTH_KEY = 'customer-encoder-admin-auth'
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123'

export function isAdminLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

export function clearAdminSession() {
  sessionStorage.removeItem(AUTH_KEY)
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
    <main className="success-card login-card">
      <h1>Admin Login</h1>
      <p>Sign in to manage the fleet dashboard.</p>

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

      {!loading && <p className="login-hint">Demo credentials: admin / admin123</p>}
    </main>
  )
}
