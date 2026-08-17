import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { UserPlus, Settings, Trash2 } from 'lucide-react-native';

const mockEmployees = [
  { id: '1', name: 'John Doe', email: 'john@alatas.com', active: true, role: 'Inspector' },
  { id: '2', name: 'Sarah Smith', email: 'sarah@alatas.com', active: true, role: 'Manager' },
  { id: '3', name: 'Mike Ross', email: 'mike@alatas.com', active: false, role: 'Inspector' },
];

export default function EmployeeManageScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Employees</Text>
        <TouchableOpacity style={styles.addButton}>
          <UserPlus color="#fff" size={20} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollInner}>
        {mockEmployees.map((employee) => (
          <View key={employee.id} style={styles.employeeCard}>
            <View style={styles.employeeInfo}>
              <Text style={styles.employeeName}>{employee.name}</Text>
              <Text style={styles.employeeEmail}>{employee.email}</Text>
              <Text style={styles.employeeRole}>{employee.role}</Text>
            </View>
            <View style={styles.employeeActions}>
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>{employee.active ? 'Active' : 'Inactive'}</Text>
                <Switch 
                  value={employee.active} 
                  trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                  thumbColor={employee.active ? '#3b82f6' : '#f1f5f9'}
                />
              </View>
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity style={styles.iconButton}>
                  <Settings color="#64748b" size={20} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconButton, styles.deleteButton]}>
                  <Trash2 color="#ef4444" size={20} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  container: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
  },
  employeeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  employeeEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  employeeRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  employeeActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  iconButton: {
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
});
