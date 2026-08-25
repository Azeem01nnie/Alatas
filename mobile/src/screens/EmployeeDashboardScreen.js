import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { useNavigation } from '@react-navigation/native';
import { Bell, ChevronRight, X, Image as ImageIcon, Car, ListTodo } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ACCENT } from '../theme/colors';
import { useFleet } from '../context/FleetContext';
import { buildFieldActivityLogs, buildUpcomingNotices } from '../utils/vehicleMapper';

function PhotoStatusLabel({ label, needsPhotos }) {
  return (
    <View style={[styles.photoLabel, needsPhotos ? styles.photoLabelNeeded : styles.photoLabelAdded]}>
      <Text style={[styles.photoLabelText, needsPhotos ? styles.photoLabelTextNeeded : styles.photoLabelTextAdded]}>
        {label}
      </Text>
    </View>
  );
}

const METRIC_CARDS = [
  { id: 'uploads', title: 'Uploaded Images', color: '#b32025', key: 'uploadedCount', icon: ImageIcon },
  { id: 'brands', title: 'Car Brands', color: '#f59e0b', key: 'brandCount', icon: Car },
  { id: 'pending', title: 'Pending', color: '#10b981', key: 'pendingCount', icon: ListTodo },
];

export default function EmployeeDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { metrics, rentals, pendingRentals, loading } = useFleet();
  const navigation = useNavigation();
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  const mySubmissions = useMemo(
    () => buildFieldActivityLogs(rentals, pendingRentals).slice(0, 5),
    [rentals, pendingRentals],
  );

  const upcomingNotices = useMemo(
    () => buildUpcomingNotices(rentals),
    [rentals],
  );

  const pendingCount = metrics.pendingCount + upcomingNotices.length;

  const renderMetrics = () => (
    <View style={styles.metricsContainer}>
      {METRIC_CARDS.map((item) => {
        const IconComponent = item.icon;
        return (
          <View key={item.id} style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.iconWrapper, { backgroundColor: `${item.color}20` }]}>
              <IconComponent color={item.color} size={24} />
            </View>
            <Text style={[styles.metricValue, { color: theme.textMain }]}>{String(metrics[item.key] ?? 0)}</Text>
            <Text style={[styles.metricTitle, { color: theme.textSub }]}>{item.title}</Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <>
      <ScreenLayout
        scroll
        scrollProps={{ style: styles.scrollContent, contentContainerStyle: styles.scrollInner }}
        header={
          <ScreenHeader>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Image
                  source={require('../../assets/logonobg.png')}
                  style={[styles.logo, isDark && { tintColor: '#ffffff' }]}
                  resizeMode="contain"
                />
                <Text style={[styles.headerTitle, { color: theme.textMain }]}>Dashboard</Text>
              </View>
              <TouchableOpacity style={styles.bellBtn} onPress={() => setNotificationsVisible(true)}>
                <Bell color={theme.textMain} size={24} />
                {pendingCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScreenHeader>
        }
      >
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Daily Operations</Text>
        {renderMetrics()}

        {upcomingNotices.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Upcoming</Text>
            {upcomingNotices.map((log) => (
              <TouchableOpacity
                key={log.id}
                style={[styles.recentCard, styles.upcomingCard, { backgroundColor: theme.card, borderColor: ACCENT }]}
                onPress={() =>
                  navigation.navigate('CarPhotos', {
                    rentalId: log.rental?.id,
                    vehicleLabel: log.vehicle,
                    existingPhotos: log.rental?.carPhotos || {},
                    addedByName: log.carPhotosAddedBy || log.rental?.carPhotosAddedBy,
                    readOnly: !log.needsCarPhotos,
                  })
                }
              >
                <View style={styles.recentCardBody}>
                  <View style={styles.upcomingTitleRow}>
                    <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>
                      {log.vehicle} · Upcoming
                    </Text>
                    <PhotoStatusLabel label={log.photoLabel} needsPhotos={log.needsCarPhotos} />
                  </View>
                  <Text style={[styles.recentCardSub, { color: theme.textSub }]} numberOfLines={2}>
                    {log.text}
                  </Text>
                </View>
                <ChevronRight color={ACCENT} size={20} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Your submissions</Text>
          {mySubmissions.length === 0 ? (
            <Text style={[styles.emptyHint, { color: theme.textSub }]}>
              {loading ? 'Loading…' : 'No submissions yet. Use Camera to submit a field inspection.'}
            </Text>
          ) : (
            mySubmissions.map((log) => (
              <TouchableOpacity
                key={log.id}
                style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => navigation.navigate('Camera')}
              >
                <View style={styles.recentCardBody}>
                  <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>
                    {log.vehicle} · {log.status}
                  </Text>
                  <Text style={[styles.recentCardSub, { color: theme.textSub }]} numberOfLines={2}>
                    {log.text}
                  </Text>
                </View>
                <ChevronRight color={theme.textSub} size={20} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScreenLayout>

      <Modal visible={notificationsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Submission status</Text>
              <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.notificationList}>
              {upcomingNotices.length > 0 ? (
                <>
                  <Text style={[styles.notifSectionLabel, { color: theme.textSub }]}>Upcoming rentals</Text>
                  {upcomingNotices.map((log) => (
                    <TouchableOpacity
                      key={`up-${log.id}`}
                      style={[styles.notificationItem, { borderBottomColor: theme.border }]}
                      onPress={() => {
                        setNotificationsVisible(false);
                        navigation.navigate('CarPhotos', {
                          rentalId: log.rental?.id,
                          vehicleLabel: log.vehicle,
                          existingPhotos: log.rental?.carPhotos || {},
                          addedByName: log.carPhotosAddedBy || log.rental?.carPhotosAddedBy,
                          readOnly: !log.needsCarPhotos,
                        });
                      }}
                    >
                      <View style={styles.notifTextContainer}>
                        <Text style={[styles.notifText, { color: theme.textMain }]}>
                          {log.vehicle} — {log.photoLabel}
                        </Text>
                        <Text style={[styles.notifTime, { color: theme.textSub }]}>{log.time}</Text>
                      </View>
                      <ChevronRight color={theme.textSub} size={18} />
                    </TouchableOpacity>
                  ))}
                </>
              ) : null}
              {mySubmissions.length === 0 && upcomingNotices.length === 0 ? (
                <Text style={[styles.emptyHint, { color: theme.textSub, padding: 16 }]}>
                  No submissions to show.
                </Text>
              ) : (
                mySubmissions.map((log) => (
                  <View key={log.id} style={[styles.notificationItem, { borderBottomColor: theme.border }]}>
                    <View style={styles.notifTextContainer}>
                      <Text style={[styles.notifText, { color: theme.textMain }]}>
                        {log.vehicle} — {log.status}
                      </Text>
                      <Text style={[styles.notifTime, { color: theme.textSub }]}>{log.time}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logo: { width: 40, height: 40, marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  bellBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 20 },
  sectionContainer: { marginBottom: 24, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  emptyHint: { fontSize: 14, lineHeight: 20 },
  metricsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  metricCard: {
    width: '31%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  metricTitle: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  recentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  recentCardBody: { flex: 1, marginRight: 8 },
  upcomingTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 },
  recentCardTitle: { fontSize: 16, fontWeight: '600' },
  recentCardSub: { fontSize: 14 },
  upcomingCard: { borderWidth: 1.5 },
  photoLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  photoLabelNeeded: { backgroundColor: '#fef3c7' },
  photoLabelAdded: { backgroundColor: '#d1fae5' },
  photoLabelText: { fontSize: 11, fontWeight: '700' },
  photoLabelTextNeeded: { color: '#b45309' },
  photoLabelTextAdded: { color: '#047857' },
  notifSectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  notificationList: { flexGrow: 0 },
  notificationItem: { paddingVertical: 14, borderBottomWidth: 1 },
  notifTextContainer: { flex: 1 },
  notifText: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  notifTime: { fontSize: 13 },
});
