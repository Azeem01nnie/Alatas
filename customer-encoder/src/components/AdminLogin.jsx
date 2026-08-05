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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(AUTH_KEY, '1')
      onSuccess()
      return
    }
    setError('Invalid username or password.')
  }

  return (
    <main className="success-card login-card">
      <h1>Admin Login</h1>
      <p>Sign in to manage the fleet dashboard.</p>

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
          />
        </label>

        {error && <span className="error-msg">{error}</span>}

        <button type="submit" className="btn-primary login-submit">
          Sign In
        </button>
      </form>

      <p className="login-hint">Demo credentials: admin / admin123</p>
    </main>
  )
}
