import { useCallback, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'
import { customerName, formatDateTime } from '../utils/dashboardHelpers'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function localDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function overlapsDay(rental, day) {
  const from = parseDate(rental.rental?.periodFrom)
  const to = parseDate(rental.rental?.periodTo) || from
  if (!from) return false
  const dayStart = startOfDay(day).getTime()
  const dayEnd = dayStart + 86400000 - 1
  const fromT = from.getTime()
  const toT = (to || from).getTime()
  return fromT <= dayEnd && toT >= dayStart
}

function isCalendarBooking(rental) {
  const life = rental?.rentalLifecycle || 'completed'
  if (life === 'cancelled' || life === 'rejected' || life === 'pending_approval') return false
  if (rental?.approvalStatus === 'rejected' || rental?.approvalStatus === 'pending') return false
  return life === 'scheduled' || life === 'active' || life === 'completed'
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

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

export default function CalendarScreen({ navigation }) {
  const { rentals, vehicles, reloadData } = useFleet()
  const { colors } = useTheme()

  const today = useMemo(() => startOfDay(new Date()), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(() => today)
  const [refreshing, setRefreshing] = useState(false)
  const [showCompleted, setShowCompleted] = useState(true)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const cells = useMemo(() => buildMonthCells(year, month), [year, month])
  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  const visibleRentals = useMemo(() => {
    return (rentals || []).filter((r) => {
      if (!isCalendarBooking(r)) return false
      const life = r.rentalLifecycle || 'completed'
      if (!showCompleted && life !== 'scheduled' && life !== 'active') return false
      return true
    })
  }, [rentals, showCompleted])

  const dayMeta = useMemo(() => {
    const map = new Map()
    for (const day of cells) {
      if (!day) continue
      const key = localDateKey(day)
      const dayRentals = visibleRentals.filter((r) => overlapsDay(r, day))
      const hasActive = dayRentals.some((r) => r.rentalLifecycle === 'active')
      const hasScheduled = dayRentals.some((r) => r.rentalLifecycle === 'scheduled')
      const hasCompleted = dayRentals.some((r) => r.rentalLifecycle === 'completed')
      map.set(key, {
        count: dayRentals.length,
        hasActive,
        hasScheduled,
        hasCompleted,
        rentals: dayRentals,
      })
    }
    return map
  }, [cells, visibleRentals])

  const selectedKey = selectedDay ? localDateKey(startOfDay(selectedDay)) : null

  const onRentList = useMemo(() => {
    const active = (rentals || []).filter((r) => r.rentalLifecycle === 'active')
    const byKey = new Map()
    for (const r of active) {
      const vehicle = resolveVehicle(r, vehicles)
      const vid = String(r.vehicleId || vehicle?.id || r.vehicle?.id || '')
      const plate = String(vehicle?.plateNo || r.vehicle?.plateNo || '')
        .trim()
        .toUpperCase()
      const key = vid || (plate ? `plate:${plate}` : r.id)
      const prev = byKey.get(key)
      if (!prev) {
        byKey.set(key, { rental: r, vehicle })
        continue
      }
      const prevTo = new Date(prev.rental.rental?.periodTo || 0).getTime() || Infinity
      const nextTo = new Date(r.rental?.periodTo || 0).getTime() || Infinity
      if (nextTo < prevTo) byKey.set(key, { rental: r, vehicle })
    }
    return [...byKey.values()].sort((a, b) => {
      const ta = new Date(a.rental.rental?.periodTo || 0).getTime()
      const tb = new Date(b.rental.rental?.periodTo || 0).getTime()
      return ta - tb
    })
  }, [rentals, vehicles])

  const completedList = useMemo(() => {
    return (rentals || [])
      .filter((r) => {
        if (r.rentalLifecycle !== 'completed') return false
        if (r.approvalStatus === 'rejected' || r.approvalStatus === 'pending') return false
        // Prefer rentals that overlap the visible month (start, end, or completed)
        const from = parseDate(r.rental?.periodFrom)
        const to = parseDate(r.rental?.periodTo) || parseDate(r.completedAt) || from
        if (!from && !to) return false
        const monthStart = new Date(year, month, 1).getTime()
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime()
        const fromT = (from || to).getTime()
        const toT = (to || from).getTime()
        return fromT <= monthEnd && toT >= monthStart
      })
      .map((r) => ({
        rental: r,
        vehicle: resolveVehicle(r, vehicles),
      }))
      .sort((a, b) => {
        const ta = new Date(
          a.rental.completedAt || a.rental.rental?.periodTo || a.rental.encodedAt || 0,
        ).getTime()
        const tb = new Date(
          b.rental.completedAt || b.rental.rental?.periodTo || b.rental.encodedAt || 0,
        ).getTime()
        return tb - ta
      })
  }, [rentals, vehicles, year, month])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await reloadData()
    } finally {
      setRefreshing(false)
    }
  }, [reloadData])

  const shiftMonth = (delta) => {
    setCursor(new Date(year, month + delta, 1))
  }

  const openTransaction = (rental) => {
    navigation.navigate('Transaction', { rentalId: rental.id })
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
      }
    >
      {/* Month calendar */}
      <View style={[styles.calCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.monthBar}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Text style={[styles.navBtnText, { color: ACCENT }]}>‹</Text>
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
          <Pressable
            onPress={() => shiftMonth(1)}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Text style={[styles.navBtnText, { color: ACCENT }]}>›</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setShowCompleted((v) => !v)}
          style={styles.toggleRow}
        >
          <View
            style={[
              styles.toggleDot,
              {
                backgroundColor: showCompleted ? ACCENT : colors.border,
              },
            ]}
          />
          <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
            Include completed rentals
          </Text>
        </Pressable>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={[styles.weekday, { color: colors.textMuted }]}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, index) => {
            if (!day) {
              return <View key={`e-${index}`} style={styles.cell} />
            }
            const key = localDateKey(day)
            const meta = dayMeta.get(key)
            const isToday = localDateKey(today) === key
            const isSelected = selectedKey === key
            const hasDots = Boolean(meta?.count)

            return (
              <Pressable
                key={key}
                onPress={() => setSelectedDay(day)}
                style={[
                  styles.cell,
                  isSelected && { backgroundColor: `${ACCENT}14`, borderRadius: 10 },
                ]}
              >
                <View
                  style={[
                    styles.dayNumWrap,
                    isToday && styles.todayRing,
                    isSelected && { backgroundColor: ACCENT },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      { color: isSelected ? '#fff' : colors.text },
                      isToday && !isSelected && { color: ACCENT, fontWeight: '800' },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </View>
                {hasDots ? (
                  <View style={styles.dots}>
                    {meta.hasActive ? <View style={[styles.dot, { backgroundColor: ACCENT }]} /> : null}
                    {meta.hasScheduled ? (
                      <View style={[styles.dot, { backgroundColor: '#2563eb' }]} />
                    ) : null}
                    {meta.hasCompleted ? (
                      <View style={[styles.dot, { backgroundColor: '#71717a' }]} />
                    ) : null}
                    {!meta.hasActive && !meta.hasScheduled && !meta.hasCompleted && meta.count > 0 ? (
                      <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.dotsPlaceholder} />
                )}
              </Pressable>
            )
          })}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: ACCENT }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>On rent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#2563eb' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Scheduled</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#71717a' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Completed</Text>
          </View>
        </View>
      </View>

      {/* Selected day label */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {selectedDay
          ? selectedDay.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          : 'Day'}
      </Text>

      {/* Vehicles on rent */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 4 }]}>
        Vehicles on rent
        {onRentList.length > 0 ? ` (${onRentList.length})` : ''}
      </Text>
      {onRentList.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>No vehicles currently on rent.</Text>
      ) : (
        onRentList.map(({ rental, vehicle }) => (
          <Pressable
            key={rental.id}
            onPress={() => openTransaction(rental)}
            style={({ pressed }) => [
              styles.onRentCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.thumb}>
              {vehicle?.image ? (
                <Image source={{ uri: vehicle.image }} style={styles.thumbImage} />
              ) : (
                <View style={[styles.thumbFallback, { backgroundColor: `${ACCENT}12` }]}>
                  <Text style={{ color: ACCENT, fontWeight: '800' }}>
                    {`${(vehicle?.make || '?').slice(0, 1)}${(vehicle?.series || '').slice(0, 1)}`.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.onRentMeta}>
              <Text style={[styles.plate, { color: colors.text }]} numberOfLines={1}>
                {vehicle?.plateNo || rental.vehicle?.plateNo || '—'}
              </Text>
              <Text style={[styles.vehicleName, { color: colors.text }]} numberOfLines={1}>
                {[vehicle?.make, vehicle?.series].filter(Boolean).join(' ') || 'Vehicle'}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {customerName(rental)} · until {formatDateTime(rental.rental?.periodTo)}
              </Text>
            </View>
            <View style={styles.onRentPill}>
              <Text style={styles.onRentPillText}>On rent</Text>
            </View>
          </Pressable>
        ))
      )}

      {/* Completed rentals this month */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 18 }]}>
        Completed rentals
        {completedList.length > 0 ? ` (${completedList.length})` : ''}
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        Completed in {monthLabel}
      </Text>
      {completedList.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          No completed rentals this month.
        </Text>
      ) : (
        completedList.map(({ rental, vehicle }) => (
          <Pressable
            key={rental.id}
            onPress={() => openTransaction(rental)}
            style={({ pressed }) => [
              styles.onRentCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.thumb}>
              {vehicle?.image ? (
                <Image source={{ uri: vehicle.image }} style={styles.thumbImage} />
              ) : (
                <View style={[styles.thumbFallback, { backgroundColor: '#71717a18' }]}>
                  <Text style={{ color: '#71717a', fontWeight: '800' }}>
                    {`${(vehicle?.make || '?').slice(0, 1)}${(vehicle?.series || '').slice(0, 1)}`.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.onRentMeta}>
              <Text style={[styles.plate, { color: colors.text }]} numberOfLines={1}>
                {vehicle?.plateNo || rental.vehicle?.plateNo || '—'}
              </Text>
              <Text style={[styles.vehicleName, { color: colors.text }]} numberOfLines={1}>
                {[vehicle?.make, vehicle?.series].filter(Boolean).join(' ') || 'Vehicle'}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {customerName(rental)} ·{' '}
                {formatDateTime(rental.completedAt || rental.rental?.periodTo)}
              </Text>
            </View>
            <View style={styles.completedPill}>
              <Text style={styles.completedPillText}>Completed</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  calCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: { paddingHorizontal: 10, paddingVertical: 2 },
  navBtnText: { fontSize: 28, fontWeight: '300', lineHeight: 32 },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 4,
  },
  toggleDot: { width: 10, height: 10, borderRadius: 5 },
  toggleText: { fontSize: 12, fontWeight: '500' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.2857%',
    aspectRatio: 0.95,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayNumWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayRing: {
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  dayNum: { fontSize: 14, fontWeight: '600' },
  dots: {
    flexDirection: 'row',
    gap: 3,
    height: 8,
    marginTop: 2,
    alignItems: 'center',
  },
  dotsPlaceholder: { height: 8, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  empty: { fontSize: 14, marginBottom: 12 },
  plate: { fontSize: 15, fontWeight: '700' },
  vehicleName: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 3 },
  onRentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f4f4f5',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onRentMeta: { flex: 1, minWidth: 0 },
  onRentPill: {
    backgroundColor: `${ACCENT}14`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  onRentPillText: { color: ACCENT, fontSize: 11, fontWeight: '700' },
  completedPill: {
    backgroundColor: '#71717a18',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedPillText: { color: '#52525b', fontSize: 11, fontWeight: '700' },
  sectionHint: { fontSize: 12, marginTop: -6, marginBottom: 10 },
})
