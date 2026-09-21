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
        if (session?.user) {
          const cached = await AsyncStorage.getItem(SESSION_USER_KEY)
          let sessionUser = cached ? JSON.parse(cached) : null
          try {
            const emailLocal = String(session.user.email || '')
              .split('@')[0]
              .trim()
            sessionUser = await resolveSessionUser(sb, sessionUser?.username || emailLocal)
            await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(sessionUser))
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
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        AsyncStorage.removeItem(SESSION_USER_KEY).catch(() => {})
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
    const { error } = await sb.auth.signInWithPassword({
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
      await AsyncStorage.setItem(profileKeyFor(sessionUser.role), sessionUser.displayName)
      await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(sessionUser))
    } catch {
      /* ignore profile cache */
    }

    setUser(sessionUser)
    return sessionUser
  }, [])

  /** @deprecated Prefer loginWithPassword — kept for any leftover callers */
  const login = useCallback(
    async (role, username, extras = {}) => {
      setUser({
        role,
        username: String(username || '').trim(),
        displayName:
          extras.displayName || (role === 'admin' ? 'Alatas Admin' : 'Employee'),
        employeeId: extras.employeeId || null,
        employeeRole: extras.employeeRole || null,
      })
    },
    [],
  )

  const logout = useCallback(async () => {
    setUser(null)
    try {
      await AsyncStorage.removeItem(SESSION_USER_KEY)
    } catch {
      /* ignore */
    }
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
      logout,
      updateDisplayName,
      isLoggedIn: Boolean(user),
      isSupabaseConfigured,
    }),
    [user, bootstrapping, login, loginWithPassword, logout, updateDisplayName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
