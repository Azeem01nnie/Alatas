import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  isSupabaseConfigured,
  mapAuthNetworkError,
  requireSupabase,
} from '../api/supabaseClient'
import { sanitizeUserText, sanitizeUsername } from '../utils/security'

const USER_STORAGE_KEY = 'alatas-session-user'

const AuthContext = createContext(null)

function toAuthEmail(username) {
  const u = String(username || '').trim()
  if (u.includes('@')) return u
  return `${u}@alatas.local`
}

async function readStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function writeStoredUser(user) {
  if (!user) {
    await AsyncStorage.removeItem(USER_STORAGE_KEY)
    return
  }
  await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        const stored = await readStoredUser()
        if (!isSupabaseConfigured) {
          if (mounted) setUser(stored)
          return
        }
        const sb = requireSupabase()
        const {
          data: { session },
        } = await sb.auth.getSession()
        if (!mounted) return
        if (session?.user && stored) {
          setUser(stored)
        } else if (session?.user) {
          const resolved = await resolveSessionUser(sb, session.user.email || '')
          setUser(resolved)
          await writeStoredUser(resolved)
        } else {
          setUser(null)
          await writeStoredUser(null)
        }
      } catch (err) {
        console.warn('Auth bootstrap failed', err)
        if (mounted) setUser(null)
      } finally {
        if (mounted) setBootstrapping(false)
      }
    }

    void bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  const loginWithPassword = useCallback(async (username, password) => {
    const safeUser = sanitizeUsername(username)
    const trimmedPass = String(password || '')
    if (!safeUser || !trimmedPass) {
      throw new Error('Enter username and password.')
    }

    const sb = requireSupabase()
    const email = toAuthEmail(safeUser)
    let authError = null
    try {
      const result = await sb.auth.signInWithPassword({
        email,
        password: trimmedPass,
      })
      authError = result.error
    } catch (err) {
      throw new Error(mapAuthNetworkError(err?.message))
    }
    if (authError) {
      throw new Error(mapAuthNetworkError(authError.message) || 'Invalid username or password.')
    }

    let sessionUser
    try {
      sessionUser = await resolveSessionUser(sb, safeUser)
    } catch (err) {
      throw new Error(mapAuthNetworkError(err?.message))
    }
    setUser(sessionUser)
    await writeStoredUser(sessionUser)
    return sessionUser
  }, [])

  const logout = useCallback(async () => {
    setUser(null)
    await writeStoredUser(null)
    try {
      if (isSupabaseConfigured) {
        await requireSupabase().auth.signOut()
      }
    } catch {
      /* ignore */
    }
  }, [])

  const updateDisplayName = useCallback(async (displayName) => {
    const name =
      sanitizeUserText(displayName, { maxLength: 80 }) || user?.displayName || 'User'
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, displayName: name }
      void writeStoredUser(updated)
      return updated
    })
  }, [user?.displayName])

  const isAdmin = user?.role === 'admin'
  const isLoggedIn = Boolean(user)

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      isLoggedIn,
      isAdmin,
      loginWithPassword,
      logout,
      updateDisplayName,
    }),
    [user, bootstrapping, isLoggedIn, isAdmin, loginWithPassword, logout, updateDisplayName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
