import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
} from '../api/backend'
import { Screen } from '../components/Screen'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'

const ROLES = ['Manager', 'Staff']

function emptyForm() {
  return { name: '', username: '', phone: '', role: 'Staff', password: '' }
}

export default function EmployeesScreen() {
  const { colors } = useTheme()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchEmployees()
      setEmployees(Array.isArray(rows) ? rows : [])
    } catch (err) {
      Alert.alert('Load failed', err?.message || 'Could not load employees.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.inputBackground,
      borderColor: colors.border,
      color: colors.text,
    },
  ]

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      Alert.alert('Missing fields', 'Name, username, and password are required.')
      return
    }
    setSaving(true)
    try {
      const created = await createEmployee({
        id: `e-${Date.now()}`,
        name: form.name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim(),
        role: form.role,
        password: form.password,
      })
      setEmployees((prev) => [created, ...prev.filter((e) => e.id !== created.id)])
      setForm(emptyForm())
      setShowForm(false)
      Alert.alert('Created', 'Employee account is ready to sign in.')
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not create employee.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(emp) {
    try {
      const updated = await updateEmployee(emp.id, { active: !emp.active })
      setEmployees((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not update employee.')
    }
  }

  function confirmDelete(emp) {
    const label = emp.name || emp.username
    Alert.alert('Delete employee', `Remove ${label}? They will no longer be able to sign in.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteEmployee(emp.id)
              setEmployees((prev) => prev.filter((row) => row.id !== emp.id))
            } catch (err) {
              Alert.alert('Error', err?.message || 'Could not delete employee.')
            }
          })()
        },
      },
    ])
  }

  return (
    <Screen title="Employees" scroll contentContainerStyle={styles.container}>
      <Pressable
        onPress={() => setShowForm((v) => !v)}
        style={[styles.addToggle, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={[styles.addToggleText, { color: ACCENT }]}>
          {showForm ? 'Hide add form' : '+ Add employee'}
        </Text>
      </Pressable>

      {showForm ? (
        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>New employee</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Full name</Text>
          <TextInput value={form.name} onChangeText={(v) => setField('name', v)} style={inputStyle} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
          <TextInput
            value={form.username}
            onChangeText={(v) => setField('username', v)}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Phone</Text>
          <TextInput
            value={form.phone}
            onChangeText={(v) => setField('phone', v)}
            keyboardType="phone-pad"
            style={inputStyle}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map((role) => (
              <Pressable
                key={role}
                onPress={() => setField('role', role)}
                style={[
                  styles.roleChip,
                  {
                    borderColor: form.role === role ? ACCENT : colors.border,
                    backgroundColor: form.role === role ? ACCENT : colors.inputBackground,
                  },
                ]}
              >
                <Text style={{ color: form.role === role ? '#fff' : colors.text, fontWeight: '600' }}>
                  {role}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
          <TextInput
            value={form.password}
            onChangeText={(v) => setField('password', v)}
            secureTextEntry
            autoCapitalize="none"
            style={inputStyle}
          />
          <Pressable
            onPress={() => void handleCreate()}
            disabled={saving}
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
          >
            <Text style={styles.primaryBtnText}>{saving ? 'Creating…' : 'Create account'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.listHeading, { color: colors.textSecondary }]}>
        Team {loading ? '(loading…)' : `(${employees.length})`}
      </Text>
      <FlatList
        data={employees}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name || item.username}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  @{item.username} · {item.role || 'Staff'}
                </Text>
              </View>
              <Text
                style={[
                  styles.activePill,
                  { color: item.active !== false ? '#2e7d32' : colors.textMuted },
                ]}
              >
                {item.active !== false ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => void toggleActive(item)}
                style={[styles.actionBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.actionBtnText, { color: colors.text }]}>
                  {item.active !== false ? 'Deactivate' : 'Activate'}
                </Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(item)} style={styles.actionBtn}>
                <Text style={[styles.actionBtnText, { color: ACCENT }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No employees yet.</Text>
          ) : null
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  addToggle: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addToggleText: {
    fontWeight: '700',
    fontSize: 15,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 16,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  roleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  primaryBtn: {
    marginTop: 16,
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
  listHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    marginTop: 4,
  },
  activePill: {
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionBtn: {
    paddingVertical: 6,
  },
  actionBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
  },
})
