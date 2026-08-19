import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const mockMetrics = [
  { id: '1', title: 'Total Cars Rented', value: '24', color: '#3b82f6' },
  { id: '2', title: 'Pending Checks', value: '7', color: '#f59e0b' },
  { id: '3', title: 'Damaged Units', value: '2', color: '#ef4444' },
  { id: '4', title: 'Active Employees', value: '12', color: '#10b981' },
];

const mockLogs = [
  { id: '101', time: '10:42 AM', type: 'submission', text: 'John D. submitted pre-rental checklist for Plate XYZ-123', status: 'Pending' },
  { id: '102', time: '09:15 AM', type: 'image', text: 'Sarah uploaded 4 images for returned car ABC-987', status: 'Approved' },
  { id: '103', time: '08:30 AM', type: 'status', text: 'Vehicle DEF-456 changed to Maintenance', status: 'Alert' },
  { id: '104', time: 'Yesterday', type: 'submission', text: 'Mike R. submitted post-rental checklist for Plate LMN-555', status: 'Approved' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const renderLogs = () => (
    <View style={styles.logsContainer}>
      <Text style={styles.sectionTitle}>Activity Logs</Text>
      {mockLogs.map((log) => (
        <View key={log.id} style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.logTime}>{log.time}</Text>
            <Text style={[
              styles.logBadge, 
              log.status === 'Pending' ? styles.badgePending : 
              log.status === 'Alert' ? styles.badgeAlert : styles.badgeApproved
            ]}>{log.status}</Text>
          </View>
          <Text style={styles.logText}>{log.text}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Image source={require('../assets/logonobg.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.headerTitle}>Admin Panel</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]} 
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'logs' && styles.activeTab]} 
          onPress={() => setActiveTab('logs')}
        >
          <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>Activity Logs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {activeTab === 'dashboard' ? (
          <>
            <Text style={styles.sectionTitle}>Overview</Text>
            {renderMetrics()}
            {renderControls()}
          </>
        ) : (
          renderLogs()
        )}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#3b82f6',
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
  logsContainer: {
    marginTop: 8,
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  logBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
  },
  badgeApproved: {
    backgroundColor: '#d1fae5',
    color: '#059669',
  },
  badgeAlert: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  logText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
});
