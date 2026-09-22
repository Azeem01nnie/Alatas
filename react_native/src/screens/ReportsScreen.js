import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Pencil, Trash2 } from 'lucide-react-native'
import { fetchVehicleReportsRemote, saveVehicleReportsRemote } from '../api/backend'
import ConfirmModal from '../components/ConfirmModal'
import { Screen } from '../components/Screen'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'
import {
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  REPORT_TYPES,
  endOfMonth,
  filterEntries,
  startOfMonth,
  sumAmounts,
  toReportDateKey,
} from '../utils/vehicleReports'

const logoFallback = require('../../assets/logo.jpg')

const EMPTY_ENTRY = {
  date: toReportDateKey(new Date()),
  type: 'Expense',
  category: 'Parts',
  description: '',
  amount: '',
  status: 'Completed',
  attachment: '',
}

function formatPeso(n) {
  const num = Number(n) || 0
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function vehicleImageSource(vehicle) {
  const uri = String(vehicle?.image || '').trim()
  if (uri && (uri.startsWith('http') || uri.startsWith('data:') || uri.startsWith('file:'))) {
    return { uri }
  }
  return logoFallback
}

async function assetToDataUrl(asset) {
  if (!asset) return ''
  if (asset.base64) {
    return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
  }
  return asset.uri || ''
}

function ChipSelect({ options, value, onChange, colors }) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const active = value === val
        return (
          <Pressable
            key={val}
            onPress={() => onChange(val)}
            style={[
              styles.chip,
              {
                borderColor: active ? ACCENT : colors.border,
                backgroundColor: active ? ACCENT : colors.inputBackground,
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

function EntryFormModal({ visible, title, initial, colors, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_ENTRY)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (visible) {
      setForm({
        ...EMPTY_ENTRY,
        date: toReportDateKey(new Date()),
        ...(initial || {}),
        attachment: initial?.attachment || '',
      })
      setError('')
    }
  }, [visible, initial])

  function set(key, val) {
    setForm((p) => ({ ...p, [key]: val }))
  }

  async function takePhoto() {
    setPicking(true)
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow camera access to attach a photo.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const dataUrl = await assetToDataUrl(result.assets[0])
      if (dataUrl) set('attachment', dataUrl)
    } finally {
      setPicking(false)
    }
  }

  async function uploadImage() {
    setPicking(true)
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to attach an image.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
        quality: 0.7,
        base64: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const dataUrl = await assetToDataUrl(result.assets[0])
      if (dataUrl) set('attachment', dataUrl)
    } finally {
      setPicking(false)
    }
  }

  function submit() {
    if (!String(form.description || '').trim()) {
      setError('Description is required')
      return
    }
    if (form.type !== 'Issue' && form.amount === '') {
      setError('Amount is required for expenses and repairs')
      return
    }
    onSave(form)
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.inputBackground,
      borderColor: colors.border,
      color: colors.text,
    },
  ]

  const hasImage =
    typeof form.attachment === 'string' &&
    (form.attachment.startsWith('data:image') ||
      form.attachment.startsWith('http') ||
      form.attachment.startsWith('file:'))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ScrollView
          style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
          <TextInput
            value={form.date}
            onChangeText={(v) => set('date', v)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={inputStyle}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
          <ChipSelect
            options={REPORT_TYPES}
            value={form.type}
            onChange={(v) => set('type', v)}
            colors={colors}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <ChipSelect
            options={REPORT_CATEGORIES}
            value={form.category}
            onChange={(v) => set('category', v)}
            colors={colors}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Description *</Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => set('description', v)}
            placeholder="What was done / issue details"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[...inputStyle, styles.noteInput]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Amount (₱)</Text>
          <TextInput
            value={String(form.amount ?? '')}
            onChangeText={(v) => set('amount', v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
          <ChipSelect
            options={REPORT_STATUSES}
            value={form.status}
            onChange={(v) => set('status', v)}
            colors={colors}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Image</Text>
          <Text style={[styles.attachHint, { color: colors.textMuted }]}>
            Optional receipt or proof photo.
          </Text>
          {hasImage ? (
            <Image source={{ uri: form.attachment }} style={styles.attachPreview} resizeMode="cover" />
          ) : null}
          <View style={styles.attachRow}>
            <Pressable
              onPress={() => void takePhoto()}
              disabled={picking}
              style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
            >
              <Text style={[styles.outlineBtnText, { color: colors.text }]}>
                {picking ? '…' : 'Take photo'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void uploadImage()}
              disabled={picking}
              style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
            >
              <Text style={[styles.outlineBtnText, { color: colors.text }]}>Upload image</Text>
            </Pressable>
          </View>
          {hasImage ? (
            <Pressable
              onPress={() => set('attachment', '')}
              style={[
                styles.outlineBtn,
                { borderColor: '#f1c0c2', backgroundColor: '#fdf2f2', marginTop: 8 },
              ]}
            >
              <Text style={[styles.outlineBtnText, { color: ACCENT }]}>Remove image</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
            >
              <Text style={[styles.outlineBtnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} style={[styles.primaryBtn, { flex: 1 }]}>
              <Text style={styles.primaryBtnText}>Save entry</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

export default function ReportsScreen() {
  const { vehicles, updateVehicle } = useFleet()
  const { user } = useAuth()
  const { colors } = useTheme()

  const [store, setStore] = useState({ entries: [], submissions: [] })
  const [loading, setLoading] = useState(true)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [rangePreset, setRangePreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [deleteRow, setDeleteRow] = useState(null)
  const [editOwner, setEditOwner] = useState(null)
  const [ownerNameDraft, setOwnerNameDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const adminName = user?.displayName || user?.username || 'Admin'

  const persistStore = useCallback(async (next) => {
    const saved = await saveVehicleReportsRemote(next)
    setStore({
      entries: Array.isArray(saved?.entries) ? saved.entries : next.entries,
      submissions: Array.isArray(saved?.submissions) ? saved.submissions : next.submissions || [],
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const remote = await fetchVehicleReportsRemote()
      setStore({
        entries: Array.isArray(remote?.entries) ? remote.entries : [],
        submissions: Array.isArray(remote?.submissions) ? remote.submissions : [],
      })
    } catch (err) {
      Alert.alert('Load failed', err?.message || 'Could not load reports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ownersFromVehicles = useMemo(() => {
    const map = new Map()
    for (const v of vehicles) {
      const ownerKey =
        String(v.ownerId || '').trim() ||
        (v.ownerName ? `name:${String(v.ownerName).trim().toLowerCase()}` : '')
      if (!ownerKey) continue
      if (!map.has(ownerKey)) {
        map.set(ownerKey, {
          id: v.ownerId || ownerKey,
          name: v.ownerName || 'Unknown owner',
          ownershipType: v.ownershipType === 'thirdParty' ? 'thirdParty' : 'company',
          vehicleCount: 0,
        })
      }
      map.get(ownerKey).vehicleCount += 1
    }
    return [...map.values()]
      .filter((o) => o.vehicleCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [vehicles])

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase()
    if (!q) return ownersFromVehicles
    return ownersFromVehicles.filter((o) => {
      if (o.name.toLowerCase().includes(q)) return true
      return vehicles.some((v) => {
        const matchesOwner =
          (v.ownerId && v.ownerId === o.id) ||
          (!v.ownerId &&
            v.ownerName &&
            String(v.ownerName).trim().toLowerCase() === String(o.name).trim().toLowerCase())
        if (!matchesOwner) return false
        return `${v.make || ''} ${v.series || ''} ${v.plateNo || ''}`.toLowerCase().includes(q)
      })
    })
  }, [ownersFromVehicles, ownerSearch, vehicles])

  const selectedOwner = ownersFromVehicles.find((o) => o.id === selectedOwnerId)

  const ownerVehicles = useMemo(() => {
    if (!selectedOwnerId) return []
    return vehicles
      .filter((v) => {
        if (v.ownerId && v.ownerId === selectedOwnerId) return true
        if (
          !v.ownerId &&
          selectedOwnerId.startsWith('name:') &&
          v.ownerName &&
          `name:${String(v.ownerName).trim().toLowerCase()}` === selectedOwnerId
        ) {
          return true
        }
        return false
      })
      .sort((a, b) => String(a.plateNo || '').localeCompare(String(b.plateNo || '')))
  }, [vehicles, selectedOwnerId])

  const selectedVehicle = vehicles.find((v) => String(v.id) === String(selectedVehicleId))

  const dateBounds = useMemo(() => {
    if (rangePreset === 'all') return { from: null, to: null }
    if (rangePreset === 'custom') {
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
        to: customTo ? new Date(`${customTo}T23:59:59.999`) : null,
      }
    }
    return { from: startOfMonth(), to: endOfMonth() }
  }, [rangePreset, customFrom, customTo])

  const entries = useMemo(() => {
    if (!selectedVehicleId) return []
    return filterEntries(store.entries, {
      vehicleId: selectedVehicleId,
      from: dateBounds.from,
      to: dateBounds.to,
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [store.entries, selectedVehicleId, dateBounds])

  const total = sumAmounts(entries)

  function applyRangePreset(preset) {
    setRangePreset(preset)
    if (preset === 'custom' && !customFrom && !customTo) {
      const now = new Date()
      setCustomFrom(toReportDateKey(startOfMonth(now)))
      setCustomTo(toReportDateKey(endOfMonth(now)))
    }
  }

  async function handleAddSave(form) {
    setSaving(true)
    try {
      const entry = {
        id: `vre_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        ownerId: selectedOwnerId,
        vehicleId: selectedVehicleId,
        plateNo: selectedVehicle?.plateNo || '',
        date: form.date,
        type: form.type,
        category: form.category,
        description: String(form.description || '').trim(),
        amount: form.amount === '' ? null : Number(form.amount),
        status: form.status,
        attachment: form.attachment || '',
        recordedBy: adminName,
        createdAt: new Date().toISOString(),
      }
      await persistStore({
        ...store,
        entries: [entry, ...(store.entries || [])],
      })
      setAddOpen(false)
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not save entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSave(form) {
    if (!editRow?.id) return
    setSaving(true)
    try {
      const nextEntries = (store.entries || []).map((e) =>
        e.id === editRow.id
          ? {
              ...e,
              date: form.date,
              type: form.type,
              category: form.category,
              description: String(form.description || '').trim(),
              amount: form.amount === '' ? null : Number(form.amount),
              status: form.status,
              attachment: form.attachment || '',
            }
          : e,
      )
      await persistStore({ ...store, entries: nextEntries })
      setEditRow(null)
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not update entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteRow?.id) return
    setSaving(true)
    try {
      await persistStore({
        ...store,
        entries: (store.entries || []).filter((e) => e.id !== deleteRow.id),
      })
      setDeleteRow(null)
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not delete entry.')
    } finally {
      setSaving(false)
    }
  }

  function handleOwnerRename() {
    const name = ownerNameDraft.trim()
    if (!name || !editOwner) return
    const matches = vehicles.filter((v) => {
      if (v.ownerId && v.ownerId === editOwner.id) return true
      if (
        !v.ownerId &&
        editOwner.id.startsWith('name:') &&
        v.ownerName &&
        `name:${String(v.ownerName).trim().toLowerCase()}` === editOwner.id
      ) {
        return true
      }
      return (
        v.ownerName &&
        String(v.ownerName).trim().toLowerCase() === String(editOwner.name).trim().toLowerCase()
      )
    })
    for (const v of matches) {
      updateVehicle(v.id, { ownerName: name })
    }
    setEditOwner(null)
    setOwnerNameDraft('')
  }

  async function shareSummary() {
    if (!selectedVehicle) return
    const lines = [
      'Vehicle Reports',
      `Owner: ${selectedOwner?.name || '—'}`,
      `Vehicle: ${selectedVehicle.make} ${selectedVehicle.series} (${selectedVehicle.plateNo})`,
      `Period: ${rangePreset === 'all' ? 'All time' : rangePreset === 'custom' ? `${customFrom} → ${customTo}` : 'This month'}`,
      `Running total: ${formatPeso(total)}`,
      '',
      ...entries.map(
        (e) =>
          `${e.date || '—'} · ${e.type || '—'} · ${e.category || '—'} · ${e.description || '—'} · ${
            e.amount == null || e.amount === '' ? '₱0' : formatPeso(e.amount)
          } · ${e.status || '—'}`,
      ),
    ]
    try {
      await Share.share({ message: lines.join('\n') })
    } catch {
      /* user cancelled */
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.inputBackground,
      borderColor: colors.border,
      color: colors.text,
    },
  ]

  // ── Owners list ───────────────────────────────────────────────
  if (!selectedOwnerId) {
    return (
      <Screen title="Vehicle Reports" scroll contentContainerStyle={styles.container}>
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>Search</Text>
        <TextInput
          value={ownerSearch}
          onChangeText={setOwnerSearch}
          placeholder="Search owner, plate, or vehicle…"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />

        <Text style={[styles.listHeading, { color: colors.textSecondary }]}>
          Owners {loading ? '(loading…)' : `(${filteredOwners.length})`}
        </Text>

        <FlatList
          data={filteredOwners}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          ListEmptyComponent={
            !loading ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                No owners linked to vehicles yet.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const third = item.ownershipType === 'thirdParty'
            return (
              <Pressable
                onPress={() => {
                  setSelectedOwnerId(item.id)
                  setSelectedVehicleId('')
                }}
                style={[styles.ownerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.ownerCardTop}>
                  <Text style={[styles.ownerName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setEditOwner(item)
                      setOwnerNameDraft(item.name)
                    }}
                    hitSlop={8}
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                  >
                    <Pencil size={16} color={colors.textMuted} strokeWidth={2.2} />
                  </Pressable>
                </View>
                <View style={styles.ownerMeta}>
                  <View
                    style={[
                      styles.ownerBadge,
                      {
                        backgroundColor: third ? '#e8f5e9' : colors.inputBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.ownerBadgeText, { color: third ? '#2e7d32' : colors.text }]}>
                      {third ? 'Third-party' : 'Company'}
                    </Text>
                  </View>
                  <Text style={[styles.ownerCount, { color: colors.textMuted }]}>
                    {item.vehicleCount} {item.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
                  </Text>
                </View>
              </Pressable>
            )
          }}
        />

        <Modal
          visible={Boolean(editOwner)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditOwner(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setEditOwner(null)}>
            <View
              style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit owner</Text>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Owner name</Text>
              <TextInput
                value={ownerNameDraft}
                onChangeText={setOwnerNameDraft}
                autoFocus
                style={inputStyle}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setEditOwner(null)}
                  style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
                >
                  <Text style={[styles.outlineBtnText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleOwnerRename} style={[styles.primaryBtn, { flex: 1 }]}>
                  <Text style={styles.primaryBtnText}>Save changes</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </Screen>
    )
  }

  // ── Owner vehicles ────────────────────────────────────────────
  if (!selectedVehicleId) {
    return (
      <Screen title="Vehicle Reports" scroll contentContainerStyle={styles.container}>
        <Pressable
          onPress={() => setSelectedOwnerId('')}
          style={styles.backLink}
        >
          <Text style={[styles.backLinkText, { color: colors.textMuted }]}>← Back to owners</Text>
        </Pressable>
        <Text style={[styles.pageTitle, { color: colors.text }]}>
          {selectedOwner?.name || 'Owner'}
        </Text>

        <FlatList
          data={ownerVehicles}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No vehicles for this owner.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedVehicleId(String(item.id))}
              style={[
                styles.vehicleCard,
                { backgroundColor: colors.surface, borderColor: `${ACCENT}55` },
              ]}
            >
              <Image source={vehicleImageSource(item)} style={styles.vehicleThumb} resizeMode="cover" />
              <View style={styles.vehicleMeta}>
                <Text style={[styles.vehicleTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.make} {item.series}
                </Text>
                <Text style={[styles.vehiclePlate, { color: colors.textSecondary }]}>
                  {item.plateNo || '—'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </Screen>
    )
  }

  // ── Vehicle entries ───────────────────────────────────────────
  return (
    <Screen title="Vehicle Reports" scroll contentContainerStyle={styles.container}>
      <Pressable
        onPress={() => setSelectedVehicleId('')}
        style={styles.backLink}
      >
        <Text style={[styles.backLinkText, { color: colors.textMuted }]}>← Back to vehicles</Text>
      </Pressable>

      <Text style={[styles.pageTitle, { color: colors.text }]}>
        {selectedVehicle?.make} {selectedVehicle?.series} · {selectedVehicle?.plateNo}
      </Text>
      <Text style={[styles.ownerSub, { color: colors.textSecondary }]}>
        Owner: {selectedOwner?.name || '—'}
      </Text>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
        >
          <Text style={[styles.outlineBtnText, { color: colors.text }]}>Add entry</Text>
        </Pressable>
        <Pressable
          onPress={() => void shareSummary()}
          style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
        >
          <Text style={[styles.outlineBtnText, { color: colors.text }]}>Downloadables ▾</Text>
        </Pressable>
      </View>

      <View style={styles.rangeRow}>
        {[
          ['month', 'This month'],
          ['custom', 'Custom range'],
          ['all', 'All time'],
        ].map(([key, label]) => {
          const active = rangePreset === key
          return (
            <Pressable
              key={key}
              onPress={() => applyRangePreset(key)}
              style={[
                styles.rangeChip,
                {
                  borderColor: active ? colors.text : colors.border,
                  backgroundColor: active ? colors.surface : 'transparent',
                },
              ]}
            >
              <Text style={[styles.rangeChipText, { color: colors.text }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      {rangePreset === 'custom' ? (
        <View style={styles.customRange}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>From</Text>
            <TextInput
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>To</Text>
            <TextInput
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
            />
          </View>
        </View>
      ) : null}

      <View style={[styles.tableCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.tableHeader, { backgroundColor: colors.inputBackground }]}>
          <Text style={[styles.th, { color: colors.textMuted, flex: 1.1 }]}>Date</Text>
          <Text style={[styles.th, { color: colors.textMuted, flex: 0.9 }]}>Type</Text>
          <Text style={[styles.th, { color: colors.textMuted, flex: 1.2 }]}>Amount</Text>
        </View>

        {entries.length === 0 ? (
          <Text style={[styles.emptyInline, { color: colors.textMuted }]}>
            No entries for this filter.
          </Text>
        ) : (
          entries.map((row) => (
            <View
              key={row.id}
              style={[styles.tableRow, { borderBottomColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.tableRowTop}>
                  <Text style={[styles.td, { color: colors.text, flex: 1.1 }]}>{row.date || '—'}</Text>
                  <Text style={[styles.td, { color: colors.text, flex: 0.9 }]}>{row.type || '—'}</Text>
                  <Text style={[styles.tdAmount, { color: colors.text, flex: 1.2 }]}>
                    {row.amount == null || row.amount === '' ? '₱0' : formatPeso(row.amount)}
                  </Text>
                </View>
                <Text style={[styles.tdDesc, { color: colors.textSecondary }]}>
                  {row.category || '—'} · {row.description || '—'}
                </Text>
                <Text style={[styles.tdStatus, { color: colors.textMuted }]}>{row.status || '—'}</Text>
                {typeof row.attachment === 'string' &&
                (row.attachment.startsWith('data:image') ||
                  row.attachment.startsWith('http') ||
                  row.attachment.startsWith('file:')) ? (
                  <Image
                    source={{ uri: row.attachment }}
                    style={styles.entryThumb}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={styles.entryActions}>
                  <Pressable
                    onPress={() =>
                      setEditRow({
                        ...row,
                        amount: row.amount == null ? '' : String(row.amount),
                      })
                    }
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                  >
                    <Pencil size={15} color={colors.text} strokeWidth={2.2} />
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleteRow(row)}
                    style={[styles.iconBtn, styles.iconBtnDanger, { borderColor: '#f1c0c2' }]}
                  >
                    <Trash2 size={15} color={ACCENT} strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Running total</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>{formatPeso(total)}</Text>
        </View>
      </View>

      <EntryFormModal
        visible={addOpen}
        title="Add entry"
        colors={colors}
        onClose={() => setAddOpen(false)}
        onSave={(form) => void handleAddSave(form)}
      />
      <EntryFormModal
        visible={Boolean(editRow)}
        title="Edit entry"
        initial={editRow}
        colors={colors}
        onClose={() => setEditRow(null)}
        onSave={(form) => void handleEditSave(form)}
      />
      <ConfirmModal
        visible={Boolean(deleteRow)}
        title="Delete entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmLabel="Delete"
        danger
        confirming={saving}
        onCancel={() => setDeleteRow(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 16,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  listHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 10,
  },
  ownerCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  ownerCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ownerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  ownerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  ownerBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ownerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ownerCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  backLink: {
    marginBottom: 8,
  },
  backLinkText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ownerSub: {
    fontSize: 14,
    marginBottom: 14,
  },
  vehicleCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  vehicleThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#ececec',
  },
  vehicleMeta: {
    flex: 1,
    minWidth: 0,
  },
  vehicleTitle: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  vehiclePlate: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  rangeChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rangeChipText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  customRange: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tableCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  td: {
    fontSize: 13,
    fontWeight: '600',
  },
  tdAmount: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  tdDesc: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  tdStatus: {
    marginTop: 4,
    fontSize: 12,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  empty: {
    textAlign: 'center',
    marginTop: 28,
    fontSize: 15,
  },
  emptyInline: {
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 14,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    backgroundColor: '#fdf2f2',
  },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '92%',
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  attachHint: {
    fontSize: 12,
    marginBottom: 8,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attachPreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#ececec',
  },
  entryThumb: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#ececec',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
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
  errorText: {
    color: ACCENT,
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
})
