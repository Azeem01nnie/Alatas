import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, Alert, Animated, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const mockLogs = [
  { 
    id: '101', 
    time: '10:42 AM', 
    employee: 'John Doe',
    vehicle: 'WGO 1001',
    text: 'Uploaded 4 images for pre-rental checklist', 
    status: 'Waiting for Approval',
    image: require('../../assets/cars/toyotawigo.webp')
  },
  { 
    id: '102', 
    time: '09:15 AM', 
    employee: 'Sarah Smith',
    vehicle: 'INN 3001',
    text: 'Uploaded 2 images for returned car condition', 
    status: 'Approved',
    image: require('../../assets/cars/toyotainnova.jpg')
  },
  { 
    id: '103', 
    time: '08:30 AM', 
    employee: 'Mike Ross',
    vehicle: 'NAV 4002',
    text: 'Uploaded images for scratch damage report', 
    status: 'Declined',
    image: require('../../assets/cars/nissannavara.jpg')
  },
  { 
    id: '104', 
    time: 'Yesterday', 
    employee: 'Jane Smith',
    vehicle: 'HIA 5004',
    text: 'Uploaded exterior photos for regular check', 
    status: 'Waiting for Approval',
    image: require('../../assets/cars/toyotahiace.jpg')
  },
];

export default function ActivityLogsScreen() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState(mockLogs);
  const [filter, setFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState(null);
  
  const [actionState, setActionState] = useState(null);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineRemarks, setDeclineRemarks] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalType, setSuccessModalType] = useState('');

  const filteredLogs = filter === 'All' 
    ? logs 
    : logs.filter(log => log.status === filter);

  const handleAction = (type) => {
    setActionState('processing');
    setTimeout(() => {
      setActionState(type === 'approve' ? 'approving' : 'declining');
      setTimeout(() => {
        const newStatus = type === 'approve' ? 'Approved' : 'Declined';
        setLogs(logs.map(l => l.id === selectedLog.id ? { ...l, status: newStatus } : l));
        setActionState(null);
        setSelectedLog(null);
        setIsDeclining(false);
        setSuccessModalType(type);
        setTimeout(() => setSuccessModalVisible(true), 150);
      }, 800);
    }, 1000);
  };

  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'Waiting for Approval': return styles.badgePending;
      case 'Approved': return styles.badgeApproved;
      case 'Declined': return styles.badgeDeclined;
      default: return {};
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Activity Logs</Text>
      </View>

      <View style={[styles.filterTabs, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'Waiting for Approval', 'Approved', 'Declined'].map(status => (
            <TouchableOpacity 
              key={status} 
              style={[styles.tab, filter === status && styles.activeTab, filter !== status && { backgroundColor: theme.bg }]}
              onPress={() => setFilter(status)}
            >
              <Text style={[styles.tabText, filter === status && styles.activeTabText, filter !== status && { color: theme.textSub }]}>{status}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        <View style={styles.logsContainer}>
          {filteredLogs.map((log) => (
            <TouchableOpacity 
              key={log.id} 
              style={[styles.logCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setSelectedLog(log)}
            >
              <View style={styles.logHeader}>
                <Text style={[styles.logTime, { color: theme.textSub }]}>{log.time}</Text>
                <Text style={[styles.logBadge, getStatusBadgeStyle(log.status)]}>
                  {log.status}
                </Text>
              </View>
              <Text style={[styles.logEmployee, { color: theme.textMain }]}>{log.employee} • {log.vehicle}</Text>
              <Text style={[styles.logText, { color: theme.textSub }]}>{log.text}</Text>
              <Text style={[styles.viewDetailsText, { color: theme.textSub }]}>Tap to view details</Text>
            </TouchableOpacity>
          ))}
          {filteredLogs.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.textSub }]}>No logs found for this status.</Text>
          )}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={!!selectedLog}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Review Submission</Text>
              <TouchableOpacity onPress={() => setSelectedLog(null)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.submitterInfo}>
                <Text style={[styles.submitterName, { color: theme.textMain }]}>{selectedLog?.employee}</Text>
                <Text style={[styles.submitterContext, { color: theme.textSub }]}>{selectedLog?.time} • {selectedLog?.vehicle}</Text>
              </View>

              <Text style={[styles.sectionHeading, { color: theme.textMain }]}>Images Submitted</Text>
              {selectedLog?.image && (
                <View style={styles.imageGrid}>
                  <Image source={selectedLog.image} style={styles.gridImage} resizeMode="cover" />
                  <View style={styles.gridImagePlaceholder}>
                    <Text style={[styles.placeholderText, { color: theme.textSub }]}>+3 more</Text>
                  </View>
                </View>
              )}

              <Text style={[styles.sectionHeading, { color: theme.textMain }]}>Log Details</Text>
              <Text style={[styles.detailText, { color: theme.textSub }]}>{selectedLog?.text}</Text>
              
              {selectedLog?.status === 'Waiting for Approval' && (
                <View style={styles.actionContainer}>
                  {!isDeclining ? (
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.declineBtn]}
                        onPress={() => setIsDeclining(true)}
                        disabled={actionState !== null}
                      >
                        <XCircle color="#ffffff" size={20} />
                        <Text style={styles.btnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleAction('approve')}
                        disabled={actionState !== null}
                      >
                        {actionState === 'processing' ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <>
                            <CheckCircle color="#ffffff" size={20} />
                            <Text style={styles.btnText}>Approve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[styles.declineForm, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                      <Text style={[styles.inputLabel, { color: theme.textMain }]}>Reason for Decline</Text>
                      <TextInput 
                        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textMain }]}
                        placeholder="Please specify why this is declined..."
                        placeholderTextColor={theme.textSub}
                        multiline
                        numberOfLines={3}
                        value={declineRemarks}
                        onChangeText={setDeclineRemarks}
                        textAlignVertical="top"
                      />
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity 
                          style={styles.cancelDeclineBtn}
                          onPress={() => setIsDeclining(false)}
                        >
                          <Text style={styles.cancelDeclineText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.confirmDeclineBtn, !declineRemarks.trim() && styles.disabledBtn]}
                          onPress={() => handleAction('decline')}
                          disabled={!declineRemarks.trim() || actionState !== null}
                        >
                          {actionState === 'processing' ? (
                            <ActivityIndicator color="#ffffff" size="small" />
                          ) : (
                            <Text style={styles.confirmDeclineText}>Confirm Decline</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={successModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, padding: 32, alignItems: 'center', borderRadius: 24 }]}>
            <View style={[
              styles.modalIconBox, 
              { backgroundColor: successModalType === 'approve' ? '#d1fae5' : '#fee2e2', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }
            ]}>
              {successModalType === 'approve' ? (
                <CheckCircle color="#10b981" size={32} />
              ) : (
                <XCircle color="#ef4444" size={32} />
              )}
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain, textAlign: 'center', marginBottom: 12, fontSize: 22, fontWeight: '800' }]}>
              {successModalType === 'approve' ? 'Submission Approved!' : 'Submission Declined'}
            </Text>
            <Text style={[styles.modalDesc, { color: theme.textSub, textAlign: 'center', marginBottom: 28, fontSize: 15 }]}>
              {successModalType === 'approve' 
                ? 'The log has been verified and successfully approved.' 
                : 'The log has been rejected and the employee will be notified.'}
            </Text>
            <TouchableOpacity 
              style={[{ width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center' }, { backgroundColor: successModalType === 'approve' ? '#10b981' : '#ef4444' }]} 
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, paddingTop: 40, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  filterTabs: { paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  activeTab: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#ffffff' },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 20 },
  logsContainer: { gap: 16 },
  logCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  logTime: { fontSize: 13, color: '#94a3b8' },
  logBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  badgePending: { backgroundColor: '#fef3c7', color: '#d97706' },
  badgeApproved: { backgroundColor: '#d1fae5', color: '#059669' },
  badgeDeclined: { backgroundColor: '#fee2e2', color: '#dc2626' },
  logEmployee: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  logText: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  viewDetailsText: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  emptyText: { textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  closeIcon: { padding: 4, borderRadius: 20, backgroundColor: '#f1f5f9' },
  modalScroll: { paddingBottom: 40 },
  submitterInfo: { marginBottom: 24 },
  submitterName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  submitterContext: { fontSize: 14, color: '#64748b' },
  sectionHeading: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  imageGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  gridImage: { width: 120, height: 120, borderRadius: 12 },
  gridImagePlaceholder: { width: 120, height: 120, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 14, fontWeight: '600' },
  detailText: { fontSize: 15, lineHeight: 24, marginBottom: 24 },
  actionContainer: { marginTop: 8 },
  actionButtonsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  approveBtn: { backgroundColor: '#10b981' },
  declineBtn: { backgroundColor: '#ef4444' },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  declineForm: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 16, height: 80 },
  cancelDeclineBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12 },
  cancelDeclineText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  confirmDeclineBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ef4444', borderRadius: 12 },
  confirmDeclineText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  disabledBtn: { opacity: 0.5 },
});
