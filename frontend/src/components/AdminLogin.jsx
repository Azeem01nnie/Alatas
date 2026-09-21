import { useEffect, useState } from 'react'
import logoLight from '../assets/logo.jpg'
import { requireSupabase } from '../api/supabaseClient'
import { recordLoginAudit } from '../utils/loginAudit'
import {
  clearCsrfToken,
  ensureCsrfToken,
  getDeviceFingerprint,
  isSuspiciousLogin,
  rememberFingerprint,
  sanitizeUsername,
} from '../utils/security'
import {
  assertBiometrics,
  biometricLabel,
  clearBiometricEnrollment,
  clearBiometricSessionVault,
  enrollBiometrics,
  isPlatformAuthenticatorAvailable,
  loadBiometricEnrollment,
  loadBiometricSessionVault,
  saveBiometricSessionVault,
  vaultCurrentSupabaseSession,
} from '../utils/webauthnBiometrics'

const AUTH_KEY = 'customer-encoder-admin-auth'
const ROLE_KEY = 'alatas-session-role'
const USER_KEY = 'alatas-session-user'

export function isAdminLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

export function getSessionRole() {
  const stored = sessionStorage.getItem(ROLE_KEY)
  if (stored === 'employee' || stored === 'admin') return stored
  try {
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
    if (user?.role === 'employee' || user?.role === 'admin') return user.role
  } catch {
    // ignore
  }
  return 'admin'
}

export function getSessionUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function clearAdminSession({ full = false } = {}) {
  sessionStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(ROLE_KEY)
  sessionStorage.removeItem(USER_KEY)
  clearCsrfToken()

  // Soft lock when biometrics are enrolled — keep Supabase + vault for fingerprint unlock.
  if (!full) {
    try {
      const enrolled = loadBiometricEnrollment()
      if (enrolled?.credentialId) {
        try {
          void vaultCurrentSupabaseSession(requireSupabase())
        } catch {
          /* ignore */
        }
        return
      }
    } catch {
      /* fall through to full sign-out */
    }
  }

  clearBiometricSessionVault()
  try {
    requireSupabase().auth.signOut()
  } catch {
    // ignore if supabase not ready
  }
}

function toAuthEmail(username) {
  const u = username.trim()
  if (u.includes('@')) return u
  return `${u}@alatas.local`
}

/** Re-check admin username/password before destructive actions (e.g. Clear data). */
export async function verifyAdminCredentials(username, password) {
  const trimmedUser = sanitizeUsername(username)
  const trimmedPass = String(password || '')
  if (!trimmedUser || !trimmedPass) {
    throw new Error('Enter admin username and password.')
  }

  const sb = requireSupabase()
  const email = toAuthEmail(trimmedUser)
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: trimmedPass,
  })
  if (error) {
    throw new Error('Invalid admin username or password.')
  }

  const user = data?.user
  const metaRole = user?.app_metadata?.role || user?.user_metadata?.role || ''
  const isAdmin =
    metaRole === 'admin' ||
    trimmedUser.toLowerCase() === 'alatas' ||
    String(user?.email || '')
      .toLowerCase()
      .includes('alatas@alatas.local')

  if (!isAdmin) {
    throw new Error('Only the admin account can clear all data.')
  }

  return true
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

function IconEye({ crossed = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      {crossed && <path d="M4 20 20 4" />}
    </svg>
  )
}

async function resolveSessionUser(sb, usernameInput) {
  const trimmed = sanitizeUsername(usernameInput)
  const {
    data: { user },
  } = await sb.auth.getUser()

  const metaRole =
    user?.app_metadata?.role || user?.user_metadata?.role || ''
  const isAdmin =
    metaRole === 'admin' ||
    trimmed.toLowerCase() === 'alatas' ||
    (user?.email || '').toLowerCase() === 'alatas@alatas.local'

  let displayName =
    user?.user_metadata?.displayName ||
    (isAdmin ? 'Alatas Admin' : trimmed)
  let username = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed

  if (!isAdmin) {
    const { data: emp } = await sb
      .from('employees')
      .select('name, username, role, active')
      .ilike('username', username)
      .maybeSingle()
    if (emp) {
      if (emp.active === false) {
        throw new Error('This employee account is inactive.')
      }
      displayName = emp.name || emp.username || displayName
      username = emp.username || username
    }
  }

  return {
    role: isAdmin ? 'admin' : 'employee',
    displayName,
    username,
  }
}

function applyDeskSession(sessionUser) {
  ensureCsrfToken()
  sessionStorage.setItem(AUTH_KEY, '1')
  sessionStorage.setItem(ROLE_KEY, sessionUser.role)
  sessionStorage.setItem(USER_KEY, JSON.stringify(sessionUser))
}

export default function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnrollment, setBioEnrollment] = useState(() => loadBiometricEnrollment())
  const [enrollPrompt, setEnrollPrompt] = useState(null) // sessionUser awaiting opt-in
  const bioName = biometricLabel()

  useEffect(() => {
    let mounted = true
    isPlatformAuthenticatorAvailable().then((ok) => {
      if (mounted) setBioAvailable(ok)
    })
    const enrolled = loadBiometricEnrollment()
    if (enrolled?.username) setUsername(enrolled.username)
    return () => {
      mounted = false
    }
  }, [])

  const finishLogin = async (sessionUser, { offerEnroll = false } = {}) => {
    applyDeskSession(sessionUser)
    if (offerEnroll && bioAvailable) {
      const existing = loadBiometricEnrollment()
      if (!existing || existing.username !== sessionUser.username) {
        setEnrollPrompt(sessionUser)
        setLoading(false)
        return true
      }
    }
    onSuccess(sessionUser)
    return false
  }

  const handleEnableBiometrics = async () => {
    if (!enrollPrompt) return
    setLoading(true)
    setError('')
    try {
      await enrollBiometrics({
        username: enrollPrompt.username,
        displayName: enrollPrompt.displayName,
        role: enrollPrompt.role,
        sessionUser: enrollPrompt,
      })
      try {
        await vaultCurrentSupabaseSession(requireSupabase())
      } catch {
        /* ignore */
      }
      setBioEnrollment(loadBiometricEnrollment())
      setNotice(`${bioName} enabled — you can unlock with it after locking the desk.`)
      setEnrollPrompt(null)
      onSuccess(enrollPrompt)
    } catch (err) {
      setError(err?.message || `Could not enable ${bioName}.`)
      setLoading(false)
    }
  }

  const handleSkipEnroll = () => {
    const user = enrollPrompt
    setEnrollPrompt(null)
    if (user) onSuccess(user)
  }

  const handleBiometricSignIn = async () => {
    if (loading) return
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const enrollment = await assertBiometrics()
      const sb = requireSupabase()
      let {
        data: { session },
      } = await sb.auth.getSession()

      // Restore from vault so fingerprint works across many locks / restarts.
      if (!session) {
        const vault = loadBiometricSessionVault()
        if (!vault) {
          setUsername(enrollment.username || '')
          setError(
            `${bioName} OK, but your session expired. Enter your password once — then fingerprint works again.`,
          )
          setLoading(false)
          return
        }
        const { data, error } = await sb.auth.setSession({
          access_token: vault.access_token,
          refresh_token: vault.refresh_token,
        })
        if (error || !data?.session) {
          clearBiometricSessionVault()
          setUsername(enrollment.username || '')
          setError(
            `${bioName} OK, but your saved session expired. Enter your password once — then fingerprint works again.`,
          )
          setLoading(false)
          return
        }
        session = data.session
      }

      saveBiometricSessionVault(session)

      let sessionUser = enrollment.sessionUser
      try {
        sessionUser = await resolveSessionUser(sb, enrollment.username)
      } catch {
        /* keep stored profile */
      }

      await recordLoginAudit({
        username: sessionUser.username,
        role: sessionUser.role,
        status: 'success',
        detail: `Signed in with ${bioName}`,
      })

      await finishLogin(sessionUser, { offerEnroll: false })
      setLoading(false)
    } catch (err) {
      setError(err?.message || `${bioName} sign-in failed.`)
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setNotice('')
    setLoading(true)
    const safeUser = sanitizeUsername(username)
    const fp = getDeviceFingerprint()
    const suspicious = isSuspiciousLogin(fp)

    try {
      const sb = requireSupabase()
      const email = toAuthEmail(safeUser)
      const { error: authError } = await sb.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) {
        await recordLoginAudit({
          username: safeUser || 'unknown',
          role: safeUser.toLowerCase() === 'alatas' ? 'admin' : 'employee',
          status: 'failed',
          detail: 'Invalid username or password',
        })
        setError(authError.message || 'Invalid username or password.')
        setLoading(false)
        return
      }

      const sessionUser = await resolveSessionUser(sb, safeUser)

      if (suspicious) {
        await recordLoginAudit({
          username: sessionUser.username,
          role: sessionUser.role,
          status: 'suspicious',
          detail: 'Successful sign-in from an unrecognized device/browser',
          suspicious: true,
        })
        setNotice(
          'Suspicious login: this device was not recognized. If this was not you, change your password.',
        )
      } else {
        await recordLoginAudit({
          username: sessionUser.username,
          role: sessionUser.role,
          status: 'success',
          detail: 'Signed in successfully over HTTPS',
        })
      }
      rememberFingerprint(fp)

      try {
        const {
          data: { session },
        } = await sb.auth.getSession()
        saveBiometricSessionVault(session)
      } catch {
        /* ignore */
      }

      const pendingEnroll = await finishLogin(sessionUser, { offerEnroll: true })
      if (!pendingEnroll) setLoading(false)
    } catch (err) {
      try {
        requireSupabase().auth.signOut()
      } catch {
        // ignore
      }
      await recordLoginAudit({
        username: safeUser || 'unknown',
        role: safeUser.toLowerCase() === 'alatas' ? 'admin' : 'employee',
        status: 'failed',
        detail: err?.message || 'Sign-in error',
      })
      setError(err?.message || 'Could not sign in. Check Supabase connection.')
      setLoading(false)
    }
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
        <h1>Sign in</h1>
        <p>Admin and employee access to the fleet desk.</p>
      </div>

      {enrollPrompt ? (
        <div className="login-bio-enroll" role="dialog" aria-labelledby="bio-enroll-title">
          <h2 id="bio-enroll-title" className="login-bio-enroll-title">
            Enable {bioName}?
          </h2>
          <p className="login-bio-enroll-copy">
            Unlock the desk with {bioName} after you lock it — works across many sessions on this
            device until you fully sign out or the login expires.
          </p>
          {error && <span className="error-msg">{error}</span>}
          <button
            type="button"
            className="btn-primary login-submit"
            disabled={loading}
            onClick={() => void handleEnableBiometrics()}
          >
            {loading ? 'Waiting for biometrics…' : `Enable ${bioName}`}
          </button>
          <button
            type="button"
            className="btn-outline login-bio-skip"
            disabled={loading}
            onClick={handleSkipEnroll}
          >
            Not now
          </button>
        </div>
      ) : loading ? (
        <div className="login-loading" aria-live="polite" aria-busy="true">
          <div className="loader" aria-hidden="true" />
          <p>Signing you in…</p>
        </div>
      ) : (
        <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
          {bioAvailable && bioEnrollment ? (
            <div className="login-bio-block">
              <button
                type="button"
                className="btn-primary login-submit login-bio-btn"
                onClick={() => void handleBiometricSignIn()}
              >
                Sign in with {bioName}
              </button>
              <p className="login-bio-hint">
                Enrolled for <strong>{bioEnrollment.username}</strong>. Or use password below.
              </p>
              <button
                type="button"
                className="login-bio-remove"
                onClick={() => {
                  clearBiometricEnrollment()
                  setBioEnrollment(null)
                  setNotice(`${bioName} removed from this device.`)
                }}
              >
                Remove {bioName} on this device
              </button>
            </div>
          ) : null}

          <label className="field">
            <span className="field-label">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(sanitizeUsername(e.target.value))
                setError('')
              }}
              autoComplete="username"
              disabled={loading}
              maxLength={64}
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <IconEye crossed={showPassword} />
              </button>
            </div>
          </label>

          {error && <span className="error-msg">{error}</span>}
          {notice && (
            <span className="login-security-notice" role="status">
              {notice}
            </span>
          )}

          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      )}
    </main>
  )
}
