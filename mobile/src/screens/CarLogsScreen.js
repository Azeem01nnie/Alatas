import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Search, Filter, ChevronRight } from 'lucide-react-native';

const mockCars = [
  { id: '1', make: 'Toyota', model: 'Camry', plate: 'ABC-123', status: 'Rented', renter: 'John Doe', returnDate: '2026-08-18' },
  { id: '2', make: 'Honda', model: 'Civic', plate: 'XYZ-987', status: 'Available', mileage: '45,200 km' },
  { id: '3', make: 'Ford', model: 'Mustang', plate: 'DEF-456', status: 'Maintenance', issue: 'Oil Change', expectedReady: '2026-08-20' },
  { id: '4', make: 'Nissan', model: 'Altima', plate: 'LMN-555', status: 'Rented', renter: 'Sarah Smith', returnDate: '2026-08-19' },
];

export default function CarLogsScreen({ navigation }) {
  const [filter, setFilter] = useState('All');

  const filteredCars = filter === 'All' ? mockCars : mockCars.filter(car => car.status === filter);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Car Logs</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search color="#94a3b8" size={20} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search by make, model, or plate..." 
            placeholderTextColor="#94a3b8"
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter color="#3b82f6" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterTabs}>
        {['All', 'Available', 'Rented', 'Maintenance'].map(status => (
          <TouchableOpacity 
            key={status} 
            style={[styles.tab, filter === status && styles.activeTab]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.tabText, filter === status && styles.activeTabText]}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollInner}>
        {filteredCars.map(car => (
          <TouchableOpacity 
            key={car.id} 
            style={styles.carCard}
            onPress={() => navigation.navigate('CarDetails', { car })}
          >
            <View style={styles.carHeader}>
              <Text style={styles.carTitle}>{car.make} {car.model}</Text>
              <Text style={[
                styles.statusBadge,
                car.status === 'Available' ? styles.badgeAvailable :
                car.status === 'Rented' ? styles.badgeRented : styles.badgeMaintenance
              ]}>{car.status}</Text>
            </View>
            <View style={styles.carDetailsRow}>
              <Text style={styles.carPlate}>{car.plate}</Text>
              {car.status === 'Rented' && <Text style={styles.carExtraInfo}>Return: {car.returnDate}</Text>}
              {car.status === 'Maintenance' && <Text style={styles.carExtraInfo}>Ready: {car.expectedReady}</Text>}
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>View details</Text>
              <ChevronRight color="#94a3b8" size={16} />
            </View>
          </TouchableOpacity>
        ))}
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
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  searchSection: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    color: '#0f172a',
  },
  filterButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
  },
  container: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  carCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  carHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  carTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeAvailable: {
    backgroundColor: '#d1fae5',
    color: '#059669',
  },
  badgeRented: {
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
  },
  badgeMaintenance: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  carDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  carPlate: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  carExtraInfo: {
    fontSize: 13,
    color: '#64748b',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
});
