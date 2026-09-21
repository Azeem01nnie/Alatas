import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native'
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { ACCENT } from '../theme/colors'
import { clearAppData, getSystemStatus } from '../api/settings'
import { fetchLoginAudit } from '../utils/loginAudit'
import { isSupabaseConfigured } from '../api/supabaseClient'
import { formatApiError } from '../api/client'
import {
  clearBiometricEnrollment,
  getBiometricLabel,
  isBiometricsAvailable,
  loadBiometricEnrollment,
} from '../utils/biometrics'

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme()
  const { user, updateDisplayName, logout, loginWithPassword, enableBiometrics } = useAuth()
  const { syncNow, queueLength, apiOk, loadAll } = useFleet()
  const pad = useTabBarContentPadding()
  const isAdmin = user?.role === 'admin'

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditRows, setAuditRows] = useState([])
  const [clearUser, setClearUser] = useState('')
  const [clearPass, setClearPass] = useState('')
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnrollment, setBioEnrollment] = useState(null)
  const [bioLabel, setBioLabel] = useState('Biometrics')

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getSystemStatus())
    } catch {
      setStatus({ mode: 'supabase', online: false })
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [available, enrollment, label] = await Promise.all([
        isBiometricsAvailable(),
        loadBiometricEnrollment(),
        getBiometricLabel(),
      ])
      if (!mounted) return
      setBioAvailable(available)
      setBioEnrollment(enrollment)
      setBioLabel(label)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const saveProfile = async () => {
    setBusy(true)
    try {
      await updateDisplayName(displayName)
      Alert.alert('Saved', 'Profile updated.')
    } catch (err) {
      Alert.alert('Save failed', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const loadAudit = async () => {
    setAuditOpen((v) => !v)
    if (auditOpen) return
    try {
      const rows = await fetchLoginAudit()
      setAuditRows(Array.isArray(rows) ? rows.slice(0, 30) : [])
    } catch (err) {
      Alert.alert('Audit load failed', formatApiError(err))
    }
  }

  const onClear = () => {
    if (!isAdmin) return
    Alert.alert(
      'Clear all app data?',
      'Deletes vehicles, rentals, and most employees on Supabase. Admin login is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            try {
              await loginWithPassword(clearUser, clearPass)
              await clearAppData()
              await loadAll()
              Alert.alert('Cleared', 'Supabase fleet data wiped.')
              setClearUser('')
              setClearPass('')
            } catch (err) {
              Alert.alert('Clear failed', formatApiError(err, 'clear'))
            } finally {
              setBusy(false)
            }
          },
        },
      ],
    )
  }

  return (
    <ScreenLayout
      scroll={false}
      header={<ScreenHeader title="Settings" subtitle="Profile, theme, and Supabase" />}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: pad + 24 }}>
        <Section title="Session" theme={theme}>
          <Text style={{ color: theme.textSub }}>
            {user?.displayName} · {user?.role} · @{user?.username}
          </Text>
        </Section>

        <Section title="Profile" theme={theme}>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.textMain, backgroundColor: theme.card }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={theme.textSub}
          />
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: ACCENT, opacity: busy ? 0.7 : 1 }]}
            onPress={saveProfile}
            disabled={busy}
          >
            <Text style={styles.btnText}>Save display name</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Appearance" theme={theme}>
          <View style={styles.row}>
            <Text style={{ color: theme.textMain, fontWeight: '600' }}>Dark mode</Text>
            <Switch value={isDark} onValueChange={toggleTheme} />
          </View>
        </Section>

        <Section title={bioLabel} theme={theme}>
          <Text style={{ color: theme.textSub }}>
            {bioEnrollment?.enabled
              ? `Enabled for @${bioEnrollment.username}`
              : bioAvailable
                ? 'Not enabled on this phone yet.'
                : 'Not available on this device.'}
          </Text>
          {bioAvailable && !bioEnrollment?.enabled ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: ACCENT }]}
              onPress={async () => {
                try {
                  await enableBiometrics(user)
                  setBioEnrollment(await loadBiometricEnrollment())
                  Alert.alert('Enabled', `${bioLabel} is ready.`)
                } catch (err) {
                  Alert.alert('Could not enable', err?.message || String(err))
                }
              }}
            >
              <Text style={styles.btnText}>Enable {bioLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {bioEnrollment?.enabled ? (
            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: theme.border }]}
              onPress={async () => {
                await clearBiometricEnrollment()
                setBioEnrollment(null)
              }}
            >
              <Text style={{ color: theme.textMain, fontWeight: '600' }}>
                Remove from this device
              </Text>
            </TouchableOpacity>
          ) : null}
        </Section>

        <Section title="Connection" theme={theme}>
          <Text style={{ color: theme.textSub }}>
            Backend: {isSupabaseConfigured ? 'Supabase' : 'Not configured'}
          </Text>
          <Text style={{ color: theme.textSub }}>
            Health: {apiOk ? 'OK' : 'Unavailable'} · Pending queue: {queueLength}
          </Text>
          <Text style={{ color: theme.textSub }}>
            Approvals waiting: {status?.pendingApprovalCount ?? '—'}
          </Text>
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: theme.border }]}
            onPress={async () => {
              await syncNow()
              await refreshStatus()
              Alert.alert('Synced', 'Offline queue flushed and fleet refreshed.')
            }}
          >
            <Text style={{ color: theme.textMain, fontWeight: '600' }}>Sync now</Text>
          </TouchableOpacity>
        </Section>

        {isAdmin ? (
          <Section title="Security / audit" theme={theme}>
            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: theme.border }]}
              onPress={loadAudit}
            >
              <Text style={{ color: theme.textMain, fontWeight: '600' }}>
                {auditOpen ? 'Hide login audit' : 'Show login audit'}
              </Text>
            </TouchableOpacity>
            {auditOpen
              ? auditRows.map((row) => (
                  <View
                    key={row.id}
                    style={[styles.auditRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                  >
                    <Text style={{ color: theme.textMain, fontWeight: '600' }}>
                      {row.username} · {row.status}
                    </Text>
                    <Text style={{ color: theme.textSub, fontSize: 12 }}>
                      {new Date(row.createdAt).toLocaleString()}
                    </Text>
                    <Text style={{ color: theme.textSub, fontSize: 12 }}>{row.detail}</Text>
                  </View>
                ))
              : null}
          </Section>
        ) : null}

        {isAdmin ? (
          <Section title="Data" theme={theme}>
            <Text style={{ color: theme.textSub, marginBottom: 8 }}>
              Re-enter admin credentials to clear fleet data on Supabase.
            </Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textMain, backgroundColor: theme.card }]}
              value={clearUser}
              onChangeText={setClearUser}
              placeholder="Admin username"
              placeholderTextColor={theme.textSub}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textMain, backgroundColor: theme.card }]}
              value={clearPass}
              onChangeText={setClearPass}
              placeholder="Admin password"
              placeholderTextColor={theme.textSub}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#dc2626', opacity: busy ? 0.7 : 1 }]}
              onPress={onClear}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Clear all data</Text>}
            </TouchableOpacity>
          </Section>
        ) : null}

        <TouchableOpacity
          style={[styles.btnOutline, { borderColor: theme.border, marginTop: 8 }]}
          onPress={() => logout()}
        >
          <Text style={{ color: '#dc2626', fontWeight: '700' }}>
            {bioEnrollment?.enabled ? `Lock with ${bioLabel}` : 'Sign out'}
          </Text>
        </TouchableOpacity>
        {bioEnrollment?.enabled ? (
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: theme.border, marginTop: 8 }]}
            onPress={() =>
              Alert.alert(
                'Sign out of account?',
                'You will need your password again before fingerprint unlock works.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: () => logout({ full: true }),
                  },
                ],
              )
            }
          >
            <Text style={{ color: theme.textSub, fontWeight: '600' }}>Sign out of account</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  )
}

function Section({ title, theme, children }) {
  return (
    <View style={[styles.section, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[styles.sectionTitle, { color: theme.textMain }]}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  btn: {
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auditRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
})
