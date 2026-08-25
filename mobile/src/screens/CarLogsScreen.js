import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout';
import { Search, Filter, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import { ACCENT } from '../theme/colors';

export default function CarLogsScreen({ navigation }) {
  const { theme } = useTheme();
  const { vehicles, loading, error, online, loadAll } = useFleet();
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const scrollBottomPad = useTabBarContentPadding();

  const filteredCars = vehicles.filter((car) => {
    const matchesFilter = filter === 'All' || car.status === filter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      car.make.toLowerCase().includes(searchLower) ||
      car.model.toLowerCase().includes(searchLower) ||
      car.plate.toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Available': return styles.badgeAvailable;
      case 'Rented': return styles.badgeRented;
      case 'Maintenance': return styles.badgeMaintenance;
      default: return {};
    }
  };

  return (
    <ScreenLayout
      scroll={false}
      header={
        <>
          <ScreenHeader
            title="Car Logs"
            subtitle={!online ? 'Offline — showing last loaded data' : undefined}
          />
          <View style={[styles.searchSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Search color={theme.textSub} size={18} />
          <TextInput
            style={[styles.searchInput, { color: theme.textMain }]}
            placeholder="Search by make, model, or plate..."
            placeholderTextColor={theme.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterButton, showFilters && styles.filterButtonActive, { backgroundColor: showFilters ? ACCENT : theme.bg, borderColor: theme.border }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter color={showFilters ? '#ffffff' : theme.textMain} size={18} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={[styles.filterTabs, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          {['All', 'Available', 'Rented', 'Maintenance'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.tab, filter === status && styles.activeTab, filter !== status && { backgroundColor: theme.bg }]}
              onPress={() => setFilter(status)}
            >
              <Text style={[styles.tabText, filter === status && styles.activeTabText, filter !== status && { color: theme.textSub }]}>{status}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
        </>
      }
    >
      {error ? (
        <Text style={[styles.errorText, { color: '#dc2626' }]}>{error}</Text>
      ) : null}

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: scrollBottomPad }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={ACCENT} />}
      >
        {loading && vehicles.length === 0 ? (
          <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.carsContainer}>
            {filteredCars.map((car) => (
              <TouchableOpacity
                key={car.id}
                style={[styles.carCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => navigation.navigate('CarDetails', { car })}
              >
                <View style={styles.carHeader}>
                  <Text style={[styles.carPlate, { color: theme.textMain }]}>{car.plate}</Text>
                  <Text style={[styles.carBadge, getStatusBadgeStyle(car.status)]}>{car.status}</Text>
                </View>

                <Text style={[styles.carName, { color: theme.textMain }]}>{car.make} {car.model}</Text>
                <Text style={[styles.carSpecs, { color: theme.textSub }]}>{car.bodyType} • {car.transmission} • {car.seats} Seats</Text>

                {car.ownerName ? (
                  <View style={[styles.carContext, { backgroundColor: theme.bg }]}>
                    <Text style={[styles.contextText, { color: theme.textMain }]} numberOfLines={1}>
                      <Text style={styles.contextLabel}>Owner:</Text> {car.ownerName}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.viewDetailsRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.viewDetailsText, { color: theme.textSub }]}>View Full Log</Text>
                  <ChevronRight color={theme.textSub} size={14} />
                </View>
              </TouchableOpacity>
            ))}
            {filteredCars.length === 0 && !loading ? (
              <Text style={[styles.emptyText, { color: theme.textSub }]}>No vehicles match your search.</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  searchSection: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14 },
  filterButton: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  filterButtonActive: { backgroundColor: ACCENT },
  filterTabs: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  activeTab: { backgroundColor: ACCENT },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#ffffff' },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 14 },
  carsContainer: { gap: 8 },
  carCard: { padding: 12, borderRadius: 12, borderWidth: 1 },
  carHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  carPlate: { fontSize: 15, fontWeight: '700' },
  carBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  badgeAvailable: { backgroundColor: '#d1fae5', color: '#059669' },
  badgeRented: { backgroundColor: '#ffedd5', color: '#c2410c' },
  badgeMaintenance: { backgroundColor: '#fee2e2', color: '#dc2626' },
  carName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  carSpecs: { fontSize: 12, marginBottom: 8 },
  carContext: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
  contextText: { fontSize: 12 },
  contextLabel: { fontWeight: '600' },
  viewDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 8 },
  viewDetailsText: { fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  errorText: { paddingHorizontal: 14, paddingTop: 10, fontSize: 13 },
});
