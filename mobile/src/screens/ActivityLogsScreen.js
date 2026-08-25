import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout';
import { X, CheckCircle, XCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import { buildActivityLogs, isUpcomingRental, isWaitingForApproval, rentalHasCarPhotos, getCarPhotosAddedBy } from '../utils/vehicleMapper';
import RentalReviewContent from '../components/RentalReviewContent';
import { ACCENT } from '../theme/colors';

export default function ActivityLogsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { rentals, pendingRentals, loading, loadAll, acceptPending, rejectPending } = useFleet();
  const [filter, setFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState(null);
  const [actionState, setActionState] = useState(null);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineRemarks, setDeclineRemarks] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalType, setSuccessModalType] = useState('');

  const logs = useMemo(
    () => buildActivityLogs(rentals, pendingRentals),
    [rentals, pendingRentals],
  );

  const filteredLogs = filter === 'All' ? logs : logs.filter((log) => log.status === filter);

  const handleAction = async (type) => {
    if (!selectedLog?.rental?.id) return;
    setActionState('processing');
    try {
      if (type === 'approve') {
        await acceptPending(selectedLog.rental.id);
      } else {
        await rejectPending(selectedLog.rental.id, declineRemarks.trim());
      }
      setActionState(null);
      setSelectedLog(null);
      setIsDeclining(false);
      setDeclineRemarks('');
      setSuccessModalType(type);
      setSuccessModalVisible(true);
    } catch (err) {
      setActionState(null);
      setSelectedLog(null);
      setIsDeclining(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Waiting for approval': return styles.badgeWaiting;
      case 'Upcoming': return styles.badgePending;
      case 'On Rent': return styles.badgeApproved;
      case 'Completed': return styles.badgeCompleted;
      case 'Cancelled': return styles.badgeCancelled;
      default: return {};
    }
  };

  const scrollBottomPad = useTabBarContentPadding();

  return (
    <>
    <ScreenLayout
      scroll={false}
      header={
        <>
          <ScreenHeader title="Activity Logs" />
          <View style={[styles.filterTabs, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'Waiting for approval', 'Upcoming', 'On Rent', 'Completed', 'Cancelled'].map((status) => (
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
        </>
      }
    >
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: scrollBottomPad }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} />}
      >
        <View style={styles.logsContainer}>
          {filteredLogs.map((log) => (
            <TouchableOpacity
              key={log.id}
              style={[styles.logCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                if (isUpcomingRental(log.rental)) {
                  const complete = rentalHasCarPhotos(log.rental);
                  navigation.navigate('CarPhotos', {
                    rentalId: log.rental?.id,
                    vehicleLabel: log.vehicle,
                    existingPhotos: log.rental?.carPhotos || {},
                    addedByName: getCarPhotosAddedBy(log.rental),
                    readOnly: complete,
                  });
                  return;
                }
                setSelectedLog(log);
              }}
            >
              <View style={styles.logHeader}>
                <Text style={[styles.logTime, { color: theme.textSub }]}>{log.time}</Text>
                <Text style={[styles.logBadge, getStatusBadgeStyle(log.status)]}>{log.status}</Text>
              </View>
              <Text style={[styles.logEmployee, { color: theme.textMain }]}>{log.employee} • {log.vehicle}</Text>
              <Text style={[styles.logText, { color: theme.textSub }]}>{log.text}</Text>
              <Text style={[styles.viewDetailsText, { color: theme.textSub }]}>Tap to review</Text>
            </TouchableOpacity>
          ))}
          {filteredLogs.length === 0 && !loading ? (
            <Text style={[styles.emptyText, { color: theme.textSub }]}>No activity logs yet.</Text>
          ) : null}
        </View>
      </ScrollView>
    </ScreenLayout>

      <Modal visible={!!selectedLog} animationType="slide" transparent onRequestClose={() => setSelectedLog(null)}>
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
                <Text style={[styles.submitterContext, { color: theme.textSub }]}>
                  {selectedLog?.time} • {selectedLog?.vehicle} • {selectedLog?.status}
                </Text>
              </View>

              <RentalReviewContent rental={selectedLog?.rental} theme={theme} />

              {selectedLog?.status === 'Waiting for approval' || isWaitingForApproval(selectedLog?.rental) ? (
                <View style={styles.actionContainer}>
                  {!isDeclining ? (
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => setIsDeclining(true)} disabled={actionState !== null}>
                        <XCircle color="#ffffff" size={20} />
                        <Text style={styles.btnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleAction('approve')} disabled={actionState !== null}>
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
                        placeholder="Optional reason..."
                        placeholderTextColor={theme.textSub}
                        multiline
                        numberOfLines={3}
                        value={declineRemarks}
                        onChangeText={setDeclineRemarks}
                        textAlignVertical="top"
                      />
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity style={styles.cancelDeclineBtn} onPress={() => setIsDeclining(false)}>
                          <Text style={styles.cancelDeclineText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.confirmDeclineBtn]} onPress={() => handleAction('decline')} disabled={actionState !== null}>
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
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={successModalVisible} animationType="fade" transparent onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, padding: 32, alignItems: 'center', borderRadius: 24 }]}>
            <Text style={[styles.modalTitle, { color: theme.textMain, textAlign: 'center', marginBottom: 12, fontSize: 22, fontWeight: '800' }]}>
              {successModalType === 'approve' ? 'Submission Approved!' : 'Rental Cancelled'}
            </Text>
            <TouchableOpacity
              style={[{ width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: successModalType === 'approve' ? '#10b981' : '#ef4444' }]}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  filterTabs: { paddingVertical: 12, borderBottomWidth: 1 },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  activeTab: { backgroundColor: ACCENT },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#ffffff' },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 20 },
  logsContainer: { gap: 16 },
  logCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  logTime: { fontSize: 13, color: '#94a3b8' },
  logBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  badgeWaiting: { backgroundColor: '#fef3c7', color: '#d97706' },
  badgePending: { backgroundColor: '#dbeafe', color: '#2563eb' },
  badgeApproved: { backgroundColor: '#d1fae5', color: '#059669' },
  badgeCompleted: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  badgeDeclined: { backgroundColor: '#fee2e2', color: '#dc2626' },
  badgeCancelled: { backgroundColor: '#f1f5f9', color: '#64748b' },
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
  gridImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 24 },
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
});
