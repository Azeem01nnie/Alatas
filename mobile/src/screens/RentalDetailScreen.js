import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { useFleet } from '../context/FleetContext'
import { useAuth } from '../context/AuthContext'
import RentalReviewContent from '../components/RentalReviewContent'
import { ACCENT } from '../theme/colors'
import { formatApiError } from '../api/client'

export default function RentalDetailScreen({ route, navigation }) {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { rentals, pendingRentals, acceptPending, rejectPending, completeRental, loadAll } =
    useFleet()
  const rentalId = route.params?.rentalId
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')

  const rental = useMemo(() => {
    const all = [...(pendingRentals || []), ...(rentals || [])]
    return all.find((r) => String(r.id) === String(rentalId)) || route.params?.rental || null
  }, [rentals, pendingRentals, rentalId, route.params?.rental])

  const isAdmin = user?.role === 'admin'
  const pending =
    rental?.approvalStatus === 'pending' || rental?.rentalLifecycle === 'pending_approval'
  const canComplete =
    isAdmin &&
    (rental?.rentalLifecycle === 'active' || rental?.rentalLifecycle === 'scheduled')

  const onApprove = async () => {
    setBusy(true)
    try {
      await acceptPending(rental.id)
      Alert.alert('Approved', 'Rental accepted.')
      await loadAll()
      navigation.goBack()
    } catch (err) {
      Alert.alert('Approve failed', formatApiError(err, 'approve'))
    } finally {
      setBusy(false)
    }
  }

  const onReject = async () => {
    setBusy(true)
    try {
      await rejectPending(rental.id, reason)
      Alert.alert('Declined', 'Rental rejected.')
      navigation.goBack()
    } catch (err) {
      Alert.alert('Decline failed', formatApiError(err, 'decline'))
    } finally {
      setBusy(false)
    }
  }

  const onComplete = async () => {
    setBusy(true)
    try {
      await completeRental(
        rental.vehicleId || rental.vehicle?.id,
        rental.vehicle?.plateNo || '',
        rental.id,
      )
      Alert.alert('Completed', 'Rental marked complete.')
      navigation.goBack()
    } catch (err) {
      Alert.alert('Complete failed', formatApiError(err, 'complete'))
    } finally {
      setBusy(false)
    }
  }

  if (!rental) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textSub }}>Rental not found.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <RentalReviewContent rental={rental} theme={theme} />

      {pending && isAdmin ? (
        <View style={styles.actions}>
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.border, color: theme.textMain, backgroundColor: theme.card },
            ]}
            placeholder="Decline reason (optional)"
            placeholderTextColor={theme.textSub}
            value={reason}
            onChangeText={setReason}
          />
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#059669', opacity: busy ? 0.7 : 1 }]}
            onPress={onApprove}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Approve</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#dc2626', opacity: busy ? 0.7 : 1 }]}
            onPress={onReject}
            disabled={busy}
          >
            <Text style={styles.btnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canComplete ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: ACCENT, marginTop: 12, opacity: busy ? 0.7 : 1 }]}
          onPress={onComplete}
          disabled={busy}
        >
          <Text style={styles.btnText}>Mark completed</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.btnOutline, { borderColor: theme.border, marginTop: 12 }]}
        onPress={() => navigation.navigate('CarPhotos', { rental })}
      >
        <Text style={{ color: theme.textMain, fontWeight: '600' }}>Vehicle photos</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 16, gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  btn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
})
