import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal,
} from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import {
  Wrench, Hash, CheckCircle, Key, X, Building2, Car, Cog,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import {
  displayStatusLabel,
  formatOwnershipLabel,
  getVehicleDisplayStatus,
} from '../utils/vehicleMapper';

function DetailRow({ icon: Icon, label, value, theme }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: theme.iconBg }]}>
        <Icon color={theme.textSub} size={20} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.textSub }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.textMain }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function statusStyles(status) {
  if (status === 'On Rent') {
    return { bg: styles.badgeRentedBg, text: styles.badgeRentedText };
  }
  if (status === 'Maintenance') {
    return { bg: styles.badgeMaintenanceBg, text: styles.badgeMaintenanceText };
  }
  if (status === 'Scheduled') {
    return { bg: styles.badgeScheduledBg, text: styles.badgeScheduledText };
  }
  return { bg: styles.badgeAvailableBg, text: styles.badgeAvailableText };
}

export default function CarDetailsScreen({ route }) {
  const { theme } = useTheme();
  const { vehicles, rentals, updateVehicleStatus } = useFleet();
  const routeCar = route.params?.car;

  const car = useMemo(
    () => vehicles.find((v) => String(v.id) === String(routeCar?.id)) || routeCar,
    [vehicles, routeCar],
  );

  const displayStatus = useMemo(
    () => getVehicleDisplayStatus(car, rentals),
    [car, rentals],
  );

  const ownershipLabel = useMemo(
    () => formatOwnershipLabel(car),
    [car],
  );

  const statusStyle = statusStyles(displayStatus);
  const statusText = displayStatusLabel(displayStatus);

  const [isStatusModalVisible, setStatusModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const applyStatus = async (label) => {
    setSaving(true);
    setStatusModalVisible(false);
    try {
      await updateVehicleStatus(car, label);
      setSuccessModalMessage(`Vehicle marked as ${label}`);
      setSuccessModalVisible(true);
    } catch (err) {
      setSuccessModalMessage(err?.message || 'Could not update status');
      setSuccessModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  if (!car) {
    return (
      <ScreenLayout scroll contentContainerStyle={styles.container}>
        <Text style={{ color: theme.textSub }}>Vehicle not found.</Text>
      </ScreenLayout>
    );
  }

  return (
    <>
      <ScreenLayout
        scroll
        edges={['left', 'right', 'bottom']}
        padTabBar={false}
        contentContainerStyle={styles.scrollContent}
      >
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
            <View style={[styles.statusBadgeOverlay, statusStyle.bg]}>
              <Text style={[styles.statusBadgeText, statusStyle.text]}>{statusText}</Text>
            </View>
          </View>

          <View style={[styles.cardBody, { borderTopColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textMain }]}>{car.make} — {car.series || car.model}</Text>
            <Text style={[styles.cardPlate, { color: theme.textSub }]}>{car.plate}</Text>
            <View style={styles.cardFacts}>
              <View style={[styles.factBadge, { backgroundColor: theme.bg }]}>
                <Text style={[styles.factText, { color: theme.textSub }]}>{car.seats || 5} seats</Text>
              </View>
              <Text style={[styles.factDot, { color: theme.border }]}>•</Text>
              <View style={[styles.factBadge, { backgroundColor: theme.bg }]}>
                <Text style={[styles.factText, { color: theme.textSub }]}>{car.transmission || 'Automatic'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Vehicle details</Text>
          <DetailRow icon={Car} label="Make" value={car.make} theme={theme} />
          <DetailRow icon={Car} label="Series" value={car.series || car.model} theme={theme} />
          <DetailRow icon={Hash} label="License plate" value={car.plate} theme={theme} />
          <DetailRow icon={Hash} label="Body type" value={car.bodyType || '—'} theme={theme} />
          <DetailRow icon={Cog} label="Engine no." value={car.engineNo} theme={theme} />
          <DetailRow icon={Cog} label="Chassis no." value={car.chassisNo} theme={theme} />
          <DetailRow icon={Building2} label="Ownership" value={ownershipLabel} theme={theme} />
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButtonPrimary, { flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
            onPress={() => setStatusModalVisible(true)}
          >
            <Key color="#ffffff" size={20} />
            <Text style={styles.actionButtonPrimaryText}>Update Status</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>

      <Modal visible={isStatusModalVisible} animationType="fade" transparent onRequestClose={() => setStatusModalVisible(false)}>
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
              {['Available', 'Rented', 'Maintenance'].map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.statusOptionCard, { borderColor: theme.border, backgroundColor: theme.bg }]}
                  onPress={() => applyStatus(label)}
                  disabled={saving}
                >
                  <View style={[styles.statusOptionIcon, statusStyles(label === 'Rented' ? 'On Rent' : label).bg]}>
                    {label === 'Available' ? <CheckCircle color="#059669" size={24} /> : null}
                    {label === 'Rented' ? <Key color="#4338ca" size={24} /> : null}
                    {label === 'Maintenance' ? <Wrench color="#dc2626" size={24} /> : null}
                  </View>
                  <View style={styles.statusOptionTextContainer}>
                    <Text style={[styles.statusOptionTitle, { color: theme.textMain }]}>{label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={successModalVisible} animationType="fade" transparent onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, padding: 32, alignItems: 'center', borderRadius: 24 }]}>
            <View style={styles.successIcon}>
              <CheckCircle color="#10b981" size={32} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textMain, textAlign: 'center', marginBottom: 12 }]}>Success</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSub, textAlign: 'center', marginBottom: 28 }]}>
              {successModalMessage}
            </Text>
            <TouchableOpacity style={[styles.actionButtonPrimary, { width: '100%' }]} onPress={() => setSuccessModalVisible(false)}>
              <Text style={styles.actionButtonPrimaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 120 },
  container: { padding: 16 },
  mainCard: {
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  carImage: { width: '100%', height: '100%' },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 24, fontWeight: 'bold' },
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
  badgeScheduledBg: { backgroundColor: '#fef3c7' },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },
  badgeAvailableText: { color: '#059669' },
  badgeRentedText: { color: '#4338ca' },
  badgeMaintenanceText: { color: '#dc2626' },
  badgeScheduledText: { color: '#d97706' },
  cardBody: { padding: 20, borderTopWidth: 1 },
  cardTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  cardPlate: { fontSize: 15, fontWeight: '500', marginBottom: 16 },
  cardFacts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  factBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  factText: { fontSize: 13, fontWeight: '600' },
  factDot: { marginHorizontal: 8, fontWeight: 'bold' },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 13, marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  actionsContainer: { gap: 12, marginBottom: 80 },
  actionButtonPrimary: {
    backgroundColor: '#b32025',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: { borderRadius: 24, padding: 24 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  modalSubtitle: { fontSize: 15, marginBottom: 24 },
  statusOptionsContainer: { gap: 12 },
  statusOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusOptionTextContainer: { flex: 1 },
  statusOptionTitle: { fontSize: 16, fontWeight: '700' },
  successIcon: {
    backgroundColor: '#d1fae5',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
});
