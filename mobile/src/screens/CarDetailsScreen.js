import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Calendar, Wrench, User, Hash } from 'lucide-react-native';

export default function CarDetailsScreen({ route }) {
  const { car } = route.params;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.carHeader}>
          <Text style={styles.carTitle}>{car.make} {car.model}</Text>
          <Text style={[
            styles.statusBadge,
            car.status === 'Available' ? styles.badgeAvailable :
            car.status === 'Rented' ? styles.badgeRented : styles.badgeMaintenance
          ]}>{car.status}</Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Hash color="#64748b" size={20} />
            </View>
            <View>
              <Text style={styles.infoLabel}>License Plate</Text>
              <Text style={styles.infoValue}>{car.plate}</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Calendar color="#64748b" size={20} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Status Details</Text>
              {car.status === 'Rented' && <Text style={styles.infoValue}>Return Date: {car.returnDate}</Text>}
              {car.status === 'Maintenance' && <Text style={styles.infoValue}>Expected Ready: {car.expectedReady}</Text>}
              {car.status === 'Available' && <Text style={styles.infoValue}>Ready for deployment</Text>}
            </View>
          </View>

          {car.renter && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <User color="#64748b" size={20} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Current Renter</Text>
                <Text style={styles.infoValue}>{car.renter}</Text>
              </View>
            </View>
          )}

          {car.issue && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Wrench color="#64748b" size={20} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Reported Issue</Text>
                <Text style={styles.infoValue}>{car.issue}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButtonPrimary}>
            <Text style={styles.actionButtonPrimaryText}>Update Status</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonSecondary}>
            <Text style={styles.actionButtonSecondaryText}>View Service History</Text>
          </TouchableOpacity>
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
  container: {
    flex: 1,
    padding: 20,
  },
  carHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  carTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
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
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButtonPrimary: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonSecondaryText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
});
