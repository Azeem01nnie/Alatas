import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Bell, CalendarClock, ChevronRight, ClipboardList, X } from 'lucide-react-native';
import { ACCENT } from '../theme/colors';
import { buildFieldActivityLogs } from '../utils/vehicleMapper';

function NotificationCard({ icon: Icon, iconBg, iconColor, title, subtitle, meta, badge, onPress, theme }) {
  return (
    <TouchableOpacity
      style={[styles.notifCard, { backgroundColor: theme.bg, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.notifIconWrap, { backgroundColor: iconBg }]}>
        <Icon color={iconColor} size={20} />
      </View>
      <View style={styles.notifCardBody}>
        <View style={styles.notifCardTitleRow}>
          <Text style={[styles.notifCardTitle, { color: theme.textMain }]} numberOfLines={1}>
            {title}
          </Text>
          {badge ? (
            <View style={[styles.notifBadge, badge.tone === 'warn' ? styles.notifBadgeWarn : styles.notifBadgeOk]}>
              <Text style={[styles.notifBadgeText, badge.tone === 'warn' ? styles.notifBadgeTextWarn : styles.notifBadgeTextOk]}>
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={[styles.notifCardSub, { color: theme.textSub }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[styles.notifCardMeta, { color: theme.textSub }]}>{meta}</Text>
        ) : null}
      </View>
      <ChevronRight color={theme.textSub} size={18} />
    </TouchableOpacity>
  );
}

export default function NotificationsPanel({
  visible,
  onClose,
  theme,
  upcomingNotices,
  pendingRentals,
  navigation,
  onMarkSeen,
  canMarkSeen = false,
}) {
  const totalCount = upcomingNotices.length + pendingRentals.length;

  const handleUpcomingPress = (log) => {
    onClose();
    navigation.navigate('CarPhotos', {
      rentalId: log.rental?.id,
      vehicleLabel: log.vehicle,
      existingPhotos: log.rental?.carPhotos || {},
      addedByName: log.carPhotosAddedBy || log.rental?.carPhotosAddedBy,
      readOnly: !log.needsCarPhotos,
    });
  };

  const handlePendingPress = () => {
    onClose();
    navigation.navigate('Logs');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft || '#fef2f2' }]}>
                <Bell color={ACCENT} size={20} />
              </View>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.textMain }]}>Notifications</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSub }]}>
                  {totalCount === 0 ? 'You are all caught up' : `${totalCount} item${totalCount === 1 ? '' : 's'} need attention`}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: theme.iconBg }]}
              onPress={onClose}
              hitSlop={8}
            >
              <X color={theme.textSub} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {totalCount === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Bell color={theme.textSub} size={32} strokeWidth={1.5} />
                <Text style={[styles.emptyTitle, { color: theme.textMain }]}>No notifications</Text>
                <Text style={[styles.emptySub, { color: theme.textSub }]}>
                  Upcoming rentals and pending approvals will appear here.
                </Text>
              </View>
            ) : null}

            {pendingRentals.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionLabel, { color: theme.textSub }]}>Pending approval</Text>
                  <View style={[styles.sectionCount, { backgroundColor: theme.accentSoft || '#fef2f2' }]}>
                    <Text style={[styles.sectionCountText, { color: ACCENT }]}>{pendingRentals.length}</Text>
                  </View>
                </View>
                {pendingRentals.map((rental) => {
                  const log = buildFieldActivityLogs([], [rental])[0];
                  const name = log?.employee || 'Field submission';
                  const plate = log?.vehicle || '—';
                  return (
                    <NotificationCard
                      key={rental.id}
                      icon={ClipboardList}
                      iconBg="#fef3c7"
                      iconColor="#d97706"
                      title={`${name} · ${plate}`}
                      subtitle={log?.text || 'Awaiting admin review'}
                      meta={log?.time}
                      badge={{ label: 'Review', tone: 'warn' }}
                      onPress={handlePendingPress}
                      theme={theme}
                    />
                  );
                })}
              </View>
            ) : null}

            {upcomingNotices.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionLabel, { color: theme.textSub }]}>Upcoming rentals</Text>
                  <View style={[styles.sectionCount, { backgroundColor: theme.accentSoft || '#fef2f2' }]}>
                    <Text style={[styles.sectionCountText, { color: ACCENT }]}>{upcomingNotices.length}</Text>
                  </View>
                </View>
                {upcomingNotices.map((log) => (
                  <NotificationCard
                    key={log.id}
                    icon={CalendarClock}
                    iconBg={log.needsCarPhotos ? '#fef3c7' : '#d1fae5'}
                    iconColor={log.needsCarPhotos ? '#d97706' : '#059669'}
                    title={log.vehicle}
                    subtitle={log.text}
                    meta={log.time}
                    badge={{
                      label: log.photoLabel,
                      tone: log.needsCarPhotos ? 'warn' : 'ok',
                    }}
                    onPress={() => handleUpcomingPress(log)}
                    theme={theme}
                  />
                ))}
              </View>
            ) : null}
          </ScrollView>

          {canMarkSeen ? (
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.markSeenBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                onPress={onMarkSeen}
              >
                <Text style={[styles.markSeenText, { color: theme.textMain }]}>Mark as seen</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sheetSubtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 8 },
  section: { marginBottom: 20 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sectionCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionCountText: { fontSize: 11, fontWeight: '800' },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  notifIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCardBody: { flex: 1, minWidth: 0 },
  notifCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  notifCardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  notifBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  notifBadgeWarn: { backgroundColor: '#fef3c7' },
  notifBadgeOk: { backgroundColor: '#d1fae5' },
  notifBadgeText: { fontSize: 10, fontWeight: '700' },
  notifBadgeTextWarn: { color: '#b45309' },
  notifBadgeTextOk: { color: '#047857' },
  notifCardSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  notifCardMeta: { fontSize: 12, marginTop: 6 },
  emptyState: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 4 : 0,
  },
  markSeenBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  markSeenText: { fontSize: 15, fontWeight: '700' },
});
