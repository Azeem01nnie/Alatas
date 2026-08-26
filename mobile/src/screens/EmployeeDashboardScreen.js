import { buildUpcomingNotices, buildWaitingApprovalNotices, getCarPhotosAddedBy, rentalHasCarPhotos } from '../utils/vehicleMapper';
import { useFleet } from '../context/FleetContext';
import { useAuth } from '../context/AuthContext';
import { ACCENT } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { Bell, ChevronRight, X, Image as ImageIcon, ListTodo } from 'lucide-react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  RefreshControl,
} from 'react-native';

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
  { id: 'uploads', title: 'Uploaded photos', color: '#b32025', key: 'uploadedCount', icon: ImageIcon },
  { id: 'pending', title: 'Photos needed', color: '#10b981', key: 'pendingCount', icon: ListTodo },
];

function sameAccount(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function isMine(rental, accountName, username) {
  const by = getCarPhotosAddedBy(rental);
  return sameAccount(by, accountName) || sameAccount(by, username);
}

export default function EmployeeDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { metrics, rentals, pendingRentals, loadAll } = useFleet();
  const navigation = useNavigation();
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const accountName = user?.displayName?.trim() || user?.username?.trim() || '';
  const username = user?.username?.trim() || '';

  const waitingNotices = useMemo(
    () => buildWaitingApprovalNotices(rentals, pendingRentals, { forEmployee: true }),
    [rentals, pendingRentals],
  );

  const upcomingNotices = useMemo(
    () => buildUpcomingNotices(rentals),
    [rentals],
  );

  const mySubmissions = useMemo(() => {
    if (!accountName && !username) return [];
    return (rentals || [])
      .filter((rental) => rentalHasCarPhotos(rental) && isMine(rental, accountName, username))
      .map((rental) => {
        const notice = buildUpcomingNotices([rental], { includePendingForPhotos: true })[0];
        const plate = rental.vehicle?.plateNo || rental.vehicle?.plate || rental.vehicleId || '—';
        const by = getCarPhotosAddedBy(rental);
        return {
          id: rental.id,
          vehicle: plate,
          text: by ? `Photos uploaded by ${by}` : 'Vehicle photos uploaded',
          rental,
          time: notice?.time || '—',
        };
      })
      .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  }, [rentals, accountName, username]);

  const openCameraForRental = useCallback(
    (rentalId) => {
      navigation.navigate('Camera', { rentalId });
    },
    [navigation],
  );

  const displayMetrics = useMemo(
    () => ({
      pendingCount: metrics.pendingCount,
      uploadedCount: mySubmissions.length,
    }),
    [metrics.pendingCount, mySubmissions.length],
  );

  const pendingCount = metrics.pendingCount;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const renderMetrics = () => (
    <View style={styles.metricsContainer}>
      {METRIC_CARDS.map((item) => {
        const IconComponent = item.icon;
        return (
          <View key={item.id} style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.iconWrapper, { backgroundColor: `${item.color}20` }]}>
              <IconComponent color={item.color} size={24} />
            </View>
            <Text style={[styles.metricValue, { color: theme.textMain }]}>{String(displayMetrics[item.key] ?? 0)}</Text>
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
        scrollProps={{
          style: styles.scrollContent,
          contentContainerStyle: styles.scrollInner,
          refreshControl: (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
            />
          ),
        }}
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

        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Waiting for approval</Text>
          {waitingNotices.length === 0 ? (
            <Text style={[styles.emptyHint, { color: theme.textSub }]}>
              No rentals waiting for desk approval.
            </Text>
          ) : (
            waitingNotices.map((log) => (
              <TouchableOpacity
                key={`wait-${log.id}`}
                style={[styles.recentCard, styles.waitingCard, { backgroundColor: theme.card, borderColor: '#d97706' }]}
                onPress={() => openCameraForRental(log.rental?.id)}
                activeOpacity={0.85}
              >
                <View style={styles.recentCardBody}>
                  <View style={styles.upcomingTitleRow}>
                    <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>
                      {log.vehicle} · Waiting for approval
                    </Text>
                    <PhotoStatusLabel label={log.photoLabel} needsPhotos={log.needsCarPhotos} />
                  </View>
                  <Text style={[styles.recentCardSub, { color: theme.textSub }]} numberOfLines={2}>
                    {log.text}
                  </Text>
                </View>
                <ChevronRight color="#d97706" size={20} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Upcoming</Text>
          {upcomingNotices.length === 0 ? (
            <Text style={[styles.emptyHint, { color: theme.textSub }]}>
              No upcoming rentals. Pull down to refresh.
            </Text>
          ) : (
            upcomingNotices.map((log) => (
              <TouchableOpacity
                key={log.id}
                style={[styles.recentCard, styles.upcomingCard, { backgroundColor: theme.card, borderColor: ACCENT }]}
                onPress={() => openCameraForRental(log.rental?.id)}
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
            ))
          )}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Your submissions</Text>
          {mySubmissions.length === 0 ? (
            <Text style={[styles.emptyHint, { color: theme.textSub }]}>
              {accountName
                ? `No photo submissions from ${accountName} yet.`
                : 'No photo submissions yet. Use Camera to upload vehicle photos.'}
            </Text>
          ) : (
            mySubmissions.map((log) => (
              <TouchableOpacity
                key={log.id}
                style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() =>
                  navigation.navigate('Camera', {
                    rentalId: log.rental?.id,
                  })
                }
              >
                <View style={styles.recentCardBody}>
                  <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>
                    {log.vehicle} · Photos uploaded
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
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Needs attention</Text>
              <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.notificationList}>
              {waitingNotices.length === 0 && upcomingNotices.length === 0 ? (
                <Text style={[styles.emptyHint, { color: theme.textSub, padding: 16 }]}>
                  Nothing waiting right now.
                </Text>
              ) : (
                <>
                  {waitingNotices.length > 0 ? (
                    <>
                      <Text style={[styles.notifSectionLabel, { color: theme.textSub }]}>
                        Waiting for approval
                      </Text>
                      {waitingNotices.map((log) => (
                        <TouchableOpacity
                          key={`wait-n-${log.id}`}
                          style={[styles.notificationItem, { borderBottomColor: theme.border }]}
                          onPress={() => {
                            setNotificationsVisible(false);
                            openCameraForRental(log.rental?.id);
                          }}
                        >
                          <View style={styles.notifTextContainer}>
                            <Text style={[styles.notifText, { color: theme.textMain }]}>
                              {log.vehicle} — {log.photoLabel}
                            </Text>
                            <Text style={[styles.notifTime, { color: theme.textSub }]}>
                              Add photos only · desk approves the rental
                            </Text>
                          </View>
                          <ChevronRight color="#d97706" size={18} />
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : null}
                  {upcomingNotices.length > 0 ? (
                    <>
                      <Text style={[styles.notifSectionLabel, { color: theme.textSub, marginTop: waitingNotices.length ? 12 : 0 }]}>
                        Upcoming
                      </Text>
                      {upcomingNotices.map((log) => (
                        <TouchableOpacity
                          key={`up-${log.id}`}
                          style={[styles.notificationItem, { borderBottomColor: theme.border }]}
                          onPress={() => {
                            setNotificationsVisible(false);
                            openCameraForRental(log.rental?.id);
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
                </>
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
  metricsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
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
  waitingCard: { borderWidth: 1.5 },
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
  notificationItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifTextContainer: { flex: 1 },
  notifText: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  notifTime: { fontSize: 13 },
});
