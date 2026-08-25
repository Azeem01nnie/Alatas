import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator,
} from 'react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { Camera, ImagePlus, Upload, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';

export default function EmployeeCameraScreen() {
  const { theme } = useTheme();
  const { vehicles, submitPending, online, queueLength } = useFleet();
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId],
  );

  const pickImage = async (useCamera) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera or gallery access is required.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    }
  };

  const handleSubmit = async () => {
    if (!selectedVehicle) {
      Alert.alert('Select vehicle', 'Choose a vehicle from the fleet list.');
      return;
    }
    if (!photoBase64) {
      Alert.alert('Photo required', 'Capture or upload an inspection photo.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicleId: selectedVehicle.id,
        vehicle: selectedVehicle._raw || {
          id: selectedVehicle.id,
          make: selectedVehicle.make,
          series: selectedVehicle.model,
          plateNo: selectedVehicle.plate,
        },
        personal: {
          firstName: 'Field',
          lastName: 'Employee',
          notes: remarks.trim(),
        },
        rental: {
          periodFrom: new Date().toISOString(),
          periodTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          notes: remarks.trim(),
          remarks: remarks.trim(),
        },
        photo: photoBase64,
        carPhotos: {},
        termsAccepted: true,
        source: 'mobile',
      };

      const result = await submitPending(payload);
      Alert.alert(
        result?.queued ? 'Queued offline' : 'Submitted',
        result?.queued
          ? 'Saved locally and will sync when you are back online.'
          : 'Rental sent for admin approval on the desk.',
        [{
          text: 'OK',
          onPress: () => {
            setPhotoUri(null);
            setPhotoBase64(null);
            setRemarks('');
            setSelectedVehicleId('');
          },
        }],
      );
    } catch (err) {
      Alert.alert('Submit failed', err?.message || 'Could not submit rental.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout
      scroll
      contentContainerStyle={styles.scrollContent}
      header={
        <ScreenHeader
          title="Capture Car Details"
          subtitle={!online ? `Offline${queueLength ? ` · ${queueLength} queued` : ''}` : undefined}
        />
      }
    >
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Photo Capture</Text>

        {photoUri ? (
          <View style={[styles.imageContainer, { borderColor: theme.border }]}>
            <Image source={{ uri: photoUri }} style={styles.capturedImage} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}>
              <X color="#fff" size={20} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.captureBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.captureBtn} onPress={() => pickImage(true)}>
              <Camera color={theme.textSub} size={48} />
              <Text style={[styles.captureText, { color: theme.textSub }]}>Tap to Open Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(false)}>
              <ImagePlus color={theme.textSub} size={20} />
              <Text style={[styles.uploadText, { color: theme.textSub }]}>Or Upload from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.textMain, marginTop: 24 }]}>Select Vehicle</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehiclePicker}>
          {vehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[
                styles.vehicleChip,
                { borderColor: theme.border, backgroundColor: theme.card },
                selectedVehicleId === v.id && styles.vehicleChipActive,
              ]}
              onPress={() => setSelectedVehicleId(v.id)}
            >
              <Text style={[styles.vehicleChipPlate, { color: theme.textMain }]}>{v.plate || v.make}</Text>
              <Text style={[styles.vehicleChipName, { color: theme.textSub }]}>{v.make} {v.model}</Text>
            </TouchableOpacity>
          ))}
          {vehicles.length === 0 ? (
            <Text style={{ color: theme.textSub }}>No vehicles loaded from cloud.</Text>
          ) : null}
        </ScrollView>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textMain }]}>Remarks / Inspector Notes</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.card, color: theme.textMain, borderColor: theme.border }]}
            placeholder="Add observations, defects, or general remarks..."
            placeholderTextColor={theme.textSub}
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!photoBase64 || !selectedVehicle || submitting) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!photoBase64 || !selectedVehicle || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Upload color="#fff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Submit for Approval</Text>
            </>
          )}
        </TouchableOpacity>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  captureBox: { height: 250, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 20 },
  captureBtn: { alignItems: 'center', marginBottom: 20 },
  captureText: { marginTop: 12, fontSize: 16, fontWeight: '500' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  uploadText: { marginLeft: 8, fontSize: 14, fontWeight: '500' },
  imageContainer: { height: 250, borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  capturedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
  vehiclePicker: { gap: 10, paddingBottom: 8, marginBottom: 16 },
  vehicleChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 120 },
  vehicleChipActive: { borderColor: '#b32025', backgroundColor: '#fef2f2' },
  vehicleChipPlate: { fontWeight: '700', fontSize: 14 },
  vehicleChipName: { fontSize: 12, marginTop: 2 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  textArea: { minHeight: 100, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15 },
  submitButton: { flexDirection: 'row', backgroundColor: '#b32025', height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
