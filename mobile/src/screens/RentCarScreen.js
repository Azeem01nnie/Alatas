import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout'
import { useTheme } from '../context/ThemeContext'
import { useFleet } from '../context/FleetContext'
import { useAuth } from '../context/AuthContext'
import { ACCENT } from '../theme/colors'

const STEPS = ['Vehicle', 'Customer', 'Schedule', 'Review']

export default function RentCarScreen({ navigation }) {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { vehicles, createRental, loading } = useFleet()
  const pad = useTabBarContentPadding()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [vehicleId, setVehicleId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [notes, setNotes] = useState('')

  const available = useMemo(
    () =>
      (vehicles || []).filter(
        (v) => v.status === 'Available' || v.status === 'Scheduled',
      ),
    [vehicles],
  )

  const selected = available.find((v) => String(v.id) === String(vehicleId))

  const next = () => {
    if (step === 0 && !vehicleId) {
      Alert.alert('Select a vehicle')
      return
    }
    if (step === 1 && (!firstName.trim() || !phone.trim())) {
      Alert.alert('Enter customer first name and phone')
      return
    }
    if (step === 2 && (!periodFrom.trim() || !periodTo.trim())) {
      Alert.alert('Enter rental from/to (ISO or YYYY-MM-DD HH:mm)')
      return
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const back = () => setStep((s) => Math.max(0, s - 1))

  const submit = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const fromDate = new Date(periodFrom)
      const toDate = new Date(periodTo)
      const startNow = !Number.isNaN(fromDate.getTime()) && fromDate.getTime() <= Date.now()
      const payload = {
        id: `r-m-${Date.now()}`,
        vehicleId: selected.id,
        vehicle: {
          id: selected.id,
          make: selected.make,
          series: selected.series || selected.model,
          plateNo: selected.plateNo || selected.plate,
          bodyType: selected.bodyType,
          rates: selected.rates || selected._raw?.rates,
        },
        personal: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        },
        rental: {
          periodFrom: Number.isNaN(fromDate.getTime()) ? periodFrom : fromDate.toISOString(),
          periodTo: Number.isNaN(toDate.getTime()) ? periodTo : toDate.toISOString(),
          notes: notes.trim(),
        },
        termsAccepted: true,
        rentalLifecycle: startNow ? 'active' : 'scheduled',
        encodedAt: new Date().toISOString(),
        encodedBy: user?.displayName || user?.username || '',
        source: 'mobile',
      }

      const pending = user?.role === 'employee'
      await createRental(payload, { pending })
      Alert.alert(
        pending ? 'Submitted for approval' : 'Rental created',
        pending
          ? 'An admin will approve this rental on the desk or phone.'
          : 'Rental saved to Supabase.',
      )
      setStep(0)
      setVehicleId('')
      setFirstName('')
      setLastName('')
      setPhone('')
      setPeriodFrom('')
      setPeriodTo('')
      setNotes('')
      navigation.navigate(user?.role === 'admin' ? 'History' : 'History')
    } catch (err) {
      Alert.alert('Could not create rental', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenLayout
      scroll={false}
      header={<ScreenHeader title="Rent Car" subtitle={`Step ${step + 1}: ${STEPS[step]}`} />}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: pad + 24 }}>
        <View style={styles.steps}>
          {STEPS.map((label, i) => (
            <View
              key={label}
              style={[
                styles.stepPill,
                { backgroundColor: i === step ? ACCENT : theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: i === step ? '#fff' : theme.textSub, fontSize: 11, fontWeight: '700' }}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {step === 0 && (
          <View>
            {available.length === 0 ? (
              <Text style={{ color: theme.textSub }}>No available vehicles.</Text>
            ) : (
              available.map((v) => {
                const active = String(v.id) === String(vehicleId)
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.card,
                        borderColor: active ? ACCENT : theme.border,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                    onPress={() => setVehicleId(v.id)}
                  >
                    <Text style={[styles.title, { color: theme.textMain }]}>
                      {v.make} {v.model || v.series}
                    </Text>
                    <Text style={{ color: theme.textSub }}>
                      {v.plate || v.plateNo} · {v.status}
                    </Text>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
        )}

        {step === 1 && (
          <View style={styles.form}>
            <Field label="First name *" value={firstName} onChangeText={setFirstName} theme={theme} />
            <Field label="Last name" value={lastName} onChangeText={setLastName} theme={theme} />
            <Field
              label="Phone *"
              value={phone}
              onChangeText={setPhone}
              theme={theme}
              keyboardType="phone-pad"
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <Field
              label="From (YYYY-MM-DD HH:mm) *"
              value={periodFrom}
              onChangeText={setPeriodFrom}
              theme={theme}
              placeholder="2026-09-22 09:00"
            />
            <Field
              label="To (YYYY-MM-DD HH:mm) *"
              value={periodTo}
              onChangeText={setPeriodTo}
              theme={theme}
              placeholder="2026-09-22 17:00"
            />
            <Field label="Notes" value={notes} onChangeText={setNotes} theme={theme} />
          </View>
        )}

        {step === 3 && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.textMain }]}>Review</Text>
            <Text style={{ color: theme.textSub, marginTop: 8 }}>
              Vehicle: {selected?.make} {selected?.model || selected?.series} (
              {selected?.plate || selected?.plateNo})
            </Text>
            <Text style={{ color: theme.textSub }}>
              Customer: {firstName} {lastName} · {phone}
            </Text>
            <Text style={{ color: theme.textSub }}>
              Period: {periodFrom} → {periodTo}
            </Text>
            {user?.role === 'employee' ? (
              <Text style={{ color: ACCENT, marginTop: 10, fontWeight: '600' }}>
                This will submit for admin approval.
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.actions}>
          {step > 0 ? (
            <TouchableOpacity style={[styles.btnOutline, { borderColor: theme.border }]} onPress={back}>
              <Text style={{ color: theme.textMain, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {step < STEPS.length - 1 ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: ACCENT }]} onPress={next}>
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: ACCENT, opacity: busy ? 0.7 : 1 }]}
              onPress={submit}
              disabled={busy || loading}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {user?.role === 'employee' ? 'Submit' : 'Create rental'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  )
}

function Field({ label, theme, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: theme.textMain, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.textSub}
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.bg,
          color: theme.textMain,
          borderRadius: 10,
          paddingHorizontal: 14,
          height: 48,
          fontSize: 16,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  stepPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: '700' },
  form: { marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
