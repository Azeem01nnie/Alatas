import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, Modal, ActivityIndicator, TextInput, Platform, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, Phone, LogOut, Camera, MonitorSmartphone, Palette, ChevronRight, X, RefreshCw, Image as ImageIcon, Trash2, Save, CheckCircle2 } from 'lucide-react-native';

import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen() {
  const { activeTheme, setActiveTheme, isDark, theme } = useTheme();

  const [profileImage, setProfileImage] = useState(null);
  
  // Profile Data
  const [profileData, setProfileData] = useState({
    name: 'Administrator',
    email: 'admin@alatas.com',
    phone: '+63 900 123 4567'
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({ ...profileData });

  const [lastSynced, setLastSynced] = useState(null);
  
  // Modals
  const [syncConfirmVisible, setSyncConfirmVisible] = useState(false);
  const [syncLoadingVisible, setSyncLoadingVisible] = useState(false);
  const [syncSuccessVisible, setSyncSuccessVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [pictureModalVisible, setPictureModalVisible] = useState(false);
  
  const handleUpdatePicture = () => {
    setPictureModalVisible(true);
  };

  const setPhoto = (uri) => {
    setProfileImage(uri);
    setPictureModalVisible(false);
  };

  const initiateSync = () => {
    setSyncConfirmVisible(true);
  };

  const confirmSync = () => {
    setSyncConfirmVisible(false);
    setTimeout(() => {
      setSyncLoadingVisible(true);
      setTimeout(() => {
        setSyncLoadingVisible(false);
        setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setTimeout(() => {
          setSyncSuccessVisible(true);
        }, 300);
      }, 2000);
    }, 400);
  };

  const openEditProfile = () => {
    setEditForm({ ...profileData });
    setEditModalVisible(true);
  };

  const saveProfile = () => {
    if (!editForm.name || !editForm.email || !editForm.phone) {
      Alert.alert("Validation Error", "All fields are required.");
      return;
    }
    setProfileData(editForm);
    setEditModalVisible(false);
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    DeviceEventEmitter.emit('logout');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Administrator Profile</Text>
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Profile Card */}
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleUpdatePicture} activeOpacity={0.8}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <User color="#fff" size={48} strokeWidth={1.5} />
            )}
            <View style={styles.cameraBadge}>
              <Camera color="#fff" size={14} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.name, { color: theme.textMain }]}>{profileData.name}</Text>
          <Text style={styles.role}>@alatas_admin</Text>
        </View>

        {/* Contact Info */}
        <View style={[styles.sectionBlock, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Contact Information</Text>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: theme.iconBg }]}>
              <Mail color="#64748b" size={18} />
            </View>
            <Text style={[styles.infoText, { color: theme.textMain }]}>{profileData.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: theme.iconBg }]}>
              <Phone color="#64748b" size={18} />
            </View>
            <Text style={[styles.infoText, { color: theme.textMain }]}>{profileData.phone}</Text>
          </View>
        </View>

        {/* Settings & Features */}
        <View style={[styles.sectionBlock, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Settings</Text>
          
          <TouchableOpacity style={styles.settingRow} onPress={initiateSync}>
            <View style={styles.settingRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: '#eff6ff' }]}>
                <MonitorSmartphone color="#3b82f6" size={18} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.textMain }]}>Sync to Desktop</Text>
                <Text style={[styles.settingDesc, { color: theme.textSub }]}>
                  {lastSynced ? `Last synced: ${lastSynced}` : 'Tap to sync data'}
                </Text>
              </View>
            </View>
            <RefreshCw color="#3b82f6" size={20} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <TouchableOpacity style={styles.settingRow} onPress={() => setThemeModalVisible(true)}>
            <View style={styles.settingRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: '#f5f3ff' }]}>
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
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={openEditProfile}>
            <Text style={[styles.actionButtonText, { color: theme.textMain }]}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
            <LogOut color="#ef4444" size={20} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Sync Confirmation Modal */}
      <Modal
        visible={syncConfirmVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSyncConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconBox, { backgroundColor: '#eff6ff' }]}>
              <MonitorSmartphone color="#3b82f6" size={32} />
            </View>
            <Text style={styles.modalTitle}>Enable Desktop Sync?</Text>
            <Text style={styles.modalDesc}>
              This will securely synchronize logs and employee data with your authorized desktop device in real-time.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSyncConfirmVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
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
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Synchronizing Data...</Text>
            <Text style={styles.loadingSubtext}>Please do not close the app.</Text>
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

            <TouchableOpacity style={styles.menuItem} onPress={() => setPhoto('https://i.pravatar.cc/300?img=11')}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#eff6ff' }]}>
                  <ImageIcon color="#3b82f6" size={20} />
                </View>
                <Text style={[styles.menuItemTitle, { color: theme.textMain }]}>Choose from Gallery</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => setPhoto('https://i.pravatar.cc/300?img=12')}>
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
              Your mobile data has been fully synchronized with the desktop application in real-time.
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
              <Text style={[styles.inputLabel, { color: theme.textMain }]}>Full Name</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.textMain, width: '100%' }]} 
                value={editForm.name}
                onChangeText={(t) => setEditForm({ ...editForm, name: t })}
              />
            </View>

            <View style={[styles.formGroup, { width: '100%' }]}>
              <Text style={[styles.inputLabel, { color: theme.textMain }]}>Email / Username</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.textMain, width: '100%' }]} 
                value={editForm.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(t) => setEditForm({ ...editForm, email: t })}
              />
            </View>

            <View style={[styles.formGroup, { width: '100%' }]}>
              <Text style={[styles.inputLabel, { color: theme.textMain }]}>Phone Number</Text>
              <View style={[styles.phoneInputContainer, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                <View style={[styles.phonePrefixBox, { backgroundColor: theme.iconBg, borderRightColor: theme.border }]}>
                  <Text style={[styles.phonePrefixText, { color: theme.textSub }]}>+63</Text>
                </View>
                <TextInput 
                  style={[styles.phoneInput, { backgroundColor: theme.bg, color: theme.textMain }]} 
                  value={editForm.phone}
                  placeholder="900 000 0000"
                  placeholderTextColor={theme.textSub}
                  keyboardType="phone-pad"
                  maxLength={10}
                  onChangeText={(text) => {
                    let sanitized = text.replace(/[^\d]/g, '');
                    if (sanitized.startsWith('0')) sanitized = sanitized.substring(1);
                    setEditForm({ ...editForm, phone: sanitized });
                  }}
                />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, { width: '100%' }]} onPress={() => {
              saveProfile();
              setEditModalVisible(false);
              setTimeout(() => {
                setSyncSuccessVisible(true);
              }, 300);
            }}>
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
            <View style={[styles.themeOptionsRow, { width: '100%', justifyContent: 'flex-start' }]}>
              {['Light', 'Dark', 'System Default'].map((t) => (
                <TouchableOpacity 
                  key={t}
                  style={[styles.themeOptionBtn, activeTheme === t && styles.themeOptionActive, { backgroundColor: activeTheme === t ? '#eff6ff' : theme.bg }]}
                  onPress={() => {
                    setActiveTheme(t);
                    setThemeModalVisible(false);
                  }}
                >
                  <Text style={[styles.themeOptionText, activeTheme === t && styles.themeOptionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
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
              Are you sure you want to securely log out of your administrator account? You will need to sign in again.
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogoutModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#ef4444', shadowColor: '#ef4444' }]} onPress={confirmLogout}>
                <Text style={styles.confirmBtnText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  container: {
    flex: 1,
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
    backgroundColor: '#3b82f6',
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
    color: '#3b82f6',
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: '80%',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 20,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748b',
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
    color: '#0f172a',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  modalDesc: {
    fontSize: 15,
    color: '#64748b',
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
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    shadowColor: '#3b82f6',
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
    borderBottomColor: '#f1f5f9',
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
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    shadowColor: '#3b82f6',
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
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionActive: {
    borderColor: '#3b82f6',
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  themeOptionTextActive: {
    color: '#3b82f6',
  },
});
