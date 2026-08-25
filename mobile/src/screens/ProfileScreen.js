import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Modal, ActivityIndicator, TextInput, Platform, DeviceEventEmitter } from 'react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { User, LogOut, Camera, MonitorSmartphone, Palette, ChevronRight, X, RefreshCw, Image as ImageIcon, Trash2, Save, CheckCircle2 } from 'lucide-react-native';

import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import { useAuth } from '../context/AuthContext';
import { pickProfilePhoto } from '../utils/profilePhoto';
import { ACCENT } from '../theme/colors';

function defaultProfile(user) {
  return {
    name: user?.displayName || 'Alatas Admin',
  };
}

export default function ProfileScreen() {
  const { activeTheme, setActiveTheme, isDark, theme } = useTheme();
  const { user, updateDisplayName } = useAuth();
  const { syncNow, lastSynced, online, apiUrl, queueLength, loadAll } = useFleet();

  const [profileImage, setProfileImage] = useState(null);
  const [profileData, setProfileData] = useState(() => defaultProfile(user));
  const [editForm, setEditForm] = useState({ ...defaultProfile(user) });

  const [lastSyncedLabel, setLastSyncedLabel] = useState(null);
  
  // Modals
  const [syncConfirmVisible, setSyncConfirmVisible] = useState(false);
  const [syncLoadingVisible, setSyncLoadingVisible] = useState(false);
  const [syncSuccessVisible, setSyncSuccessVisible] = useState(false);
  const [profileSavedVisible, setProfileSavedVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [pictureModalVisible, setPictureModalVisible] = useState(false);

  useEffect(() => {
    const next = defaultProfile(user);
    setProfileData(next);
    setEditForm(next);
  }, [user?.username, user?.displayName]);
  
  const handleUpdatePicture = () => {
    setPictureModalVisible(true);
  };

  const setPhoto = (uri) => {
    setProfileImage(uri);
    setPictureModalVisible(false);
  };

  const choosePhoto = async (useCamera) => {
    const uri = await pickProfilePhoto(useCamera);
    if (uri) setPhoto(uri);
  };

  const initiateSync = () => {
    setSyncConfirmVisible(true);
  };

  const confirmSync = async () => {
    setSyncConfirmVisible(false);
    setSyncLoadingVisible(true);
    try {
      await syncNow();
      await loadAll();
      const stamp = lastSynced
        ? lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedLabel(stamp);
      setSyncSuccessVisible(true);
    } catch (err) {
      Alert.alert('Sync failed', err?.message || 'Could not sync with cloud.');
    } finally {
      setSyncLoadingVisible(false);
    }
  };

  const openEditProfile = () => {
    setEditForm({ ...profileData });
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!editForm.name?.trim()) {
      Alert.alert('Validation Error', 'Display name is required.');
      return;
    }
    try {
      const next = await updateDisplayName(editForm.name);
      setProfileData({ name: next });
      setEditModalVisible(false);
      setTimeout(() => setProfileSavedVisible(true), 300);
    } catch (err) {
      Alert.alert('Could not save', err?.message || 'Please try again.');
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    DeviceEventEmitter.emit('logout');
  };

  const syncSubtitle = lastSyncedLabel
    ? `Last synced ${lastSyncedLabel}`
    : `${online ? 'Online' : 'Offline'}${queueLength ? ` · ${queueLength} queued` : ''}`;

  const shortApiHost = (() => {
    try {
      return new URL(apiUrl).host;
    } catch {
      return apiUrl;
    }
  })();

  return (
    <>
    <ScreenLayout
      scroll
      contentContainerStyle={styles.container}
      header={<ScreenHeader title="Profile" subtitle="Administrator account" />}
    >
        
        {/* Profile Card */}
        <View style={styles.profileHeader}>
          <TouchableOpacity style={[styles.avatarContainer, { backgroundColor: theme.iconBg }]} onPress={handleUpdatePicture} activeOpacity={0.8}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <User color={theme.textSub} size={48} strokeWidth={1.5} />
            )}
            <View style={[styles.cameraBadge, { borderColor: theme.card }]}>
              <Camera color="#fff" size={14} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.name, { color: theme.textMain }]}>{profileData.name}</Text>
          <Text style={styles.role}>@{user?.username || 'alatas_admin'}</Text>
        </View>

        {/* Display name */}
        <View style={[styles.sectionBlock, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Display name</Text>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: theme.accentSoft }]}>
              <User color={ACCENT} size={18} />
            </View>
            <Text style={[styles.infoText, { color: theme.textMain, flex: 1 }]}>{profileData.name}</Text>
            <TouchableOpacity onPress={openEditProfile} hitSlop={8}>
              <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 13 }}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings & Features */}
        <View style={[styles.sectionBlock, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Settings</Text>
          
          <TouchableOpacity style={styles.settingRow} onPress={initiateSync}>
            <View style={styles.settingRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: theme.accentSoft }]}>
                <MonitorSmartphone color={ACCENT} size={18} />
              </View>
              <View style={styles.settingTextWrap}>
                <View style={styles.settingTitleRow}>
                  <Text style={[styles.settingTitle, { color: theme.textMain }]}>Sync with Cloud</Text>
                  <View style={[styles.statusPill, { backgroundColor: online ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#451a03' : '#fff7ed') }]}>
                    <View style={[styles.statusDot, { backgroundColor: online ? '#10b981' : '#f59e0b' }]} />
                    <Text style={[styles.statusPillText, { color: online ? '#10b981' : '#f59e0b' }]}>{online ? 'Online' : 'Offline'}</Text>
                  </View>
                </View>
                <Text style={[styles.settingDesc, { color: theme.textSub }]} numberOfLines={2}>
                  {syncSubtitle} · {shortApiHost}
                </Text>
              </View>
            </View>
            <RefreshCw color={ACCENT} size={20} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <TouchableOpacity style={styles.settingRow} onPress={() => setThemeModalVisible(true)}>
            <View style={styles.settingRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#2e1065' : '#f5f3ff' }]}>
                <Palette color="#8b5cf6" size={18} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.textMain }]}>Personalization</Text>
                <Text style={[styles.settingDesc, { color: theme.textSub }]}>Theme: {activeTheme}</Text>
              </View>
            </View>
            <ChevronRight color={theme.textSub} size={20} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={[styles.actionButton, styles.logoutButton, { borderColor: isDark ? '#7f1d1d' : '#fee2e2', backgroundColor: isDark ? '#450a0a' : '#fef2f2' }]} onPress={handleLogout}>
            <LogOut color="#ef4444" size={20} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

    </ScreenLayout>

      {/* Sync Confirmation Modal */}
      <Modal
        visible={syncConfirmVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSyncConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIconBox, { backgroundColor: isDark ? '#450a0a' : '#fef2f2' }]}>
              <MonitorSmartphone color="#b32025" size={32} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain }]}>Sync with Cloud?</Text>
            <Text style={[styles.modalDesc, { color: theme.textSub }]}>
              Push queued submissions and refresh fleet data from {shortApiHost}.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.iconBg }]} onPress={() => setSyncConfirmVisible(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmSync}>
                <Text style={styles.confirmBtnText}>Start Sync</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sync Loading Modal */}
      <Modal
        visible={syncLoadingVisible}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.loadingModalContent, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color="#b32025" />
            <Text style={[styles.loadingText, { color: theme.textMain }]}>Synchronizing...</Text>
            <Text style={[styles.loadingSubtext, { color: theme.textSub }]}>Please keep the app open.</Text>
          </View>
        </View>
      </Modal>

      {/* Profile Picture Menu Modal */}
      <Modal
        visible={pictureModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPictureModalVisible(false)}
      >
        <View style={styles.bottomModalOverlay}>
          <View style={[styles.bottomModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.bottomModalHeader}>
              <Text style={[styles.bottomModalTitle, { color: theme.textMain }]}>Update Photo</Text>
              <TouchableOpacity onPress={() => setPictureModalVisible(false)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={() => choosePhoto(false)}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#fef2f2' }]}>
                  <ImageIcon color="#b32025" size={20} />
                </View>
                <Text style={[styles.menuItemTitle, { color: theme.textMain }]}>Choose from Gallery</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={() => choosePhoto(true)}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#f5f3ff' }]}>
                  <Camera color="#8b5cf6" size={20} />
                </View>
                <Text style={[styles.menuItemTitle, { color: theme.textMain }]}>Take a Photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => setPhoto(null)}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#fef2f2' }]}>
                  <Trash2 color="#ef4444" size={20} />
                </View>
                <Text style={[styles.menuItemTitle, { color: '#ef4444' }]}>Remove Photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sync Success Modal */}
      <Modal
        visible={syncSuccessVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSyncSuccessVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIconBox, { backgroundColor: '#ecfdf5' }]}>
              <CheckCircle2 color="#10b981" size={36} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain }]}>Sync Successful!</Text>
            <Text style={[styles.modalDesc, { color: theme.textSub }]}>
              Fleet data is up to date with the cloud.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setSyncSuccessVisible(false)}>
                <Text style={styles.confirmBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal (Floating Center) */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.bottomModalHeader}>
              <Text style={[styles.bottomModalTitle, { color: theme.textMain }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.formGroup, { width: '100%' }]}>
              <Text style={[styles.inputLabel, { color: theme.textMain }]}>Display name</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.textMain, width: '100%' }]} 
                value={editForm.name}
                onChangeText={(t) => setEditForm({ ...editForm, name: t })}
                placeholder="Your display name"
                placeholderTextColor={theme.textSub}
              />
            </View>

            <TouchableOpacity style={[styles.saveBtn, { width: '100%', backgroundColor: ACCENT }]} onPress={saveProfile}>
              <Save color="#fff" size={20} />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Personalization Modal (Floating Center) */}
      <Modal
        visible={themeModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.bottomModalHeader}>
              <Text style={[styles.bottomModalTitle, { color: theme.textMain }]}>App Personalization</Text>
              <TouchableOpacity onPress={() => setThemeModalVisible(false)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.inputLabel, { color: theme.textMain, alignSelf: 'flex-start' }]}>Select App Theme</Text>
            <View style={[styles.themeOptionsRow, { width: '100%' }]}>
              {['Light', 'Dark'].map((t) => (
                <TouchableOpacity 
                  key={t}
                  style={[
                    styles.themeOptionBtn,
                    { backgroundColor: activeTheme === t ? theme.accentSoft : theme.bg, borderColor: activeTheme === t ? ACCENT : theme.border },
                  ]}
                  onPress={() => {
                    setActiveTheme(t);
                    setThemeModalVisible(false);
                  }}
                >
                  <Text style={[styles.themeOptionText, { color: theme.textSub }, activeTheme === t && { color: ACCENT, fontWeight: '700' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Saved Modal */}
      <Modal
        visible={profileSavedVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setProfileSavedVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIconBox, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
              <CheckCircle2 color="#10b981" size={36} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain }]}>Profile Updated</Text>
            <Text style={[styles.modalDesc, { color: theme.textSub }]}>
              Your display name has been saved and synced.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: ACCENT }]} onPress={() => setProfileSavedVisible(false)}>
                <Text style={styles.confirmBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIconBox, { backgroundColor: '#fef2f2' }]}>
              <LogOut color="#ef4444" size={32} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain }]}>Confirm Logout</Text>
            <Text style={[styles.modalDesc, { color: theme.textSub }]}>
              Are you sure you want to log out of your administrator account? You will need to sign in again.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.iconBg }]} onPress={() => setLogoutModalVisible(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#ef4444', shadowColor: '#ef4444' }]} onPress={confirmLogout}>
                <Text style={styles.confirmBtnText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    backgroundColor: '#b32025',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f8fafc',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  role: {
    fontSize: 15,
    color: '#b32025',
    fontWeight: '600',
  },
  sectionBlock: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  actionsSection: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  phonePrefixBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontSize: 15,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  loadingModalContent: {
    borderRadius: 24,
    padding: 32,
    width: '80%',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  modalDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#b32025',
    alignItems: 'center',
    shadowColor: '#b32025',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Bottom Modal
  bottomModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  bottomModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  bottomModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeIcon: {
    padding: 6,
    borderRadius: 20,
  },
  
  // Menu Items (Picture update)
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Edit Profile Form
  formGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: '#b32025',
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    shadowColor: '#b32025',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Themes
  themeOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  themeOptionTextActive: {
    color: '#b32025',
  },
});
