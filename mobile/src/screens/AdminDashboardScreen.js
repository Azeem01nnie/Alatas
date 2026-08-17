import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView } from 'react-native';

const mockMetrics = [
  { id: '1', title: 'Total Cars Rented', value: '24', color: '#3b82f6' },
  { id: '2', title: 'Pending Checks', value: '7', color: '#f59e0b' },
  { id: '3', title: 'Damaged Units', value: '2', color: '#ef4444' },
  { id: '4', title: 'Active Employees', value: '12', color: '#10b981' },
];

export default function AdminDashboardScreen() {
  const renderMetrics = () => (
    <View style={styles.metricsContainer}>
      {mockMetrics.map((item) => (
        <View key={item.id} style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: item.color }]}>{item.value}</Text>
          <Text style={styles.metricTitle}>{item.title}</Text>
        </View>
      ))}
    </View>
  );

  const renderControls = () => (
    <View style={styles.controlsContainer}>
      <Text style={styles.sectionTitle}>Management Controls</Text>
      <View style={styles.controlsGrid}>
        <TouchableOpacity style={[styles.controlBtn, styles.btnApprove]}>
          <Text style={styles.controlBtnText}>Approve Rentals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.btnOverride]}>
          <Text style={styles.controlBtnText}>Override Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.btnLock]}>
          <Text style={styles.controlBtnText}>Lock Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Image source={require('../../assets/logonobg.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        <Text style={styles.sectionTitle}>Overview</Text>
        {renderMetrics()}
        {renderControls()}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    marginTop: 8,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  controlsContainer: {
    marginBottom: 24,
  },
  controlsGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  controlBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  btnApprove: {
    backgroundColor: '#10b981',
  },
  btnOverride: {
    backgroundColor: '#f59e0b',
  },
  btnLock: {
    backgroundColor: '#ef4444',
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
