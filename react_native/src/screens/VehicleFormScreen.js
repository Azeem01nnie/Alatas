import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { ChevronDown } from 'lucide-react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Screen } from '../components/Screen'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'
import { vehicleImageSource } from '../utils/vehicleImages'

const BODY_TYPES = ['Hatchback', 'Sedan', 'MPV', 'SUV', 'Pick-up', 'Van', 'Motorcycle']
const TRANSMISSIONS = ['Automatic', 'Manual', 'Manual / Automatic']
const OWNERSHIP_TYPES = [
  { value: 'company', label: 'Company-owned' },
  { value: 'thirdParty', label: 'Third-party owned' },
]
const STATUS_OPTIONS = [
  { value: 'Available', label: 'Available' },
  { value: 'Under Maintenance', label: 'In maintenance' },
]
const PLATE_MAX = 10

function sanitizePlateNo(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, PLATE_MAX)
}

function autoCapitalizeWords(value) {
  return String(value ?? '').replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

function emptyForm() {
  return {
    ownerName: '',
    ownershipType: 'company',
    make: '',
    series: '',
    bodyType: 'Sedan',
    seats: '5',
    transmission: 'Automatic',
    status: 'Available',
    plateNo: '',
    engineNo: '',
    chassisNo: '',
    hrs5: '',
    hrs12: '',
    hrs24: '',
    exceedHour: '',
    image: '',
    orcrImage: '',
    orImage: '',
  }
}

function vehicleToForm(vehicle) {
  return {
    ownerName: vehicle.ownerName || '',
    ownershipType: vehicle.ownershipType === 'thirdParty' ? 'thirdParty' : 'company',
    make: vehicle.make || '',
    series: vehicle.series || '',
    bodyType: vehicle.bodyType || 'Sedan',
    seats: vehicle.seats != null ? String(vehicle.seats) : '5',
    transmission: vehicle.transmission || 'Automatic',
    status: vehicle.status === 'Under Maintenance' ? 'Under Maintenance' : 'Available',
    plateNo: sanitizePlateNo(vehicle.plateNo),
    engineNo: vehicle.engineNo || '',
    chassisNo: vehicle.chassisNo || '',
    hrs5: vehicle.rates?.hrs5 != null ? String(vehicle.rates.hrs5) : '',
    hrs12: vehicle.rates?.hrs12 != null ? String(vehicle.rates.hrs12) : '',
    hrs24: vehicle.rates?.hrs24 != null ? String(vehicle.rates.hrs24) : '',
    exceedHour: vehicle.rates?.exceedHour != null ? String(vehicle.rates.exceedHour) : '',
    image: vehicle.image || '',
    orcrImage: vehicle.orcrImage || '',
    orImage: vehicle.orImage || '',
  }
}

function previewSource(image) {
  return vehicleImageSource({ image })
}

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function Section({ title, copy, colors, children }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {copy ? (
        <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>{copy}</Text>
      ) : null}
      {children}
    </View>
  )
}

function FieldLabel({ children, colors, required }) {
  return (
    <Text style={[styles.label, { color: colors.textSecondary }]}>
      {children}
      {required ? <Text style={{ color: ACCENT }}> *</Text> : null}
    </Text>
  )
}

function ChipSelect({ options, value, onChange, colors, disabled }) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const active = value === val
        return (
          <Pressable
            key={val}
            disabled={disabled}
            onPress={() => onChange(val)}
            style={[
              styles.chip,
              {
                borderColor: active ? ACCENT : colors.border,
                backgroundColor: active ? ACCENT : colors.inputBackground,
                opacity: disabled ? 0.55 : 1,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function VehicleFormScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { vehicles, addVehicle, updateVehicle } = useFleet()
  const { colors } = useTheme()

  const vehicleId = route.params?.vehicleId
  const existing = useMemo(
    () => (vehicleId ? vehicles.find((v) => String(v.id) === String(vehicleId)) : null),
    [vehicles, vehicleId],
  )
  const missingEdit = Boolean(vehicleId) && !existing
  const statusLocked = existing?.status === 'Rented'

  const ownerSuggestions = useMemo(() => {
    const map = new Map()
    for (const v of vehicles) {
      const name = String(v.ownerName || '').trim()
      if (!name) continue
      if (!map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          name,
          ownershipType: v.ownershipType === 'thirdParty' ? 'thirdParty' : 'company',
          ownerId: v.ownerId || '',
        })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [vehicles])

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [hydratedId, setHydratedId] = useState(null)
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
  const [addingNewOwner, setAddingNewOwner] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({ title: vehicleId ? 'Edit Vehicle' : 'Add Vehicle' })
  }, [navigation, vehicleId])

  useLayoutEffect(() => {
    if (!vehicleId) {
      if (hydratedId !== null) {
        setForm(emptyForm())
        setHydratedId(null)
        setFieldsLocked(false)
      }
      return
    }
    if (existing && hydratedId !== String(existing.id)) {
      setForm(vehicleToForm(existing))
      setHydratedId(String(existing.id))
      setFieldsLocked(Boolean(existing.orcrImage || existing.orImage))
      setAddingNewOwner(false)
    }
  }, [vehicleId, existing, hydratedId])

  const inputStyle = useCallback(
    (extra) => [
      styles.input,
      {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
        color: colors.text,
      },
      fieldsLocked && styles.inputLocked,
      extra,
    ],
    [colors, fieldsLocked],
  )

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function pickDataUrl({ imagesOnly = false } = {}) {
    if (imagesOnly) {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to attach images.')
        return ''
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
        quality: 0.7,
        base64: true,
      })
      if (result.canceled || !result.assets?.[0]) return ''
      const asset = result.assets[0]
      return asset.base64
        ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
        : asset.uri
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (result.canceled || !result.assets?.[0]) return ''
    const asset = result.assets[0]
    const uri = asset.uri
    if (asset.mimeType?.startsWith('image/')) {
      try {
        const resp = await fetch(uri)
        const blob = await resp.blob()
        return await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Could not read file'))
          reader.readAsDataURL(blob)
        })
      } catch {
        return uri
      }
    }
    return uri
  }

  async function uploadCr() {
    const dataUrl = await pickDataUrl()
    if (!dataUrl) return
    setField('orcrImage', dataUrl)
    setFieldsLocked(true)
  }

  async function uploadOr() {
    const dataUrl = await pickDataUrl()
    if (!dataUrl) return
    setField('orImage', dataUrl)
    setFieldsLocked(true)
  }

  async function assetToDataUrl(asset) {
    if (!asset) return ''
    if (asset.base64) {
      return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
    }
    return asset.uri || ''
  }

  async function pickDisplayFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a vehicle image.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
      quality: 0.7,
      base64: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const dataUrl = await assetToDataUrl(result.assets[0])
    if (dataUrl) setField('image', dataUrl)
  }

  async function takeDisplayPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a vehicle photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const dataUrl = await assetToDataUrl(result.assets[0])
    if (dataUrl) setField('image', dataUrl)
  }

  function selectOwnerSuggestion(owner) {
    setForm((prev) => ({
      ...prev,
      ownerName: owner.name,
      ownershipType: owner.ownershipType,
    }))
    setAddingNewOwner(false)
    setOwnerMenuOpen(false)
  }

  function startAddNewOwner() {
    setAddingNewOwner(true)
    setOwnerMenuOpen(false)
    setField('ownerName', '')
  }

  function validate() {
    const next = {}
    if (!form.ownerName.trim()) next.ownerName = 'Owner is required'
    if (!form.make.trim()) next.make = 'Brand is required'
    if (!form.series.trim()) next.series = 'Model / series is required'
    if (!form.bodyType.trim()) next.bodyType = 'Body type is required'
    if (!form.seats.trim() || Number(form.seats) < 1) next.seats = 'Seats are required'
    if (!form.transmission.trim()) next.transmission = 'Transmission is required'
    if (!form.plateNo.trim()) next.plateNo = 'Plate number is required'
    if (!String(form.hrs5).trim()) next.hrs5 = '5-hour rate is required'
    if (!String(form.hrs12).trim()) next.hrs12 = '12-hour rate is required'
    if (!String(form.hrs24).trim()) next.hrs24 = '24-hour rate is required'
    return next
  }

  async function handleSave() {
    const errors = validate()
    if (Object.keys(errors).length) {
      Alert.alert('Missing fields', Object.values(errors)[0])
      return
    }

    setSaving(true)
    try {
      const ownershipType = form.ownershipType === 'thirdParty' ? 'thirdParty' : 'company'
      const ownerName = autoCapitalizeWords(form.ownerName.trim())
      const matched = ownerSuggestions.find((o) => o.name.toLowerCase() === ownerName.toLowerCase())
      const ownerId =
        (existing?.ownerId &&
          String(existing.ownerName || '').toLowerCase() === ownerName.toLowerCase() &&
          existing.ownerId) ||
        matched?.ownerId ||
        `own_${Date.now().toString(36)}`

      const payload = {
        make: autoCapitalizeWords(form.make.trim()),
        series: autoCapitalizeWords(form.series.trim()),
        bodyType: form.bodyType.trim(),
        seats: Number(form.seats) || 5,
        transmission: form.transmission.trim(),
        plateNo: sanitizePlateNo(form.plateNo),
        engineNo: form.engineNo.trim().toUpperCase(),
        chassisNo: form.chassisNo.trim().toUpperCase(),
        image: form.image || '',
        status: statusLocked
          ? 'Rented'
          : form.status === 'Under Maintenance'
            ? 'Under Maintenance'
            : 'Available',
        ownerId,
        ownerName,
        ownershipType,
        orcrImage: form.orcrImage || '',
        orImage: form.orImage || '',
        rates: {
          hrs5: parseAmount(form.hrs5),
          hrs12: parseAmount(form.hrs12),
          hrs24: parseAmount(form.hrs24),
          exceedHour: parseAmount(form.exceedHour),
        },
      }

      if (vehicleId && existing) {
        updateVehicle(existing.id, payload)
        Alert.alert('Saved', 'Vehicle details updated.')
      } else {
        addVehicle({
          id: `v-${Date.now()}`,
          ...payload,
        })
        Alert.alert('Saved', 'Vehicle added to the fleet.')
      }
      navigation.goBack()
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not save vehicle.')
    } finally {
      setSaving(false)
    }
  }

  if (missingEdit) {
    return (
      <Screen scroll contentContainerStyle={styles.container}>
        <Text style={[styles.missing, { color: colors.textMuted }]}>
          Vehicle not found. It may have been removed.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.outlineBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.outlineBtnText, { color: colors.text }]}>Go back</Text>
        </Pressable>
      </Screen>
    )
  }

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      <Section
        title="LTO OR & CR scan"
        copy="Upload the Certificate of Registration (CR) and Official Receipt (OR) as an image or PDF. After upload, fields lock — tap Edit to correct mistakes."
        colors={colors}
      >
        <View style={styles.rowBtns}>
          <Pressable
            onPress={() => void uploadCr()}
            style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
          >
            <Text style={[styles.outlineBtnText, { color: colors.text }]}>
              {form.orcrImage ? 'Re-scan CR' : 'Upload CR'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void uploadOr()}
            style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
          >
            <Text style={[styles.outlineBtnText, { color: colors.text }]}>
              {form.orImage ? 'Re-scan OR' : 'Upload OR'}
            </Text>
          </Pressable>
          {fieldsLocked ? (
            <Pressable
              onPress={() => setFieldsLocked(false)}
              style={[styles.outlineBtn, { borderColor: ACCENT }]}
            >
              <Text style={[styles.outlineBtnText, { color: ACCENT }]}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
        {(form.orcrImage || form.orImage) && (
          <View style={styles.docPreviewRow}>
            {form.orcrImage ? (
              <View style={styles.docPreview}>
                <Text style={[styles.docLabel, { color: colors.textMuted }]}>CR</Text>
                <Image source={previewSource(form.orcrImage)} style={styles.docThumb} />
              </View>
            ) : null}
            {form.orImage ? (
              <View style={styles.docPreview}>
                <Text style={[styles.docLabel, { color: colors.textMuted }]}>OR</Text>
                <Image source={previewSource(form.orImage)} style={styles.docThumb} />
              </View>
            ) : null}
          </View>
        )}
      </Section>

      <Section
        title="Owner & ownership"
        copy="Links this vehicle to Vehicle Reports (Owner → Vehicle)."
        colors={colors}
      >
        <FieldLabel colors={colors} required>
          Ownership type
        </FieldLabel>
        <ChipSelect
          options={OWNERSHIP_TYPES}
          value={form.ownershipType}
          onChange={(v) => setField('ownershipType', v)}
          colors={colors}
          disabled={fieldsLocked}
        />

        <FieldLabel colors={colors} required>
          Owner
        </FieldLabel>
        <View style={styles.selectWrap}>
          <Pressable
            disabled={fieldsLocked}
            onPress={() => {
              if (fieldsLocked) return
              setOwnerMenuOpen((open) => !open)
            }}
            style={[
              styles.selectTrigger,
              {
                backgroundColor: colors.surface,
                borderColor: ownerMenuOpen ? '#d97706' : colors.border,
                opacity: fieldsLocked ? 0.55 : 1,
              },
              ownerMenuOpen && styles.selectTriggerOpen,
            ]}
          >
            <Text
              style={[
                styles.selectTriggerText,
                { color: form.ownerName && !addingNewOwner ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {addingNewOwner
                ? '+ Add New Owner'
                : form.ownerName || 'Select owner…'}
            </Text>
            <View style={ownerMenuOpen ? styles.chevronOpen : null}>
              <ChevronDown size={18} color={colors.textMuted} strokeWidth={2.2} />
            </View>
          </Pressable>

          {ownerMenuOpen && !fieldsLocked ? (
            <View
              style={[
                styles.inlineDropdown,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ScrollView
                style={styles.inlineDropdownScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <Pressable
                  onPress={() => {
                    setField('ownerName', '')
                    setAddingNewOwner(false)
                    setOwnerMenuOpen(false)
                  }}
                  style={[
                    styles.inlineOption,
                    !form.ownerName && !addingNewOwner && styles.inlineOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.inlineOptionText,
                      {
                        color:
                          !form.ownerName && !addingNewOwner ? '#fff' : colors.textMuted,
                      },
                    ]}
                  >
                    Select owner…
                  </Text>
                </Pressable>

                <Pressable
                  onPress={startAddNewOwner}
                  style={[
                    styles.inlineOption,
                    { borderBottomColor: colors.border },
                    addingNewOwner && styles.inlineOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.inlineOptionText,
                      { color: addingNewOwner ? '#fff' : colors.text, fontWeight: '700' },
                    ]}
                  >
                    + Add New Owner
                  </Text>
                </Pressable>

                {ownerSuggestions.map((item) => {
                  const selected =
                    !addingNewOwner &&
                    form.ownerName.trim().toLowerCase() === item.name.toLowerCase()
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => selectOwnerSuggestion(item)}
                      style={[
                        styles.inlineOption,
                        { borderBottomColor: colors.border },
                        selected && styles.inlineOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.inlineOptionText,
                          { color: selected ? '#fff' : colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                        {item.ownershipType === 'thirdParty' ? ' (Third-party)' : ' (Company)'}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {addingNewOwner && !fieldsLocked ? (
          <View style={styles.newOwnerWrap}>
            <FieldLabel colors={colors}>New owner name</FieldLabel>
            <TextInput
              value={form.ownerName}
              onChangeText={(v) => setField('ownerName', autoCapitalizeWords(v))}
              placeholder="Type owner name…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={inputStyle()}
            />
          </View>
        ) : null}
      </Section>

      <Section
        title="Vehicle details"
        copy="Core fleet information shown across the system."
        colors={colors}
      >
        <FieldLabel colors={colors} required>
          Brand
        </FieldLabel>
        <TextInput
          value={form.make}
          onChangeText={(v) => setField('make', autoCapitalizeWords(v))}
          editable={!fieldsLocked}
          placeholder="Toyota"
          placeholderTextColor={colors.textMuted}
          style={inputStyle()}
        />

        <FieldLabel colors={colors} required>
          Model / Series
        </FieldLabel>
        <TextInput
          value={form.series}
          onChangeText={(v) => setField('series', autoCapitalizeWords(v))}
          editable={!fieldsLocked}
          placeholder="Wigo"
          placeholderTextColor={colors.textMuted}
          style={inputStyle()}
        />

        <FieldLabel colors={colors} required>
          Body type
        </FieldLabel>
        <ChipSelect
          options={BODY_TYPES}
          value={form.bodyType}
          onChange={(v) => setField('bodyType', v)}
          colors={colors}
          disabled={fieldsLocked}
        />

        <FieldLabel colors={colors} required>
          Seats
        </FieldLabel>
        <TextInput
          value={form.seats}
          onChangeText={(v) => setField('seats', v.replace(/[^\d]/g, ''))}
          editable={!fieldsLocked}
          keyboardType="number-pad"
          placeholder="5"
          placeholderTextColor={colors.textMuted}
          style={inputStyle()}
        />

        <FieldLabel colors={colors} required>
          Transmission
        </FieldLabel>
        <ChipSelect
          options={TRANSMISSIONS}
          value={form.transmission}
          onChange={(v) => setField('transmission', v)}
          colors={colors}
          disabled={fieldsLocked}
        />

        <FieldLabel colors={colors}>Fleet status</FieldLabel>
        {statusLocked ? (
          <Text style={[styles.hint, { color: ACCENT, marginTop: 0 }]}>
            On rent — status is managed by the active rental.
          </Text>
        ) : (
          <>
            <ChipSelect
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(v) => setField('status', v)}
              colors={colors}
              disabled={fieldsLocked}
            />
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              In maintenance vehicles are hidden from Rent Car selection.
            </Text>
          </>
        )}

        <FieldLabel colors={colors} required>
          Plate no.
        </FieldLabel>
        <TextInput
          value={form.plateNo}
          onChangeText={(v) => setField('plateNo', sanitizePlateNo(v))}
          editable={!fieldsLocked}
          autoCapitalize="characters"
          maxLength={PLATE_MAX}
          placeholder="Max 10 letters/digits"
          placeholderTextColor={colors.textMuted}
          style={inputStyle()}
        />

        <FieldLabel colors={colors}>Engine no.</FieldLabel>
        <TextInput
          value={form.engineNo}
          onChangeText={(v) => setField('engineNo', v.toUpperCase())}
          editable={!fieldsLocked}
          autoCapitalize="characters"
          placeholder="As on CR"
          placeholderTextColor={colors.textMuted}
          style={inputStyle()}
        />

        <FieldLabel colors={colors}>Chassis no.</FieldLabel>
        <TextInput
          value={form.chassisNo}
          onChangeText={(v) => setField('chassisNo', v.toUpperCase())}
          editable={!fieldsLocked}
          autoCapitalize="characters"
          placeholder="As on CR"
          placeholderTextColor={colors.textMuted}
          style={inputStyle()}
        />
      </Section>

      <Section
        title="City drive rates (₱)"
        copy="Keep rate cards clean and accurate for auto-computation."
        colors={colors}
      >
        {[
          ['hrs5', '5 hours', true],
          ['hrs12', '12 hours', true],
          ['hrs24', '24 hours', true],
          ['exceedHour', 'Exceeding / hour', false],
        ].map(([key, label, required]) => (
          <View key={key}>
            <FieldLabel colors={colors} required={required}>
              {label}
            </FieldLabel>
            <TextInput
              value={form[key]}
              onChangeText={(v) => setField(key, v.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              style={inputStyle()}
            />
          </View>
        ))}
      </Section>

      <Section
        title="Display image"
        copy="Take a photo or upload an image. Shown on fleet cards and rent car selection."
        colors={colors}
      >
        <Image source={previewSource(form.image)} style={styles.preview} resizeMode="cover" />
        <View style={styles.rowBtns}>
          <Pressable
            onPress={() => void takeDisplayPhoto()}
            style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
          >
            <Text style={[styles.outlineBtnText, { color: colors.text }]}>Take photo</Text>
          </Pressable>
          <Pressable
            onPress={() => void pickDisplayFromLibrary()}
            style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
          >
            <Text style={[styles.outlineBtnText, { color: colors.text }]}>Upload image</Text>
          </Pressable>
        </View>
        {form.image ? (
          <Pressable
            onPress={() => setField('image', '')}
            style={[
              styles.outlineBtn,
              { borderColor: '#f1c0c2', backgroundColor: '#fdf2f2', marginTop: 10 },
            ]}
          >
            <Text style={[styles.outlineBtnText, { color: ACCENT }]}>Remove photo</Text>
          </Pressable>
        ) : null}
      </Section>

      <Pressable
        onPress={() => void handleSave()}
        disabled={saving}
        style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
      >
        <Text style={styles.primaryBtnText}>
          {saving ? 'Saving…' : vehicleId ? 'Save changes' : 'Add vehicle'}
        </Text>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    paddingTop: 8,
    gap: 12,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCopy: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 16,
  },
  inputLocked: {
    opacity: 0.7,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectWrap: {
    position: 'relative',
    zIndex: 2,
  },
  selectTrigger: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 15,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  inlineDropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
  },
  inlineDropdownScroll: {
    maxHeight: 220,
  },
  inlineOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineOptionActive: {
    backgroundColor: '#2563eb',
    borderBottomColor: 'transparent',
  },
  inlineOptionText: {
    fontSize: 15,
  },
  newOwnerWrap: {
    marginTop: 4,
  },
  rowBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  docPreviewRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  docPreview: {
    flex: 1,
  },
  docLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  docThumb: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    backgroundColor: '#ececec',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#ececec',
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  missing: {
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
    fontSize: 15,
  },
})
