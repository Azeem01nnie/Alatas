import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Bell, ChevronRight, X, CheckCircle2, Circle, Trash2, CheckCheck, ListChecks } from 'lucide-react-native';

import { useTheme } from '../context/ThemeContext';

const mockMetrics = [
  { id: '1', title: 'Activity Logs', value: '156', color: '#3b82f6' },
  { id: '2', title: 'Car Logs', value: '45', color: '#f59e0b' },
  { id: '3', title: 'Active Employees', value: '12', color: '#10b981' },
];

const mockNotifications = [
  { id: '1', text: 'New activity log recorded', time: '5m ago', isRead: false },
  { id: '2', text: 'Employee John logged in', time: '1h ago', isRead: false },
  { id: '3', text: 'Car #1024 checked out', time: '2h ago', isRead: true },
];

export default function AdminDashboardScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);
  const [selectedNotifs, setSelectedNotifs] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const isAllSelected = notifications.length > 0 && selectedNotifs.length === notifications.length;

  const toggleSelect = (id) => {
    if (selectedNotifs.includes(id)) {
      setSelectedNotifs(selectedNotifs.filter(notifId => notifId !== id));
    } else {
      setSelectedNotifs([...selectedNotifs, id]);
    }
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedNotifs([]);
    } else {
      setSelectedNotifs(notifications.map(n => n.id));
    }
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const markSelectedAsRead = () => {
    setNotifications(notifications.map(n => 
      selectedNotifs.includes(n.id) ? { ...n, isRead: true } : n
    ));
    setSelectedNotifs([]);
  };

  const removeSelected = () => {
    setNotifications(notifications.filter(n => !selectedNotifs.includes(n.id)));
    setSelectedNotifs([]);
  };

  const renderMetrics = () => (
    <View style={styles.metricsContainer}>
      {mockMetrics.map((item) => (
        <View key={item.id} style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: item.color }]}>{item.value}</Text>
          <Text style={[styles.metricTitle, { color: theme.textSub }]}>{item.title}</Text>
        </View>
      ))}
    </View>
  );

  const renderRecentLogs = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Recent Activity Logs</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Logs')}>
          <Text style={[styles.viewAllText, { color: '#3b82f6' }]}>View All</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => navigation.navigate('Logs')}
      >
        <View>
          <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>System Update</Text>
          <Text style={[styles.recentCardSub, { color: theme.textSub }]}>Admin modified settings</Text>
        </View>
        <ChevronRight color={theme.textSub} size={20} />
      </TouchableOpacity>
    </View>
  );

  const renderRecentCars = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Recent Car Logs</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cars')}>
          <Text style={[styles.viewAllText, { color: '#3b82f6' }]}>View All</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => navigation.navigate('Cars')}
      >
        <View>
          <Text style={[styles.recentCardTitle, { color: theme.textMain }]}>Toyota Corolla - XCV 123</Text>
          <Text style={[styles.recentCardSub, { color: theme.textSub }]}>Checked out by Inspector</Text>
        </View>
        <ChevronRight color={theme.textSub} size={20} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('../../assets/logonobg.png')} 
            style={[styles.logo, isDark && { tintColor: '#ffffff' }]} 
            resizeMode="contain" 
          />
          <Text style={[styles.headerTitle, { color: theme.textMain }]}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={() => setNotificationsVisible(true)}>
          <Bell color={theme.textMain} size={24} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Overview</Text>
        {renderMetrics()}
        {renderRecentLogs()}
        {renderRecentCars()}
      </ScrollView>

      {/* Notifications Modal */}
      <Modal visible={notificationsVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Notifications</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 16}}>
                <TouchableOpacity onPress={() => { setIsEditMode(!isEditMode); setSelectedNotifs([]); }}>
                  <ListChecks color={isEditMode ? '#3b82f6' : theme.textSub} size={24} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setNotificationsVisible(false); setSelectedNotifs([]); setIsEditMode(false); }}>
                  <X color={theme.textSub} size={24} />
                </TouchableOpacity>
              </View>
            </View>
            {isEditMode && (
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity onPress={toggleSelectAll}>
                  <Text style={{color: theme.textSub, fontWeight: '600'}}>{isAllSelected ? 'Deselect all' : 'Select all'}</Text>
                </TouchableOpacity>

                {selectedNotifs.length > 0 ? (
                  <View style={{flexDirection: 'row', gap: 15}}>
                    <TouchableOpacity onPress={removeSelected} style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                      <Trash2 color="#ef4444" size={16} />
                      <Text style={{color: '#ef4444', fontWeight: '600'}}>Remove</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={markSelectedAsRead} style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                      <CheckCheck color="#3b82f6" size={16} />
                      <Text style={{color: '#3b82f6', fontWeight: '600'}}>Mark Read</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={{color: '#3b82f6', fontWeight: '600'}}>Mark all as read</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <ScrollView style={styles.notificationList}>
              {notifications.map(notif => {
                const isSelected = selectedNotifs.includes(notif.id);
                return (
                  <TouchableOpacity 
                    key={notif.id} 
                    style={[
                      styles.notificationItem, 
                      { borderBottomColor: theme.border, backgroundColor: notif.isRead ? theme.card : (theme.bg || '#f1f5f9') },
                      (isEditMode && isSelected) && { backgroundColor: theme.iconBg || '#eff6ff' }
                    ]}
                    onPress={() => { if(isEditMode) toggleSelect(notif.id); }}
                    activeOpacity={isEditMode ? 0.7 : 1}
                  >
                    {isEditMode && (
                      <View style={styles.notifSelectContainer}>
                        {isSelected ? <CheckCircle2 color="#3b82f6" size={20} /> : <Circle color={theme.textSub} size={20} />}
                      </View>
                    )}
                    <View style={styles.notifDotContainer}>
                      {!notif.isRead && <View style={styles.unreadDot} />}
                    </View>
                    <View style={styles.notifTextContainer}>
                      <Text style={[styles.notifText, { color: theme.textMain }]}>{notif.text}</Text>
                      <Text style={[styles.notifTime, { color: theme.textSub }]}>{notif.time}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 40, paddingBottom: 15,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  bellBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute', top: 0, right: 0, backgroundColor: '#ef4444',
    borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#fff'
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 20, paddingBottom: 40 },
  sectionContainer: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16, marginTop: 8 },
  viewAllText: { fontSize: 14, fontWeight: '600' },
  metricsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  metricCard: {
    width: '31%', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center'
  },
  metricValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  metricTitle: { fontSize: 11, color: '#64748b', fontWeight: '500', textAlign: 'center' },
  recentCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 12, borderWidth: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
  },
  recentCardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  recentCardSub: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalHeaderActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  notificationList: { flex: 1 },
  notificationItem: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 12, borderBottomWidth: 1, borderRadius: 8, marginBottom: 4 },
  notifDotContainer: { width: 16, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  notifTextContainer: { flex: 1 },
  notifText: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  notifTime: { fontSize: 13 },
  notifSelectContainer: { justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  notifRemoveBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
});
