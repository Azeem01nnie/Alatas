import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isSupabaseConfigured, requireSupabase } from '../api/supabaseClient'
import { fetchAdminProfile, saveAdminProfile } from '../api/settings'
import { sanitizeUsername } from '../utils/security'
import {
  clearBiometricSessionVault,
  loadBiometricEnrollment,
  loadBiometricSessionVault,
  promptBiometrics,
  saveBiometricEnrollment,
  saveBiometricSessionVault,
} from '../utils/biometrics'

const AuthContext = createContext(null)
const PROFILE_KEY = 'alatas-mobile-display-name'
const SESSION_USER_KEY = 'alatas-mobile-session-user'

function profileKeyFor(role) {
  return role === 'admin' ? `${PROFILE_KEY}-admin` : `${PROFILE_KEY}-employee`
}

function toAuthEmail(username) {
  const u = String(username || '').trim()
  if (u.includes('@')) return u
  return `${u}@alatas.local`
}

async function resolveSessionUser(sb, usernameInput) {
  const trimmed = sanitizeUsername(usernameInput)
  const {
    data: { user },
  } = await sb.auth.getUser()

  const metaRole = user?.app_metadata?.role || user?.user_metadata?.role || ''
  const isAdmin =
    metaRole === 'admin' ||
    trimmed.toLowerCase() === 'alatas' ||
    (user?.email || '').toLowerCase() === 'alatas@alatas.local'

  let displayName =
    user?.user_metadata?.displayName || (isAdmin ? 'Alatas Admin' : trimmed)
  let username = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed

  if (!isAdmin) {
    const { data: emp } = await sb
      .from('employees')
      .select('id, name, username, role, active')
      .ilike('username', username)
      .maybeSingle()
    if (emp) {
      if (emp.active === false) {
        throw new Error('This employee account is inactive.')
      }
      displayName = emp.name || emp.username || displayName
      username = emp.username || username
      return {
        role: 'employee',
        displayName,
        username,
        employeeId: emp.id,
        employeeRole: emp.role,
      }
    }
  }

  return {
    role: isAdmin ? 'admin' : 'employee',
    displayName,
    username,
    employeeId: null,
    employeeRole: null,
  }
}

async function persistSessionUser(sessionUser) {
  await AsyncStorage.setItem(profileKeyFor(sessionUser.role), sessionUser.displayName)
  await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(sessionUser))
}

async function vaultCurrentSession(sb) {
  const enrollment = await loadBiometricEnrollment()
  if (!enrollment?.enabled) return
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (session) await saveBiometricSessionVault(session)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const userRef = useRef(null)
  userRef.current = user

  useEffect(() => {
    let mounted = true

    async function restore() {
      if (!isSupabaseConfigured) {
        if (mounted) setBootstrapping(false)
        return
      }
      try {
        const sb = requireSupabase()
        const {
          data: { session },
        } = await sb.auth.getSession()
        if (!mounted) return

        const bio = await loadBiometricEnrollment()
        // Biometrics enrolled → always require fingerprint/Face ID (many sessions).
        if (bio?.enabled) {
          if (mounted) setBootstrapping(false)
          return
        }

        if (session?.user) {
          const cached = await AsyncStorage.getItem(SESSION_USER_KEY)
          let sessionUser = cached ? JSON.parse(cached) : null
          try {
            const emailLocal = String(session.user.email || '')
              .split('@')[0]
              .trim()
            sessionUser = await resolveSessionUser(sb, sessionUser?.username || emailLocal)
            await persistSessionUser(sessionUser)
          } catch {
            /* keep cached */
          }
          if (sessionUser) setUser(sessionUser)
        }
      } catch (err) {
        console.warn('Auth restore failed', err?.message || err)
      } finally {
        if (mounted) setBootstrapping(false)
      }
    }

    void restore()

    if (!isSupabaseConfigured) return undefined
    const sb = requireSupabase()
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
      if (
        session &&
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')
      ) {
        void saveBiometricSessionVault(session).catch(() => {})
      }
    })
    return () => {
      mounted = false
      data?.subscription?.unsubscribe?.()
    }
  }, [])

  const loginWithPassword = useCallback(async (username, password) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured on this build.')
    }
    const safeUser = sanitizeUsername(username)
    const sb = requireSupabase()
    const email = toAuthEmail(safeUser)
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: String(password || ''),
    })
    if (error) {
      throw new Error(error.message || 'Invalid username or password.')
    }

    const sessionUser = await resolveSessionUser(sb, safeUser)
    try {
      if (sessionUser.role === 'admin') {
        const remote = await fetchAdminProfile()
        if (remote?.displayName?.trim()) {
          sessionUser.displayName = remote.displayName.trim()
        }
      }
      await persistSessionUser(sessionUser)
      if (data?.session) await saveBiometricSessionVault(data.session)
      else await vaultCurrentSession(sb)
    } catch {
      /* ignore profile cache */
    }

    setUser(sessionUser)
    return sessionUser
  }, [])

  const enableBiometrics = useCallback(async (sessionUser) => {
    const profile = sessionUser || userRef.current
    if (!profile?.username) throw new Error('Sign in first, then enable biometrics.')
    await promptBiometrics('Confirm to enable biometrics for Alatas')
    const enrollment = await saveBiometricEnrollment(profile)
    if (isSupabaseConfigured) {
      const sb = requireSupabase()
      await vaultCurrentSession(sb)
    }
    return enrollment
  }, [])

  const unlockWithBiometrics = useCallback(async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured on this build.')
    }
    const enrollment = await loadBiometricEnrollment()
    if (!enrollment?.enabled) {
      throw new Error('Biometrics are not enabled yet. Sign in with password first.')
    }

    await promptBiometrics()

    const sb = requireSupabase()
    let {
      data: { session },
    } = await sb.auth.getSession()

    // Restore from secure vault so fingerprint works across many locks / restarts.
    if (!session) {
      const vault = await loadBiometricSessionVault()
      if (!vault) {
        throw new Error('Session expired. Enter your password once, then fingerprint will work again.')
      }
      const { data, error } = await sb.auth.setSession({
        access_token: vault.access_token,
        refresh_token: vault.refresh_token,
      })
      if (error || !data?.session) {
        await clearBiometricSessionVault()
        throw new Error('Saved session expired. Enter your password once, then fingerprint will work again.')
      }
      session = data.session
      await saveBiometricSessionVault(session)
    } else {
      await saveBiometricSessionVault(session)
    }

    let sessionUser = null
    try {
      sessionUser = await resolveSessionUser(sb, enrollment.username)
    } catch {
      const cached = await AsyncStorage.getItem(SESSION_USER_KEY)
      sessionUser = cached ? JSON.parse(cached) : null
    }
    if (!sessionUser) {
      throw new Error('Could not restore your account. Sign in with password.')
    }

    await persistSessionUser(sessionUser)
    setUser(sessionUser)
    return sessionUser
  }, [])

  /** @deprecated Prefer loginWithPassword — kept for any leftover callers */
  const login = useCallback(async (role, username, extras = {}) => {
    setUser({
      role,
      username: String(username || '').trim(),
      displayName: extras.displayName || (role === 'admin' ? 'Alatas Admin' : 'Employee'),
      employeeId: extras.employeeId || null,
      employeeRole: extras.employeeRole || null,
    })
  }, [])

  /**
   * Lock the desk UI across many sessions.
   * - Default with biometrics: keep Supabase + secure vault (fingerprint unlock again).
   * - full: true — revoke session and clear vault (password required once).
   */
  const logout = useCallback(async (options = {}) => {
    const full = Boolean(options?.full)
    const enrollment = await loadBiometricEnrollment()
    const softLock = !full && Boolean(enrollment?.enabled)

    setUser(null)

    if (softLock) {
      // Keep vault + refresh token so fingerprint works next time.
      if (isSupabaseConfigured) {
        try {
          await vaultCurrentSession(requireSupabase())
        } catch {
          /* ignore */
        }
      }
      return
    }

    try {
      await AsyncStorage.removeItem(SESSION_USER_KEY)
    } catch {
      /* ignore */
    }
    await clearBiometricSessionVault()
    if (isSupabaseConfigured) {
      try {
        await requireSupabase().auth.signOut()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const updateDisplayName = useCallback(async (name) => {
    const next = String(name || '').trim()
    if (!next) throw new Error('Display name is required')

    const role = userRef.current?.role
    setUser((prev) => (prev ? { ...prev, displayName: next } : prev))
    try {
      await AsyncStorage.setItem(profileKeyFor(role), next)
      const cached = userRef.current ? { ...userRef.current, displayName: next } : null
      if (cached) await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(cached))
    } catch {
      /* ignore */
    }

    if (role === 'admin') {
      try {
        await saveAdminProfile({ displayName: next })
      } catch (err) {
        console.warn('Could not sync display name', err?.message || err)
      }
    }

    return next
  }, [])

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      login,
      loginWithPassword,
      unlockWithBiometrics,
      enableBiometrics,
      logout,
      updateDisplayName,
      isLoggedIn: Boolean(user),
      isSupabaseConfigured,
    }),
    [
      user,
      bootstrapping,
      login,
      loginWithPassword,
      unlockWithBiometrics,
      enableBiometrics,
      logout,
      updateDisplayName,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
