import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { Screen } from '../components/Screen'
import SignaturePad, { isSignatureSigned } from '../components/SignaturePad'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { getDisplayStatus, displayStatusLabel } from '../utils/vehicleDisplayStatus'
import { ACCENT } from '../theme/colors'
import {
  formatPhMobile,
  ensurePhMobilePrefix,
  isCompletePhMobile,
  formatEmergencyContact,
} from '../utils/phone'
import {
  composeTime,
  formatPeriodLabel,
  toPeriodDate,
  isValidHour,
  isValidMinute,
  sanitizeTimePart,
} from '../utils/rentalPeriod'
import {
  buildRentalAutoPatch,
  parseDurationDays,
  parseDurationHours,
  formatDurationDaysLabel,
} from '../utils/rentalFee'
import {
  CONTRACT_DOCUMENT_TITLE,
  CONTRACT_TERMS,
  LIABILITY_CLAUSE,
} from '../data/contract'

const STEP_LABELS = ['Personal', 'Vehicle', 'Rental', 'Photo', 'Terms', 'Car photo', 'Summary']

const DURATIONS = ['5hrs', '12hrs', '24hrs', 'Others']
const RENTAL_TYPES = ['Self-drive', 'With-driver']
const MERIDIEMS = ['AM', 'PM']

export const EMERGENCY_RELATIONS = [
  'Spouse',
  'Parent',
  'Sibling',
  'Child',
  'Relative',
  'Friend',
  'Other',
]

const CAR_PHOTO_SLOTS = [
  { key: 'front', title: 'Front', hint: 'Full front view of the vehicle.' },
  { key: 'rear', title: 'Rear', hint: 'Full rear view of the vehicle.' },
  { key: 'left', title: 'Left side', hint: 'Driver / left side of the vehicle.' },
  { key: 'right', title: 'Right side', hint: 'Passenger / right side of the vehicle.' },
]

const initialPersonal = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  address: '',
  contactNo: '',
  emergencyName: '',
  emergencyRelation: '',
  emergencyRelationOther: '',
  emergencyPhone: '',
}

const initialRental = {
  duration: '',
  durationOther: '',
  rentalType: '',
  fromDate: '',
  fromHour: '',
  fromMinute: '',
  fromMeridiem: 'AM',
  toDate: '',
  toHour: '',
  toMinute: '',
  toMeridiem: 'AM',
  rentalFee: '',
  feeNote: '',
  feeHours: null,
}

const AUTO_CAPITALIZE_KEYS = new Set([
  'firstName',
  'middleName',
  'lastName',
  'suffix',
  'address',
  'emergencyName',
  'emergencyRelationOther',
])

function todayDateValue() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function autoCapitalizeWords(value) {
  return String(value ?? '').replace(/\b([a-z])/g, (match) => match.toUpperCase())
}

function dateStringToDate(yyyyMmDd) {
  if (!yyyyMmDd?.trim()) return new Date()
  const [y, mo, d] = yyyyMmDd.split('-').map((n) => parseInt(n, 10))
  return new Date(y, mo - 1, d, 12, 0, 0, 0)
}

function dateToYyyyMmDd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function uriToDataUrl(uri) {
  if (!uri) return ''
  if (uri.startsWith('data:')) return uri
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    try {
      const resp = await fetch(uri)
      const blob = await resp.blob()
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result || uri))
        reader.onerror = () => reject(new Error('Could not read image'))
        reader.readAsDataURL(blob)
      })
    } catch {
      return uri
    }
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType?.Base64 ?? 'base64',
    })
    const mime = uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${base64}`
  } catch {
    return uri
  }
}

function StepIndicator({ step, colors }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stepRow}
    >
      {STEP_LABELS.map((label, index) => {
        const active = index === step
        const done = index < step
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                { backgroundColor: active || done ? ACCENT : colors.border },
              ]}
            >
              <Text style={[styles.stepDotText, (active || done) && styles.stepDotTextOn]}>
                {done ? '✓' : index + 1}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.stepLabel, { color: active ? colors.text : colors.textMuted }]}
            >
              {label}
            </Text>
          </View>
        )
      })}
    </ScrollView>
  )
}

function FieldError({ message }) {
  if (!message) return null
  return <Text style={styles.errorText}>{message}</Text>
}

export default function RentCarScreen() {
  const { user, isAdmin } = useAuth()
  const { vehicles, rentals, addRental, ready } = useFleet()
  const { colors } = useTheme()

  const [step, setStep] = useState(0)
  const [personal, setPersonal] = useState(initialPersonal)
  const [vehicleId, setVehicleId] = useState('')
  const [rental, setRental] = useState(() => ({ ...initialRental, fromDate: todayDateValue() }))
  const [photo, setPhoto] = useState('')
  const [licensePhoto, setLicensePhoto] = useState('')
  const [optionalPhoto, setOptionalPhoto] = useState('')
  const [signature, setSignature] = useState('')
  const [carPhotos, setCarPhotos] = useState({})
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showFromDatePicker, setShowFromDatePicker] = useState(false)
  const [editingDays, setEditingDays] = useState(false)

  const encodedByName = useMemo(
    () => String(user?.displayName || user?.username || 'Staff').trim(),
    [user],
  )

  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => getDisplayStatus(v, rentals) === 'available')
  }, [vehicles, rentals])

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(vehicleId)),
    [vehicles, vehicleId],
  )

  const rates = selectedVehicle?.rates
  const durationHours = useMemo(
    () => parseDurationHours(rental.duration, rental.durationOther),
    [rental.duration, rental.durationOther],
  )

  const toLocked = Boolean(
    durationHours &&
      rental.fromDate &&
      rental.fromHour &&
      rental.fromMinute !== '' &&
      rental.fromMeridiem,
  )

  const updatePersonal = useCallback((key, value) => {
    const nextValue = AUTO_CAPITALIZE_KEYS.has(key) ? autoCapitalizeWords(value) : value
    setPersonal((prev) => ({ ...prev, [key]: nextValue }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }, [])

  const updateRental = useCallback((keyOrPatch, value) => {
    const sanitizeKey = (key, val) =>
      key === 'fromHour' ||
      key === 'fromMinute' ||
      key === 'toHour' ||
      key === 'toMinute'
        ? sanitizeTimePart(val)
        : val

    setRental((prev) => {
      let patch = {}
      if (typeof keyOrPatch === 'object' && keyOrPatch !== null) {
        Object.entries(keyOrPatch).forEach(([key, val]) => {
          patch[key] = sanitizeKey(key, val)
        })
      } else {
        patch[keyOrPatch] = sanitizeKey(keyOrPatch, value)
      }
      const next = { ...prev, ...patch }
      const auto = buildRentalAutoPatch(next, rates)
      return { ...next, ...auto }
    })

    setErrors((prev) => {
      const next = { ...prev }
      if (typeof keyOrPatch === 'object' && keyOrPatch !== null) {
        Object.keys(keyOrPatch).forEach((key) => {
          next[key] = ''
        })
      } else {
        next[keyOrPatch] = ''
      }
      return next
    })
  }, [rates])

  useEffect(() => {
    const auto = buildRentalAutoPatch(rental, rates)
    const keys = Object.keys(auto)
    if (!keys.length) return
    const changed = keys.some((key) => rental[key] !== auto[key])
    if (changed) {
      setRental((prev) => ({ ...prev, ...auto }))
    }
  }, [rental, rates])

  useEffect(() => {
    if (step !== 5) return
    setErrors((prev) => {
      const next = { ...prev }
      let changed = false
      for (const slot of CAR_PHOTO_SLOTS) {
        if (next[slot.key]) {
          next[slot.key] = ''
          changed = true
        }
      }
      if (next.carPhotos) {
        next.carPhotos = ''
        changed = true
      }
      return changed ? next : prev
    })
  }, [step])

  const resetForm = useCallback(() => {
    setStep(0)
    setPersonal(initialPersonal)
    setVehicleId('')
    setRental({ ...initialRental, fromDate: todayDateValue() })
    setPhoto('')
    setLicensePhoto('')
    setOptionalPhoto('')
    setSignature('')
    setCarPhotos({})
    setTermsAccepted(false)
    setErrors({})
    setSubmitting(false)
    setEditingDays(false)
  }, [])

  const pickImage = useCallback(async (target) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to attach images.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
        quality: 0.75,
        allowsEditing: true,
      })
      if (result.canceled || !result.assets?.[0]?.uri) return
      const dataUrl = await uriToDataUrl(result.assets[0].uri)
      if (target === 'holding') {
        setPhoto(dataUrl)
        setErrors((prev) => ({ ...prev, photo: '' }))
      } else if (target === 'license') {
        setLicensePhoto(dataUrl)
        setErrors((prev) => ({ ...prev, licensePhoto: '' }))
      } else if (target === 'optional') {
        setOptionalPhoto(dataUrl)
      } else if (target === 'extra') {
        setCarPhotos((prev) => {
          const extras = Array.isArray(prev.extras) ? [...prev.extras] : []
          extras.push({
            id: `extra-${Date.now()}`,
            uri: dataUrl,
            label: `Extra ${extras.length + 1}`,
          })
          return { ...prev, extras }
        })
      } else {
        setCarPhotos((prev) => ({ ...prev, [target]: dataUrl }))
        setErrors((prev) => ({ ...prev, [target]: '', carPhotos: '' }))
      }
    } catch (err) {
      Alert.alert('Photo error', err?.message || 'Could not pick image.')
    }
  }, [])

  const validateStep = useCallback(
    (currentStep) => {
      const nextErrors = {}
      const desktopStep = currentStep + 1

      if (desktopStep === 1) {
        if (!personal.firstName.trim()) nextErrors.firstName = 'First name is required'
        if (!personal.lastName.trim()) nextErrors.lastName = 'Last name is required'
        if (!personal.address.trim()) nextErrors.address = 'Address is required'
        if (!personal.contactNo.trim()) nextErrors.contactNo = 'Contact number is required'
        else if (!isCompletePhMobile(personal.contactNo)) {
          nextErrors.contactNo = 'Enter a valid number (e.g. +63 912 123 1234)'
        }
        if (!personal.emergencyName.trim()) {
          nextErrors.emergencyName = 'Emergency contact name is required'
        }
        if (!personal.emergencyRelation.trim()) {
          nextErrors.emergencyRelation = 'Relationship is required'
        } else if (
          personal.emergencyRelation === 'Other' &&
          !personal.emergencyRelationOther.trim()
        ) {
          nextErrors.emergencyRelationOther = 'Please specify the relationship'
        }
        if (!personal.emergencyPhone.trim()) {
          nextErrors.emergencyPhone = 'Emergency contact number is required'
        } else if (!isCompletePhMobile(personal.emergencyPhone)) {
          nextErrors.emergencyPhone = 'Enter a valid number (e.g. +63 912 123 1234)'
        }
      }

      if (desktopStep === 2) {
        if (!vehicleId) nextErrors.vehicle = 'Please select a vehicle'
      }

      if (desktopStep === 3) {
        if (!rental.duration) nextErrors.duration = 'Select a duration'
        if (rental.duration === 'Others') {
          const days = parseDurationDays(rental.durationOther)
          if (!days) nextErrors.durationOther = 'Enter the number of days'
        }
        if (!rental.rentalType) nextErrors.rentalType = 'Select a rental type'

        if (!rental.fromDate) nextErrors.fromDate = 'From date is required'
        if (!rental.fromHour.trim()) nextErrors.fromHour = 'From hour is required'
        else if (!isValidHour(rental.fromHour)) nextErrors.fromHour = 'Hour must be 1–12'
        if (rental.fromMinute.trim() === '') nextErrors.fromMinute = 'From minute is required'
        else if (!isValidMinute(rental.fromMinute)) {
          nextErrors.fromMinute = 'Minute must be 0–59'
        }
        if (!rental.fromMeridiem) nextErrors.fromMeridiem = 'Select AM or PM'

        if (!rental.toDate) nextErrors.toDate = 'To date is required'
        if (!rental.toHour.trim()) nextErrors.toHour = 'To hour is required'
        else if (!isValidHour(rental.toHour)) nextErrors.toHour = 'Hour must be 1–12'
        if (rental.toMinute.trim() === '') nextErrors.toMinute = 'To minute is required'
        else if (!isValidMinute(rental.toMinute)) nextErrors.toMinute = 'Minute must be 0–59'
        if (!rental.toMeridiem) nextErrors.toMeridiem = 'Select AM or PM'

        const fromTime = composeTime(rental.fromHour, rental.fromMinute)
        const toTime = composeTime(rental.toHour, rental.toMinute)
        const fromDt = toPeriodDate(rental.fromDate, fromTime, rental.fromMeridiem)
        const toDt = toPeriodDate(rental.toDate, toTime, rental.toMeridiem)

        if (fromDt && toDt && toDt.getTime() <= fromDt.getTime()) {
          nextErrors.toDate = 'To must be after From'
        }
        if (fromDt && fromDt.getTime() < Date.now()) {
          nextErrors.fromHour = 'Start time cannot be in the past'
        }
        if (!rental.rentalFee.trim()) nextErrors.rentalFee = 'Rental fee is required'
      }

      if (desktopStep === 4) {
        if (!photo) nextErrors.photo = 'Add a photo of the customer holding their license'
        if (!licensePhoto) nextErrors.licensePhoto = 'Add a clear photo of the customer'
      }

      if (desktopStep === 5) {
        if (!isSignatureSigned(signature)) nextErrors.signature = 'Customer signature is required'
        if (!termsAccepted) nextErrors.terms = 'You must accept the terms to continue'
      }

      setErrors(nextErrors)
      return Object.keys(nextErrors).length === 0
    },
    [personal, vehicleId, rental, photo, licensePhoto, signature, termsAccepted],
  )

  const goBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  const goNext = useCallback(() => {
    if (step === 2 && rental.duration === 'Others') {
      const labeled = formatDurationDaysLabel(rental.durationOther)
      if (labeled && labeled !== rental.durationOther) {
        updateRental({ durationOther: labeled })
      }
    }

    if (step === 5) {
      setErrors((prev) => {
        const next = { ...prev }
        for (const slot of CAR_PHOTO_SLOTS) next[slot.key] = ''
        next.carPhotos = ''
        return next
      })
      setStep(6)
      return
    }

    if (!validateStep(step)) return
    if (step < STEP_LABELS.length - 1) setStep((s) => s + 1)
  }, [step, rental, updateRental, validateStep])

  const handleSubmit = useCallback(async () => {
    if (submitting) return

    if (!selectedVehicle) {
      Alert.alert('Vehicle', 'Selected vehicle is no longer available. Go back and choose again.')
      setStep(1)
      return
    }

    const fromTime = composeTime(rental.fromHour, rental.fromMinute)
    const toTime = composeTime(rental.toHour, rental.toMinute)
    const fromDt = toPeriodDate(rental.fromDate, fromTime, rental.fromMeridiem)
    const toDt = toPeriodDate(rental.toDate, toTime, rental.toMeridiem)

    if (fromDt && fromDt.getTime() < Date.now()) {
      setErrors({ fromHour: 'Start time cannot be in the past' })
      setStep(2)
      Alert.alert('Rental period', 'Start time cannot be in the past.')
      return
    }

    setSubmitting(true)
    try {
      const periodFromLabel = formatPeriodLabel(rental.fromDate, fromTime, rental.fromMeridiem)
      const periodToLabel = formatPeriodLabel(rental.toDate, toTime, rental.toMeridiem)
      const safe = (value) => String(value ?? '').trim()
      const encoder = encodedByName || 'Unknown'

      const vehicleImage =
        selectedVehicle.image && /^https?:\/\//i.test(selectedVehicle.image)
          ? selectedVehicle.image
          : selectedVehicle.image && selectedVehicle.image.length < 180_000
            ? selectedVehicle.image
            : ''

      const carPhotosPayload = { ...carPhotos }
      if (Array.isArray(carPhotosPayload.extras)) {
        carPhotosPayload.extras = carPhotosPayload.extras.filter((e) => e?.uri)
      }

      await addRental({
        personal: {
          ...personal,
          firstName: safe(personal.firstName),
          middleName: safe(personal.middleName),
          lastName: safe(personal.lastName),
          suffix: safe(personal.suffix),
          address: safe(personal.address),
          contactNo: safe(personal.contactNo),
          emergencyContact: formatEmergencyContact(personal),
          encodedBy: encoder,
          ...(optionalPhoto ? { optionalPhoto } : {}),
        },
        vehicleId: selectedVehicle.id,
        vehicle: {
          id: selectedVehicle.id,
          make: selectedVehicle.make,
          series: selectedVehicle.series,
          plateNo: selectedVehicle.plateNo,
          bodyType: selectedVehicle.bodyType,
          engineNo: selectedVehicle.engineNo,
          chassisNo: selectedVehicle.chassisNo,
          image: vehicleImage,
        },
        rental: {
          duration: rental.duration === 'Others' ? rental.durationOther : rental.duration,
          rentalType: rental.rentalType,
          rentalFee: rental.rentalFee,
          fromDate: rental.fromDate,
          fromHour: rental.fromHour,
          fromMinute: rental.fromMinute,
          fromTime,
          fromMeridiem: rental.fromMeridiem,
          toDate: rental.toDate,
          toHour: rental.toHour,
          toMinute: rental.toMinute,
          toTime,
          toMeridiem: rental.toMeridiem,
          periodFrom: fromDt ? fromDt.toISOString() : periodFromLabel,
          periodTo: toDt ? toDt.toISOString() : periodToLabel,
          periodFromLabel,
          periodToLabel,
        },
        photo,
        licensePhoto,
        signature,
        carPhotos: carPhotosPayload,
        termsAccepted,
        encodedAt: new Date().toISOString(),
        encodedBy: encoder,
        autoApprove: isAdmin,
        source: 'mobile',
      })

      Alert.alert(
        'Success',
        isAdmin ? 'Rental recorded and approved.' : 'Rental submitted for admin approval.',
        [{ text: 'OK', onPress: resetForm }],
      )
    } catch (err) {
      Alert.alert('Submit failed', err?.message || 'Could not save rental.')
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting,
    selectedVehicle,
    rental,
    personal,
    photo,
    licensePhoto,
    optionalPhoto,
    signature,
    carPhotos,
    termsAccepted,
    encodedByName,
    isAdmin,
    addRental,
    resetForm,
  ])

  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
        color: colors.text,
      },
    ],
    [colors],
  )

  const inputErrorStyle = (key) =>
    errors[key] ? [inputStyle, styles.inputError] : inputStyle

  const parsedDays = parseDurationDays(rental.durationOther)
  const daysInputValue = editingDays
    ? String(rental.durationOther || '').replace(/\D/g, '')
    : parsedDays
      ? formatDurationDaysLabel(rental.durationOther)
      : String(rental.durationOther || '')

  const renderPeriodBlock = ({
    label,
    dateKey,
    hourKey,
    minuteKey,
    meridiemKey,
    readOnly,
    showDatePicker,
    setShowDatePicker,
  }) => (
    <View
      style={[
        styles.periodCard,
        { borderColor: colors.border, backgroundColor: colors.surface },
        readOnly && styles.periodCardAuto,
      ]}
    >
      <View style={styles.periodCardHead}>
        <Text style={[styles.periodTitle, { color: colors.text }]}>{label}</Text>
        {readOnly ? (
          <Text style={[styles.autoTag, { color: ACCENT }]}>Auto</Text>
        ) : null}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date</Text>
      {readOnly ? (
        <Text style={[styles.readOnlyValue, { color: colors.text }]}>{rental[dateKey] || '—'}</Text>
      ) : (
        <>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={[...inputStyle, styles.datePressable]}
          >
            <Text style={{ color: rental[dateKey] ? colors.text : colors.textMuted }}>
              {rental[dateKey] || 'Select date'}
            </Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={dateStringToDate(rental[dateKey])}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={dateStringToDate(todayDateValue())}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') setShowDatePicker(false)
                if (selected) updateRental(dateKey, dateToYyyyMmDd(selected))
              }}
            />
          ) : null}
          <FieldError message={errors[dateKey]} />
        </>
      )}

      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Time</Text>
      <View style={styles.timeRow}>
        <TextInput
          value={rental[hourKey]}
          onChangeText={(v) => updateRental(hourKey, v)}
          placeholder="Hr"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          editable={!readOnly}
          style={[...inputErrorStyle(hourKey), styles.timeInput]}
        />
        <Text style={[styles.timeColon, { color: colors.text }]}>:</Text>
        <TextInput
          value={rental[minuteKey]}
          onChangeText={(v) => updateRental(minuteKey, v)}
          placeholder="Min"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          editable={!readOnly}
          style={[...inputErrorStyle(minuteKey), styles.timeInput]}
        />
        <View style={styles.meridiemRow}>
          {MERIDIEMS.map((m) => (
            <Pressable
              key={m}
              disabled={readOnly}
              onPress={() => updateRental(meridiemKey, m)}
              style={[
                styles.chipSmall,
                {
                  borderColor: rental[meridiemKey] === m ? ACCENT : colors.border,
                  backgroundColor: rental[meridiemKey] === m ? ACCENT : colors.surface,
                  opacity: readOnly ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipTextSmall,
                  { color: rental[meridiemKey] === m ? '#fff' : colors.text },
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FieldError message={errors[hourKey] || errors[minuteKey] || errors[meridiemKey]} />
    </View>
  )

  function renderStepContent() {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              Customer and emergency contact details
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>First name *</Text>
            <TextInput
              value={personal.firstName}
              onChangeText={(v) => updatePersonal('firstName', v)}
              style={inputErrorStyle('firstName')}
            />
            <FieldError message={errors.firstName} />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Middle name</Text>
            <TextInput
              value={personal.middleName}
              onChangeText={(v) => updatePersonal('middleName', v)}
              style={inputStyle}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Last name *</Text>
            <TextInput
              value={personal.lastName}
              onChangeText={(v) => updatePersonal('lastName', v)}
              style={inputErrorStyle('lastName')}
            />
            <FieldError message={errors.lastName} />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Suffix</Text>
            <TextInput
              value={personal.suffix}
              onChangeText={(v) => updatePersonal('suffix', v)}
              style={inputStyle}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Address *</Text>
            <TextInput
              value={personal.address}
              onChangeText={(v) => updatePersonal('address', v)}
              multiline
              style={[...inputErrorStyle('address'), styles.textArea]}
            />
            <FieldError message={errors.address} />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Contact number *</Text>
            <TextInput
              value={personal.contactNo}
              onChangeText={(v) => updatePersonal('contactNo', formatPhMobile(v))}
              onFocus={() => {
                if (!personal.contactNo.trim()) updatePersonal('contactNo', ensurePhMobilePrefix(''))
              }}
              keyboardType="phone-pad"
              style={inputErrorStyle('contactNo')}
            />
            <FieldError message={errors.contactNo} />
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>
              Emergency contact
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name *</Text>
            <TextInput
              value={personal.emergencyName}
              onChangeText={(v) => updatePersonal('emergencyName', v)}
              style={inputErrorStyle('emergencyName')}
            />
            <FieldError message={errors.emergencyName} />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Relationship *</Text>
            <View style={styles.chipWrap}>
              {EMERGENCY_RELATIONS.map((rel) => (
                <Pressable
                  key={rel}
                  onPress={() => updatePersonal('emergencyRelation', rel)}
                  style={[
                    styles.chip,
                    {
                      borderColor: personal.emergencyRelation === rel ? ACCENT : colors.border,
                      backgroundColor:
                        personal.emergencyRelation === rel ? ACCENT : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: personal.emergencyRelation === rel ? '#fff' : colors.text },
                    ]}
                  >
                    {rel}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FieldError message={errors.emergencyRelation} />
            {personal.emergencyRelation === 'Other' ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Specify relationship *
                </Text>
                <TextInput
                  value={personal.emergencyRelationOther}
                  onChangeText={(v) => updatePersonal('emergencyRelationOther', v)}
                  style={inputErrorStyle('emergencyRelationOther')}
                />
                <FieldError message={errors.emergencyRelationOther} />
              </>
            ) : null}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone *</Text>
            <TextInput
              value={personal.emergencyPhone}
              onChangeText={(v) => updatePersonal('emergencyPhone', formatPhMobile(v))}
              onFocus={() => {
                if (!personal.emergencyPhone.trim()) {
                  updatePersonal('emergencyPhone', ensurePhMobilePrefix(''))
                }
              }}
              keyboardType="phone-pad"
              style={inputErrorStyle('emergencyPhone')}
            />
            <FieldError message={errors.emergencyPhone} />
          </>
        )

      case 1:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Select vehicle</Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              Available vehicles ({availableVehicles.length})
            </Text>
            <FieldError message={errors.vehicle} />
            {!ready ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={availableVehicles}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No vehicles available right now.
                  </Text>
                }
                renderItem={({ item }) => {
                  const selected = String(item.id) === String(vehicleId)
                  const display = getDisplayStatus(item, rentals)
                  return (
                    <Pressable
                      onPress={() => {
                        setVehicleId(String(item.id))
                        setErrors((prev) => ({ ...prev, vehicle: '' }))
                      }}
                      style={[
                        styles.vehicleCard,
                        {
                          borderColor: selected ? ACCENT : colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.vehicleTitle, { color: colors.text }]}>
                        {item.make} {item.series}
                      </Text>
                      <Text style={[styles.vehicleMeta, { color: colors.textSecondary }]}>
                        {item.plateNo || '—'} · {displayStatusLabel(display)}
                      </Text>
                      <Text style={[styles.vehicleRates, { color: colors.textMuted }]}>
                        5h ₱{item.rates?.hrs5 ?? '—'} · 12h ₱{item.rates?.hrs12 ?? '—'} · 24h ₱
                        {item.rates?.hrs24 ?? '—'}
                      </Text>
                    </Pressable>
                  )
                }}
              />
            )}
          </>
        )

      case 2:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Rental details</Text>
            {selectedVehicle ? (
              <View style={[styles.vehicleChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.vehicleTitle, { color: colors.text }]}>
                  {selectedVehicle.make} — {selectedVehicle.series}
                </Text>
                <Text style={[styles.vehicleMeta, { color: colors.textSecondary }]}>
                  {selectedVehicle.bodyType} · {selectedVehicle.plateNo}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Duration *</Text>
            <View style={styles.chipWrap}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => updateRental('duration', d)}
                  style={[
                    styles.chip,
                    {
                      borderColor: rental.duration === d ? ACCENT : colors.border,
                      backgroundColor: rental.duration === d ? ACCENT : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: rental.duration === d ? '#fff' : colors.text },
                    ]}
                  >
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FieldError message={errors.duration} />

            {rental.duration === 'Others' ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Days *</Text>
                <TextInput
                  value={daysInputValue}
                  onFocus={() => {
                    setEditingDays(true)
                    if (parsedDays) updateRental('durationOther', String(parsedDays))
                  }}
                  onBlur={() => {
                    setEditingDays(false)
                    const digits = String(rental.durationOther || '').replace(/\D/g, '')
                    if (!digits) {
                      if (rental.durationOther) updateRental('durationOther', '')
                      return
                    }
                    const labeled = formatDurationDaysLabel(digits)
                    if (labeled && labeled !== rental.durationOther) {
                      updateRental('durationOther', labeled)
                    }
                  }}
                  onChangeText={(raw) => {
                    const digits = String(raw).replace(/\D/g, '').slice(0, 3)
                    updateRental('durationOther', digits)
                  }}
                  keyboardType="number-pad"
                  placeholder="e.g. 3"
                  placeholderTextColor={colors.textMuted}
                  style={inputErrorStyle('durationOther')}
                />
                <FieldError message={errors.durationOther} />
              </>
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Rental type *</Text>
            <View style={styles.chipWrap}>
              {RENTAL_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => updateRental('rentalType', type)}
                  style={[
                    styles.chip,
                    {
                      borderColor: rental.rentalType === type ? ACCENT : colors.border,
                      backgroundColor: rental.rentalType === type ? ACCENT : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: rental.rentalType === type ? '#fff' : colors.text },
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FieldError message={errors.rentalType} />

            {renderPeriodBlock({
              label: 'From',
              dateKey: 'fromDate',
              hourKey: 'fromHour',
              minuteKey: 'fromMinute',
              meridiemKey: 'fromMeridiem',
              readOnly: false,
              showDatePicker: showFromDatePicker,
              setShowDatePicker: setShowFromDatePicker,
            })}

            {renderPeriodBlock({
              label: 'To',
              dateKey: 'toDate',
              hourKey: 'toHour',
              minuteKey: 'toMinute',
              meridiemKey: 'toMeridiem',
              readOnly: toLocked,
              showDatePicker: false,
              setShowDatePicker: () => {},
            })}

            {parsedDays ? (
              <Text style={[styles.periodHint, { color: colors.textMuted }]}>
                End time is set from start + {parsedDays} day{parsedDays === 1 ? '' : 's'}.
              </Text>
            ) : durationHours ? (
              <Text style={[styles.periodHint, { color: colors.textMuted }]}>
                End time is set from start + {durationHours} hour{durationHours === 1 ? '' : 's'}.
              </Text>
            ) : rental.duration === 'Others' ? (
              <Text style={[styles.periodHint, { color: colors.textMuted }]}>
                Enter the number of days to auto-fill the end time.
              </Text>
            ) : null}

            <View style={[styles.feePanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Rental fee</Text>
              <Text style={[styles.feeNote, { color: colors.textMuted }]}>
                {rental.feeNote ||
                  (rates ? 'Select duration to calculate' : 'Select a vehicle first')}
              </Text>
              <Text style={[styles.feeAmount, { color: colors.text }]}>
                {rental.rentalFee || '—'}
              </Text>
              <FieldError message={errors.rentalFee} />
            </View>
          </>
        )

      case 3:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Customer photos</Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              Holding license and customer photo are required.
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Holding license *
            </Text>
            <Text style={[styles.slotHint, { color: colors.textMuted }]}>
              Customer holding their driver's license next to their face.
            </Text>
            <Pressable
              style={[styles.photoBtn, { borderColor: colors.border }]}
              onPress={() => void pickImage('holding')}
            >
              <Text style={[styles.photoBtnText, { color: colors.text }]}>Choose photo</Text>
            </Pressable>
            {photo ? <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" /> : null}
            <FieldError message={errors.photo} />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>
              Customer photo *
            </Text>
            <Text style={[styles.slotHint, { color: colors.textMuted }]}>
              Clear photo of the customer (face), or license front.
            </Text>
            <Pressable
              style={[styles.photoBtn, { borderColor: colors.border }]}
              onPress={() => void pickImage('license')}
            >
              <Text style={[styles.photoBtnText, { color: colors.text }]}>Choose photo</Text>
            </Pressable>
            {licensePhoto ? (
              <Image source={{ uri: licensePhoto }} style={styles.preview} resizeMode="cover" />
            ) : null}
            <FieldError message={errors.licensePhoto} />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>
              Optional photo
            </Text>
            <Pressable
              style={[styles.photoBtn, { borderColor: colors.border }]}
              onPress={() => void pickImage('optional')}
            >
              <Text style={[styles.photoBtnText, { color: colors.text }]}>Choose optional photo</Text>
            </Pressable>
            {optionalPhoto ? (
              <Image source={{ uri: optionalPhoto }} style={styles.preview} resizeMode="cover" />
            ) : null}
          </>
        )

      case 4:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{CONTRACT_DOCUMENT_TITLE}</Text>
            <ScrollView
              style={[styles.termsScroll, { borderColor: colors.border, backgroundColor: colors.surface }]}
              nestedScrollEnabled
            >
              {CONTRACT_TERMS.map((clause, index) => (
                <View key={clause.title} style={styles.termsClause}>
                  <Text style={[styles.termsClauseTitle, { color: colors.text }]}>
                    {index + 1}. {clause.title}
                  </Text>
                  <Text style={[styles.termsClauseBody, { color: colors.textSecondary }]}>
                    {clause.body}
                  </Text>
                </View>
              ))}
              <Text style={[styles.liabilityClause, { color: colors.text }]}>{LIABILITY_CLAUSE}</Text>
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>
              Customer signature *
            </Text>
            <View style={[styles.signatureBox, { borderColor: colors.border }]}>
              <SignaturePad
                onChange={(val) => {
                  setSignature(val)
                  setErrors((prev) => ({ ...prev, signature: '', terms: '' }))
                }}
              />
            </View>
            <FieldError message={errors.signature} />

            <Pressable
              onPress={() => {
                setTermsAccepted((v) => !v)
                setErrors((prev) => ({ ...prev, terms: '' }))
              }}
              style={[styles.termsRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxOn]}>
                {termsAccepted ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={[styles.termsText, { color: colors.text }]}>
                I have read and accept the terms, conditions, and undertaking above.
              </Text>
            </Pressable>
            <FieldError message={errors.terms} />
          </>
        )

      case 5:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Car photos (optional)</Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              Document vehicle condition before handover. You can skip and add later.
            </Text>
            {CAR_PHOTO_SLOTS.map((slot) => (
              <View key={slot.key} style={styles.carSlot}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{slot.title}</Text>
                <Text style={[styles.slotHint, { color: colors.textMuted }]}>{slot.hint}</Text>
                <Pressable
                  style={[styles.photoBtn, { borderColor: colors.border }]}
                  onPress={() => void pickImage(slot.key)}
                >
                  <Text style={[styles.photoBtnText, { color: colors.text }]}>
                    {carPhotos[slot.key] ? 'Replace photo' : 'Choose photo'}
                  </Text>
                </Pressable>
                {carPhotos[slot.key] ? (
                  <Image
                    source={{ uri: carPhotos[slot.key] }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
            ))}
            <Pressable
              style={[styles.photoBtn, { borderColor: colors.border, marginTop: 8 }]}
              onPress={() => void pickImage('extra')}
            >
              <Text style={[styles.photoBtnText, { color: colors.text }]}>Add extra photo</Text>
            </Pressable>
            {Array.isArray(carPhotos.extras)
              ? carPhotos.extras.map((extra) => (
                  <Image
                    key={extra.id}
                    source={{ uri: extra.uri }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                ))
              : null}
          </>
        )

      case 6: {
        const fromTime = composeTime(rental.fromHour, rental.fromMinute)
        const toTime = composeTime(rental.toHour, rental.toMinute)
        const periodFromLabel = formatPeriodLabel(rental.fromDate, fromTime, rental.fromMeridiem)
        const periodToLabel = formatPeriodLabel(rental.toDate, toTime, rental.toMeridiem)
        const fullName = [personal.firstName, personal.middleName, personal.lastName]
          .filter(Boolean)
          .join(' ')
        return (
          <View
            style={[styles.summaryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Review & submit</Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Customer: {fullName}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Contact: {personal.contactNo}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Address: {personal.address}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Emergency: {formatEmergencyContact(personal)}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Vehicle: {selectedVehicle?.make} {selectedVehicle?.series} ({selectedVehicle?.plateNo})
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Duration: {rental.duration === 'Others' ? rental.durationOther : rental.duration} ·{' '}
              {rental.rentalType}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              From: {periodFromLabel}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              To: {periodToLabel}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Fee: {rental.rentalFee}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Photos: {photo && licensePhoto ? 'Customer photos attached' : 'Missing photos'}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Signature: {isSignatureSigned(signature) ? 'Signed' : 'Not signed'}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Car photos:{' '}
              {CAR_PHOTO_SLOTS.some((s) => carPhotos[s.key])
                ? 'Some attached'
                : 'None (optional)'}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Encoded by: {encodedByName}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
              Approval: {isAdmin ? 'Auto (admin)' : 'Pending admin review'}
            </Text>
          </View>
        )
      }

      default:
        return null
    }
  }

  const nextDisabled = step === 4 && (!termsAccepted || !isSignatureSigned(signature))

  return (
    <Screen title="Rent Car" scroll contentContainerStyle={styles.container}>
      <StepIndicator step={step} colors={colors} />
      <View style={styles.stepBody}>{renderStepContent()}</View>
      <View style={styles.navRow}>
        {step > 0 ? (
          <Pressable
            onPress={goBack}
            disabled={submitting}
            style={[styles.navBtn, styles.navBtnSecondary, { borderColor: colors.border }]}
          >
            <Text style={[styles.navBtnTextSecondary, { color: colors.text }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}
        {step < STEP_LABELS.length - 1 ? (
          <Pressable
            onPress={goNext}
            disabled={nextDisabled || submitting}
            style={[styles.navBtn, (nextDisabled || submitting) && styles.navBtnDisabled]}
          >
            <Text style={styles.navBtnText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submitting}
            style={[styles.navBtn, submitting && styles.navBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.navBtnText}>Submit</Text>
            )}
          </Pressable>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingVertical: 4,
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 52,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
  },
  stepDotTextOn: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  stepBody: {
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 14,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  inputError: {
    borderColor: ACCENT,
  },
  errorText: {
    color: ACCENT,
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '700',
    fontSize: 14,
  },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTextSmall: {
    fontWeight: '700',
    fontSize: 13,
  },
  vehicleCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  vehicleChip: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  vehicleTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  vehicleMeta: {
    marginTop: 4,
    fontSize: 14,
  },
  vehicleRates: {
    marginTop: 6,
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 15,
  },
  periodCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  periodCardAuto: {
    opacity: 0.92,
  },
  periodCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  autoTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  datePressable: {
    justifyContent: 'center',
  },
  readOnlyValue: {
    fontSize: 16,
    paddingVertical: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  timeInput: {
    width: 56,
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 18,
    fontWeight: '700',
  },
  meridiemRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 4,
  },
  periodHint: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  feePanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  feeNote: {
    fontSize: 13,
    marginBottom: 6,
  },
  feeAmount: {
    fontSize: 22,
    fontWeight: '800',
  },
  photoBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  photoBtnText: {
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 12,
  },
  slotHint: {
    fontSize: 12,
    marginBottom: 8,
  },
  carSlot: {
    marginBottom: 12,
  },
  termsScroll: {
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  termsClause: {
    marginBottom: 12,
  },
  termsClauseTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  termsClauseBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  liabilityClause: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  signatureBox: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: ACCENT,
  },
  checkMark: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  navSpacer: {
    flex: 1,
  },
  navBtn: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.55,
  },
  navBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  navBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  navBtnTextSecondary: {
    fontWeight: '700',
    fontSize: 16,
  },
})
