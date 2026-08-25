import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X, ChevronLeft, ChevronRight, Check, Lock } from 'lucide-react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import { useAuth } from '../context/AuthContext';
import { CAR_PHOTO_SLOTS, rentalHasCarPhotos, getCarPhotosAddedBy } from '../utils/vehicleMapper';
import { ACCENT } from '../theme/colors';

export default function CarPhotosScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { uploadCarPhotos, online, queueLength, rentals } = useFleet();

  const rentalId = route.params?.rentalId;
  const vehicleLabel = route.params?.vehicleLabel || 'Vehicle';
  const initialPhotos = route.params?.existingPhotos || {};
  const addedByName = route.params?.addedByName || null;
  const rental = useMemo(
    () => rentals.find((item) => String(item.id) === String(rentalId)),
    [rentals, rentalId],
  );

  const resolvedAddedBy = useMemo(
    () =>
      addedByName ||
      getCarPhotosAddedBy(rental) ||
      (initialPhotos._addedBy && String(initialPhotos._addedBy).trim()) ||
      null,
    [addedByName, rental, initialPhotos._addedBy],
  );

  const readOnlyParam = route.params?.readOnly;
  const initiallyComplete = rentalHasCarPhotos({ carPhotos: initialPhotos });
  const readOnly = readOnlyParam ?? initiallyComplete;

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState(() => ({
    front: initialPhotos.front || '',
    rear: initialPhotos.rear || '',
    left: initialPhotos.left || '',
    right: initialPhotos.right || '',
  }));
  const [submitting, setSubmitting] = useState(false);

  const slot = CAR_PHOTO_SLOTS[step];
  const currentPhoto = photos[slot.key];
  const completedCount = CAR_PHOTO_SLOTS.filter((s) => photos[s.key]).length;
  const allComplete = completedCount === CAR_PHOTO_SLOTS.length;

  const previewUri = useMemo(() => {
    if (!currentPhoto) return null;
    return currentPhoto.startsWith('data:') ? currentPhoto : currentPhoto;
  }, [currentPhoto]);

  const addedByLabel = resolvedAddedBy;

  const pickImage = async (useCamera) => {
    if (readOnly) return;

    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera or gallery access is required.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.65, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.65, base64: true });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const dataUrl = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setPhotos((prev) => ({ ...prev, [slot.key]: dataUrl }));
    }
  };

  const handleSubmit = async () => {
    if (readOnly) return;

    if (!rentalId) {
      Alert.alert('Missing rental', 'Could not identify this rental.');
      return;
    }
    if (!allComplete) {
      Alert.alert('Incomplete', 'Capture all four sides before submitting.');
      return;
    }

    const addedBy = user?.displayName || user?.username || 'Mobile user';

    setSubmitting(true);
    try {
      const result = await uploadCarPhotos(rentalId, { ...photos, _addedBy: addedBy }, addedBy);
      Alert.alert(
        result?.queued ? 'Queued offline' : 'Photos saved',
        result?.queued
          ? 'Saved locally and will sync when you are back online.'
          : 'Pre-rental car photos are synced to desktop.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert('Upload failed', err?.message || 'Could not save car photos.');
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
          title={readOnly ? 'Car photos (locked)' : 'Car photos'}
          subtitle={`${vehicleLabel}${!online ? ` · Offline${queueLength ? ` · ${queueLength} queued` : ''}` : ''}`}
        />
      }
    >
      {readOnly ? (
        <View style={[styles.lockBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Lock color={ACCENT} size={18} />
          <View style={styles.lockBannerText}>
            <Text style={[styles.lockTitle, { color: theme.textMain }]}>Photos locked</Text>
            <Text style={[styles.lockSub, { color: theme.textSub }]}>
              All vehicle photos were added and cannot be edited.
            </Text>
            {addedByLabel ? (
              <Text style={[styles.lockSub, { color: theme.textSub }]}>
                Added by {addedByLabel}
              </Text>
            ) : (
              <Text style={[styles.lockSub, { color: theme.textSub }]}>
                Uploader was not recorded for this rental.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.stepperRow}>
        {CAR_PHOTO_SLOTS.map((s, index) => {
          const done = Boolean(photos[s.key]);
          const active = index === step;
          return (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.stepDot,
                { borderColor: theme.border, backgroundColor: theme.card },
                active && styles.stepDotActive,
                done && styles.stepDotDone,
              ]}
              onPress={() => setStep(index)}
            >
              {done ? (
                <Check color="#fff" size={14} />
              ) : (
                <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{index + 1}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.stepLabel, { color: theme.textSub }]}>
        Step {step + 1} of {CAR_PHOTO_SLOTS.length}
      </Text>
      <Text style={[styles.stepTitle, { color: theme.textMain }]}>{slot.title}</Text>
      <Text style={[styles.stepHint, { color: theme.textSub }]}>{slot.hint}</Text>

      {previewUri ? (
        <View style={[styles.imageContainer, { borderColor: theme.border }]}>
          <Image source={{ uri: previewUri }} style={styles.capturedImage} />
          {!readOnly ? (
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setPhotos((prev) => ({ ...prev, [slot.key]: '' }))}
            >
              <X color="#fff" size={20} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : readOnly ? (
        <View style={[styles.captureBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.captureText, { color: theme.textSub }]}>No photo for this side</Text>
        </View>
      ) : (
        <View style={[styles.captureBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.captureBtn} onPress={() => pickImage(true)}>
            <Camera color={theme.textSub} size={48} />
            <Text style={[styles.captureText, { color: theme.textSub }]}>Open camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(false)}>
            <ImagePlus color={theme.textSub} size={20} />
            <Text style={[styles.uploadText, { color: theme.textSub }]}>Upload from gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.progressRow}>
        <Text style={[styles.progressText, { color: theme.textSub }]}>
          {completedCount} of {CAR_PHOTO_SLOTS.length} captured
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, { borderColor: theme.border }, step === 0 && styles.navBtnDisabled]}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft color={step === 0 ? theme.textSub : theme.textMain} size={20} />
          <Text style={[styles.navBtnText, { color: step === 0 ? theme.textSub : theme.textMain }]}>Back</Text>
        </TouchableOpacity>

        {readOnly ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnPrimary, step === CAR_PHOTO_SLOTS.length - 1 && styles.navBtnDisabled]}
            onPress={() => setStep((s) => Math.min(CAR_PHOTO_SLOTS.length - 1, s + 1))}
            disabled={step === CAR_PHOTO_SLOTS.length - 1}
          >
            <Text style={styles.navBtnPrimaryText}>Next</Text>
            <ChevronRight color="#fff" size={20} />
          </TouchableOpacity>
        ) : step < CAR_PHOTO_SLOTS.length - 1 ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnPrimary, !currentPhoto && styles.navBtnDisabled]}
            onPress={() => setStep((s) => Math.min(CAR_PHOTO_SLOTS.length - 1, s + 1))}
            disabled={!currentPhoto}
          >
            <Text style={styles.navBtnPrimaryText}>Next</Text>
            <ChevronRight color="#fff" size={20} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnPrimary, (!allComplete || submitting) && styles.navBtnDisabled]}
            onPress={handleSubmit}
            disabled={!allComplete || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.navBtnPrimaryText}>Save & sync</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 40 },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  lockBannerText: { flex: 1, gap: 2 },
  lockTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  lockSub: { fontSize: 13, lineHeight: 18 },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: ACCENT,
    backgroundColor: '#fef2f2',
  },
  stepDotDone: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  stepDotText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  stepDotTextActive: { color: ACCENT },
  stepLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  stepTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  stepHint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  captureBox: {
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  captureBtn: { alignItems: 'center', marginBottom: 20 },
  captureText: { marginTop: 12, fontSize: 16, fontWeight: '500' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  uploadText: { marginLeft: 8, fontSize: 14, fontWeight: '500' },
  imageContainer: {
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  capturedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6,
  },
  progressRow: { marginTop: 16, marginBottom: 20 },
  progressText: { fontSize: 13, fontWeight: '600' },
  navRow: { flexDirection: 'row', gap: 12 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  navBtnPrimary: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  navBtnDisabled: { opacity: 0.45 },
  navBtnText: { fontSize: 15, fontWeight: '700' },
  navBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
