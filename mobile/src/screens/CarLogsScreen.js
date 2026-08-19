import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const mockCars = [
  { id: '1', make: 'Toyota', model: 'Wigo', bodyType: 'Hatchback', seats: 5, transmission: 'Automatic', plate: 'WGO 1001', status: 'Rented', renter: 'John Doe', returnDate: '2026-08-18', returnTime: '10:42 AM', image: require('../../assets/cars/toyotawigo.webp') },
  { id: '2', make: 'Toyota', model: 'Innova', bodyType: 'SUV', seats: 8, transmission: 'Automatic', plate: 'INN 3001', status: 'Available', mileage: '45,200 km', image: require('../../assets/cars/toyotainnova.jpg') },
  { id: '3', make: 'Nissan', model: 'Navara', bodyType: 'Pick-up', seats: 5, transmission: 'Automatic', plate: 'NAV 4002', status: 'Maintenance', issue: 'Oil Change', expectedReady: '2026-08-20', readyTime: '08:30 AM', image: require('../../assets/cars/nissannavara.jpg') },
  { id: '4', make: 'Toyota', model: 'Hiace', bodyType: 'Van', seats: 15, transmission: 'Manual', plate: 'HIA 5004', status: 'Rented', renter: 'Sarah Smith', returnDate: '2026-08-19', returnTime: '04:00 PM', image: require('../../assets/cars/toyotahiace.jpg') },
];

export default function CarLogsScreen({ navigation }) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredCars = mockCars.filter(car => {
    const matchesFilter = filter === 'All' || car.status === filter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      car.make.toLowerCase().includes(searchLower) ||
      car.model.toLowerCase().includes(searchLower) ||
      car.plate.toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'Available': return styles.badgeAvailable;
      case 'Rented': return styles.badgeRented;
      case 'Maintenance': return styles.badgeMaintenance;
      default: return {};
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Car Logs</Text>
      </View>

      <View style={[styles.searchSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Search color={theme.textSub} size={20} />
          <TextInput 
            style={[styles.searchInput, { color: theme.textMain }]} 
            placeholder="Search by make, model, or plate..." 
            placeholderTextColor={theme.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity 
          style={[styles.filterButton, showFilters && styles.filterButtonActive, { backgroundColor: showFilters ? '#3b82f6' : theme.bg, borderColor: theme.border }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter color={showFilters ? "#ffffff" : theme.textMain} size={20} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={[styles.filterTabs, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          {['All', 'Available', 'Rented', 'Maintenance'].map(status => (
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

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        <View style={styles.carsContainer}>
          {filteredCars.map((car) => (
            <TouchableOpacity 
              key={car.id} 
              style={[styles.carCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.navigate('CarDetails', { car })}
            >
              <View style={styles.carHeader}>
                <Text style={[styles.carPlate, { color: theme.textMain }]}>{car.plate}</Text>
                <Text style={[styles.carBadge, getStatusBadgeStyle(car.status)]}>
                  {car.status}
                </Text>
              </View>
              
              <Text style={[styles.carName, { color: theme.textMain }]}>{car.make} {car.model}</Text>
              <Text style={[styles.carSpecs, { color: theme.textSub }]}>{car.bodyType} • {car.transmission} • {car.seats} Seats</Text>
              
              {car.status === 'Rented' && (
                <View style={[styles.carContext, { backgroundColor: theme.bg }]}>
                  <Text style={[styles.contextText, { color: theme.textMain }]}><Text style={styles.contextLabel}>Renter:</Text> {car.renter}</Text>
                  <Text style={[styles.contextText, { color: theme.textMain }]}><Text style={styles.contextLabel}>Return:</Text> {car.returnDate} at {car.returnTime}</Text>
                </View>
              )}
              
              {car.status === 'Maintenance' && (
                <View style={[styles.carContext, { backgroundColor: '#fef2f2' }]}>
                  <Text style={[styles.contextText, { color: '#b91c1c' }]}><Text style={[styles.contextLabel, { color: '#b91c1c' }]}>Issue:</Text> {car.issue}</Text>
                  <Text style={[styles.contextText, { color: '#b91c1c' }]}><Text style={[styles.contextLabel, { color: '#b91c1c' }]}>Ready:</Text> {car.expectedReady} at {car.readyTime}</Text>
                </View>
              )}

              <View style={[styles.viewDetailsRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.viewDetailsText, { color: theme.textSub }]}>View Full Log</Text>
                <ChevronRight color={theme.textSub} size={16} />
              </View>
            </TouchableOpacity>
          ))}
          {filteredCars.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.textSub }]}>No vehicles match your search.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  searchSection: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#0f172a',
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#ffffff',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
  },
  carsContainer: {
    gap: 16,
  },
  carCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  carHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  carPlate: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  carBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  badgeAvailable: {
    backgroundColor: '#d1fae5',
    color: '#059669',
  },
  badgeRented: {
    backgroundColor: '#dbeafe',
    color: '#2563eb',
  },
  badgeMaintenance: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  carName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  carSpecs: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  carContext: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 4,
  },
  contextText: {
    fontSize: 14,
    color: '#334155',
  },
  contextLabel: {
    fontWeight: '600',
    color: '#475569',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 40,
    fontSize: 15,
  }
});
