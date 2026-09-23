import { useLayoutEffect, useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Pencil } from 'lucide-react-native'
import { Screen } from '../components/Screen'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'
import { displayStatusLabel, getDisplayStatus } from '../utils/vehicleDisplayStatus'
import { vehicleImageSource } from '../utils/vehicleImages'

function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function InfoRow({ label, value, colors }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  )
}

export default function VehicleDetailScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { vehicles, rentals } = useFleet()
  const { colors } = useTheme()

  const vehicleId = route.params?.vehicleId
  const vehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(vehicleId)),
    [vehicles, vehicleId],
  )

  const display = vehicle ? getDisplayStatus(vehicle, rentals) : 'available'
  const statusText =
    vehicle?.status === 'Under Maintenance'
      ? 'Under Maintenance'
      : displayStatusLabel(display) === 'On Rent'
        ? 'On Rent'
        : vehicle?.status || displayStatusLabel(display)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: vehicle?.plateNo || 'Vehicle',
      headerRight: vehicle
        ? () => (
            <Pressable
              onPress={() => navigation.navigate('VehicleForm', { vehicleId: vehicle.id })}
              hitSlop={10}
              style={styles.headerEdit}
              accessibilityLabel="Edit vehicle"
            >
              <Pencil size={18} color={ACCENT} strokeWidth={2.4} />
              <Text style={styles.headerEditText}>Edit</Text>
            </Pressable>
          )
        : undefined,
    })
  }, [navigation, vehicle])

  if (!vehicle) {
    return (
      <Screen scroll contentContainerStyle={styles.container}>
        <Text style={[styles.missing, { color: colors.textMuted }]}>Vehicle not found.</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.outlineBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.outlineBtnText, { color: colors.text }]}>Go back</Text>
        </Pressable>
      </Screen>
    )
  }

  const ownership =
    vehicle.ownershipType === 'thirdParty' ? 'Third-party owned' : 'Company-owned'

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Image source={vehicleImageSource(vehicle)} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroBody}>
          <Text style={[styles.plate, { color: colors.text }]}>{vehicle.plateNo || '—'}</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {vehicle.make} {vehicle.series}
          </Text>
          <Text style={[styles.status, { color: ACCENT }]}>{statusText}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
        <InfoRow label="Owner" value={vehicle.ownerName} colors={colors} />
        <InfoRow label="Ownership" value={ownership} colors={colors} />
        <InfoRow label="Body type" value={vehicle.bodyType} colors={colors} />
        <InfoRow label="Seats" value={vehicle.seats != null ? String(vehicle.seats) : ''} colors={colors} />
        <InfoRow label="Transmission" value={vehicle.transmission} colors={colors} />
        <InfoRow label="Engine no." value={vehicle.engineNo} colors={colors} />
        <InfoRow label="Chassis no." value={vehicle.chassisNo} colors={colors} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>City drive rates</Text>
        <InfoRow label="5 hours" value={formatMoney(vehicle.rates?.hrs5)} colors={colors} />
        <InfoRow label="12 hours" value={formatMoney(vehicle.rates?.hrs12)} colors={colors} />
        <InfoRow label="24 hours" value={formatMoney(vehicle.rates?.hrs24)} colors={colors} />
        <InfoRow
          label="Exceeding / hour"
          value={formatMoney(vehicle.rates?.exceedHour)}
          colors={colors}
        />
      </View>

      {(vehicle.orcrImage || vehicle.orImage) && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Documents</Text>
          <View style={styles.docRow}>
            {vehicle.orcrImage ? (
              <View style={styles.docCol}>
                <Text style={[styles.docLabel, { color: colors.textMuted }]}>CR</Text>
                <Image
                  source={vehicleImageSource({ image: vehicle.orcrImage })}
                  style={styles.docThumb}
                  resizeMode="cover"
                />
              </View>
            ) : null}
            {vehicle.orImage ? (
              <View style={styles.docCol}>
                <Text style={[styles.docLabel, { color: colors.textMuted }]}>OR</Text>
                <Image
                  source={vehicleImageSource({ image: vehicle.orImage })}
                  style={styles.docThumb}
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </View>
        </View>
      )}

      <Pressable
        onPress={() => navigation.navigate('VehicleForm', { vehicleId: vehicle.id })}
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryBtnText}>Edit vehicle</Text>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    paddingTop: 8,
    gap: 12,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#ececec',
  },
  heroBody: {
    padding: 14,
  },
  plate: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  status: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  docRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
    marginTop: 8,
  },
  docCol: {
    flex: 1,
  },
  docLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  docThumb: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#ececec',
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    paddingVertical: 6,
  },
  headerEditText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 15,
  },
  missing: {
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 16,
    fontSize: 15,
  },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
})
