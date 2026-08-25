import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { useNavigation } from '@react-navigation/native';
import { Bell, ChevronRight, Wrench, CheckCircle2, Key } from 'lucide-react-native';

import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import { buildOnRentNotices, buildUpcomingNotices, buildWaitingApprovalNotices, getFleetOverviewCounts } from '../utils/vehicleMapper';
import NotificationsPanel from '../components/NotificationsPanel';
import { useNotificationsSeen } from '../hooks/useNotificationsSeen';
import { ACCENT } from '../theme/colors';

const OVERVIEW_CARDS = [
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, color: '#d97706', bg: '#fef3c7' },
  { key: 'available', label: 'Available', icon: CheckCircle2, color: '#059669', bg: '#d1fae5' },
];

function PhotoStatusLabel({ label, needsPhotos }) {
  return (
    <View style={[styles.photoLabel, needsPhotos ? styles.photoLabelNeeded : styles.photoLabelAdded]}>
      <Text style={[styles.photoLabelText, needsPhotos ? styles.photoLabelTextNeeded : styles.photoLabelTextAdded]}>
        {label}
      </Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { rentals, pendingRentals, vehicles } = useFleet();
  const navigation = useNavigation();
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  const upcomingNotices = useMemo(
    () => buildUpcomingNotices(rentals),
    [rentals],
  );

  const onRentNotices = useMemo(
    () => buildOnRentNotices(rentals, vehicles),
    [rentals, vehicles],
  );

  const waitingNotices = useMemo(
    () => buildWaitingApprovalNotices(rentals, pendingRentals),
    [rentals, pendingRentals],
  );

  const { unseenCount, markAllSeen, hasNotifications } = useNotificationsSeen(
    upcomingNotices,
    pendingRentals,
  );

  const overview = useMemo(
    () => getFleetOverviewCounts(vehicles, rentals, pendingRentals),
    [vehicles, rentals, pendingRentals],
  );

  const handleMarkSeen = async () => {
    await markAllSeen();
    setNotificationsVisible(false);
  };

  const renderOverview = () => (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Overview</Text>
      <View style={styles.overviewRow}>
        {OVERVIEW_CARDS.map((item) => {
          const IconComponent = item.icon;
          const value = overview[item.key] ?? 0;
          return (
            <View
              key={item.key}
              style={[styles.overviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={[styles.overviewIconWrap, { backgroundColor: item.bg }]}>
                <IconComponent color={item.color} size={22} />
              </View>
              <Text style={[styles.overviewValue, { color: theme.textMain }]}>{value}</Text>
              <Text style={[styles.overviewLabel, { color: theme.textSub }]}>{item.label}</Text>
            </View>
          );
        })}
      </View>
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
                {unseenCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScreenHeader>
        }
      >
        {renderOverview()}

        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Waiting for approval</Text>
          {waitingNotices.length === 0 ? (
            <Text style={[styles.emptyHint, { color: theme.textSub }]}>
              No rentals waiting for approval.
            </Text>
          ) : (
            waitingNotices.map((log) => (
              <TouchableOpacity
                key={log.id}
                style={[styles.recentCard, styles.waitingCard, { backgroundColor: theme.card, borderColor: '#d97706' }]}
                onPress={() => navigation.navigate('Logs')}
              >
                <View style={styles.recentCardBody}>
                  <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>
                    {log.vehicle} · Waiting for approval
                  </Text>
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
              No upcoming scheduled rentals.
            </Text>
          ) : (
            upcomingNotices.map((log) => (
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
            ))
          )}
        </View>

        {onRentNotices.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: theme.textMain }]}>On Rent</Text>
            {onRentNotices.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.recentCard, styles.onRentCard, { backgroundColor: theme.card, borderColor: '#4338ca' }]}
                onPress={() => item.car && navigation.navigate('CarDetails', { car: item.car })}
              >
                <View style={styles.recentCardBody}>
                  <View style={styles.upcomingTitleRow}>
                    <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>
                      {item.title || item.vehicle} · On Rent
                    </Text>
                    <View style={styles.onRentBadge}>
                      <Key color="#4338ca" size={12} />
                    </View>
                  </View>
                  <Text style={[styles.recentCardSub, { color: theme.textSub }]} numberOfLines={2}>
                    {item.text}
                  </Text>
                  <Text style={[styles.returnLabel, { color: '#4338ca' }]}>
                    Return: {item.returnLabel}
                  </Text>
                </View>
                <ChevronRight color="#4338ca" size={20} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScreenLayout>

      <NotificationsPanel
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
        theme={theme}
        upcomingNotices={upcomingNotices}
        pendingRentals={pendingRentals}
        navigation={navigation}
        onMarkSeen={handleMarkSeen}
        canMarkSeen={hasNotifications}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  emptyHint: { fontSize: 14, lineHeight: 20 },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    minHeight: 124,
    justifyContent: 'center',
  },
  overviewIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  overviewValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  overviewLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
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
  returnLabel: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  upcomingCard: { borderWidth: 1.5 },
  waitingCard: { borderWidth: 1.5 },
  onRentCard: { borderWidth: 1.5 },
  onRentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
