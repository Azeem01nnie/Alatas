import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native'
import { useFleet } from '../context/FleetContext'
import { ACCENT } from '../theme/colors'

function customerName(rental) {
  const p = rental?.personal || {}
  return (
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') ||
    p.fullName ||
    p.name ||
    'Customer'
  )
}

function plateFor(rental) {
  return rental?.vehicle?.plateNo || rental?.vehicle?.plate || rental?.vehicleId || '—'
}

function vehicleLabel(rental) {
  const v = rental?.vehicle || {}
  const make = [v.make, v.series].filter(Boolean).join(' ')
  return make || plateFor(rental)
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function lifecycleLabel(r) {
  if (r.approvalStatus === 'rejected' || r.rentalLifecycle === 'cancelled') {
    return 'Rejected / cancelled'
  }
  if (r.approvalStatus === 'pending' || r.rentalLifecycle === 'pending_approval') {
    return 'Pending approval'
  }
  switch (r.rentalLifecycle) {
    case 'active':
      return 'Active'
    case 'scheduled':
      return 'Scheduled'
    case 'completed':
      return 'Completed'
    default:
      return r.rentalLifecycle || r.approvalStatus || '—'
  }
}

function isPhotoUri(value) {
  if (!value || typeof value !== 'string') return false
  const t = value.trim()
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('file://') ||
    t.startsWith('data:image')
  )
}

function collectPhotoEntries(rental) {
  const out = []
  const push = (uri, label) => {
    if (isPhotoUri(uri)) out.push({ uri: uri.trim(), label })
  }
  push(rental?.photo, 'Customer photo')
  push(rental?.licensePhoto, 'License')
  push(rental?.signature, 'Signature')
  const personal = rental?.personal || {}
  push(personal.optionalPhoto, 'Optional photo')

  const carPhotos = rental?.carPhotos
  if (carPhotos && typeof carPhotos === 'object' && !Array.isArray(carPhotos)) {
    Object.entries(carPhotos).forEach(([key, uri]) => {
      push(uri, key.replace(/_/g, ' '))
    })
  }
  return out
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  )
}

export default function TransactionScreen({ route, navigation }) {
  const { rentals } = useFleet()
  const rentalId = route?.params?.rentalId

  const rental = useMemo(() => {
    if (route?.params?.rental) return route.params.rental
    return (rentals || []).find((r) => String(r.id) === String(rentalId)) || null
  }, [rentals, rentalId, route?.params?.rental])

  const photos = useMemo(
    () => (rental ? collectPhotoEntries(rental) : []),
    [rental],
  )

  const fees = rental?.rental || {}
  const personal = rental?.personal || {}

  if (!rental) {
    return (
      <View style={styles.center}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.notFound}>Rental not found.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Transaction</Text>
      <View style={styles.lifecyclePill}>
        <Text style={styles.lifecycleText}>{lifecycleLabel(rental)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Customer</Text>
      <View style={styles.card}>
        <DetailRow label="Name" value={customerName(rental)} />
        <DetailRow label="Contact" value={personal.contactNo} />
        <DetailRow label="Address" value={personal.address} />
        {personal.emergencyName ? (
          <DetailRow
            label="Emergency"
            value={`${personal.emergencyName}${personal.emergencyContact ? ` · ${personal.emergencyContact}` : ''}`}
          />
        ) : null}
        {rental.encodedBy ? <DetailRow label="Encoded by" value={rental.encodedBy} /> : null}
      </View>

      <Text style={styles.sectionTitle}>Vehicle</Text>
      <View style={styles.card}>
        <DetailRow label="Unit" value={vehicleLabel(rental)} />
        <DetailRow label="Plate" value={plateFor(rental)} />
        <DetailRow label="Transmission" value={rental.vehicle?.transmission} />
      </View>

      <Text style={styles.sectionTitle}>Rental period</Text>
      <View style={styles.card}>
        <DetailRow
          label="From"
          value={fees.periodFromLabel || formatDateTime(fees.periodFrom)}
        />
        <DetailRow label="To" value={fees.periodToLabel || formatDateTime(fees.periodTo)} />
        <DetailRow label="Package" value={fees.packageLabel || fees.package || fees.rateType} />
        {rental.startedAt ? (
          <DetailRow label="Started" value={formatDateTime(rental.startedAt)} />
        ) : null}
        {rental.completedAt ? (
          <DetailRow label="Completed" value={formatDateTime(rental.completedAt)} />
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Fees</Text>
      <View style={styles.card}>
        <DetailRow
          label="Base rate"
          value={
            fees.baseRate != null
              ? `₱${Number(fees.baseRate).toLocaleString()}`
              : fees.rateLabel || fees.rate
          }
        />
        <DetailRow
          label="Total"
          value={
            fees.totalFee != null
              ? `₱${Number(fees.totalFee).toLocaleString()}`
              : fees.total != null
                ? `₱${Number(fees.total).toLocaleString()}`
                : fees.amount != null
                  ? `₱${Number(fees.amount).toLocaleString()}`
                  : null
          }
        />
        {fees.deposit != null ? (
          <DetailRow label="Deposit" value={`₱${Number(fees.deposit).toLocaleString()}`} />
        ) : null}
        {fees.excessHours != null ? (
          <DetailRow label="Excess hours" value={String(fees.excessHours)} />
        ) : null}
      </View>

      {rental.rejectionReason ? (
        <>
          <Text style={styles.sectionTitle}>Rejection</Text>
          <View style={[styles.card, styles.rejectCard]}>
            <Text style={styles.rejectText}>{rental.rejectionReason}</Text>
          </View>
        </>
      ) : null}

      {photos.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoGrid}>
            {photos.map((entry) => (
              <View key={`${entry.label}-${entry.uri.slice(0, 32)}`} style={styles.photoWrap}>
                <Image source={{ uri: entry.uri }} style={styles.photo} resizeMode="cover" />
                <Text style={styles.photoLabel} numberOfLines={1}>
                  {entry.label}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    padding: 16,
    justifyContent: 'center',
  },
  notFound: {
    textAlign: 'center',
    color: '#52525b',
    marginTop: 16,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 6,
  },
  backBtnText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#18181b',
  },
  lifecyclePill: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 16,
  },
  lifecycleText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181b',
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    padding: 14,
    marginBottom: 14,
  },
  detailRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 15,
    color: '#18181b',
  },
  rejectCard: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  rejectText: {
    color: '#991b1b',
    fontSize: 14,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  photoWrap: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#e4e4e7',
  },
  photoLabel: {
    fontSize: 11,
    color: '#52525b',
    padding: 6,
  },
})
