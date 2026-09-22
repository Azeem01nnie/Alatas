import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import { useFleet } from '../context/FleetContext'
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

function isPendingRental(r) {
  return r.approvalStatus === 'pending' || r.rentalLifecycle === 'pending_approval'
}

function lifecycleLabel(r) {
  if (r.approvalStatus === 'rejected' || r.rentalLifecycle === 'cancelled') {
    return 'Rejected'
  }
  switch (r.rentalLifecycle) {
    case 'completed':
      return 'Completed'
    case 'active':
      return 'Active'
    case 'scheduled':
      return 'Scheduled'
    default:
      return r.approvalStatus || '—'
  }
}

function sortKey(r) {
  const stamp =
    r.completedAt ||
    r.rental?.periodTo ||
    r.rental?.periodFrom ||
    r.updatedAt ||
    r.createdAt ||
    ''
  return new Date(stamp).getTime() || 0
}

export default function HistoryScreen({ navigation }) {
  const { rentals, reloadData } = useFleet()
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const rows = useMemo(() => {
    const base = (rentals || []).filter((r) => !isPendingRental(r))
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? base.filter((r) => {
          const name = customerName(r).toLowerCase()
          const plate = plateFor(r).toLowerCase()
          return name.includes(needle) || plate.includes(needle)
        })
      : base
    return [...filtered].sort((a, b) => sortKey(b) - sortKey(a))
  }, [rentals, query])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await reloadData()
    } finally {
      setRefreshing(false)
    }
  }, [reloadData])

  const renderItem = ({ item }) => {
    const from = item.rental?.periodFrom
    let period = '—'
    if (from) {
      const d = new Date(from)
      if (!Number.isNaN(d.getTime())) {
        period = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      }
    }
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Transaction', { rentalId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.row}>
          <Text style={styles.plate}>{plateFor(item)}</Text>
          <Text style={styles.badge}>{lifecycleLabel(item)}</Text>
        </View>
        <Text style={styles.customer}>{customerName(item)}</Text>
        <Text style={styles.meta}>{period}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Completed and past rentals</Text>
        <TextInput
          style={styles.search}
          placeholder="Search customer or plate…"
          placeholderTextColor="#71717a"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No matching rentals.</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#18181b',
  },
  subtitle: {
    fontSize: 13,
    color: '#52525b',
    marginTop: 2,
    marginBottom: 12,
  },
  search: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#18181b',
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    padding: 14,
    marginBottom: 10,
  },
  row: {
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
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT,
  },
  customer: {
    fontSize: 15,
    color: '#18181b',
  },
  meta: {
    fontSize: 13,
    color: '#52525b',
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: '#71717a',
    marginTop: 40,
    fontSize: 14,
  },
})
