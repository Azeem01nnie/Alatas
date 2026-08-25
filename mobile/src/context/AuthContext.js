import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAdminProfile, saveAdminProfile } from '../api/settings';

const AuthContext = createContext(null);
const PROFILE_KEY = 'alatas-mobile-display-name';

function profileKeyFor(role) {
  return role === 'admin' ? `${PROFILE_KEY}-admin` : `${PROFILE_KEY}-employee`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;

  const login = useCallback(async (role, username, extras = {}) => {
    const trimmed = String(username || '').trim();
    let displayName =
      extras.displayName ||
      (role === 'admin' ? 'Alatas Admin' : 'Employee');

    try {
      const local = await AsyncStorage.getItem(profileKeyFor(role));
      if (!extras.displayName && local && local.trim()) displayName = local.trim();
    } catch {
      /* ignore */
    }

    if (role === 'admin') {
      try {
        const remote = await fetchAdminProfile();
        if (remote?.displayName?.trim()) {
          displayName = remote.displayName.trim();
          await AsyncStorage.setItem(profileKeyFor('admin'), displayName);
        }
      } catch {
        /* offline — keep local/default */
      }
    } else if (extras.displayName) {
      try {
        await AsyncStorage.setItem(profileKeyFor('employee'), displayName);
      } catch {
        /* ignore */
      }
    }

    setUser({
      role,
      username: trimmed,
      displayName,
      employeeId: extras.employeeId || null,
      employeeRole: extras.employeeRole || null,
    });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const updateDisplayName = useCallback(async (name) => {
    const next = String(name || '').trim();
    if (!next) throw new Error('Display name is required');

    const role = userRef.current?.role;
    setUser((prev) => (prev ? { ...prev, displayName: next } : prev));
    try {
      await AsyncStorage.setItem(profileKeyFor(role), next);
    } catch {
      /* ignore */
    }

    if (role === 'admin') {
      try {
        await saveAdminProfile({ displayName: next });
      } catch (err) {
        console.warn('Could not sync display name to cloud', err?.message || err);
      }
    }

    return next;
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, updateDisplayName, isLoggedIn: Boolean(user) }),
    [user, login, logout, updateDisplayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
