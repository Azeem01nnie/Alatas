import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native'
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout'
import { useTheme } from '../context/ThemeContext'
import { useFleet } from '../context/FleetContext'
import { ACCENT } from '../theme/colors'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function rentalTouchesDay(rental, day) {
  const from = rental?.rental?.periodFrom || rental?.startedAt || rental?.createdAt
  const to = rental?.rental?.periodTo || rental?.completedAt || from
  if (!from) return false
  const start = new Date(from)
  const end = new Date(to || from)
  if (Number.isNaN(start.getTime())) return false
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const dayEnd = dayStart + 86400000 - 1
  const s = start.getTime()
  const e = Number.isNaN(end.getTime()) ? s : end.getTime()
  return s <= dayEnd && e >= dayStart
}

export default function CalendarScreen({ navigation }) {
  const { theme } = useTheme()
  const { rentals, pendingRentals, loading, loadAll } = useFleet()
  const pad = useTabBarContentPadding()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())

  const openRentals = useMemo(() => {
    const pendingIds = new Set((pendingRentals || []).map((r) => String(r.id)))
    return [...(pendingRentals || []), ...(rentals || []).filter((r) => !pendingIds.has(String(r.id)))]
      .filter((r) => r.approvalStatus !== 'rejected' && r.rentalLifecycle !== 'cancelled')
  }, [rentals, pendingRentals])

  const dayRentals = useMemo(
    () => openRentals.filter((r) => rentalTouchesDay(r, selected)),
    [openRentals, selected],
  )

  const cells = useMemo(() => {
    const first = startOfMonth(cursor)
    const total = daysInMonth(cursor)
    const offset = first.getDay()
    const list = []
    for (let i = 0; i < offset; i += 1) list.push(null)
    for (let d = 1; d <= total; d += 1) {
      list.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    }
    return list
  }, [cursor])

  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  return (
    <ScreenLayout
      scroll={false}
      header={
        <ScreenHeader title="Calendar" subtitle="Scheduled and active rentals" />
      }
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: pad }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={ACCENT} />}
      >
        <View style={[styles.monthBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            onPress={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
            style={styles.navBtn}
          >
            <ChevronLeft color={theme.textMain} size={22} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: theme.textMain }]}>{monthLabel}</Text>
          <TouchableOpacity
            onPress={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
            style={styles.navBtn}
          >
            <ChevronRight color={theme.textMain} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={`wd-${i}`} style={[styles.weekDay, { color: theme.textSub }]}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (!day) return <View key={`e-${idx}`} style={styles.cell} />
            const has = openRentals.some((r) => rentalTouchesDay(r, day))
            const isSel = sameDay(day, selected)
            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.cell,
                  isSel && { backgroundColor: ACCENT },
                  has && !isSel && { borderColor: ACCENT, borderWidth: 1 },
                ]}
                onPress={() => setSelected(day)}
              >
                <Text
                  style={[
                    styles.cellText,
                    { color: isSel ? '#fff' : theme.textMain },
                  ]}
                >
                  {day.getDate()}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
          {selected.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Text>

        {dayRentals.length === 0 ? (
          <Text style={{ color: theme.textSub }}>No rentals on this day.</Text>
        ) : (
          dayRentals.map((r) => {
            const name =
              [r.personal?.firstName, r.personal?.lastName].filter(Boolean).join(' ') ||
              r.personal?.fullName ||
              'Customer'
            const plate = r.vehicle?.plateNo || r.vehicleId || '—'
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => navigation.navigate('RentalDetail', { rentalId: r.id })}
              >
                <Text style={[styles.cardTitle, { color: theme.textMain }]}>{plate}</Text>
                <Text style={{ color: theme.textSub }}>{name}</Text>
                <Text style={{ color: theme.textSub, marginTop: 4 }}>
                  {r.rentalLifecycle || r.approvalStatus || '—'}
                </Text>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cellText: { fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
})
