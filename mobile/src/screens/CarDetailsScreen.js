import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Wrench, User, Hash, CheckCircle, Key, X, Clock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function CarDetailsScreen({ route }) {
  const { theme } = useTheme();
  const { car } = route.params;
  const [isStatusModalVisible, setStatusModalVisible] = useState(false);
  const [isHistoryModalVisible, setHistoryModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <ScrollView style={styles.container}>
        
        {/* Main Vehicle Card matching Desktop Frontend */}
        <View style={[styles.mainCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.mediaContainer, { backgroundColor: theme.bg }]}>
            {car.image ? (
              <Image source={car.image} style={styles.carImage} resizeMode="contain" />
            ) : (
              <View style={[styles.placeholderImage, { backgroundColor: theme.border }]}>
                <Text style={[styles.placeholderText, { color: theme.textSub }]}>
                  {car.make?.charAt(0)}{car.model?.charAt(0)}
                </Text>
              </View>
            )}
            <View style={[
              styles.statusBadgeOverlay,
              car.status === 'Available' ? styles.badgeAvailableBg :
              car.status === 'Rented' ? styles.badgeRentedBg : styles.badgeMaintenanceBg
            ]}>
              <Text style={[
                styles.statusBadgeText,
                car.status === 'Available' ? styles.badgeAvailableText :
                car.status === 'Rented' ? styles.badgeRentedText : styles.badgeMaintenanceText
              ]}>
                {car.status}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: theme.textMain }]}>{car.make} — {car.model}</Text>
            <Text style={[styles.cardPlate, { color: theme.textSub }]}>{car.plate}</Text>
            
            <View style={styles.cardFacts}>
              <View style={[styles.factBadge, { backgroundColor: theme.bg }]}><Text style={[styles.factText, { color: theme.textSub }]}>{car.seats || 5} seats</Text></View>
              <Text style={[styles.factDot, { color: theme.border }]}>•</Text>
              <View style={[styles.factBadge, { backgroundColor: theme.bg }]}><Text style={[styles.factText, { color: theme.textSub }]}>{car.transmission || 'Automatic'}</Text></View>
              <Text style={[styles.factDot, { color: theme.border }]}>•</Text>
              <View style={[styles.factBadge, { backgroundColor: theme.bg }]}><Text style={[styles.factText, { color: theme.textSub }]}>{car.bodyType || 'Sedan'}</Text></View>
            </View>
          </View>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Rental Information</Text>
          
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.iconBg }]}>
              <Hash color={theme.textSub} size={20} />
            </View>
            <View>
              <Text style={[styles.infoLabel, { color: theme.textSub }]}>License Plate</Text>
              <Text style={[styles.infoValue, { color: theme.textMain }]}>{car.plate}</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.iconBg }]}>
              <Calendar color={theme.textSub} size={20} />
            </View>
            <View>
              <Text style={[styles.infoLabel, { color: theme.textSub }]}>Status Details</Text>
              {car.status === 'Rented' && <Text style={[styles.infoValue, { color: theme.textMain }]}>Return Date: {car.returnDate} {car.returnTime ? `at ${car.returnTime}` : ''}</Text>}
              {car.status === 'Maintenance' && <Text style={[styles.infoValue, { color: theme.textMain }]}>Expected Ready: {car.expectedReady} {car.readyTime ? `at ${car.readyTime}` : ''}</Text>}
              {car.status === 'Available' && <Text style={[styles.infoValue, { color: theme.textMain }]}>Ready for deployment</Text>}
            </View>
          </View>

          {car.renter && (
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: theme.iconBg }]}>
                <User color={theme.textSub} size={20} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: theme.textSub }]}>Current Renter</Text>
                <Text style={[styles.infoValue, { color: theme.textMain }]}>{car.renter}</Text>
              </View>
            </View>
          )}

          {car.issue && (
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: theme.iconBg }]}>
                <Wrench color={theme.textSub} size={20} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: theme.textSub }]}>Reported Issue</Text>
                <Text style={[styles.infoValue, { color: theme.textMain }]}>{car.issue}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButtonPrimary, { flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
            onPress={() => setStatusModalVisible(true)}
          >
            <Key color="#ffffff" size={20} />
            <Text style={styles.actionButtonPrimaryText}>Update Status</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButtonSecondary, { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: theme.bg, borderColor: theme.border }]}
            onPress={() => setHistoryModalVisible(true)}
          >
            <Clock color={theme.textMain} size={20} />
            <Text style={[styles.actionButtonSecondaryText, { color: theme.textMain }]}>View History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Interactive Status Update Modal */}
      <Modal
        visible={isStatusModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Update Status</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: theme.textSub }]}>Select a new status for this vehicle.</Text>
            
            <View style={styles.statusOptionsContainer}>
              <TouchableOpacity 
                style={[styles.statusOptionCard, { borderColor: theme.border, backgroundColor: theme.bg }]} 
                onPress={() => {
                  setStatusModalVisible(false);
                  setTimeout(() => {
                    setSuccessModalMessage("Vehicle marked as Available");
                    setSuccessModalVisible(true);
                  }, 300);
                }}
              >
                <View style={[styles.statusOptionIcon, styles.badgeAvailableBg]}>
                  <CheckCircle color="#059669" size={24} />
                </View>
                <View style={styles.statusOptionTextContainer}>
                  <Text style={[styles.statusOptionTitle, { color: theme.textMain }]}>Available</Text>
                  <Text style={[styles.statusOptionDesc, { color: theme.textSub }]}>Vehicle is ready for deployment</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statusOptionCard, { borderColor: theme.border, backgroundColor: theme.bg }]} 
                onPress={() => {
                  setStatusModalVisible(false);
                  setTimeout(() => {
                    setSuccessModalMessage("Vehicle marked as Rented");
                    setSuccessModalVisible(true);
                  }, 300);
                }}
              >
                <View style={[styles.statusOptionIcon, styles.badgeRentedBg]}>
                  <Key color="#4338ca" size={24} />
                </View>
                <View style={styles.statusOptionTextContainer}>
                  <Text style={[styles.statusOptionTitle, { color: theme.textMain }]}>Rented</Text>
                  <Text style={[styles.statusOptionDesc, { color: theme.textSub }]}>Currently out with a customer</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statusOptionCard, { borderColor: theme.border, backgroundColor: theme.bg }]} 
                onPress={() => {
                  setStatusModalVisible(false);
                  setTimeout(() => {
                    setSuccessModalMessage("Vehicle marked as Maintenance");
                    setSuccessModalVisible(true);
                  }, 300);
                }}
              >
                <View style={[styles.statusOptionIcon, styles.badgeMaintenanceBg]}>
                  <Wrench color="#dc2626" size={24} />
                </View>
                <View style={styles.statusOptionTextContainer}>
                  <Text style={[styles.statusOptionTitle, { color: theme.textMain }]}>Maintenance</Text>
                  <Text style={[styles.statusOptionDesc, { color: theme.textSub }]}>In the shop for repairs or service</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Service History Modal */}
      <Modal
        visible={isHistoryModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Service History</Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <X color={theme.textSub} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: theme.textSub }]}>Recent maintenance records for {car.plate}</Text>
            
            <View style={styles.historyTimeline}>
              <View style={styles.historyItem}>
                <View style={[styles.historyIconContainer, { backgroundColor: theme.iconBg }]}>
                  <Wrench color="#3b82f6" size={20} />
                </View>
                <View style={[styles.historyContent, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.historyTitle, { color: theme.textMain }]}>Routine Maintenance</Text>
                  <Text style={[styles.historyDesc, { color: theme.textSub }]}>Oil change, fluid check, and tire rotation.</Text>
                  <View style={styles.historyDateRow}>
                    <Clock color={theme.textSub} size={14} />
                    <Text style={[styles.historyDate, { color: theme.textSub }]}>Aug 10, 2026</Text>
                  </View>
                </View>
              </View>

              <View style={styles.historyItem}>
                <View style={[styles.historyIconContainer, { backgroundColor: theme.iconBg }]}>
                  <Wrench color="#3b82f6" size={20} />
                </View>
                <View style={[styles.historyContent, { borderBottomColor: 'transparent' }]}>
                  <Text style={[styles.historyTitle, { color: theme.textMain }]}>Brake Inspection</Text>
                  <Text style={[styles.historyDesc, { color: theme.textSub }]}>Replaced front brake pads and checked rotors.</Text>
                  <View style={styles.historyDateRow}>
                    <Clock color={theme.textSub} size={14} />
                    <Text style={[styles.historyDate, { color: theme.textSub }]}>Jun 22, 2026</Text>
                  </View>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.modalCloseButton, { backgroundColor: theme.bg }]} 
              onPress={() => setHistoryModalVisible(false)}
            >
              <Text style={[styles.modalCloseButtonText, { color: theme.textMain }]}>Done</Text>
            </TouchableOpacity>
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
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, padding: 32, alignItems: 'center', borderRadius: 24 }]}>
            <View style={[
              { backgroundColor: '#d1fae5', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }
            ]}>
              <CheckCircle color="#10b981" size={32} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain, textAlign: 'center', marginBottom: 12, fontSize: 22, fontWeight: '800' }]}>
              Success
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSub, textAlign: 'center', marginBottom: 28, fontSize: 15 }]}>
              {successModalMessage}
            </Text>
            <TouchableOpacity 
              style={[styles.actionButtonPrimary, { width: '100%' }]} 
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={styles.actionButtonPrimaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  mediaContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#f8fafc',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  statusBadgeOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeAvailableBg: { backgroundColor: '#d1fae5' },
  badgeRentedBg: { backgroundColor: '#e0e7ff' },
  badgeMaintenanceBg: { backgroundColor: '#fee2e2' },
  
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeAvailableText: { color: '#059669' },
  badgeRentedText: { color: '#4338ca' },
  badgeMaintenanceText: { color: '#dc2626' },

  cardBody: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardPlate: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 16,
  },
  cardFacts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  factBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  factText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  factDot: {
    marginHorizontal: 8,
    color: '#cbd5e1',
    fontWeight: 'bold',
  },
  
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 60,
  },
  actionButtonPrimary: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonSecondaryText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  statusOptionsContainer: {
    gap: 12,
  },
  statusOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusOptionTextContainer: {
    flex: 1,
  },
  statusOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  statusOptionDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  historyTimeline: {
    gap: 20,
    marginBottom: 24,
  },
  historyItem: {
    flexDirection: 'row',
  },
  historyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  historyContent: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  historyDesc: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 6,
  },
  modalCloseButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
});
