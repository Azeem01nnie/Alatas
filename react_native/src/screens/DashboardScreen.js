import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import PendingApprovals from '../components/PendingApprovals'
import RevenueAreaChart from '../components/RevenueAreaChart'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'
import {
  buildDailyRevenueSeries,
  customerName,
  formatDateTime,
  formatPeso,
  formatRangeCaption,
  formatTimeRemaining,
  getRevenueRange,
} from '../utils/dashboardHelpers'
import { getDisplayStatus } from '../utils/vehicleDisplayStatus'
import { getVehicleGallery, vehicleImageSource } from '../utils/vehicleImages'

const ATTENTION_FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'onRent', label: 'On rent' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'pending', label: 'Pending' },
]

const REVENUE_PRESETS = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

function resolveVehicle(rental, vehicles) {
  return (
    vehicles.find((v) => String(v.id) === String(rental.vehicleId || rental.vehicle?.id)) ||
    vehicles.find(
      (v) =>
        String(v.plateNo || '')
          .trim()
          .toUpperCase() ===
        String(rental.vehicle?.plateNo || '')
          .trim()
          .toUpperCase(),
    ) ||
    rental.vehicle ||
    null
  )
}

function Thumb({ vehicle }) {
  const gallery = getVehicleGallery(vehicle)
  if (gallery[0]) {
    return <Image source={vehicleImageSource(vehicle)} style={styles.thumbImage} />
  }
  const initials = `${(vehicle?.make || '?').slice(0, 1)}${(vehicle?.series || '').slice(0, 1)}`
  return (
    <View style={styles.thumbFallback}>
      <Text style={styles.thumbInitials}>{initials.toUpperCase()}</Text>
    </View>
  )
}

function AttentionRow({ vehicle, title, subtitle, timeLine, action, onPress, overdue, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.attnRow,
        { borderBottomColor: colors.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.thumb}>
        <Thumb vehicle={vehicle} />
      </View>
      <View style={styles.attnMeta}>
        <Text style={[styles.attnTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.attnSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {timeLine ? (
          <Text
            style={[styles.attnTime, { color: colors.textMuted }, overdue && styles.attnOverdue]}
            numberOfLines={2}
          >
            {timeLine}
          </Text>
        ) : null}
      </View>
      {action}
    </Pressable>
  )
}

export default function DashboardScreen({ navigation }) {
  const { user, isAdmin } = useAuth()
  const {
    vehicles,
    rentals,
    ready,
    loadError,
    reloadData,
    acceptPending,
    rejectPending,
    completeRentalForVehicle,
    cancelScheduledRental,
  } = useFleet()
  const { colors } = useTheme()

  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [attentionFilter, setAttentionFilter] = useState('upcoming')
  const [revenuePreset, setRevenuePreset] = useState('week')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1_000)
    return () => clearInterval(id)
  }, [])

  const stats = useMemo(() => {
    let available = 0
    let rented = 0
    let maintenance = 0
    for (const v of vehicles) {
      const status = getDisplayStatus(v, rentals)
      if (status === 'available') available += 1
      if (status === 'active') rented += 1
      if (status === 'maintenance') maintenance += 1
    }
    const scheduled = rentals.filter(
      (r) =>
        r.rentalLifecycle === 'scheduled' &&
        r.approvalStatus !== 'pending' &&
        r.approvalStatus !== 'rejected',
    ).length
    const pending = rentals.filter(
      (r) =>
        r.approvalStatus === 'pending' &&
        (r.rentalLifecycle === 'pending_approval' || !r.rentalLifecycle),
    ).length
    const utilization = vehicles.length ? Math.round((rented / vehicles.length) * 100) : 0
    return { available, rented, maintenance, scheduled, pending, utilization, total: vehicles.length }
  }, [vehicles, rentals])

  const upcomingScheduled = useMemo(() => {
    const now = Date.now()
    return rentals
      .filter(
        (r) =>
          r.rentalLifecycle === 'scheduled' &&
          r.approvalStatus !== 'pending' &&
          r.approvalStatus !== 'rejected',
      )
      .map((r) => {
        const startMs = r.rental?.periodFrom ? new Date(r.rental.periodFrom).getTime() : NaN
        return {
          rental: r,
          vehicle: resolveVehicle(r, vehicles),
          isPastDue: !Number.isNaN(startMs) && startMs <= now,
        }
      })
      .sort((a, b) => {
        const ta = new Date(a.rental.rental?.periodFrom || 0).getTime()
        const tb = new Date(b.rental.rental?.periodFrom || 0).getTime()
        return ta - tb
      })
  }, [rentals, vehicles, tick])

  const onRentQueue = useMemo(() => {
    const rows = rentals
      .filter((r) => r.rentalLifecycle === 'active')
      .map((r) => ({
        rental: r,
        vehicle: resolveVehicle(r, vehicles),
      }))

    const byKey = new Map()
    for (const row of rows) {
      const vid = String(row.rental.vehicleId || row.vehicle?.id || row.rental.vehicle?.id || '')
      const plate = String(row.vehicle?.plateNo || row.rental.vehicle?.plateNo || '')
        .trim()
        .toUpperCase()
      const key = vid || (plate ? `plate:${plate}` : row.rental.id)
      const prev = byKey.get(key)
      if (!prev) {
        byKey.set(key, row)
        continue
      }
      const prevTo = new Date(prev.rental.rental?.periodTo || 0).getTime() || Infinity
      const nextTo = new Date(row.rental.rental?.periodTo || 0).getTime() || Infinity
      if (nextTo < prevTo) byKey.set(key, row)
    }
    return [...byKey.values()]
  }, [rentals, vehicles])

  const maintenanceVehicles = useMemo(
    () => vehicles.filter((v) => getDisplayStatus(v, rentals) === 'maintenance'),
    [vehicles, rentals],
  )

  const pendingItems = useMemo(
    () =>
      rentals.filter(
        (r) =>
          r.approvalStatus === 'pending' &&
          (r.rentalLifecycle === 'pending_approval' || !r.rentalLifecycle),
      ),
    [rentals],
  )

  const filterCounts = useMemo(
    () => ({
      upcoming: upcomingScheduled.length,
      onRent: onRentQueue.length,
      maintenance: maintenanceVehicles.length,
      pending: pendingItems.length,
    }),
    [upcomingScheduled, onRentQueue, maintenanceVehicles, pendingItems],
  )

  const revenueSnapshot = useMemo(() => {
    const { from, to } = getRevenueRange(revenuePreset)
    return buildDailyRevenueSeries(rentals, from, to)
  }, [rentals, revenuePreset])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await reloadData()
    } finally {
      setRefreshing(false)
    }
  }, [reloadData])

  const openTransaction = useCallback(
    (rental) => {
      navigation.navigate('Transaction', { rentalId: rental.id })
    },
    [navigation],
  )

  const handleAccept = useCallback(
    async (rental) => {
      setBusyId(rental.id)
      try {
        await acceptPending(rental.id)
      } catch (err) {
        Alert.alert('Accept failed', err?.message || 'Could not accept rental.')
      } finally {
        setBusyId(null)
      }
    },
    [acceptPending],
  )

  const handleReject = useCallback(
    async (rental, reason) => {
      setBusyId(rental.id)
      try {
        await rejectPending(rental.id, reason)
      } catch (err) {
        Alert.alert('Reject failed', err?.message || 'Could not reject rental.')
      } finally {
        setBusyId(null)
      }
    },
    [rejectPending],
  )

  const handleComplete = useCallback(
    (rental, vehicle) => {
      if (!isAdmin) return
      const plate = vehicle?.plateNo || rental.vehicle?.plateNo || 'this vehicle'
      Alert.alert('Complete rental', `Mark ${plate} as returned?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(rental.id)
            try {
              await completeRentalForVehicle(
                rental.vehicleId || vehicle?.id || rental.vehicle?.id,
                vehicle?.plateNo || rental.vehicle?.plateNo || '',
                rental.id,
              )
            } catch (err) {
              Alert.alert('Complete failed', err?.message || 'Could not complete rental.')
            } finally {
              setBusyId(null)
            }
          },
        },
      ])
    },
    [completeRentalForVehicle, isAdmin],
  )

  const handleCancel = useCallback(
    (rental, vehicle) => {
      if (!isAdmin) return
      const plate = vehicle?.plateNo || rental.vehicle?.plateNo || 'this rental'
      Alert.alert('Cancel scheduled rental', `Cancel booking for ${plate}?`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel rental',
          style: 'destructive',
          onPress: () => cancelScheduledRental(rental.id),
        },
      ])
    },
    [cancelScheduledRental, isAdmin],
  )

  const greeting = user?.displayName || user?.username || 'Team'

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
      }
    >
      <Text style={[styles.title, { color: colors.text }]}>Dashboard</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Hello, {greeting}</Text>

      {!ready ? <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} /> : null}
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      <View style={styles.statsRow}>
        {[
          { label: 'Fleet', value: stats.total },
          { label: 'Available', value: stats.available },
          { label: 'On rent', value: stats.rented, accent: true },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'Utilization', value: `${stats.utilization}%` },
        ].map((s) => (
          <View
            key={s.label}
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.statValue, { color: s.accent ? ACCENT : colors.text }]}>
              {s.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Needs attention */}
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.text }]}>Needs attention</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {ATTENTION_FILTERS.map((opt) => {
            const active = attentionFilter === opt.id
            const count = filterCounts[opt.id] || 0
            return (
              <Pressable
                key={opt.id}
                onPress={() => setAttentionFilter(opt.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? `${ACCENT}18` : colors.inputBackground,
                    borderColor: active ? ACCENT : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? ACCENT : colors.textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
                {count > 0 ? (
                  <View style={[styles.filterBadge, { backgroundColor: ACCENT }]}>
                    <Text style={styles.filterBadgeText}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={styles.attnBody}>
          {attentionFilter === 'upcoming' &&
            (upcomingScheduled.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No upcoming rentals.</Text>
            ) : (
              upcomingScheduled.map(({ rental, vehicle, isPastDue }) => {
                const remaining = isPastDue
                  ? null
                  : formatTimeRemaining(rental.rental?.periodFrom, Date.now(), {
                      mode: 'untilStart',
                    })
                const startLabel = formatDateTime(rental.rental?.periodFrom)
                return (
                  <AttentionRow
                    key={rental.id}
                    vehicle={vehicle}
                    colors={colors}
                    title={`${vehicle?.make || 'Vehicle'} — ${vehicle?.series || ''}`.trim()}
                    subtitle={`${vehicle?.plateNo || '—'} · ${customerName(rental)}`}
                    timeLine={`${startLabel}${isPastDue ? ' · activating…' : remaining ? ` · ${remaining}` : ''}`}
                    onPress={() => openTransaction(rental)}
                    action={
                      isAdmin ? (
                        <Pressable
                          style={styles.outlineBtn}
                          onPress={() => handleCancel(rental, vehicle)}
                        >
                          <Text style={styles.outlineBtnDanger}>Cancel</Text>
                        </Pressable>
                      ) : null
                    }
                  />
                )
              })
            ))}

          {attentionFilter === 'onRent' &&
            (onRentQueue.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No active rentals.</Text>
            ) : (
              onRentQueue.map(({ rental, vehicle }) => {
                const untilLabel = formatDateTime(rental.rental?.periodTo)
                const remaining = formatTimeRemaining(rental.rental?.periodTo)
                const isOverdue = remaining?.startsWith('Overdue')
                const busy = busyId != null && String(busyId) === String(rental.id)
                return (
                  <AttentionRow
                    key={rental.id}
                    vehicle={vehicle}
                    colors={colors}
                    title={`${vehicle?.make || 'Vehicle'} — ${vehicle?.series || ''}`.trim()}
                    subtitle={`${vehicle?.plateNo || '—'} · ${customerName(rental)}`}
                    timeLine={`Until ${untilLabel}${remaining ? ` · ${remaining}` : ''}`}
                    overdue={isOverdue}
                    onPress={() => openTransaction(rental)}
                    action={
                      isAdmin ? (
                        <Pressable
                          style={[styles.primaryBtn, busy && { opacity: 0.65 }]}
                          disabled={busy}
                          onPress={() => handleComplete(rental, vehicle)}
                        >
                          {busy ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.primaryBtnText}>Complete</Text>
                          )}
                        </Pressable>
                      ) : null
                    }
                  />
                )
              })
            ))}

          {attentionFilter === 'maintenance' &&
            (maintenanceVehicles.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                No units under maintenance.
              </Text>
            ) : (
              maintenanceVehicles.map((v) => (
                <AttentionRow
                  key={v.id}
                  vehicle={v}
                  colors={colors}
                  title={`${v.make || 'Vehicle'} — ${v.series || ''}`.trim()}
                  subtitle={`${v.plateNo || '—'} · ${v.bodyType || 'Unit'}`}
                  onPress={() => {
                    if (isAdmin) navigation.navigate('ManageVehicles')
                  }}
                  action={
                    isAdmin ? (
                      <Pressable
                        style={styles.outlineBtn}
                        onPress={() => navigation.navigate('ManageVehicles')}
                      >
                        <Text style={[styles.outlineBtnText, { color: colors.text }]}>Manage</Text>
                      </Pressable>
                    ) : null
                  }
                />
              ))
            ))}

          {attentionFilter === 'pending' && (
            <PendingApprovals
              items={pendingItems}
              isAdmin={isAdmin}
              busyId={busyId}
              onAccept={handleAccept}
              onReject={handleReject}
              onPressItem={openTransaction}
            />
          )}
        </View>
      </View>

      {/* Revenue */}
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.text }]}>Revenue</Text>
        <Text style={[styles.revCaption, { color: colors.textMuted }]}>
          {formatRangeCaption(revenueSnapshot.from, revenueSnapshot.to)}
        </Text>

        <View style={styles.filterRow}>
          {REVENUE_PRESETS.map((opt) => {
            const active = revenuePreset === opt.id
            return (
              <Pressable
                key={opt.id}
                onPress={() => setRevenuePreset(opt.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? `${ACCENT}18` : colors.inputBackground,
                    borderColor: active ? ACCENT : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? ACCENT : colors.textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.revStats}>
          <View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Rentals encoded</Text>
            <Text style={[styles.revValue, { color: colors.text }]}>{revenueSnapshot.count}</Text>
          </View>
          <View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Est. revenue</Text>
            <Text style={[styles.revValue, { color: colors.text }]}>
              {formatPeso(revenueSnapshot.revenue)}
            </Text>
          </View>
        </View>

        <RevenueAreaChart
          series={revenueSnapshot.series}
          height={168}
          color={ACCENT}
          textColor={colors.textMuted}
          gridColor={colors.border}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 14 },
  error: { color: ACCENT, marginBottom: 10, fontSize: 13 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 3, textAlign: 'center' },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  panelTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterLabel: { fontSize: 13, fontWeight: '600' },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  attnBody: { gap: 0 },
  empty: { fontSize: 14, paddingVertical: 8 },
  attnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    gap: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f4f4f5',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${ACCENT}12`,
  },
  thumbInitials: { color: ACCENT, fontWeight: '800', fontSize: 13 },
  attnMeta: { flex: 1, minWidth: 0 },
  attnTitle: { fontSize: 14, fontWeight: '700' },
  attnSub: { fontSize: 12, marginTop: 2 },
  attnTime: { fontSize: 11, marginTop: 3 },
  attnOverdue: { color: ACCENT, fontWeight: '600' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  outlineBtnDanger: { color: ACCENT, fontWeight: '700', fontSize: 12 },
  outlineBtnText: { fontWeight: '700', fontSize: 12 },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  revCaption: { fontSize: 12, marginTop: -6, marginBottom: 10 },
  revStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  revValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
})
