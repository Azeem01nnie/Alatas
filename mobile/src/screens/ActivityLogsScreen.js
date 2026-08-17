import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';

const mockLogs = [
  { id: '101', time: '10:42 AM', type: 'submission', text: 'John D. submitted pre-rental checklist for Plate XYZ-123', status: 'Pending' },
  { id: '102', time: '09:15 AM', type: 'image', text: 'Sarah uploaded 4 images for returned car ABC-987', status: 'Approved' },
  { id: '103', time: '08:30 AM', type: 'status', text: 'Vehicle DEF-456 changed to Maintenance', status: 'Alert' },
  { id: '104', time: 'Yesterday', type: 'submission', text: 'Mike R. submitted post-rental checklist for Plate LMN-555', status: 'Approved' },
];

export default function ActivityLogsScreen() {
  const renderLogs = () => (
    <View style={styles.logsContainer}>
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
        <Text style={styles.headerTitle}>Activity Logs</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {renderLogs()}
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
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 40,
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
