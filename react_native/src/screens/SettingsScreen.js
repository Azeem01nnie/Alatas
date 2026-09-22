import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  clearAllAppData,
  fetchAdminProfile,
  saveAdminProfileRemote,
} from '../api/backend'
import { Screen } from '../components/Screen'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'

export default function SettingsScreen() {
  const { user, isAdmin, logout, updateDisplayName } = useAuth()
  const { reloadData } = useFleet()
  const { colors, mode, toggleTheme, setMode } = useTheme()

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    setDisplayName(user?.displayName || '')
  }, [user?.displayName])

  const loadAdminProfile = useCallback(async () => {
    if (!isAdmin) return
    setProfileLoading(true)
    try {
      const profile = await fetchAdminProfile()
      if (profile?.displayName) {
        setDisplayName(profile.displayName)
      }
    } catch (err) {
      Alert.alert('Profile', err?.message || 'Could not load admin profile.')
    } finally {
      setProfileLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void loadAdminProfile()
  }, [loadAdminProfile])

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.inputBackground,
      borderColor: colors.border,
      color: colors.text,
    },
  ]

  async function handleSaveDisplayName() {
    const name = displayName.trim()
    if (!name) {
      Alert.alert('Display name', 'Enter a display name.')
      return
    }
    setSavingName(true)
    try {
      await updateDisplayName(name)
      if (isAdmin) {
        await saveAdminProfileRemote({ displayName: name, photo: '' })
      }
      Alert.alert('Saved', 'Display name updated.')
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not save display name.')
    } finally {
      setSavingName(false)
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'End your session on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void logout()
        },
      },
    ])
  }

  function confirmClearData() {
    Alert.alert(
      'Clear all data',
      'This permanently deletes fleet, rentals, reports, and non-admin employees from Supabase. Admin login is kept. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearing(true)
              try {
                await clearAllAppData()
                await reloadData()
                await logout()
                Alert.alert('Cleared', 'All app data was removed. Sign in again when ready.')
              } catch (err) {
                Alert.alert('Clear failed', err?.message || 'Could not clear data.')
              } finally {
                setClearing(false)
              }
            })()
          },
        },
      ],
    )
  }

  const roleLabel = user?.role === 'admin' ? 'Administrator' : user?.role || 'Employee'

  return (
    <Screen title="Settings" scroll contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Account</Text>
        <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
          Signed in as <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.displayName || '—'}</Text>
        </Text>
        <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
          Role: {roleLabel}
          {user?.username ? ` · @${user.username}` : ''}
        </Text>
      </View>

      {isAdmin ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Admin display name</Text>
          {profileLoading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
          ) : (
            <>
              <TextInput value={displayName} onChangeText={setDisplayName} style={inputStyle} />
              <Pressable
                onPress={() => void handleSaveDisplayName()}
                disabled={savingName}
                style={[styles.primaryBtn, savingName && styles.primaryBtnDisabled]}
              >
                <Text style={styles.primaryBtnText}>{savingName ? 'Saving…' : 'Save name'}</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance</Text>
        <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
          Theme: {mode === 'dark' ? 'Dark' : 'Light'}
        </Text>
        <View style={styles.themeRow}>
          <Pressable
            onPress={() => void setMode('light')}
            style={[
              styles.themeBtn,
              {
                borderColor: mode === 'light' ? ACCENT : colors.border,
                backgroundColor: mode === 'light' ? ACCENT : colors.inputBackground,
              },
            ]}
          >
            <Text style={{ color: mode === 'light' ? '#fff' : colors.text, fontWeight: '600' }}>Light</Text>
          </Pressable>
          <Pressable
            onPress={() => void setMode('dark')}
            style={[
              styles.themeBtn,
              {
                borderColor: mode === 'dark' ? ACCENT : colors.border,
                backgroundColor: mode === 'dark' ? ACCENT : colors.inputBackground,
              },
            ]}
          >
            <Text style={{ color: mode === 'dark' ? '#fff' : colors.text, fontWeight: '600' }}>Dark</Text>
          </Pressable>
          <Pressable
            onPress={toggleTheme}
            style={[styles.themeBtn, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>Toggle</Text>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={confirmSignOut} style={[styles.outlineBtn, { borderColor: colors.border }]}>
        <Text style={[styles.outlineBtnText, { color: colors.text }]}>Sign out</Text>
      </Pressable>

      {isAdmin ? (
        <Pressable
          onPress={confirmClearData}
          disabled={clearing}
          style={[styles.dangerBtn, clearing && styles.primaryBtnDisabled]}
        >
          {clearing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerBtnText}>Clear all data</Text>
          )}
        </Pressable>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    marginTop: 4,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  themeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontWeight: '700',
    fontSize: 16,
  },
  dangerBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
})
