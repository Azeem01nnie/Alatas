import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
} from 'react-native'
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout'
import { useTheme } from '../context/ThemeContext'
import { useFleet } from '../context/FleetContext'
import { ACCENT } from '../theme/colors'
import { buildActivityLogs } from '../utils/vehicleMapper'
import { Search } from 'lucide-react-native'

export default function HistoryScreen({ navigation }) {
  const { theme } = useTheme()
  const { rentals, pendingRentals, loading, loadAll } = useFleet()
  const pad = useTabBarContentPadding()
  const [q, setQ] = useState('')

  const logs = useMemo(() => {
    const rows = buildActivityLogs(rentals, pendingRentals)
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      `${row.vehicle || ''} ${row.text || ''} ${row.status || ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [rentals, pendingRentals, q])

  return (
    <ScreenLayout
      scroll={false}
      header={
        <>
          <ScreenHeader title="Rental History" subtitle="All bookings and field submissions" />
          <View style={[styles.searchWrap, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={[styles.searchBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Search color={theme.textSub} size={18} />
              <TextInput
                style={[styles.searchInput, { color: theme.textMain }]}
                placeholder="Search plate, customer, status…"
                placeholderTextColor={theme.textSub}
                value={q}
                onChangeText={setQ}
              />
            </View>
          </View>
        </>
      }
    >
      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: pad }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={ACCENT} />}
        ListEmptyComponent={
          <Text style={{ color: theme.textSub, textAlign: 'center', marginTop: 40 }}>
            No rentals yet.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() =>
              navigation.navigate('RentalDetail', {
                rentalId: item.rental?.id || item.id,
              })
            }
          >
            <View style={styles.row}>
              <Text style={[styles.plate, { color: theme.textMain }]}>{item.vehicle || '—'}</Text>
              <Text style={[styles.badge, { color: ACCENT }]}>{item.status}</Text>
            </View>
            <Text style={{ color: theme.textSub }} numberOfLines={2}>
              {item.text}
            </Text>
          </TouchableOpacity>
        )}
      />
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  plate: { fontWeight: '700', fontSize: 16 },
  badge: { fontWeight: '700', fontSize: 12 },
})
