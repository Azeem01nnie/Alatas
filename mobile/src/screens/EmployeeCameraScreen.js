import React, { useEffect, useMemo, useState } from 'react';
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
import {
  Camera,
  ImagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Car,
} from 'lucide-react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import { useAuth } from '../context/AuthContext';
import {
  CAR_PHOTO_SLOTS,
  buildUpcomingNotices,
} from '../utils/vehicleMapper';
import { ACCENT } from '../theme/colors';

const EMPTY_PHOTOS = { front: '', rear: '', left: '', right: '' };

export default function EmployeeCameraScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { rentals, uploadCarPhotos, online, queueLength, loading } = useFleet();

  const accountName =
    user?.displayName?.trim() ||
    user?.username?.trim() ||
    'Employee';

  const upcoming = useMemo(
    () => buildUpcomingNotices(rentals, { includePendingForPhotos: true }),
    [rentals],
  );
  const needingPhotos = useMemo(
    () => upcoming.filter((item) => item.needsCarPhotos),
    [upcoming],
  );
  const completedPhotos = useMemo(
    () => upcoming.filter((item) => !item.needsCarPhotos),
    [upcoming],
  );

  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState(EMPTY_PHOTOS);
  const [submitting, setSubmitting] = useState(false);

  // Deep-link from dashboard upcoming card
  useEffect(() => {
    const rentalId = route.params?.rentalId;
    if (!rentalId || !upcoming.length) return;
    const match = upcoming.find((item) => String(item.rental?.id) === String(rentalId));
    if (!match) return;

    if (match.needsCarPhotos) {
      const existing = match.rental?.carPhotos || {};
      setSelected(match);
      setStep(0);
      setPhotos({
        front: existing.front || '',
        rear: existing.rear || '',
        left: existing.left || '',
        right: existing.right || '',
      });
    } else {
      Alert.alert(
        'Photos already added',
        match.carPhotosAddedBy
          ? `Vehicle photos were added by ${match.carPhotosAddedBy}.`
          : 'This upcoming rental already has vehicle photos.',
      );
    }
    navigation.setParams({ rentalId: undefined });
  }, [route.params?.rentalId, upcoming, navigation]);

  const startPhotoFlow = (item) => {
    const existing = item.rental?.carPhotos || {};
    setSelected(item);
    setStep(0);
    setPhotos({
      front: existing.front || '',
      rear: existing.rear || '',
      left: existing.left || '',
      right: existing.right || '',
    });
  };

  const resetFlow = () => {
    setSelected(null);
    setStep(0);
    setPhotos(EMPTY_PHOTOS);
    if (route.params?.rentalId) {
      navigation.setParams({ rentalId: undefined });
    }
  };

  const slot = CAR_PHOTO_SLOTS[step];
  const currentPhoto = photos[slot?.key];
  const completedCount = CAR_PHOTO_SLOTS.filter((s) => photos[s.key]).length;
  const allComplete = completedCount === CAR_PHOTO_SLOTS.length;

  const pickImage = async (useCamera) => {
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
    const rentalId = selected?.rental?.id;
    if (!rentalId) {
      Alert.alert('Missing rental', 'Pick an upcoming rental first.');
      return;
    }
    if (!allComplete) {
      Alert.alert('Incomplete', 'Capture Front, Rear, Left, and Right before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await uploadCarPhotos(
        rentalId,
        { ...photos, _addedBy: accountName },
        accountName,
      );
      Alert.alert(
        result?.queued ? 'Queued offline' : 'Vehicle photos saved',
        result?.queued
          ? `Saved as ${accountName}. Will sync when you are back online.`
          : selected?.waitingApproval
            ? `Photos saved under ${accountName}. The rental is still waiting for desk approval.`
            : `Photos saved under ${accountName}. Desk can see who took them when reviewing.`,
        [{ text: 'OK', onPress: resetFlow }],
      );
    } catch (err) {
      Alert.alert('Submit failed', err?.message || 'Could not save vehicle photos.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!selected) {
    return (
      <ScreenLayout
        scroll
        contentContainerStyle={styles.scrollContent}
        header={
          <ScreenHeader
            title="Vehicle photos"
            subtitle={
              !online
                ? `Offline${queueLength ? ` · ${queueLength} queued` : ''}`
                : `Signed in as ${accountName}`
            }
          />
        }
      >
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
          Upcoming — needs photos
        </Text>
        <Text style={[styles.sectionHint, { color: theme.textSub }]}>
          Pick a rental, then capture Front, Rear, Left, and Right. Your account name is saved as proof.
        </Text>

        {loading && needingPhotos.length === 0 ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
        ) : needingPhotos.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Car color={theme.textSub} size={36} />
            <Text style={[styles.emptyTitle, { color: theme.textMain }]}>No rentals need photos</Text>
            <Text style={[styles.emptySub, { color: theme.textSub }]}>
              Field rentals appear here right away so you can add vehicle photos — even before desk approval.
            </Text>
          </View>
        ) : (
          needingPhotos.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.pickCard, { backgroundColor: theme.card, borderColor: ACCENT }]}
              onPress={() => startPhotoFlow(item)}
              activeOpacity={0.85}
            >
              <View style={styles.pickCardBody}>
                <Text style={[styles.pickTitle, { color: theme.textMain }]}>{item.vehicle}</Text>
                <Text style={[styles.pickSub, { color: theme.textSub }]} numberOfLines={2}>
                  {item.text}
                </Text>
                <View style={styles.needBadge}>
                  <Text style={styles.needBadgeText}>4 sides required</Text>
                </View>
              </View>
              <ChevronRight color={ACCENT} size={22} />
            </TouchableOpacity>
          ))
        )}

        {completedPhotos.length > 0 ? (
          <View style={styles.doneSection}>
            <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Photos already added</Text>
            {completedPhotos.map((item) => (
              <View
                key={`done-${item.id}`}
                style={[styles.doneCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Text style={[styles.pickTitle, { color: theme.textMain }]}>{item.vehicle}</Text>
                <Text style={[styles.pickSub, { color: theme.textSub }]}>
                  {item.carPhotosAddedBy
                    ? `Taken by ${item.carPhotosAddedBy}`
                    : 'Vehicle photos complete'}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScreenLayout>
    );
  }

  const vehicleLabel = selected.vehicle || 'Vehicle';
  const previewUri = currentPhoto || null;

  return (
    <ScreenLayout
      scroll
      contentContainerStyle={styles.scrollContent}
      header={
        <ScreenHeader
          title="Capture sides"
          subtitle={`${vehicleLabel} · ${accountName}`}
        />
      }
    >
      <TouchableOpacity style={styles.changeRental} onPress={resetFlow}>
        <ChevronLeft color={ACCENT} size={18} />
        <Text style={styles.changeRentalText}>Change upcoming rental</Text>
      </TouchableOpacity>

      <View style={[styles.accountBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.accountBannerLabel, { color: theme.textSub }]}>Photos credited to</Text>
        <Text style={[styles.accountBannerName, { color: theme.textMain }]}>{accountName}</Text>
      </View>

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
          <TouchableOpacity
            style={styles.removeImageBtn}
            onPress={() => setPhotos((prev) => ({ ...prev, [slot.key]: '' }))}
          >
            <X color="#fff" size={20} />
          </TouchableOpacity>
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

      <Text style={[styles.progressText, { color: theme.textSub }]}>
        {completedCount} of {CAR_PHOTO_SLOTS.length} captured
      </Text>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, { borderColor: theme.border }, step === 0 && styles.navBtnDisabled]}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft color={step === 0 ? theme.textSub : theme.textMain} size={20} />
          <Text style={[styles.navBtnText, { color: step === 0 ? theme.textSub : theme.textMain }]}>
            Back
          </Text>
        </TouchableOpacity>

        {step < CAR_PHOTO_SLOTS.length - 1 ? (
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
            style={[
              styles.navBtn,
              styles.navBtnPrimary,
              (!allComplete || submitting) && styles.navBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!allComplete || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.navBtnPrimaryText}>Submit · {accountName}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  sectionHint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  pickCardBody: { flex: 1, marginRight: 8, gap: 4 },
  pickTitle: { fontSize: 16, fontWeight: '700' },
  pickSub: { fontSize: 13, lineHeight: 18 },
  needBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  needBadgeText: { fontSize: 11, fontWeight: '700', color: '#b45309' },
  doneSection: { marginTop: 20, gap: 8 },
  doneCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 4,
  },
  changeRental: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 14,
  },
  changeRentalText: { color: ACCENT, fontWeight: '700', fontSize: 14 },
  accountBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  accountBannerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  accountBannerName: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: ACCENT, backgroundColor: '#fef2f2' },
  stepDotDone: { backgroundColor: ACCENT, borderColor: ACCENT },
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
  progressText: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 16 },
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
  navBtnPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },
  navBtnDisabled: { opacity: 0.45 },
  navBtnText: { fontSize: 15, fontWeight: '700' },
  navBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
