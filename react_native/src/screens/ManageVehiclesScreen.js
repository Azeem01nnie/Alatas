import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react-native'
import ConfirmModal from '../components/ConfirmModal'
import { Screen } from '../components/Screen'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'
import { getDisplayStatus } from '../utils/vehicleDisplayStatus'

const logoFallback = require('../../assets/logo.jpg')

const BODY_TYPE_ORDER = [
  'Hatchback',
  'Sedan',
  'MPV',
  'SUV',
  'Pick-up',
  'Van',
  'Motorcycle',
  'Other',
]

const STATUS_OPTIONS = [
  { value: 'Available', label: 'Available', color: '#2e7d32' },
  { value: 'Maintenance', label: 'Maintenance', color: '#ed6c02' },
]

function vehicleImageSource(vehicle) {
  const uri = String(vehicle?.image || '').trim()
  if (uri && (uri.startsWith('http') || uri.startsWith('data:') || uri.startsWith('file:'))) {
    return { uri }
  }
  return logoFallback
}

function mapMaintenanceStatus(status) {
  if (status === 'Maintenance') return 'Under Maintenance'
  return status
}

/** Badge label for manage-fleet cards (includes live rental state). */
function fleetStatusLabel(vehicle, rentals) {
  const derived = getDisplayStatus(vehicle, rentals)
  if (derived === 'maintenance' || vehicle?.status === 'Under Maintenance') return 'Maintenance'
  if (derived === 'active' || vehicle?.status === 'Rented') return 'Rented'
  if (derived === 'scheduled') return 'Scheduled'
  if (derived === 'pending_approval') return 'Pending'
  return 'Available'
}

function statusAccent(label) {
  if (label === 'Available') return '#2e7d32'
  if (label === 'Maintenance') return '#ed6c02'
  if (label === 'Scheduled' || label === 'Pending') return '#2563eb'
  return ACCENT
}

export default function ManageVehiclesScreen() {
  const navigation = useNavigation()
  const { vehicles, rentals, updateVehicleStatus, removeVehicle } = useFleet()
  const { colors } = useTheme()
  const [openStatusId, setOpenStatusId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const sections = useMemo(() => {
    const groups = {}
    for (const v of vehicles) {
      const key = String(v.bodyType || '').trim() || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(v)
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) =>
        String(a.plateNo || '').localeCompare(String(b.plateNo || '')),
      )
    }
    const known = new Set(BODY_TYPE_ORDER)
    const extras = Object.keys(groups)
      .filter((k) => !known.has(k))
      .sort((a, b) => a.localeCompare(b))
    const order = [...BODY_TYPE_ORDER.filter((k) => k !== 'Other'), ...extras, 'Other']
    return order
      .filter((key) => groups[key]?.length)
      .map((key) => ({
        title: key,
        data: groups[key],
      }))
  }, [vehicles])

  const fleetCount = vehicles.length

  const openAdd = useCallback(() => {
    navigation.navigate('VehicleForm')
  }, [navigation])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openAdd}
          hitSlop={10}
          accessibilityLabel="Add vehicle"
          style={styles.headerAdd}
        >
          <Plus size={18} color={ACCENT} strokeWidth={2.4} />
          <Text style={styles.headerAddText}>Add</Text>
        </Pressable>
      ),
    })
  }, [navigation, openAdd])

  function openEdit(vehicle) {
    setOpenStatusId(null)
    navigation.navigate('VehicleForm', { vehicleId: vehicle.id })
  }

  function openDetail(vehicle) {
    setOpenStatusId(null)
    navigation.navigate('VehicleDetail', { vehicleId: vehicle.id })
  }

  function confirmDelete(vehicle) {
    setOpenStatusId(null)
    setDeleteTarget(vehicle)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await removeVehicle(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not delete vehicle.')
    } finally {
      setDeleting(false)
    }
  }

  function changeStatus(vehicle, status) {
    if (fleetStatusLabel(vehicle, rentals) === 'Rented') {
      Alert.alert(
        'On rent',
        'Status is managed by the active rental. Complete the rental to free this vehicle.',
      )
      setOpenStatusId(null)
      return
    }
    updateVehicleStatus(vehicle.id, mapMaintenanceStatus(status))
    setOpenStatusId(null)
  }

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      <Text style={[styles.listHeading, { color: colors.textSecondary }]}>
        Fleet ({fleetCount})
      </Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        stickySectionHeadersEnabled={false}
        extraData={`${openStatusId}-${rentals?.length || 0}`}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
              {section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const current = fleetStatusLabel(item, rentals)
          const accent = statusAccent(current)
          const menuOpen = openStatusId === String(item.id)
          const onRent = current === 'Rented'

          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  zIndex: menuOpen ? 20 : 1,
                },
              ]}
            >
              <Pressable onPress={() => openDetail(item)} style={styles.cardTop}>
                <Image
                  source={vehicleImageSource(item)}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View style={styles.cardMeta}>
                  <Text style={[styles.plate, { color: colors.text }]} numberOfLines={1}>
                    {item.plateNo || '—'}
                  </Text>
                  <Text style={[styles.make, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.make} {item.series}
                  </Text>
                </View>

                <View style={styles.rightCol}>
                  <View style={styles.statusWrap}>
                    <Pressable
                      onPress={() => {
                        if (onRent) {
                          Alert.alert(
                            'On rent',
                            'This vehicle has an active rental. Status updates when the rental is completed.',
                          )
                          return
                        }
                        setOpenStatusId((id) =>
                          id === String(item.id) ? null : String(item.id),
                        )
                      }}
                      style={[
                        styles.statusTrigger,
                        {
                          borderColor: menuOpen ? accent : colors.border,
                          backgroundColor: `${accent}14`,
                        },
                        menuOpen && styles.statusTriggerOpen,
                      ]}
                    >
                      <View style={[styles.statusDot, { backgroundColor: accent }]} />
                      <Text style={[styles.statusTriggerText, { color: accent }]} numberOfLines={1}>
                        {current}
                      </Text>
                      {!onRent ? (
                        <View style={menuOpen ? styles.chevronOpen : null}>
                          <ChevronDown size={14} color={accent} strokeWidth={2.4} />
                        </View>
                      ) : null}
                    </Pressable>

                    {menuOpen && !onRent ? (
                      <View
                        style={[
                          styles.statusMenu,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        {STATUS_OPTIONS.map((opt) => {
                          const active = current === opt.label || current === opt.value
                          return (
                            <Pressable
                              key={opt.value}
                              onPress={() => changeStatus(item, opt.value)}
                              style={[
                                styles.statusOption,
                                { borderBottomColor: colors.border },
                                active && { backgroundColor: `${opt.color}14` },
                              ]}
                            >
                              <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                              <Text
                                style={[
                                  styles.statusOptionText,
                                  { color: active ? opt.color : colors.text },
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.iconActions}>
                    <Pressable
                      onPress={() => openEdit(item)}
                      hitSlop={8}
                      accessibilityLabel={`Edit ${item.plateNo || item.make}`}
                      style={[
                        styles.iconBtn,
                        { borderColor: colors.border, backgroundColor: colors.inputBackground },
                      ]}
                    >
                      <Pencil size={16} color={colors.text} strokeWidth={2.2} />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      hitSlop={8}
                      accessibilityLabel={`Delete ${item.plateNo || item.make}`}
                      style={[styles.iconBtn, styles.iconBtnDanger, { borderColor: '#f1c0c2' }]}
                    >
                      <Trash2 size={16} color={ACCENT} strokeWidth={2.2} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </View>
          )
        }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>No vehicles yet.</Text>
        }
      />

      <ConfirmModal
        visible={Boolean(deleteTarget)}
        title="Delete vehicle?"
        message={`Remove ${deleteTarget?.plateNo || deleteTarget?.make || 'this vehicle'} from the fleet? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  headerAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerAddText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 15,
  },
  listHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    overflow: 'visible',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumb: {
    width: 88,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#ececec',
  },
  cardMeta: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  plate: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  make: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 118,
  },
  statusWrap: {
    position: 'relative',
    zIndex: 5,
    alignSelf: 'stretch',
  },
  statusTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  statusTriggerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    left: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    backgroundColor: '#fdf2f2',
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
  },
})
