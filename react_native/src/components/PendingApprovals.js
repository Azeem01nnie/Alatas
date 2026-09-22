import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native'
import { ACCENT } from '../theme/colors'

function customerName(rental) {
  const p = rental?.personal || {}
  return (
    [p.firstName, p.lastName].filter(Boolean).join(' ') ||
    p.fullName ||
    p.name ||
    'Customer'
  )
}

function plateFor(rental) {
  return rental?.vehicle?.plateNo || rental?.vehicle?.plate || rental?.vehicleId || '—'
}

function formatPeriod(rental) {
  const from = rental?.rental?.periodFrom
  if (!from) return 'Dates TBD'
  const d = new Date(from)
  if (Number.isNaN(d.getTime())) return 'Dates TBD'
  const to = rental?.rental?.periodTo
  const fromStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (!to) return fromStr
  const t = new Date(to)
  if (Number.isNaN(t.getTime())) return fromStr
  return `${fromStr} – ${t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export default function PendingApprovals({
  items,
  isAdmin,
  busyId,
  onAccept,
  onReject,
  onPressItem,
}) {
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const confirmReject = (rental) => {
    if (!isAdmin) return
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Reject rental',
        'Optional reason for rejection',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: (reason) => onReject?.(rental, reason || ''),
          },
        ],
        'plain-text',
        '',
      )
      return
    }
    setRejectTarget(rental)
    setRejectReason('')
  }

  const submitReject = () => {
    if (!rejectTarget) return
    const rental = rejectTarget
    setRejectTarget(null)
    onReject?.(rental, rejectReason.trim())
    setRejectReason('')
  }

  if (!items?.length) {
    return (
      <Text style={styles.empty}>No rentals waiting for approval.</Text>
    )
  }

  return (
    <>
      {items.map((rental) => {
        const busy = busyId != null && String(busyId) === String(rental.id)
        return (
          <TouchableOpacity
            key={String(rental.id)}
            style={styles.card}
            activeOpacity={onPressItem ? 0.85 : 1}
            onPress={() => onPressItem?.(rental)}
            disabled={!onPressItem}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.plate}>{plateFor(rental)}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Pending</Text>
              </View>
            </View>
            <Text style={styles.customer}>{customerName(rental)}</Text>
            <Text style={styles.meta}>{formatPeriod(rental)}</Text>
            {rental.encodedBy ? (
              <Text style={styles.meta}>Encoded by {rental.encodedBy}</Text>
            ) : null}

            {isAdmin ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnAccept, busy && styles.btnDisabled]}
                  onPress={() => onAccept?.(rental)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnText}>Accept</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnReject, busy && styles.btnDisabled]}
                  onPress={() => confirmReject(rental)}
                  disabled={busy}
                >
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.viewOnly}>View only — desk admin must approve.</Text>
            )}
          </TouchableOpacity>
        )
      })}

      <Modal
        visible={Boolean(rejectTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject rental</Text>
            <Text style={styles.modalSub}>Optional reason</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason"
              placeholderTextColor="#71717a"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject]}
                onPress={submitReject}
              >
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  empty: {
    color: '#71717a',
    fontSize: 14,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  plate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181b',
  },
  badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  customer: {
    fontSize: 15,
    color: '#18181b',
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: '#52525b',
    marginTop: 4,
  },
  viewOnly: {
    marginTop: 10,
    fontSize: 12,
    color: '#71717a',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAccept: {
    backgroundColor: '#2e7d32',
  },
  btnReject: {
    backgroundColor: ACCENT,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18181b',
  },
  modalSub: {
    fontSize: 13,
    color: '#52525b',
    marginTop: 4,
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#18181b',
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btnGhost: {
    backgroundColor: '#f4f4f5',
  },
  btnGhostText: {
    color: '#18181b',
    fontWeight: '600',
  },
})
