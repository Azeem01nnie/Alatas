import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, LayoutAnimation, Platform, UIManager, TextInput, ActivityIndicator, Alert } from 'react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { UserPlus, Settings, Trash2, Mail, Shield, UserCircle, X, AlertTriangle, Eye, EyeOff, UserCheck, UserMinus, Key, Briefcase, ChevronRight, CheckCircle, Search, Users } from 'lucide-react-native';

import { useTheme } from '../context/ThemeContext';
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../api/employees';
import { formatApiError } from '../api/client';
import { useConnectivity } from '../hooks/useConnectivity';
import { enqueueOfflineOp, flushOfflineQueue, getOfflineQueueLength } from '../utils/offlineQueue';

export default function EmployeeManageScreen() {
  const { theme, isDark } = useTheme();
  const { online } = useConnectivity();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [queueLength, setQueueLength] = useState(0);

  // Modals state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [confirmAddModalVisible, setConfirmAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);
  const [toggleStatusModalVisible, setToggleStatusModalVisible] = useState(false);
  const [changeRoleModalVisible, setChangeRoleModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalTitle, setSuccessModalTitle] = useState('');
  const [successModalDesc, setSuccessModalDesc] = useState('');

  // Form state for Add
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('Inspector');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Form state for Update
  const [updateRole, setUpdateRole] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');
  const [updateConfirmPassword, setUpdateConfirmPassword] = useState('');

  // Password Validation
  const isPasswordStrong = (pw) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(pw);
  };
  
  const getPasswordStrength = (pw) => {
    if (!pw) return null;
    let score = 0;
    if (pw.length > 5) score += 1;
    if (pw.length >= 8) score += 1;
    if (/[A-Z]/.test(pw)) score += 1;
    if (/[a-z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[@$!%*?&]/.test(pw)) score += 1;

    if (score < 3) return { text: 'Weak', color: '#ef4444', width: '33%' };
    if (score < 5) return { text: 'Fair', color: '#f59e0b', width: '66%' };
    return { text: 'Strong', color: '#10b981', width: '100%' };
  };
  
  const isFormValid = () => {
    return (
      newName.length > 0 &&
      newUsername.length > 0 &&
      newPhone.length === 10 &&
      newRole.length > 0 &&
      newPassword === confirmPassword &&
      isPasswordStrong(newPassword)
    );
  };

  const isUpdatePasswordValid = () => {
    return (
      updatePassword === updateConfirmPassword &&
      isPasswordStrong(updatePassword)
    );
  };

  const showSuccess = (title, desc) => {
    setTimeout(() => {
      setSuccessModalTitle(title);
      setSuccessModalDesc(desc);
      setSuccessModalVisible(true);
    }, 300);
  };

  const refreshQueueLength = useCallback(async () => {
    setQueueLength(await getOfflineQueueLength());
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      if (online) {
        await flushOfflineQueue({
          'employee-create': (payload) => createEmployee(payload),
          'employee-update': (payload) => updateEmployee(payload.id, payload.patch),
          'employee-delete': (payload) => deleteEmployee(payload.id),
        });
        await refreshQueueLength();
        const rows = await fetchEmployees();
        setEmployees(Array.isArray(rows) ? rows : []);
      } else {
        await refreshQueueLength();
      }
    } catch (err) {
      Alert.alert('Could not load employees', formatApiError(err, 'employees'));
    } finally {
      setLoading(false);
    }
  }, [online, refreshQueueLength]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const openSettingsMenu = (emp) => {
    setSelectedEmployee(emp);
    setSettingsMenuVisible(true);
  };

  const confirmToggleStatus = () => {
    setSettingsMenuVisible(false);
    setTimeout(() => setToggleStatusModalVisible(true), 150);
  };

  const openChangeRole = () => {
    setUpdateRole(selectedEmployee.role);
    setSettingsMenuVisible(false);
    setTimeout(() => setChangeRoleModalVisible(true), 150);
  };

  const openChangePassword = () => {
    setUpdatePassword('');
    setUpdateConfirmPassword('');
    setSettingsMenuVisible(false);
    setTimeout(() => setChangePasswordModalVisible(true), 150);
  };

  const executeToggleStatus = async () => {
    if (!selectedEmployee || saving) return;
    const wasActive = selectedEmployee.active;
    const id = selectedEmployee.id;
    setSaving(true);
    try {
      if (!online) {
        await enqueueOfflineOp({
          type: 'employee-update',
          payload: { id, patch: { active: !wasActive } },
        });
        await refreshQueueLength();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === id ? { ...emp, active: !wasActive } : emp)),
        );
      } else {
        const updated = await updateEmployee(id, { active: !wasActive });
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setEmployees((prev) => prev.map((emp) => (emp.id === updated.id ? updated : emp)));
      }
      setToggleStatusModalVisible(false);
      showSuccess(
        wasActive ? 'Account Frozen' : 'Account Activated',
        `The account has been successfully ${wasActive ? 'frozen' : 'activated'}.`,
      );
      setSelectedEmployee(null);
    } catch (err) {
      Alert.alert('Update failed', err?.message || 'Could not update employee status.');
    } finally {
      setSaving(false);
    }
  };

  const executeChangeRole = async () => {
    if (!selectedEmployee || !updateRole || saving) return;
    const id = selectedEmployee.id;
    setSaving(true);
    try {
      if (!online) {
        await enqueueOfflineOp({
          type: 'employee-update',
          payload: { id, patch: { role: updateRole } },
        });
        await refreshQueueLength();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === id ? { ...emp, role: updateRole } : emp)),
        );
      } else {
        const updated = await updateEmployee(id, { role: updateRole });
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setEmployees((prev) => prev.map((emp) => (emp.id === updated.id ? updated : emp)));
      }
      setChangeRoleModalVisible(false);
      showSuccess('Role Updated', `Employee's role has been successfully changed to ${updateRole}.`);
      setSelectedEmployee(null);
    } catch (err) {
      Alert.alert('Update failed', err?.message || 'Could not update role.');
    } finally {
      setSaving(false);
    }
  };

  const executeChangePassword = async () => {
    if (!selectedEmployee || !isUpdatePasswordValid() || saving) return;
    const id = selectedEmployee.id;
    setSaving(true);
    try {
      if (!online) {
        await enqueueOfflineOp({
          type: 'employee-update',
          payload: { id, patch: { password: updatePassword } },
        });
        await refreshQueueLength();
      } else {
        await updateEmployee(id, { password: updatePassword });
      }
      setChangePasswordModalVisible(false);
      setUpdatePassword('');
      setUpdateConfirmPassword('');
      showSuccess('Password Changed', 'The login credentials have been securely updated.');
      setSelectedEmployee(null);
    } catch (err) {
      Alert.alert('Update failed', err?.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (emp) => {
    setSelectedEmployee(emp);
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    if (!selectedEmployee || saving) return;
    const id = selectedEmployee.id;
    setSaving(true);
    try {
      if (!online) {
        await enqueueOfflineOp({ type: 'employee-delete', payload: { id } });
        await refreshQueueLength();
      } else {
        await deleteEmployee(id);
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      setDeleteModalVisible(false);
      showSuccess('Employee Removed', 'The employee account has been permanently removed from the system.');
      setSelectedEmployee(null);
    } catch (err) {
      Alert.alert('Delete failed', err?.message || 'Could not remove employee.');
    } finally {
      setSaving(false);
    }
  };

  const initiateAdd = () => {
    if (!isFormValid()) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setConfirmAddModalVisible(true);
  };

  const executeAdd = async () => {
    if (saving) return;
    const payload = {
      name: newName.trim(),
      username: newUsername.trim(),
      phone: '+63' + newPhone,
      active: true,
      role: newRole,
      password: newPassword,
    };
    setSaving(true);
    try {
      let created;
      if (!online) {
        created = {
          id: `local-${Date.now()}`,
          name: payload.name,
          username: payload.username,
          phone: payload.phone,
          active: true,
          role: payload.role,
          createdAt: new Date().toISOString(),
        };
        await enqueueOfflineOp({ type: 'employee-create', payload });
        await refreshQueueLength();
      } else {
        created = await createEmployee(payload);
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setEmployees((prev) => [created, ...prev.filter((emp) => emp.id !== created.id)]);

      setNewName('');
      setNewUsername('');
      setNewPhone('');
      setNewPassword('');
      setConfirmPassword('');
      setNewRole('Inspector');
      setShowPassword(false);
      setShowErrors(false);

      setConfirmAddModalVisible(false);
      setAddModalVisible(false);
      showSuccess(
        'Employee Added',
        online
          ? 'The new employee has been successfully added to the system.'
          : 'Saved offline and will sync when you are back online.',
      );
    } catch (err) {
      Alert.alert('Create failed', err?.message || 'Could not add employee.');
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) =>
      emp.name.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const activeCount = employees.filter((e) => e.active).length;
  const inactiveCount = employees.length - activeCount;

  const roleColor = (role) => {
    if (role === 'Manager') return '#8b5cf6';
    if (role === 'Inspector') return '#b32025';
    return '#64748b';
  };

  return (
    <>
    <ScreenLayout
      scroll
      contentContainerStyle={styles.scrollInner}
      header={
        <ScreenHeader style={{ paddingBottom: 14 }}>
          <View style={styles.headerTopRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: theme.textMain }]}>Employees</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>
              {loading
                ? 'Loading…'
                : `${employees.length} team members${!online ? ' · offline' : ''}${queueLength ? ` · ${queueLength} queued` : ''}`}
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)} activeOpacity={0.8}>
            <UserPlus color="#fff" size={18} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Search color={theme.textSub} size={18} />
          <TextInput
            style={[styles.searchInput, { color: theme.textMain }]}
            placeholder="Search by name, username, or role"
            placeholderTextColor={theme.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={theme.textSub} size={18} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5', borderColor: isDark ? '#065f46' : '#a7f3d0' }]}>
            <Users color="#10b981" size={14} />
            <Text style={[styles.statChipText, { color: '#10b981' }]}>{activeCount} active</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: isDark ? '#334155' : '#f1f5f9', borderColor: theme.border }]}>
            <Text style={[styles.statChipText, { color: theme.textSub }]}>{inactiveCount} inactive</Text>
          </View>
        </View>
        </ScreenHeader>
      }
    >
        {loading ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ActivityIndicator color="#b32025" size="large" />
            <Text style={[styles.emptyTitle, { color: theme.textMain }]}>Loading employees…</Text>
          </View>
        ) : filteredEmployees.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <UserCircle color={theme.textSub} size={48} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: theme.textMain }]}>
              {searchQuery ? 'No matches found' : 'No employees yet'}
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.textSub }]}>
              {searchQuery ? 'Try a different search term.' : 'Tap Add to create your first team member.'}
            </Text>
          </View>
        ) : filteredEmployees.map((employee) => (
          <View key={employee.id} style={[styles.employeeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTop}>
              <View style={styles.avatarContainer}>
                <View style={[styles.avatarCircle, { backgroundColor: theme.iconBg }]}>
                  <UserCircle color={theme.textSub} size={40} strokeWidth={1.5} />
                </View>
                <View style={[styles.statusIndicator, { backgroundColor: employee.active ? '#10b981' : '#94a3b8', borderColor: theme.card }]} />
              </View>
              <View style={styles.employeeInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.employeeName, { color: theme.textMain }]}>{employee.name}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: isDark ? '#450a0a' : '#fef2f2' }]}>
                    <Text style={[styles.roleBadgeText, { color: roleColor(employee.role) }]}>{employee.role}</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Mail color={theme.textSub} size={14} />
                  <Text style={[styles.employeeEmail, { color: theme.textSub }]}>@{employee.username}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Shield color={roleColor(employee.role)} size={14} />
                  <Text style={[styles.employeePhone, { color: theme.textSub }]}>{employee.phone}</Text>
                </View>
              </View>
            </View>
            
            <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
            
            <View style={styles.employeeActions}>
              <View style={[styles.statusToggleGroup, { backgroundColor: theme.iconBg }]}>
                <View style={[styles.statusDot, { backgroundColor: employee.active ? '#10b981' : '#94a3b8' }]} />
                <Text style={[styles.statusText, { color: employee.active ? '#10b981' : theme.textSub }]}>
                  {employee.active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity 
                  style={[styles.iconBtn, { backgroundColor: theme.iconBg, borderColor: theme.border }]} 
                  onPress={() => openSettingsMenu(employee)}
                >
                  <Settings color={theme.textSub} size={20} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, styles.deleteBtn, { borderColor: isDark ? '#7f1d1d' : '#fee2e2' }]} onPress={() => confirmDelete(employee)}>
                  <Trash2 color="#ef4444" size={20} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
    </ScreenLayout>

      {/* Floating Add Employee Modal */}
      <Modal
        visible={addModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Add New Employee</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textMain }]}>Full Name</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: showErrors && newName.length === 0 ? '#ef4444' : theme.border, color: theme.textMain }]} 
                  placeholder="e.g. Jane Doe"
                  placeholderTextColor="#cbd5e1"
                  value={newName}
                  onChangeText={setNewName}
                />
                {showErrors && newName.length === 0 && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Full Name is required</Text>}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textMain }]}>Username</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: showErrors && newUsername.length === 0 ? '#ef4444' : theme.border, color: theme.textMain }]} 
                  placeholder="e.g. janedoe"
                  placeholderTextColor="#cbd5e1"
                  autoCapitalize="none"
                  value={newUsername}
                  onChangeText={setNewUsername}
                />
                {showErrors && newUsername.length === 0 && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Username is required</Text>}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textMain }]}>Mobile Phone</Text>
                <View style={[styles.phoneInputContainer, { borderColor: showErrors && newPhone.length < 10 ? '#ef4444' : theme.border, backgroundColor: theme.bg }]}>
                  <View style={[styles.phonePrefixBox, { backgroundColor: theme.iconBg, borderRightColor: theme.border }]}>
                    <Text style={[styles.phonePrefixText, { color: theme.textSub }]}>+63</Text>
                  </View>
                  <TextInput 
                    style={[styles.phoneInput, { color: theme.textMain, backgroundColor: theme.bg }]} 
                    placeholder="900 000 0000"
                    placeholderTextColor="#cbd5e1"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={newPhone}
                    onChangeText={(text) => {
                      let sanitized = text.replace(/[^\d]/g, '');
                      if (sanitized.startsWith('0')) sanitized = sanitized.substring(1);
                      setNewPhone(sanitized);
                    }}
                  />
                </View>
                {showErrors && newPhone.length < 10 && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Valid 10-digit phone is required</Text>}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textMain }]}>Password</Text>
                <View style={[styles.passwordContainer, { backgroundColor: theme.bg, borderColor: showErrors && !isPasswordStrong(newPassword) ? '#ef4444' : theme.border }]}>
                  <TextInput 
                    style={[styles.passwordInput, { color: theme.textMain }]} 
                    placeholder="Strong password required"
                    placeholderTextColor="#cbd5e1"
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    {showPassword ? <EyeOff color="#94a3b8" size={20} /> : <Eye color="#94a3b8" size={20} />}
                  </TouchableOpacity>
                </View>
                
                {newPassword.length > 0 && (() => {
                  const strength = getPasswordStrength(newPassword);
                  return (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBarBg}>
                        <View style={[styles.strengthBarFill, { width: strength.width, backgroundColor: strength.color }]} />
                      </View>
                      <Text style={[styles.strengthText, { color: strength.color }]}>{strength.text} Password</Text>
                    </View>
                  );
                })()}

                {(showErrors || newPassword.length > 0) && !isPasswordStrong(newPassword) && (
                  <Text style={styles.helperTextError}>
                    Requires 8+ chars, uppercase, lowercase, number, and special character (@$!%*?&).
                  </Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textMain }]}>Confirm Password</Text>
                <View style={[styles.passwordContainer, { backgroundColor: theme.bg, borderColor: showErrors && newPassword !== confirmPassword ? '#ef4444' : theme.border }]}>
                  <TextInput 
                    style={[styles.passwordInput, { color: theme.textMain }]} 
                    placeholder="Repeat password"
                    placeholderTextColor="#cbd5e1"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
                {(showErrors || confirmPassword.length > 0) && newPassword !== confirmPassword && (
                  <Text style={styles.helperTextError}>Passwords do not match.</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textMain }]}>Role</Text>
                <View style={styles.roleContainer}>
                  {['Manager', 'Inspector', 'Staff'].map(role => (
                    <TouchableOpacity 
                      key={role}
                      style={[
                        styles.roleOption,
                        { backgroundColor: newRole === role ? (isDark ? '#450a0a' : '#fef2f2') : theme.iconBg, borderColor: newRole === role ? '#b32025' : 'transparent' },
                      ]}
                      onPress={() => setNewRole(role)}
                    >
                      <Text style={[styles.roleOptionText, { color: theme.textSub }, newRole === role && styles.roleOptionTextActive]}>
                        {role}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {showErrors && newRole.length === 0 && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Role is required</Text>}
              </View>
              
              <TouchableOpacity 
                style={styles.primaryActionBtn} 
                onPress={initiateAdd}
              >
                <Text style={styles.primaryActionBtnText}>Create Employee</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation to Add Modal */}
      <Modal
        visible={confirmAddModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmAddModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.warningIconContainer, { backgroundColor: '#fef2f2' }]}>
              <UserPlus color="#b32025" size={32} />
            </View>
            <Text style={[styles.deleteModalTitle, { color: theme.textMain }]}>Confirm Addition</Text>
            <Text style={[styles.deleteModalDesc, { color: theme.textSub }]}>
              You are about to add <Text style={{fontWeight: '700', color: theme.textMain}}>{newName}</Text> to the system as a <Text style={{fontWeight: '700', color: theme.textMain}}>{newRole}</Text>. Continue?
            </Text>
            
            <View style={styles.deleteActionRow}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { backgroundColor: theme.iconBg }]} 
                onPress={() => setConfirmAddModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Review Details</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmDeleteBtn, { backgroundColor: '#b32025', shadowColor: '#b32025' }]} 
                onPress={executeAdd}
              >
                <Text style={styles.confirmDeleteBtnText}>Yes, Add Employee</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Options Menu */}
      <Modal
        visible={settingsMenuVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSettingsMenuVisible(false)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Manage {selectedEmployee?.name}</Text>
              <TouchableOpacity onPress={() => setSettingsMenuVisible(false)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={openChangeRole}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#fef2f2' }]}>
                  <Briefcase color="#b32025" size={20} />
                </View>
                <View>
                  <Text style={[styles.menuItemTitle, { color: theme.textMain }]}>Change Role</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textSub }]}>Current: {selectedEmployee?.role}</Text>
                </View>
              </View>
              <ChevronRight color="#cbd5e1" size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={openChangePassword}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#f5f3ff' }]}>
                  <Key color="#8b5cf6" size={20} />
                </View>
                <View>
                  <Text style={[styles.menuItemTitle, { color: theme.textMain }]}>Change Password</Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textSub }]}>Update login credentials</Text>
                </View>
              </View>
              <ChevronRight color="#cbd5e1" size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={confirmToggleStatus}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: selectedEmployee?.active ? '#fff7ed' : '#ecfdf5' }]}>
                  {selectedEmployee?.active ? <UserMinus color="#ea580c" size={20} /> : <UserCheck color="#10b981" size={20} />}
                </View>
                <View>
                  <Text style={[styles.menuItemTitle, { color: theme.textMain }]}>
                    {selectedEmployee?.active ? 'Deactivate Account' : 'Activate Account'}
                  </Text>
                  <Text style={[styles.menuItemDesc, { color: theme.textSub }]}>
                    {selectedEmployee?.active ? 'Suspend system access' : 'Restore system access'}
                  </Text>
                </View>
              </View>
              <ChevronRight color="#cbd5e1" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        visible={changeRoleModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setChangeRoleModalVisible(false)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Change Role</Text>
              <TouchableOpacity onPress={() => setChangeRoleModalVisible(false)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textMain }]}>Select New Role for {selectedEmployee?.name}</Text>
              <View style={styles.roleContainer}>
                {['Manager', 'Inspector', 'Staff'].map(role => (
                  <TouchableOpacity 
                    key={role}
                    style={[
                      styles.roleOption,
                      { backgroundColor: updateRole === role ? (isDark ? '#450a0a' : '#fef2f2') : theme.iconBg, borderColor: updateRole === role ? '#b32025' : 'transparent' },
                    ]}
                    onPress={() => setUpdateRole(role)}
                  >
                    <Text style={[styles.roleOptionText, { color: theme.textSub }, updateRole === role && styles.roleOptionTextActive]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.primaryActionBtn, (!updateRole || updateRole === selectedEmployee?.role) && styles.primaryActionBtnDisabled]} 
              onPress={executeChangeRole}
              disabled={!updateRole || updateRole === selectedEmployee?.role}
            >
              <Text style={styles.primaryActionBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setChangePasswordModalVisible(false)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePasswordModalVisible(false)} style={[styles.closeIcon, { backgroundColor: theme.iconBg }]}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textMain }]}>New Password</Text>
              <View style={[styles.passwordContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <TextInput 
                  style={[styles.passwordInput, { color: theme.textMain }]} 
                  placeholder="Enter new password"
                  placeholderTextColor="#cbd5e1"
                  secureTextEntry={!showPassword}
                  value={updatePassword}
                  onChangeText={setUpdatePassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  {showPassword ? <EyeOff color="#94a3b8" size={20} /> : <Eye color="#94a3b8" size={20} />}
                </TouchableOpacity>
              </View>

              {updatePassword.length > 0 && (() => {
                const strength = getPasswordStrength(updatePassword);
                return (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBarBg}>
                      <View style={[styles.strengthBarFill, { width: strength.width, backgroundColor: strength.color }]} />
                    </View>
                    <Text style={[styles.strengthText, { color: strength.color }]}>{strength.text} Password</Text>
                  </View>
                );
              })()}

              {updatePassword.length > 0 && !isPasswordStrong(updatePassword) && (
                <Text style={styles.helperTextError}>
                  Requires 8+ chars, uppercase, lowercase, number, and special character.
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textMain }]}>Confirm New Password</Text>
              <View style={[styles.passwordContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <TextInput 
                  style={[styles.passwordInput, { color: theme.textMain }]} 
                  placeholder="Repeat new password"
                  placeholderTextColor="#cbd5e1"
                  secureTextEntry={!showPassword}
                  value={updateConfirmPassword}
                  onChangeText={setUpdateConfirmPassword}
                />
              </View>
              {updateConfirmPassword.length > 0 && updatePassword !== updateConfirmPassword && (
                <Text style={styles.helperTextError}>Passwords do not match.</Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={[styles.primaryActionBtn, !isUpdatePasswordValid() && styles.primaryActionBtnDisabled]} 
              onPress={executeChangePassword}
              disabled={!isUpdatePasswordValid()}
            >
              <Text style={styles.primaryActionBtnText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings (Toggle Active) Modal */}
      <Modal
        visible={toggleStatusModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setToggleStatusModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.warningIconContainer, { backgroundColor: selectedEmployee?.active ? '#fff7ed' : '#ecfdf5' }]}>
              {selectedEmployee?.active ? (
                <UserMinus color="#ea580c" size={32} />
              ) : (
                <UserCheck color="#10b981" size={32} />
              )}
            </View>
            <Text style={[styles.deleteModalTitle, { color: theme.textMain }]}>
              {selectedEmployee?.active ? 'Freeze Account?' : 'Activate Account?'}
            </Text>
            <Text style={[styles.deleteModalDesc, { color: theme.textSub }]}>
              {selectedEmployee?.active 
                ? `Are you sure you want to deactivate ${selectedEmployee?.name}? They will lose access to the system immediately.`
                : `Are you sure you want to activate ${selectedEmployee?.name}? They will regain full access to the system.`
              }
            </Text>
            
            <View style={styles.deleteActionRow}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { backgroundColor: theme.iconBg }]} 
                onPress={() => setToggleStatusModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmDeleteBtn, { backgroundColor: selectedEmployee?.active ? '#f97316' : '#10b981', shadowColor: selectedEmployee?.active ? '#f97316' : '#10b981' }]} 
                onPress={executeToggleStatus}
              >
                <Text style={styles.confirmDeleteBtnText}>
                  {selectedEmployee?.active ? 'Deactivate' : 'Activate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modern Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.warningIconContainer}>
              <AlertTriangle color="#ef4444" size={32} />
            </View>
            <Text style={[styles.deleteModalTitle, { color: theme.textMain }]}>Remove Employee?</Text>
            <Text style={[styles.deleteModalDesc, { color: theme.textSub }]}>
              Are you absolutely sure you want to remove <Text style={{fontWeight: '700', color: theme.textMain}}>{selectedEmployee?.name}</Text> from the team? This action cannot be undone.
            </Text>
            
            <View style={styles.deleteActionRow}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { backgroundColor: theme.iconBg }]} 
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmDeleteBtn} 
                onPress={executeDelete}
              >
                <Text style={styles.confirmDeleteBtnText}>Yes, Remove</Text>
              </TouchableOpacity>
            </View>
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
        <View style={[styles.centerModalOverlay, { padding: 20 }]}>
          <View style={[styles.centerModalContent, { backgroundColor: theme.card, padding: 32, alignItems: 'center' }]}>
            <View style={[
              { backgroundColor: '#d1fae5', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }
            ]}>
              <CheckCircle color="#10b981" size={32} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain, textAlign: 'center', marginBottom: 12, fontSize: 22, fontWeight: '800' }]}>
              {successModalTitle}
            </Text>
            <Text style={[styles.modalDesc, { color: theme.textSub, textAlign: 'center', marginBottom: 28, fontSize: 15 }]}>
              {successModalDesc}
            </Text>
            <TouchableOpacity 
              style={[{ backgroundColor: '#10b981', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }]} 
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b32025',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#b32025',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  container: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  employeeCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  employeeInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  employeeName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  employeeEmail: {
    fontSize: 14,
    color: '#64748b',
  },
  employeePhone: {
    fontSize: 13,
  },
  cardDivider: {
    height: 1,
    marginVertical: 14,
  },
  employeeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtn: {
    backgroundColor: '#fef2f2',
  },
  
  // Floating Center Modal
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  closeIcon: {
    padding: 6,
    borderRadius: 20,
  },
  formScroll: {
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  phonePrefixBox: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  phonePrefixText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  phoneInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 14,
  },
  helperTextError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleOptionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  roleOptionTextActive: {
    color: '#b32025',
  },
  primaryActionBtn: {
    backgroundColor: '#b32025',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#b32025',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryActionBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Delete / Settings Modal
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
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
  warningIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  deleteModalDesc: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  deleteActionRow: {
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
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmDeleteBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Settings Bottom Menu Styles
  bottomModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomModalContent: {
    backgroundColor: '#ffffff',
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  menuItemDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  strengthContainer: {
    marginTop: 12,
    gap: 6,
  },
  strengthBarBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
});
