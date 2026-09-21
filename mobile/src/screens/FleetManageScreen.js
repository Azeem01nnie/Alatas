import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native'
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout'
import { useTheme } from '../context/ThemeContext'
import { useFleet } from '../context/FleetContext'
import { ACCENT } from '../theme/colors'
import { Plus, Search } from 'lucide-react-native'

const FILTERS = ['All', 'Available', 'Rented', 'Maintenance', 'Scheduled']

export default function FleetManageScreen({ navigation }) {
  const { theme } = useTheme()
  const { vehicles, loading, loadAll, removeVehicle, error } = useFleet()
  const pad = useTabBarContentPadding()
  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (vehicles || []).filter((car) => {
      const matchesFilter = filter === 'All' || car.status === filter
      const hay = `${car.make} ${car.model || car.series} ${car.plate || car.plateNo}`.toLowerCase()
      return matchesFilter && (!needle || hay.includes(needle))
    })
  }, [vehicles, filter, q])

  const onDelete = (car) => {
    Alert.alert('Delete vehicle?', `${car.make} ${car.plate || car.plateNo}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeVehicle(car.id)
          } catch (err) {
            Alert.alert('Delete failed', err?.message || String(err))
          }
        },
      },
    ])
  }

  return (
    <ScreenLayout
      scroll={false}
      header={
        <>
          <ScreenHeader
            title="Manage Vehicle"
            subtitle="Fleet CRUD on Supabase"
            right={
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: ACCENT }]}
                onPress={() => navigation.navigate('VehicleForm', { mode: 'add' })}
              >
                <Plus color="#fff" size={20} />
              </TouchableOpacity>
            }
          />
          <View style={[styles.searchSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={[styles.searchBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Search color={theme.textSub} size={18} />
              <TextInput
                style={[styles.searchInput, { color: theme.textMain }]}
                placeholder="Search fleet…"
                placeholderTextColor={theme.textSub}
                value={q}
                onChangeText={setQ}
              />
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: theme.card }}
            contentContainerStyle={styles.filters}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.chip,
                  {
                    backgroundColor: filter === f ? ACCENT : theme.bg,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={{ color: filter === f ? '#fff' : theme.textSub, fontWeight: '600', fontSize: 12 }}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      }
    >
      {error ? <Text style={{ color: '#dc2626', padding: 16 }}>{error}</Text> : null}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: pad }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={ACCENT} />}
      >
        {rows.map((car) => (
          <View
            key={car.id}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <TouchableOpacity onPress={() => navigation.navigate('CarDetails', { car })}>
              <Text style={[styles.plate, { color: theme.textMain }]}>
                {car.plate || car.plateNo}
              </Text>
              <Text style={{ color: theme.textSub }}>
                {car.make} {car.model || car.series} · {car.status}
              </Text>
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => navigation.navigate('VehicleForm', { mode: 'edit', car })}
              >
                <Text style={{ color: ACCENT, fontWeight: '700' }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(car)}>
                <Text style={{ color: '#dc2626', fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {rows.length === 0 ? (
          <Text style={{ color: theme.textSub, textAlign: 'center', marginTop: 32 }}>
            No vehicles match.
          </Text>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
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
  filters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  plate: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
})
