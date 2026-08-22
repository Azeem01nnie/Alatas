import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import logo from '../assets/logonobg.png'
import addVehiclePlaceholder from '../assets/addvehicle.png'
import { useVehicles } from '../context/VehicleContext'
import { BODY_TYPES } from '../data/vehicles'
import { compressImageDataUrl } from '../utils/storage'
import {
  archiveVehicleSnapshot,
  loadArchivedVehicles,
  removeFromArchiveStore,
  restoreArchivedVehicle,
  saveArchivedVehicles,
} from '../utils/archivedVehicles'
import {
  displayStatusLabel,
  getBlockingRental,
  getDisplayStatus,
  statusClassForDisplay,
} from '../utils/vehicleDisplayStatus'
import AdminLogin, { clearAdminSession, isAdminLoggedIn } from './AdminLogin'
import ConfirmModal from './ConfirmModal'
import AddOwnerModal from './AddOwnerModal'
import PremiumDatePicker from './PremiumDatePicker'
import RentCarForm from './RentCarForm'
import RentalCalendar from './RentalCalendar'
import TransactionPage from './TransactionPage'
import VehicleModal from './VehicleModal'
import VehicleReports from './VehicleReports'
import PendingApprovals from './PendingApprovals'
import { addOwner, autoCapitalizeWords, loadOwners, purgeOrphanOwners, updateOwner } from '../utils/owners'
import { loadReportStore } from '../utils/vehicleReports'
import { scanOrcrImage, mergeScanFields } from '../utils/orcrOcr'
import { fetchSystemStatus } from '../api/backend'
import { CLOUD_SYNC_ENABLED, isCloudConfigured } from '../api/cloudSync'
import { useConnectivity } from '../hooks/useConnectivity'

const PROFILE_KEY = 'alatas-admin-profile'
const SYSTEM_SETTINGS_KEY = 'alatas-admin-system-settings'
const PLATE_MAX = 10

function sanitizePlateNo(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, PLATE_MAX)
}

const DEFAULT_PROFILE = {
  displayName: 'Alatas Admin',
  photo: '',
}

const DEFAULT_SYSTEM_SETTINGS = {
  theme: 'light', // light | dark
  notifyOverdue: true,
  notifyUpcoming: true,
  notifyBrowser: false,
}

function loadAdminProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    const parsed = JSON.parse(raw)
    return {
      displayName: typeof parsed.displayName === 'string' && parsed.displayName.trim()
        ? parsed.displayName.trim()
        : DEFAULT_PROFILE.displayName,
      photo: typeof parsed.photo === 'string' ? parsed.photo : '',
    }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

function saveAdminProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    /* ignore quota errors */
  }
}

function loadSystemSettings() {
  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SYSTEM_SETTINGS }
    const parsed = JSON.parse(raw)
    const theme = parsed.theme === 'dark' ? 'dark' : 'light'
    return {
      theme,
      notifyOverdue: parsed.notifyOverdue !== false,
      notifyUpcoming: parsed.notifyUpcoming !== false,
      notifyBrowser: Boolean(parsed.notifyBrowser),
    }
  } catch {
    return { ...DEFAULT_SYSTEM_SETTINGS }
  }
}

function saveSystemSettings(settings) {
  try {
    localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
}

function profileInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function vehicleLabel(r) {
  const v = r?.vehicle
  if (!v) return 'Vehicle'
  const name = `${v.make || ''} ${v.series || ''}`.trim()
  return name || v.plateNo || 'Vehicle'
}

const EMPTY = {
  make: '',
  series: '',
  bodyType: 'Sedan',
  seats: '5',
  transmission: 'Automatic',
  plateNo: '',
  engineNo: '',
  chassisNo: '',
  image: '',
  status: 'Available',
  ownerId: '',
  ownerName: '',
  ownershipType: 'company',
  orcrImage: '',
  orImage: '',
  hrs5: '',
  hrs12: '',
  hrs24: '',
  exceedHour: '',
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconRent() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14h15l2.5 3v2h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-5Z" />
      <path d="M5 14V9.5A1.5 1.5 0 0 1 6.5 8H13l3.5 3.5" />
      <circle cx="7" cy="19" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="19" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
    </svg>
  )
}

function IconManage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15h11l2 2.5V19H5.5A1.5 1.5 0 0 1 4 17.5V15Z" />
      <path d="M5.5 15V11A1.5 1.5 0 0 1 7 9.5h5.5L15 12" />
      <circle cx="7.5" cy="19" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="19" r="0.75" fill="currentColor" stroke="none" />
      <path d="M18.5 5v5M16 7.5h5" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 5.5V9H8" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" />
      <circle cx="12" cy="12" r="7.5" />
    </svg>
  )
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 8.5h2.2l1.3-2h8l1.3 2H19.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5Z" />
      <circle cx="12" cy="14" r="3.2" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.5 1.5 5.5H5s1.5-1.3 1.5-5.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconArchive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

function IconReports() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V9" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  )
}

const MANAGE_STATUS_FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'Available', label: 'Available' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'Rented', label: 'On Rent' },
  { id: 'Under Maintenance', label: 'Maintenance' },
]

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { id: 'calendar', label: 'Calendar', icon: <IconCalendar /> },
  { id: 'rent', label: 'Rent Car', icon: <IconRent /> },
  { id: 'manage', label: 'Manage Vehicle', icon: <IconManage /> },
  { id: 'reports', label: 'Vehicle Reports', icon: <IconReports /> },
  { id: 'history', label: 'Rental History', icon: <IconHistory /> },
]

function statusClass(status) {
  return statusClassForDisplay(status)
}

function formatStatusLabel(status) {
  return displayStatusLabel(status)
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

const DASH_QUEUE_PREVIEW = 2

function DashAttentionCard({
  tone,
  title,
  note,
  items,
  emptyLabel,
  expanded,
  onToggleExpand,
  onSeeMore,
  renderItem,
}) {
  const total = items.length
  const visible = onSeeMore || !expanded ? items.slice(0, DASH_QUEUE_PREVIEW) : items
  const hiddenCount = Math.max(0, total - DASH_QUEUE_PREVIEW)

  return (
    <article className={`dash-attn-card dash-attn-${tone}`}>
      <header className="dash-attn-head">
        <div className="dash-attn-head-copy">
          <h4 className="dash-attn-title">{title}</h4>
          {note ? <p className="dash-attn-note">{note}</p> : null}
        </div>
        <span className="dash-attn-count" aria-label={`${total} items`}>
          {total}
        </span>
      </header>

      {total === 0 ? (
        <p className="dash-attn-empty">{emptyLabel}</p>
      ) : (
        <div className="dash-attn-list">
          {visible.map((item, index) => renderItem(item, index))}
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          className="dash-attn-more"
          onClick={onSeeMore || onToggleExpand}
        >
          {onSeeMore
            ? `See more (${hiddenCount})`
            : expanded
              ? 'Show less'
              : `See more (${hiddenCount})`}
        </button>
      )}
    </article>
  )
}

function parseFee(fee) {
  if (fee == null || fee === '') return 0
  const n = Number(String(fee).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function customerName(r) {
  const name = `${r.personal?.firstName || ''} ${r.personal?.lastName || ''}`.trim()
  return name || 'Customer'
}

function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function toDateKey(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDateKey(key) {
  if (!key) return null
  const d = new Date(`${key}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatPesoDash(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatDashDayLabel(date) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  })
}

function formatRangeCaption(from, to) {
  const sameYear = from.getFullYear() === to.getFullYear()
  const fromLabel = from.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  const toLabel = to.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${fromLabel} – ${toLabel}`
}

function getRevenueRange(preset, customFrom, customTo) {
  const now = new Date()

  if (preset === 'week') {
    const from = startOfWeek(now)
    const to = new Date(from)
    to.setDate(to.getDate() + 6)
    return { from: startOfDay(from), to: endOfDay(to) }
  }

  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: startOfDay(from), to: endOfDay(to) }
  }

  if (preset === 'year') {
    const from = new Date(now.getFullYear(), 0, 1)
    const to = new Date(now.getFullYear(), 11, 31)
    return { from: startOfDay(from), to: endOfDay(to) }
  }

  const fromParsed = parseLocalDateKey(customFrom)
  const toParsed = parseLocalDateKey(customTo)

  if (fromParsed && toParsed) {
    const from = startOfDay(fromParsed)
    const to = endOfDay(toParsed)
    return from.getTime() <= to.getTime()
      ? { from, to }
      : { from: startOfDay(toParsed), to: endOfDay(fromParsed) }
  }
  if (fromParsed && !toParsed) {
    return { from: startOfDay(fromParsed), to: endOfDay(now) }
  }
  if (!fromParsed && toParsed) {
    return { from: startOfDay(toParsed), to: endOfDay(toParsed) }
  }

  const from = startOfWeek(now)
  const to = new Date(from)
  to.setDate(to.getDate() + 6)
  return { from: startOfDay(from), to: endOfDay(to) }
}

function buildDailyRevenueSeries(rentals, from, to) {
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const byDay = new Map()

  for (const r of rentals) {
    const encoded = new Date(r.encodedAt || 0).getTime()
    if (!Number.isFinite(encoded) || encoded < fromMs || encoded > toMs) continue
    const key = toDateKey(encoded)
    const prev = byDay.get(key) || { revenue: 0, count: 0 }
    prev.revenue += parseFee(r.rental?.rentalFee)
    prev.count += 1
    byDay.set(key, prev)
  }

  const series = []
  const cursor = startOfDay(from)
  const last = startOfDay(to)
  while (cursor.getTime() <= last.getTime()) {
    const key = toDateKey(cursor)
    const bucket = byDay.get(key) || { revenue: 0, count: 0 }
    series.push({
      date: key,
      shortLabel: formatDashDayLabel(cursor),
      revenue: bucket.revenue,
      count: bucket.count,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const count = series.reduce((sum, d) => sum + d.count, 0)
  const revenue = series.reduce((sum, d) => sum + d.revenue, 0)
  return { series, count, revenue, from, to }
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div className="dash-rev-tooltip">
      <span className="dash-rev-tooltip-date">{point?.shortLabel || label}</span>
      <strong className="dash-rev-tooltip-value">{formatPesoDash(payload[0].value)}</strong>
      <span className="dash-rev-tooltip-meta">
        {point?.count || 0} rental{(point?.count || 0) === 1 ? '' : 's'}
      </span>
    </div>
  )
}

export default function AdminPanel() {
  const {
    vehicles,
    rentals,
    ready,
    loadError,
    addVehicle,
    updateVehicle,
    removeVehicle,
    updateVehicleStatus,
    completeRentalForVehicle,
    replaceAllData,
    reloadData,
  } = useVehicles()
  const { online } = useConnectivity()
  const [authed, setAuthed] = useState(() => isAdminLoggedIn())
  const [tab, setTab] = useState('dashboard')
  const [form, setForm] = useState(EMPTY)
  const [editForm, setEditForm] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [revenuePreset, setRevenuePreset] = useState('week')
  const [revenueDateFrom, setRevenueDateFrom] = useState('')
  const [revenueDateTo, setRevenueDateTo] = useState('')
  const [manageStatus, setManageStatus] = useState('All')
  const [manageView, setManageView] = useState('fleet') // fleet | archive
  const [archivedVehicles, setArchivedVehicles] = useState(() => loadArchivedVehicles())
  const [manageLayout, setManageLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('alatas-manage-layout')
      return saved === 'cards' ? 'cards' : 'list'
    } catch {
      return 'list'
    }
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [owners, setOwners] = useState(() => loadOwners())
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const [editFieldsLocked, setEditFieldsLocked] = useState(false)
  const [orcrBusy, setOrcrBusy] = useState(false)
  const [orcrProgress, setOrcrProgress] = useState(0)
  const [orcrTarget, setOrcrTarget] = useState(null) // 'add' | 'edit' | null
  const [orcrDocHint, setOrcrDocHint] = useState(null) // 'cr' | 'or' | null
  const crFileRef = useRef(null)
  const orFileRef = useRef(null)
  const crEditFileRef = useRef(null)
  const orEditFileRef = useRef(null)
  const [previewVehicle, setPreviewVehicle] = useState(null)
  const [addOwnerModal, setAddOwnerModal] = useState(null) // null | { forEdit: boolean }
  const [confirm, setConfirm] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [transactionReturnTab, setTransactionReturnTab] = useState('history')
  const [rentDirty, setRentDirty] = useState(false)
  const [rentFormKey, setRentFormKey] = useState(0)
  const [pendingTab, setPendingTab] = useState(null)
  const [profile, setProfile] = useState(() => loadAdminProfile())
  const [profileDraft, setProfileDraft] = useState(() => loadAdminProfile())
  const [profileMessage, setProfileMessage] = useState('')
  const [systemSettings, setSystemSettings] = useState(() => {
    const loaded = loadSystemSettings()
    applyTheme(loaded.theme)
    return loaded
  })
  const [alertTick, setAlertTick] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState(() => new Set())
  const [dashQueueExpanded, setDashQueueExpanded] = useState({
    upcoming: false,
    onRent: false,
    maintenance: false,
    pending: false,
  })
  const [systemStatus, setSystemStatus] = useState(null)
  const fileRef = useRef(null)
  const editFileRef = useRef(null)
  const profilePhotoRef = useRef(null)
  const notifRef = useRef(null)
  const importDataRef = useRef(null)
  const [dataMessage, setDataMessage] = useState('')
  const [dataBusy, setDataBusy] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('alatas-manage-layout', manageLayout)
    } catch {
      /* ignore */
    }
  }, [manageLayout])

  // Remove OCR junk owners that were never linked to a saved vehicle
  // Wait until fleet data has loaded successfully — empty [] on API failure must not wipe owners.
  useEffect(() => {
    if (!ready || loadError) return
    const linkedIds = [
      ...vehicles.map((v) => v.ownerId),
      ...archivedVehicles.map((v) => v.ownerId),
    ].filter(Boolean)
    setOwners(purgeOrphanOwners(linkedIds))
  }, [ready, loadError, vehicles, archivedVehicles])

  useEffect(() => {
    if (tab === 'settings') {
      setProfileDraft(profile)
      setProfileMessage('')
    }
  }, [tab, profile])

  useEffect(() => {
    applyTheme(systemSettings.theme)
    saveSystemSettings(systemSettings)
  }, [systemSettings])

  useEffect(() => {
    const id = window.setInterval(() => setAlertTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!notifRef.current?.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const systemAlerts = useMemo(() => {
    const now = Date.now()
    const hour = 60 * 60 * 1000
    const list = []

    for (const r of rentals) {
      const life = r.rentalLifecycle || 'completed'
      const who = customerName(r)
      const car = vehicleLabel(r)

      if (systemSettings.notifyOverdue && life === 'active') {
        const due = new Date(r.rental?.periodTo || 0).getTime()
        if (due && !Number.isNaN(due) && now > due) {
          const hoursLate = Math.max(1, Math.round((now - due) / hour))
          list.push({
            id: `overdue-${r.id}`,
            kind: 'overdue',
            title: 'Overdue return',
            body: `${who} · ${car} is ${hoursLate}h past return time and not yet returned.`,
            rentalId: r.id,
          })
        }
      }

      if (systemSettings.notifyUpcoming && life === 'scheduled') {
        const start = new Date(r.rental?.periodFrom || 0).getTime()
        if (start && !Number.isNaN(start) && start > now && start - now <= hour) {
          const mins = Math.max(1, Math.round((start - now) / 60000))
          list.push({
            id: `upcoming-${r.id}`,
            kind: 'upcoming',
            title: 'Rental starting soon',
            body: `${car} for ${who} starts in about ${mins} min.`,
            rentalId: r.id,
          })
        }
      }
    }

    return list
    // alertTick forces a recompute every minute
  }, [rentals, systemSettings.notifyOverdue, systemSettings.notifyUpcoming, alertTick])

  const visibleAlerts = useMemo(
    () => systemAlerts.filter((a) => !dismissedAlerts.has(a.id)),
    [systemAlerts, dismissedAlerts],
  )

  useEffect(() => {
    if (!systemSettings.notifyBrowser || visibleAlerts.length === 0) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    const key = `alatas-browser-notif:${visibleAlerts.map((a) => a.id).join('|')}`
    if (sessionStorage.getItem(key) === '1') return
    sessionStorage.setItem(key, '1')

    const top = visibleAlerts[0]
    try {
      new Notification(top.title, { body: top.body, tag: top.id })
    } catch {
      /* ignore */
    }
  }, [visibleAlerts, systemSettings.notifyBrowser])

  const updateSystemSetting = (patch) => {
    setSystemSettings((prev) => ({ ...prev, ...patch }))
  }

  const toggleBrowserNotifs = async (enabled) => {
    if (!enabled) {
      updateSystemSetting({ notifyBrowser: false })
      return
    }
    if (typeof Notification === 'undefined') {
      updateSystemSetting({ notifyBrowser: false })
      return
    }
    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }
    updateSystemSetting({ notifyBrowser: permission === 'granted' })
  }

  const handleRentDirtyChange = useCallback((dirty) => {
    setRentDirty(Boolean(dirty))
  }, [])

  const saveProfileChanges = async () => {
    const next = {
      displayName: profileDraft.displayName.trim() || DEFAULT_PROFILE.displayName,
      photo: profileDraft.photo || '',
    }
    saveAdminProfile(next)
    setProfile(next)
    setProfileDraft(next)
    setProfileMessage('Profile saved.')
    window.setTimeout(() => setProfileMessage(''), 2200)
  }

  const downloadAppData = () => {
    try {
      const payload = {
        version: 2,
        app: 'alatas-car-rental',
        exportedAt: new Date().toISOString(),
        vehicles,
        rentals,
        owners: loadOwners(),
        archivedVehicles: loadArchivedVehicles(),
        vehicleReports: loadReportStore(),
        systemSettings,
        adminProfile: profile,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `alatas-backup-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDataMessage('Backup downloaded.')
      window.setTimeout(() => setDataMessage(''), 2500)
    } catch {
      setDataMessage('Could not download backup.')
    }
  }

  const importAppData = async (file) => {
    if (!file) return
    setDataBusy(true)
    setDataMessage('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid backup file')
      }
      if (!Array.isArray(parsed.vehicles) || !Array.isArray(parsed.rentals)) {
        throw new Error('Backup must include vehicles and rentals arrays')
      }

      await replaceAllData({
        vehicles: parsed.vehicles,
        rentals: parsed.rentals,
      })

      const nextOwners = Array.isArray(parsed.owners) ? parsed.owners : []
      try {
        localStorage.setItem('alatas-owners', JSON.stringify(nextOwners))
      } catch {
        /* ignore quota */
      }
      setOwners(nextOwners)

      const nextArchived = Array.isArray(parsed.archivedVehicles)
        ? parsed.archivedVehicles
        : []
      saveArchivedVehicles(nextArchived)
      setArchivedVehicles(nextArchived)

      const nextReports =
        parsed.vehicleReports && typeof parsed.vehicleReports === 'object'
          ? {
              entries: Array.isArray(parsed.vehicleReports.entries)
                ? parsed.vehicleReports.entries
                : [],
              submissions: Array.isArray(parsed.vehicleReports.submissions)
                ? parsed.vehicleReports.submissions
                : [],
            }
          : { entries: [], submissions: [] }
      try {
        localStorage.setItem('alatas-vehicle-reports', JSON.stringify(nextReports))
      } catch {
        /* ignore quota */
      }

      if (parsed.systemSettings && typeof parsed.systemSettings === 'object') {
        const nextSettings = {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...parsed.systemSettings,
        }
        saveSystemSettings(nextSettings)
        applyTheme(nextSettings.theme)
        setSystemSettings(nextSettings)
      }

      if (parsed.adminProfile && typeof parsed.adminProfile === 'object') {
        const nextProfile = {
          displayName:
            String(parsed.adminProfile.displayName || '').trim() ||
            DEFAULT_PROFILE.displayName,
          photo:
            typeof parsed.adminProfile.photo === 'string'
              ? parsed.adminProfile.photo
              : '',
        }
        saveAdminProfile(nextProfile)
        setProfile(nextProfile)
        setProfileDraft(nextProfile)
      }

      setDataMessage(
        `Imported ${parsed.vehicles.length} vehicles and ${parsed.rentals.length} rentals.`,
      )
      setMessage('Data import completed.')
      window.setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      setDataMessage(err?.message || 'Import failed. Check the backup file.')
    } finally {
      setDataBusy(false)
    }
  }

  const requestImportData = () => {
    setConfirm({
      type: 'import-data',
      title: 'Import / migrate data?',
      message:
        'This will replace the current vehicles, rental history, owners, archives, and reports with the selected backup file. Continue only if you trust this file.',
      confirmLabel: 'Choose backup file',
      danger: true,
    })
  }

  const requestClearCache = () => {
    setConfirm({
      type: 'clear-cache',
      title: 'Clear cache?',
      message:
        'This clears temporary browser cache and notification markers. Vehicles, rentals, owners, and settings are not deleted.',
      confirmLabel: 'Clear cache',
    })
  }

  const clearAppCache = async () => {
    setDataBusy(true)
    setDataMessage('')
    try {
      const authKey = 'customer-encoder-admin-auth'
      const sessionKeys = []
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i)
        if (key) sessionKeys.push(key)
      }
      sessionKeys.forEach((key) => {
        if (key === authKey) return
        if (key.startsWith('alatas-browser-notif:')) {
          sessionStorage.removeItem(key)
        }
      })

      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map((name) => caches.delete(name)))
      }

      setDismissedAlerts(new Set())
      setDataMessage('Cache cleared. Vehicles and rental data were kept.')
      window.setTimeout(() => setDataMessage(''), 2800)
    } catch (err) {
      setDataMessage(err?.message || 'Could not clear cache.')
    } finally {
      setDataBusy(false)
    }
  }

  const onProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const compressed = await compressImageDataUrl(String(reader.result || ''), 480, 0.78)
      setProfileDraft((prev) => ({ ...prev, photo: compressed }))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const requestTabChange = (nextTab) => {
    if (nextTab === tab) return
    if (tab === 'rent' && nextTab !== 'rent' && rentDirty) {
      setPendingTab(nextTab)
      setConfirm({
        type: 'leave-rent',
        title: 'Leave rent form?',
        message:
          'You still have an unfinished rental form. If you leave now, your progress will be lost. Are you sure you want to continue?',
        confirmLabel: 'Leave form',
        cancelLabel: 'Stay',
        danger: true,
      })
      return
    }
    setTab(nextTab)
    setSelectedTransaction(null)
  }

  const counts = useMemo(() => {
    const archivedIds = new Set(archivedVehicles.map((v) => String(v.id)))
    const base = { Available: 0, Rented: 0, Scheduled: 0, 'Under Maintenance': 0 }
    vehicles.forEach((v) => {
      if (archivedIds.has(String(v.id))) return
      const status = getDisplayStatus(v, rentals)
      if (base[status] !== undefined) base[status] += 1
    })
    return base
  }, [vehicles, rentals, archivedVehicles, alertTick])

  const fleetVehicles = useMemo(() => {
    const archivedIds = new Set(archivedVehicles.map((v) => String(v.id)))
    return vehicles.filter((v) => !archivedIds.has(String(v.id)))
  }, [vehicles, archivedVehicles])

  useEffect(() => {
    let mounted = true
    fetchSystemStatus()
      .then((status) => {
        if (mounted) setSystemStatus(status)
      })
      .catch(() => {
        if (mounted) setSystemStatus(null)
      })
    return () => {
      mounted = false
    }
  }, [ready, online])

  const scheduledRentals = useMemo(
    () =>
      rentals.filter(
        (r) =>
          r.rentalLifecycle === 'scheduled' &&
          r.approvalStatus !== 'pending' &&
          r.approvalStatus !== 'rejected',
      ),
    [rentals],
  )

  const pendingApprovalCount = useMemo(
    () => rentals.filter((r) => r.approvalStatus === 'pending').length,
    [rentals],
  )

  const activeRentals = useMemo(
    () => rentals.filter((r) => r.rentalLifecycle === 'active'),
    [rentals],
  )

  const utilization = useMemo(() => {
    if (!vehicles.length) return 0
    return Math.round((counts.Rented / vehicles.length) * 100)
  }, [counts.Rented, vehicles.length])

  const upcomingScheduled = useMemo(() => {
    const now = Date.now()
    return scheduledRentals
      .map((r) => {
        const startMs = r.rental?.periodFrom ? new Date(r.rental.periodFrom).getTime() : NaN
        const isPastDue = !Number.isNaN(startMs) && startMs <= now
        return {
          rental: r,
          vehicle: vehicles.find((v) => v.id === r.vehicle?.id) || r.vehicle,
          isPastDue,
        }
      })
      .sort((a, b) => {
        const ta = new Date(a.rental.rental?.periodFrom || 0).getTime()
        const tb = new Date(b.rental.rental?.periodFrom || 0).getTime()
        return ta - tb
      })
  }, [scheduledRentals, vehicles])

  const onRentQueue = useMemo(() => {
    return activeRentals.map((r) => ({
      rental: r,
      vehicle: vehicles.find((v) => v.id === r.vehicle?.id) || r.vehicle,
    }))
  }, [activeRentals, vehicles])

  const maintenanceVehicles = useMemo(
    () => fleetVehicles.filter((v) => getDisplayStatus(v, rentals) === 'Under Maintenance'),
    [fleetVehicles, rentals, alertTick],
  )

  const revenueSnapshot = useMemo(() => {
    const { from, to } = getRevenueRange(revenuePreset, revenueDateFrom, revenueDateTo)
    return buildDailyRevenueSeries(rentals, from, to)
  }, [rentals, revenuePreset, revenueDateFrom, revenueDateTo])

  const revenueCaption = useMemo(
    () => formatRangeCaption(revenueSnapshot.from, revenueSnapshot.to),
    [revenueSnapshot.from, revenueSnapshot.to],
  )

  const revenueXAxisInterval = useMemo(() => {
    const n = revenueSnapshot.series.length
    if (n <= 8) return 0
    if (n <= 31) return 3
    if (n <= 92) return 13
    return Math.max(0, Math.floor(n / 12) - 1)
  }, [revenueSnapshot.series.length])

  const applyRevenuePreset = (preset) => {
    setRevenuePreset(preset)
    if (preset === 'custom' && (!revenueDateFrom || !revenueDateTo)) {
      const { from, to } = getRevenueRange('week', '', '')
      setRevenueDateFrom(toDateKey(from))
      setRevenueDateTo(toDateKey(to))
    }
  }

  const recentRentals = useMemo(() => {
    return [...rentals]
      .sort((a, b) => new Date(b.encodedAt || 0) - new Date(a.encodedAt || 0))
      .slice(0, 6)
  }, [rentals])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const source = manageView === 'archive' ? archivedVehicles : fleetVehicles
    return source.filter((v) => {
      if (manageView === 'fleet') {
        const display = getDisplayStatus(v, rentals)
        if (manageStatus !== 'All' && display !== manageStatus) return false
      }
      if (!q) return true
      const haystack =
        `${v.make} ${v.series} ${v.plateNo} ${v.bodyType} ${v.transmission}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [fleetVehicles, archivedVehicles, search, manageStatus, manageView, rentals, alertTick])

  const filteredGrouped = useMemo(() => {
    const groups = {}
    filtered.forEach((v) => {
      const key = v.bodyType || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(v)
    })
    const order = [...BODY_TYPES, 'Other']
    return order
      .filter((key) => groups[key]?.length)
      .map((key) => ({ bodyType: key, items: groups[key] }))
  }, [filtered])

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    const fromMs = historyDateFrom ? new Date(`${historyDateFrom}T00:00:00`).getTime() : null
    const toMs = historyDateTo ? new Date(`${historyDateTo}T23:59:59.999`).getTime() : null

    return rentals.filter((r) => {
      if (q) {
        const name = [
          r.personal?.firstName,
          r.personal?.middleName,
          r.personal?.lastName,
        ]
          .filter(Boolean)
          .join(' ')
        const plate = r.vehicle?.plateNo || ''
        const haystack = `${name} ${plate}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      if (fromMs != null || toMs != null) {
        const stamp = new Date(r.encodedAt || r.rental?.periodFrom || 0).getTime()
        if (Number.isNaN(stamp) || stamp <= 0) return false
        if (fromMs != null && stamp < fromMs) return false
        if (toMs != null && stamp > toMs) return false
      }

      return true
    })
  }, [rentals, historySearch, historyDateFrom, historyDateTo])

  const historyWithImages = useMemo(() => {
    return filteredHistory.map((r) => {
      if (r.vehicle?.image) return r
      const fleetMatch = vehicles.find((v) => v.id === r.vehicle?.id)
      if (!fleetMatch?.image) return r
      return {
        ...r,
        vehicle: { ...r.vehicle, image: fleetMatch.image },
      }
    })
  }, [filteredHistory, vehicles])

  const TEXT_CAP_KEYS = new Set(['make', 'series', 'engineNo', 'chassisNo', 'ownerName'])

  const update = (key, value) => {
    const nextValue = TEXT_CAP_KEYS.has(key) ? autoCapitalizeWords(value) : value
    setForm((prev) => ({ ...prev, [key]: nextValue }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const updateEdit = (key, value) => {
    const nextValue = TEXT_CAP_KEYS.has(key) ? autoCapitalizeWords(value) : value
    setEditForm((prev) => ({ ...prev, [key]: nextValue }))
    setEditErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const handleImageFile = (e, forEdit = false) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (forEdit) updateEdit('image', reader.result)
      else update('image', reader.result)
    }
    reader.readAsDataURL(file)
  }

  const applyOwnerSelection = (ownerId, forEdit = false) => {
    if (ownerId === '__new__') {
      setAddOwnerModal({ forEdit })
      return
    }

    const owner = owners.find((o) => o.id === ownerId)
    const patch = {
      ownerId: ownerId || '',
      ownerName: owner?.name || '',
      ownershipType: owner?.ownershipType || (forEdit ? editForm?.ownershipType : form.ownershipType) || 'company',
    }
    if (forEdit) {
      setEditForm((prev) => ({ ...prev, ...patch }))
      setEditErrors((prev) => ({ ...prev, ownerId: '' }))
    } else {
      setForm((prev) => ({ ...prev, ...patch }))
      setErrors((prev) => ({ ...prev, ownerId: '' }))
    }
  }

  const handleOrcrFile = async (e, forEdit = false, docHint = 'auto') => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setConfirm({
        type: 'orcr-error',
        title: 'Invalid file',
        message: 'Please upload a PNG or JPEG image of the LTO OR or CR.',
        confirmLabel: 'OK',
        hideCancel: true,
      })
      e.target.value = ''
      return
    }

    setOrcrBusy(true)
    setOrcrProgress(0)
    setOrcrTarget(forEdit ? 'edit' : 'add')
    setOrcrDocHint(docHint === 'or' ? 'or' : 'cr')
    try {
      const raw = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(file)
      })
      const compressed = (await compressImageDataUrl(raw, 1600, 0.88)) || raw
      const { fields } = await scanOrcrImage(compressed, setOrcrProgress, docHint)

      const hasAnyField = Boolean(
        fields.make ||
          fields.series ||
          fields.plateNo ||
          fields.engineNo ||
          fields.chassisNo ||
          fields.ownerName ||
          fields.bodyType ||
          fields.seats,
      )

      if (!hasAnyField) {
        setConfirm({
          type: 'orcr-error',
          title: 'No information found',
          message:
            'No readable LTO OR/CR fields were found. Upload a clear photo of the Certificate of Registration (CR) and/or Official Receipt (OR), or fill the form manually.',
          confirmLabel: 'OK',
          hideCancel: true,
        })
        return
      }

      const applyOwnerFromName = (next, ownerName) => {
        if (!ownerName) return next
        const name = autoCapitalizeWords(ownerName)
        const existing = loadOwners().find((o) => o.name.toLowerCase() === name.toLowerCase())
        if (existing) {
          next.ownerId = existing.id
          next.ownerName = existing.name
          next.ownershipType = existing.ownershipType || next.ownershipType || 'company'
          return next
        }
        // IMPORTANT: do NOT auto-create an Owner record during OCR scan.
        // We only fill the detected ownerName as a suggestion; the Owner gets created
        // later when user clicks "Add Vehicle" / "Save Changes".
        next.ownerName = name
        return next
      }

      const apply = (prev) => {
        const merged = mergeScanFields(
          {
            make: prev.make,
            series: prev.series,
            plateNo: prev.plateNo,
            engineNo: prev.engineNo,
            chassisNo: prev.chassisNo,
            ownerName: prev.ownerName,
            bodyType: prev.bodyType,
            seats: prev.seats,
          },
          fields,
        )

        const next = { ...prev }
        if (docHint === 'cr' || fields.docType === 'cr' || fields.docType === 'both') {
          next.orcrImage = compressed
        }
        if (docHint === 'or' || fields.docType === 'or') {
          next.orImage = compressed
        }
        // If auto and unknown, still keep a preview on CR slot
        if (!next.orcrImage && !next.orImage) next.orcrImage = compressed

        if (merged.make) next.make = autoCapitalizeWords(merged.make)
        if (merged.series) next.series = autoCapitalizeWords(merged.series)
        if (merged.plateNo) next.plateNo = sanitizePlateNo(merged.plateNo)
        if (merged.engineNo) next.engineNo = String(merged.engineNo).toUpperCase()
        if (merged.chassisNo) next.chassisNo = String(merged.chassisNo).toUpperCase()
        if (merged.bodyType) next.bodyType = merged.bodyType
        if (merged.seats) next.seats = String(merged.seats)

        if (merged.ownerName && !prev.ownerId) {
          applyOwnerFromName(next, merged.ownerName)
        } else if (merged.ownerName && fields.ownerName) {
          // Prefer newly scanned owner when re-scanning
          applyOwnerFromName(next, fields.ownerName)
        }

        return next
      }

      if (forEdit) {
        setEditForm((prev) => apply(prev))
        setEditFieldsLocked(true)
        setEditErrors({})
      } else {
        setForm((prev) => apply(prev))
        setFieldsLocked(true)
        setErrors({})
      }
    } catch (err) {
      console.error(err)
      setConfirm({
        type: 'orcr-error',
        title: 'OR/CR scan failed',
        message:
          'The scanner could not read this image. Please try again with a clearer photo of the OR and/or CR, or fill the form manually.',
        confirmLabel: 'OK',
        hideCancel: true,
      })
    } finally {
      setOrcrBusy(false)
      setOrcrProgress(0)
      setOrcrTarget(null)
      setOrcrDocHint(null)
      e.target.value = ''
    }
  }

  const validateFields = (data) => {
    const next = {}
    ;['make', 'series', 'bodyType', 'engineNo', 'chassisNo'].forEach((key) => {
        if (!String(data[key] || '').trim()) next[key] = 'Required'
    })
    const plate = sanitizePlateNo(data.plateNo)
    if (!plate) next.plateNo = 'Required'
    else if (plate.length > PLATE_MAX) next.plateNo = `Max ${PLATE_MAX} characters`
    if (!String(data.seats || '').trim() || Number(data.seats) <= 0) {
      next.seats = 'Required'
    }
    if (!String(data.transmission || '').trim()) next.transmission = 'Required'
    // Allow saving even if ownerId is not selected yet (ownerName may be set by OCR).
    if (!String(data.ownerId || '').trim() && !String(data.ownerName || '').trim()) {
      next.ownerId = 'Owner is required'
    }
    ;['hrs5', 'hrs12', 'hrs24', 'exceedHour'].forEach((key) => {
      const raw = String(data[key] ?? '').replace(/[^\d.]/g, '')
      const n = Number(raw)
      if (raw === '' || Number.isNaN(n) || n < 0) {
        next[key] = 'Required'
      }
    })
    return next
  }

  const toVehiclePayload = (data) => {
    const ownershipType = data.ownershipType === 'thirdParty' ? 'thirdParty' : 'company'
    const ownerName = String(data.ownerName || '').trim()
    const ownerId = String(data.ownerId || '').trim()

    // Create Owner record only when user confirms "Add Vehicle"/"Save Changes".
    let resolvedOwnerId = ownerId
    let resolvedOwnerName = ownerName
    if (!resolvedOwnerId && resolvedOwnerName) {
      try {
        const created = addOwner({ name: resolvedOwnerName, ownershipType })
        setOwners(loadOwners())
        resolvedOwnerId = created.id
        resolvedOwnerName = created.name
      } catch (err) {
        console.error('Could not create owner from form:', err)
      }
    }

    return {
      make: data.make.trim(),
      series: data.series.trim(),
      bodyType: data.bodyType.trim(),
      seats: Number(data.seats) || 5,
      transmission: data.transmission.trim(),
      plateNo: sanitizePlateNo(data.plateNo),
      engineNo: data.engineNo.trim(),
      chassisNo: data.chassisNo.trim(),
      image: data.image.trim() || logo,
      status: 'Available',
      ownerId: resolvedOwnerId || '',
      ownerName: resolvedOwnerName || '',
      ownershipType,
      orcrImage: data.orcrImage || '',
      orImage: data.orImage || '',
      rates: {
        hrs5: Number(String(data.hrs5 ?? '').replace(/[^\d.]/g, '')) || 0,
        hrs12: Number(String(data.hrs12 ?? '').replace(/[^\d.]/g, '')) || 0,
        hrs24: Number(String(data.hrs24 ?? '').replace(/[^\d.]/g, '')) || 0,
        exceedHour: Number(String(data.exceedHour ?? '').replace(/[^\d.]/g, '')) || 0,
      },
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const next = validateFields(form)
    setErrors(next)
    if (Object.keys(next).length) return

    setConfirm({
      type: 'add',
      title: 'Add vehicle?',
      message: `Add ${form.make.trim()} — ${form.series.trim()} (${form.plateNo.trim()}) to the fleet?`,
      confirmLabel: 'Add Vehicle',
    })
  }

  const openEdit = (vehicle) => {
    setEditForm({
      ...vehicle,
      status: 'Available',
      seats: vehicle.seats ?? 5,
      transmission: vehicle.transmission || 'Automatic',
      plateNo: sanitizePlateNo(vehicle.plateNo),
      ownerId: vehicle.ownerId || '',
      ownerName: vehicle.ownerName || '',
      ownershipType: vehicle.ownershipType === 'thirdParty' ? 'thirdParty' : 'company',
      orcrImage: vehicle.orcrImage || '',
      orImage: vehicle.orImage || '',
      hrs5: vehicle.rates?.hrs5 ?? '',
      hrs12: vehicle.rates?.hrs12 ?? '',
      hrs24: vehicle.rates?.hrs24 ?? '',
      exceedHour: vehicle.rates?.exceedHour ?? '',
    })
    setEditErrors({})
    setEditFieldsLocked(Boolean(vehicle.orcrImage))
  }

  const requestSaveEdit = () => {
    if (!editForm) return
    const next = validateFields(editForm)
    setEditErrors(next)
    if (Object.keys(next).length) return

    setConfirm({
      type: 'edit',
      title: 'Save vehicle changes?',
      message: `Update information for ${editForm.make} — ${editForm.series}?`,
      confirmLabel: 'Save changes',
    })
  }

  const requestRentCompleted = (vehicle) => {
    setConfirm({
      type: 'complete-rental',
      title: 'Mark rent as completed?',
      message: `Confirm that the rental for ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo}) is completed? The vehicle will be set back to Available.`,
      confirmLabel: 'Rent Completed',
      vehicleId: vehicle.id,
    })
  }

  const openTransaction = (r, returnTab = 'history') => {
    const fleetMatch = vehicles.find((v) => v.id === r.vehicle?.id)
    setSelectedTransaction({
      ...r,
      vehicle: {
        ...r.vehicle,
        image: r.vehicle?.image || fleetMatch?.image || '',
      },
    })
    setTransactionReturnTab(returnTab)
  }

  const closeTransaction = () => {
    const returnTab = transactionReturnTab || 'history'
    setSelectedTransaction(null)
    setTab(returnTab)
  }

  const requestArchive = (vehicle) => {
    const blocking = getBlockingRental(vehicle.id, rentals)
    if (blocking) {
      const when = blocking.rental?.periodFrom
        ? new Date(blocking.rental.periodFrom).toLocaleString()
        : 'the scheduled date'
      const life = blocking.rentalLifecycle === 'active' ? 'currently on rent' : 'scheduled to be rented'
    setConfirm({
        type: 'archive-blocked',
        title: 'Cannot archive vehicle',
        message: `You cannot archive ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo}) because it is ${life} on ${when}. Complete or wait until the rental is finished first.`,
        confirmLabel: 'OK',
        hideCancel: true,
        danger: false,
      })
      return
    }

    setConfirm({
      type: 'archive',
      title: 'Archive vehicle?',
      message: `Move ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo}) to the archive? You can restore it later from the Archive view.`,
      confirmLabel: 'Archive',
      danger: true,
      vehicle,
    })
  }

  const requestRestore = (vehicle) => {
    setConfirm({
      type: 'restore',
      title: 'Restore vehicle?',
      message: `Restore ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo}) to the active fleet?`,
      confirmLabel: 'Restore',
      vehicleId: vehicle.id,
    })
  }

  const requestPermanentDelete = (vehicle) => {
    setConfirm({
      type: 'permanent-delete',
      title: 'Delete permanently?',
      message: `Permanently delete ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo})? This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
      vehicleId: vehicle.id,
    })
  }

  const handleAddOwnerConfirm = ({ name, ownershipType: ownership }) => {
    const forEdit = addOwnerModal?.forEdit
    try {
      const owner = addOwner({ name, ownershipType: ownership })
      setOwners(loadOwners())
      if (forEdit) {
        setEditForm((prev) => ({
          ...prev,
          ownerId: owner.id,
          ownerName: owner.name,
          ownershipType: owner.ownershipType,
        }))
        setEditErrors((prev) => ({ ...prev, ownerId: '' }))
      } else {
        setForm((prev) => ({
          ...prev,
          ownerId: owner.id,
          ownerName: owner.name,
          ownershipType: owner.ownershipType,
        }))
        setErrors((prev) => ({ ...prev, ownerId: '' }))
      }
      setAddOwnerModal(null)
    } catch (err) {
      setConfirm({
        type: 'orcr-error',
        title: 'Could not add owner',
        message: err.message || 'Please try a different name.',
        confirmLabel: 'OK',
        hideCancel: true,
      })
    }
  }

  const requestLogout = () => {
    setConfirm({
      type: 'logout',
      title: 'Log out?',
      message: 'You will need to sign in again to access the admin panel.',
      confirmLabel: 'Log out',
      danger: true,
    })
  }

  const handleConfirm = async () => {
    if (!confirm) return
    if (confirm.type === 'logout') {
      clearAdminSession()
      setTab('dashboard')
      setSelectedTransaction(null)
      setAuthed(false)
    }
    if (confirm.type === 'status') {
      updateVehicleStatus(confirm.vehicleId, confirm.status)
    }
    if (confirm.type === 'complete-rental') {
      completeRentalForVehicle(confirm.vehicleId)
    }
    if (confirm.type === 'add') {
      const payload = toVehiclePayload(form)
      if (payload.ownerId) {
        updateOwner(payload.ownerId, { ownershipType: payload.ownershipType })
        setOwners(loadOwners())
      }
      addVehicle(payload)
      setForm(EMPTY)
      setFieldsLocked(false)
      setShowAddForm(false)
      setMessage('Vehicle added successfully.')
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => setMessage(''), 2500)
    }
    if (confirm.type === 'archive' && confirm.vehicle) {
      setArchivedVehicles(archiveVehicleSnapshot(confirm.vehicle))
      setMessage('Vehicle archived.')
      setTimeout(() => setMessage(''), 2500)
    }
    if (confirm.type === 'restore' && confirm.vehicleId) {
      setArchivedVehicles(restoreArchivedVehicle(confirm.vehicleId))
      setMessage('Vehicle restored to fleet.')
      setTimeout(() => setMessage(''), 2500)
    }
    if (confirm.type === 'permanent-delete' && confirm.vehicleId) {
      await removeVehicle(confirm.vehicleId)
      setArchivedVehicles(removeFromArchiveStore(confirm.vehicleId))
      setMessage('Vehicle permanently deleted.')
      setTimeout(() => setMessage(''), 2500)
    }
    if (confirm.type === 'edit' && editForm) {
      const existing = vehicles.find((v) => v.id === editForm.id)
      const payload = toVehiclePayload(editForm)
      if (payload.ownerId) {
        updateOwner(payload.ownerId, { ownershipType: payload.ownershipType })
        setOwners(loadOwners())
      }
      updateVehicle(editForm.id, {
        ...payload,
        status: existing?.status === 'Rented' ? 'Rented' : 'Available',
      })
      setEditForm(null)
      setEditFieldsLocked(false)
      setMessage('Vehicle updated.')
      setTimeout(() => setMessage(''), 2500)
    }
    if (confirm.type === 'leave-rent') {
      const next = pendingTab || 'dashboard'
      setRentFormKey((k) => k + 1)
      setRentDirty(false)
      setTab(next)
      setSelectedTransaction(null)
      setPendingTab(null)
    }
    if (confirm.type === 'import-data') {
      setConfirm(null)
      window.setTimeout(() => importDataRef.current?.click(), 50)
      return
    }
    if (confirm.type === 'clear-cache') {
      setConfirm(null)
      void clearAppCache()
      return
    }
    setConfirm(null)
  }

  if (!authed) {
    return (
      <div className="app login-shell">
        <AdminLogin
          onSuccess={() => {
            setTab('dashboard')
            setSelectedTransaction(null)
            setAuthed(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="app admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="Alatas Car Rental Services" className="sidebar-logo" />
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link${tab === item.id ? ' active' : ''}`}
              title={item.label}
              onClick={() => requestTabChange(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`sidebar-link sidebar-settings-link${tab === 'settings' ? ' active' : ''}`}
            title="Settings"
            onClick={() => requestTabChange('settings')}
          >
            <span className="sidebar-icon">
              <IconSettings />
            </span>
            <span className="sidebar-label">Settings</span>
          </button>

          <button
            type="button"
            className={`sidebar-profile${tab === 'settings' ? ' is-active' : ''}`}
            title={`${profile.displayName} · Admin`}
            onClick={() => requestTabChange('settings')}
          >
            <span className="sidebar-avatar" aria-hidden="true">
              {profile.photo ? (
                <img src={profile.photo} alt="" />
              ) : (
                <span className="sidebar-avatar-fallback">{profileInitials(profile.displayName)}</span>
              )}
            </span>
            <span className="sidebar-profile-meta">
              <span className="sidebar-profile-name">{profile.displayName}</span>
              <span className="sidebar-profile-role">Admin</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-content-header">
          <h2>
            {selectedTransaction
              ? 'Transaction'
              : tab === 'settings'
                ? 'Settings'
              : NAV.find((n) => n.id === tab)?.label}
          </h2>
          <div className="admin-content-header-actions">
          {message && <span className="admin-success">{message}</span>}
            {loadError && (
              <span className="admin-load-error" role="alert">
                Server unavailable — fleet data not loaded. Start the API and refresh.
              </span>
            )}
            {!loadError && !online && (
              <span className="admin-offline-badge" role="status">
                Offline — local desk still works
              </span>
            )}
            {pendingApprovalCount > 0 && tab === 'dashboard' && (
              <span className="admin-pending-badge" role="status">
                {pendingApprovalCount} pending approval{pendingApprovalCount === 1 ? '' : 's'}
              </span>
            )}
            <div className="admin-notif" ref={notifRef}>
              <button
                type="button"
                className={`admin-notif-btn${notifOpen ? ' is-open' : ''}${visibleAlerts.length ? ' has-alerts' : ''}`}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((o) => !o)}
              >
                <IconBell />
                {visibleAlerts.length > 0 && (
                  <span className="admin-notif-count">{visibleAlerts.length > 9 ? '9+' : visibleAlerts.length}</span>
                )}
              </button>
              {notifOpen && (
                <div className="admin-notif-panel" role="dialog" aria-label="System notifications">
                  <div className="admin-notif-panel-head">
                    <strong>Alerts</strong>
                    {visibleAlerts.length > 0 && (
                      <button
                        type="button"
                        className="btn-ghost admin-notif-clear"
                        onClick={() => {
                          setDismissedAlerts(new Set(systemAlerts.map((a) => a.id)))
                          setNotifOpen(false)
                        }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {visibleAlerts.length === 0 ? (
                    <p className="admin-notif-empty">No active alerts right now.</p>
                  ) : (
                    <ul className="admin-notif-list">
                      {visibleAlerts.map((alert) => (
                        <li key={alert.id} className={`admin-notif-item is-${alert.kind}`}>
                          <div>
                            <strong>{alert.title}</strong>
                            <p>{alert.body}</p>
                          </div>
                          <button
                            type="button"
                            className="btn-ghost admin-notif-dismiss"
                            aria-label="Dismiss"
                            onClick={() =>
                              setDismissedAlerts((prev) => new Set([...prev, alert.id]))
                            }
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    className="btn-ghost admin-notif-manage"
                    onClick={() => {
                      setNotifOpen(false)
                      requestTabChange('settings')
                    }}
                  >
                    Manage notification settings
                  </button>
                </div>
              )}
            </div>
            {tab === 'manage' && (
              <>
                <div className="manage-view-toggle" role="group" aria-label="Manage vehicle view">
                  <button
                    type="button"
                    className={`manage-layout-btn${manageView === 'fleet' ? ' is-active' : ''}`}
                    onClick={() => setManageView('fleet')}
                    aria-pressed={manageView === 'fleet'}
                  >
                    Fleet
                  </button>
                  <button
                    type="button"
                    className={`manage-layout-btn${manageView === 'archive' ? ' is-active' : ''}`}
                    onClick={() => {
                      setManageView('archive')
                      setShowAddForm(false)
                    }}
                    aria-pressed={manageView === 'archive'}
                  >
                    Archive
                  </button>
                </div>
                {manageView === 'fleet' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setShowAddForm((prev) => {
                        if (prev) {
                          setForm(EMPTY)
                          setFieldsLocked(false)
                        }
                        return !prev
                      })
                      setErrors({})
                    }}
                  >
                    {showAddForm ? 'Cancel' : 'Add Vehicle'}
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <main className="admin-main-panel">
          {selectedTransaction ? (
            <TransactionPage
              transaction={selectedTransaction}
              backLabel={
                transactionReturnTab === 'calendar'
                  ? '← Back to Calendar'
                  : transactionReturnTab === 'dashboard'
                    ? '← Back to Dashboard'
                    : '← Back to History'
              }
              onBack={closeTransaction}
            />
          ) : (
            <>
          {tab === 'rent' && (
            <RentCarForm key={rentFormKey} onDirtyChange={handleRentDirtyChange} />
          )}

          {tab === 'dashboard' && (
            <section className="admin-dashboard">
              <div className="dashboard-stats">
                <article className="stat-card">
                  <span className="stat-label">Available</span>
                  <strong className="stat-value">{counts.Available}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">On Rent</span>
                  <strong className="stat-value">{counts.Rented}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Maintenance</span>
                  <strong className="stat-value">{counts['Under Maintenance']}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Total Fleet</span>
                  <strong className="stat-value">{vehicles.length}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Scheduled</span>
                  <strong className="stat-value">{scheduledRentals.length}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Utilization</span>
                  <strong className="stat-value">{utilization}%</strong>
                </article>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-main">
                  <section className="dash-panel dash-attention">
                    <h3 className="dash-panel-title">Needs attention</h3>

                    <div className="dash-attn-stack">
                      <DashAttentionCard
                        tone="upcoming"
                        title="Upcoming"
                        note="Starts automatically at the contract From time."
                        emptyLabel="No upcoming rentals."
                        items={upcomingScheduled}
                        expanded={dashQueueExpanded.upcoming}
                        onSeeMore={() => requestTabChange('history')}
                        renderItem={({ rental, vehicle, isPastDue }) => (
                          <article key={rental.id} className="dash-attn-row">
                            <div className="dash-attn-thumb" aria-hidden="true">
                              {vehicle?.image ? (
                                <img src={vehicle.image} alt="" />
                              ) : (
                                <span>
                                  {(vehicle?.make || '?').slice(0, 1)}
                                  {(vehicle?.series || '').slice(0, 1)}
                                </span>
                              )}
                            </div>
                            <div className="dash-attn-meta">
                              <strong>
                                {vehicle?.make} — {vehicle?.series}
                              </strong>
                              <span>
                                {vehicle?.plateNo} · {customerName(rental)}
                              </span>
                              <span className="dash-attn-time">
                                {rental.rental?.periodFromLabel ||
                                  formatDateTime(rental.rental?.periodFrom)}
                                {isPastDue ? ' · activating…' : ''}
                              </span>
                            </div>
                          </article>
                        )}
                      />

                      <DashAttentionCard
                        tone="onrent"
                        title="On rent"
                        emptyLabel="No active rentals."
                        items={onRentQueue}
                        expanded={dashQueueExpanded.onRent}
                        onToggleExpand={() =>
                          setDashQueueExpanded((prev) => ({
                            ...prev,
                            onRent: !prev.onRent,
                          }))
                        }
                        renderItem={({ rental, vehicle }) => (
                          <article key={rental.id} className="dash-attn-row">
                            <div className="dash-attn-thumb" aria-hidden="true">
                              {vehicle?.image ? (
                                <img src={vehicle.image} alt="" />
                              ) : (
                                <span>
                                  {(vehicle?.make || '?').slice(0, 1)}
                                  {(vehicle?.series || '').slice(0, 1)}
                                </span>
                              )}
                            </div>
                            <div className="dash-attn-meta">
                              <strong>
                                {vehicle?.make} — {vehicle?.series}
                              </strong>
                              <span>
                                {vehicle?.plateNo} · {customerName(rental)}
                              </span>
                              <span className="dash-attn-time">
                                Until{' '}
                                {rental.rental?.periodToLabel ||
                                  formatDateTime(rental.rental?.periodTo)}
                              </span>
                            </div>
                    <button
                      type="button"
                              className="btn-outline btn-sm"
                              onClick={() => requestRentCompleted(vehicle)}
                    >
                              Complete
                    </button>
                          </article>
                        )}
                      />

                      <DashAttentionCard
                        tone="maintenance"
                        title="Maintenance"
                        emptyLabel="No units under maintenance."
                        items={maintenanceVehicles}
                        expanded={dashQueueExpanded.maintenance}
                        onToggleExpand={() =>
                          setDashQueueExpanded((prev) => ({
                            ...prev,
                            maintenance: !prev.maintenance,
                          }))
                        }
                        renderItem={(v) => (
                          <article key={v.id} className="dash-attn-row">
                            <div className="dash-attn-thumb" aria-hidden="true">
                              {v.image ? (
                                <img src={v.image} alt="" />
                              ) : (
                                <span>
                                  {(v.make || '?').slice(0, 1)}
                                  {(v.series || '').slice(0, 1)}
                                </span>
                              )}
                            </div>
                            <div className="dash-attn-meta">
                      <strong>
                        {v.make} — {v.series}
                      </strong>
                      <span>
                                {v.plateNo} · {v.bodyType}
                      </span>
                            </div>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => setTab('manage')}
                            >
                              Manage
                            </button>
                          </article>
                        )}
                      />

                      <div className="dash-attn-card dash-attn-pending">
                        <PendingApprovals
                          vehicles={vehicles}
                          onChanged={reloadData}
                          compact
                        />
                      </div>
                    </div>
                  </section>
                </div>

                <div className="dashboard-side">
                  <section className="dash-panel dash-revenue-panel">
                    <div className="dash-panel-head dash-rev-head">
                      <div>
                        <h3 className="dash-panel-title">Revenue</h3>
                        <p className="dash-rev-caption">{revenueCaption}</p>
                      </div>
                    </div>

                    <div className="dash-rev-presets" role="group" aria-label="Revenue date range">
                      {[
                        { id: 'week', label: 'Week' },
                        { id: 'month', label: 'Month' },
                        { id: 'year', label: 'Year' },
                        { id: 'custom', label: 'Custom' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`dash-rev-preset${revenuePreset === opt.id ? ' is-active' : ''}`}
                          aria-pressed={revenuePreset === opt.id}
                          onClick={() => applyRevenuePreset(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {revenuePreset === 'custom' && (
                      <div className="dash-rev-custom-dates">
                        <div className="field history-date-field">
                          <span className="field-label">From</span>
                          <PremiumDatePicker
                            value={revenueDateFrom}
                            maxDate={revenueDateTo || undefined}
                            title="From date"
                            onChange={(next) => {
                              setRevenueDateFrom(next)
                              if (revenueDateTo && next > revenueDateTo) setRevenueDateTo('')
                            }}
                          />
                        </div>
                        <div className="field history-date-field">
                          <span className="field-label">To</span>
                          <PremiumDatePicker
                            value={revenueDateTo}
                            minDate={revenueDateFrom || undefined}
                            title="To date"
                            onChange={setRevenueDateTo}
                          />
                        </div>
                      </div>
                    )}

                    <div className="dash-week-stats">
                      <div>
                        <span className="stat-label">Rentals encoded</span>
                        <strong className="dash-week-value">{revenueSnapshot.count}</strong>
                      </div>
                      <div>
                        <span className="stat-label">Est. revenue</span>
                        <strong className="dash-week-value">
                          {formatPesoDash(revenueSnapshot.revenue)}
                        </strong>
                      </div>
                    </div>

                    <div className="dash-rev-chart" aria-label="Daily estimated revenue">
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart
                          data={revenueSnapshot.series}
                          margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="dashRevFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#b32025" stopOpacity={0.28} />
                              <stop offset="100%" stopColor="#b32025" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="var(--border)"
                            strokeDasharray="3 6"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="shortLabel"
                            interval={revenueXAxisInterval}
                            tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-ui)' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                            minTickGap={8}
                          />
                          <YAxis
                            width={48}
                            tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-ui)' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) =>
                              v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${v}`
                            }
                          />
                          <Tooltip
                            content={<RevenueTooltip />}
                            cursor={{ stroke: '#b32025', strokeWidth: 1, strokeDasharray: '4 4' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#b32025"
                            strokeWidth={2.25}
                            fill="url(#dashRevFill)"
                            activeDot={{
                              r: 5,
                              fill: '#b32025',
                              stroke: 'var(--surface)',
                              strokeWidth: 2,
                            }}
                            dot={
                              revenueSnapshot.series.length <= 14
                                ? { r: 3, fill: '#b32025', strokeWidth: 0 }
                                : false
                            }
                            isAnimationActive
                            animationDuration={650}
                            animationEasing="ease-out"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="dash-util">
                      <div className="dash-util-head">
                        <span className="stat-label">Fleet utilization</span>
                        <span className="dash-util-pct">{utilization}%</span>
                      </div>
                      <div className="dash-util-track" aria-hidden="true">
                        <div
                          className="dash-util-fill"
                          style={{ width: `${Math.min(100, utilization)}%` }}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="dash-panel">
                    <div className="dash-panel-head">
                      <h3 className="dash-panel-title">Recent activity</h3>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => setTab('history')}
                      >
                        History
                      </button>
                    </div>
                    {recentRentals.length === 0 && (
                      <p className="empty-state dash-empty">No rentals yet.</p>
                    )}
                    <ul className="dash-recent-list">
                      {recentRentals.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="dash-recent-btn"
                            onClick={() => openTransaction(r, 'dashboard')}
                          >
                            <span className="dash-recent-main">
                              <strong>{customerName(r)}</strong>
                              <span>
                                {r.vehicle?.make} {r.vehicle?.series}
                              </span>
                            </span>
                            <span className="dash-recent-meta">
                              <span>{r.rental?.rentalFee || '—'}</span>
                    <span
                      className={`status-badge ${
                                  r.rentalLifecycle === 'active'
                                    ? 'status-rented'
                                    : r.rentalLifecycle === 'scheduled'
                                      ? 'cal-chip-scheduled'
                                      : 'status-available'
                                }`}
                              >
                                {r.rentalLifecycle === 'active'
                                  ? 'On Rent'
                                  : r.rentalLifecycle === 'scheduled'
                                    ? 'Scheduled'
                                    : 'Done'}
                    </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </section>
          )}

          {tab === 'calendar' && (
            <RentalCalendar
              rentals={rentals}
              vehicles={vehicles}
              onOpenRental={(r) => openTransaction(r, 'calendar')}
            />
          )}

          {tab === 'manage' && (
            <section className="admin-list-section manage-vehicle-section">
              {!(showAddForm && manageView === 'fleet') && (
              <div className="manage-toolbar">
                <label className="field search-field manage-search">
                  <span className="field-label">Search</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Brand, model, plate, type..."
                  />
                </label>
                <div className="manage-toolbar-row">
                  {manageView === 'fleet' ? (
                    <div className="chip-group manage-status-filters" role="group" aria-label="Filter by status">
                      {MANAGE_STATUS_FILTERS.map((f) => (
                      <button
                          key={f.id}
                        type="button"
                          className={`chip${manageStatus === f.id ? ' selected' : ''}`}
                          onClick={() => setManageStatus(f.id)}
                      >
                          {f.label}
                      </button>
                      ))}
                    </div>
                  ) : (
                    <p className="manage-archive-note">
                      Archived vehicles are hidden from the fleet. Restore them anytime, or delete permanently.
                    </p>
                  )}
                  <div className="manage-layout-toggle" role="group" aria-label="Fleet layout">
                      <button
                        type="button"
                      className={`manage-layout-btn${manageLayout === 'list' ? ' is-active' : ''}`}
                      onClick={() => setManageLayout('list')}
                      aria-pressed={manageLayout === 'list'}
                      >
                      List
                      </button>
                    <button
                      type="button"
                      className={`manage-layout-btn${manageLayout === 'cards' ? ' is-active' : ''}`}
                      onClick={() => setManageLayout('cards')}
                      aria-pressed={manageLayout === 'cards'}
                    >
                      Cards
                    </button>
              </div>
                </div>
              </div>
          )}

              {showAddForm && manageView === 'fleet' && (
                <form className="form-grid manage-add-form" onSubmit={handleSubmit}>
                <VehicleFields
                  data={form}
                  errors={errors}
                  onChange={update}
                  fileRef={fileRef}
                  onFile={(e) => handleImageFile(e, false)}
                    locked={fieldsLocked}
                    onToggleLock={() => setFieldsLocked(false)}
                    owners={owners}
                    onOwnerSelect={(id) => applyOwnerSelection(id, false)}
                    crFileRef={crFileRef}
                    orFileRef={orFileRef}
                    onCrFile={(e) => handleOrcrFile(e, false, 'cr')}
                    onOrFile={(e) => handleOrcrFile(e, false, 'or')}
                    orcrBusy={orcrBusy && orcrTarget === 'add'}
                    orcrDocHint={orcrTarget === 'add' ? orcrDocHint : null}
                    orcrProgress={orcrProgress}
                />
                <div className="field field-full admin-form-actions">
                    <button type="submit" className="btn-primary" disabled={orcrBusy}>
                      Save Vehicle
                  </button>
                </div>
              </form>
              )}

              {!(showAddForm && manageView === 'fleet') && (
              <div
                className={`admin-vehicle-list manage-vehicle-list manage-layout-${manageLayout}`}
              >
                {filtered.length === 0 && (
                  <p className="empty-state">
                    {manageView === 'archive' ? 'No archived vehicles.' : 'No vehicles found.'}
                  </p>
                )}
                {filteredGrouped.map((group) => (
                  <div key={group.bodyType} className="manage-group">
                    <h3 className="manage-group-title">{group.bodyType}</h3>
                    <div
                      className={
                        manageLayout === 'cards' ? 'manage-card-grid' : 'manage-list-stack'
                      }
                    >
                      {group.items.map((v) => {
                        const display =
                          manageView === 'archive' ? 'Archived' : getDisplayStatus(v, rentals)
                        const badgeClass =
                          manageView === 'archive' ? 'status-reserved' : statusClass(display)
                        return manageLayout === 'cards' ? (
                          <article
                            key={v.id}
                            className="manage-vehicle-card is-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => manageView === 'fleet' && setPreviewVehicle(v)}
                            onKeyDown={(e) => {
                              if (manageView !== 'fleet') return
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setPreviewVehicle(v)
                              }
                            }}
                          >
                            <div className="manage-card-media">
                              <img src={v.image} alt="" />
                              <span className={`status-badge ${badgeClass}`}>
                                {manageView === 'archive' ? 'Archived' : formatStatusLabel(display)}
                              </span>
                            </div>
                            <div className="manage-card-body">
                              <strong className="manage-card-title">
                                {v.make} — {v.series}
                              </strong>
                              <span className="manage-card-plate">{v.plateNo}</span>
                              <ul className="manage-card-facts">
                                <li>{v.seats} seats</li>
                                <li>{v.transmission}</li>
                                <li>{v.bodyType}</li>
                              </ul>
                            </div>
                            <div className="manage-card-actions">
                              {manageView === 'fleet' ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEdit(v)
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost btn-sm manage-card-archive"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      requestArchive(v)
                                    }}
                                  >
                                    Archive
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      requestRestore(v)
                                    }}
                                  >
                                    Restore
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost btn-sm manage-card-remove"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      requestPermanentDelete(v)
                                    }}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        ) : (
                          <article
                            key={v.id}
                            className="admin-vehicle-row manage-vehicle-row is-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => manageView === 'fleet' && setPreviewVehicle(v)}
                            onKeyDown={(e) => {
                              if (manageView !== 'fleet') return
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setPreviewVehicle(v)
                              }
                            }}
                          >
                            <img src={v.image} alt="" className="admin-vehicle-thumb" />
                    <div className="admin-vehicle-meta">
                      <strong>
                        {v.make} — {v.series}
                      </strong>
                      <span>
                                {v.seats} seaters · {v.transmission} · {v.plateNo}
                      </span>
                    </div>
                            <span className={`status-badge ${badgeClass}`}>
                              {manageView === 'archive' ? 'Archived' : formatStatusLabel(display)}
                            </span>
                            <div className="manage-row-actions">
                              {manageView === 'fleet' ? (
                                <>
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    title="Edit"
                                    aria-label={`Edit ${v.make} ${v.series}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEdit(v)
                                    }}
                                  >
                                    <IconEdit />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn icon-btn-archive"
                                    title="Archive"
                                    aria-label={`Archive ${v.make} ${v.series}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      requestArchive(v)
                                    }}
                                  >
                                    <IconArchive />
                                  </button>
                                </>
                              ) : (
                                <>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      requestRestore(v)
                                    }}
                    >
                                    Restore
                    </button>
                    <button
                      type="button"
                                    className="btn-ghost btn-sm manage-card-remove"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      requestPermanentDelete(v)
                                    }}
                                  >
                                    Delete
                    </button>
                                </>
                              )}
                            </div>
                  </article>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </section>
          )}

          {tab === 'reports' && (
            <VehicleReports
              vehicles={vehicles}
              adminName={profile.displayName}
              dataReady={ready && !loadError}
            />
          )}

          {tab === 'history' && (
            <section className="admin-history-section">
              <div className="history-filters">
                <label className="field search-field history-search-field">
                <span className="field-label">Search history</span>
                <input
                  type="search"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Customer name or plate..."
                />
              </label>

                <div className="field history-date-field">
                  <span className="field-label">From</span>
                  <PremiumDatePicker
                    value={historyDateFrom}
                    maxDate={historyDateTo || undefined}
                    title="From date"
                    onChange={(next) => {
                      setHistoryDateFrom(next)
                      if (historyDateTo && next > historyDateTo) setHistoryDateTo('')
                    }}
                  />
                </div>

                <div className="field history-date-field">
                  <span className="field-label">To</span>
                  <PremiumDatePicker
                    value={historyDateTo}
                    minDate={historyDateFrom || undefined}
                    title="To date"
                    onChange={setHistoryDateTo}
                  />
                </div>

                {(historySearch || historyDateFrom || historyDateTo) && (
                  <button
                    type="button"
                    className="btn-ghost history-clear-filters"
                    onClick={() => {
                      setHistorySearch('')
                      setHistoryDateFrom('')
                      setHistoryDateTo('')
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <p className="history-filter-note">
                {historyWithImages.length} result{historyWithImages.length === 1 ? '' : 's'}
                {(historyDateFrom || historyDateTo) && ' · filtered by encoded date'}
              </p>

              <div className="history-list">
                {historyWithImages.length === 0 && (
                  <p className="empty-state">No rental history matches your filters.</p>
                )}
                {historyWithImages.map((r) => {
                  const fullName =
                    `${r.personal?.firstName || ''} ${r.personal?.middleName || ''} ${r.personal?.lastName || ''}`.replace(
                      /\s+/g,
                      ' ',
                    ).trim() || 'Customer'
                  const life = r.rentalLifecycle || 'completed'
                  return (
                  <button
                    key={r.id}
                    type="button"
                    className="history-row history-row-btn"
                    onClick={() => openTransaction(r, 'history')}
                  >
                    <div className="history-thumb" aria-hidden="true">
                      {r.vehicle?.image ? (
                        <img src={r.vehicle.image} alt="" />
                      ) : (
                        <span className="history-thumb-fallback">
                          {(r.vehicle?.make || 'A').slice(0, 1)}
                        </span>
                      )}
                    </div>

                    <div className="history-body">
                    <div className="history-main">
                        <strong>{fullName}</strong>
                        <span className="history-vehicle">
                          {r.vehicle?.make} {r.vehicle?.series}
                          {r.vehicle?.plateNo ? ` · ${r.vehicle.plateNo}` : ''}
                      </span>
                    </div>

                    <div className="history-meta">
                        {r.rental?.rentalType && (
                          <span className="history-chip">{r.rental.rentalType}</span>
                        )}
                        {r.rental?.duration && (
                          <span className="history-chip">{r.rental.duration}</span>
                        )}
                        {r.rental?.rentalFee && (
                          <span className="history-chip history-chip-fee">{r.rental.rentalFee}</span>
                        )}
                      </div>

                      <div className="history-period">
                      <span>
                          {r.rental?.periodFromLabel || formatDateTime(r.rental?.periodFrom)}
                          {' → '}
                          {r.rental?.periodToLabel || formatDateTime(r.rental?.periodTo)}
                      </span>
                      <span className="history-encoded">
                        Encoded {formatDateTime(r.encodedAt)}
                      </span>
                    </div>
                    </div>

                    <div className="history-aside">
                      <span className={`history-life history-life-${life}`}>
                        {life === 'active' ? 'On rent' : life === 'scheduled' ? 'Scheduled' : 'Completed'}
                      </span>
                      <span className="history-open-hint" aria-hidden="true">
                        View
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </button>
                  )
                })}
              </div>
            </section>
          )}

          {tab === 'settings' && (
            <section className="admin-settings">
              <div className="settings-hero">
                <div className="settings-hero-copy">
                  <span className="settings-eyebrow">Workspace</span>
                  <h3 className="settings-title">Settings</h3>
                  <p className="settings-lead">
                    Profile, appearance, alerts, backups, and browser cache for the fleet desk.
                  </p>
                </div>
                {profileMessage && <span className="admin-success settings-toast">{profileMessage}</span>}
              </div>

              <div className="settings-layout">
                <div className="settings-stack">
                  <article className="settings-card settings-profile-card">
                    <div className="settings-card-head">
                      <span className="settings-eyebrow">Account</span>
                      <h4 className="settings-card-title">Admin profile</h4>
                      <p className="settings-card-copy">
                        Update how you appear in the sidebar. Your role stays Admin.
                      </p>
                    </div>

                    <div className="settings-profile-body">
                      <div className="settings-avatar-wrap">
                        <div className="settings-avatar" aria-hidden="true">
                          {profileDraft.photo ? (
                            <img src={profileDraft.photo} alt="" />
                          ) : (
                            <span>{profileInitials(profileDraft.displayName)}</span>
                          )}
                        </div>
                        <div className="settings-avatar-actions">
                          <input
                            ref={profilePhotoRef}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={onProfilePhotoChange}
                          />
                          <button
                            type="button"
                            className="btn-outline settings-photo-btn"
                            onClick={() => profilePhotoRef.current?.click()}
                          >
                            <IconCamera />
                            {profileDraft.photo ? 'Change photo' : 'Upload photo'}
                          </button>
                          {profileDraft.photo && (
                            <button
                              type="button"
                              className="btn-ghost settings-remove-photo"
                              onClick={() => setProfileDraft((prev) => ({ ...prev, photo: '' }))}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="settings-profile-fields">
                        <label className="field settings-name-field">
                          <span className="field-label">Display name</span>
                          <input
                            type="text"
                            value={profileDraft.displayName}
                            onChange={(e) =>
                              setProfileDraft((prev) => ({ ...prev, displayName: e.target.value }))
                            }
                            maxLength={40}
                            placeholder="Your name"
                          />
                        </label>

                        <div className="settings-role-row">
                          <span className="settings-role-label">Role</span>
                          <span className="settings-role-badge">Admin</span>
                        </div>

                        <div className="settings-card-actions">
                          <button type="button" className="btn-primary" onClick={saveProfileChanges}>
                            Save profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="settings-card settings-notifications-card">
                    <div className="settings-card-head">
                      <span className="settings-eyebrow">System</span>
                      <h4 className="settings-card-title">Notifications</h4>
                      <p className="settings-card-copy">
                        Stay ahead of overdue returns and rentals that are about to start.
                      </p>
                    </div>

                    <div className="settings-toggle-list settings-toggle-grid">
                      <label className="settings-toggle-row">
                        <span className="settings-toggle-copy">
                          <strong>Overdue returns</strong>
                          <span>
                            Alert when a rented car is past its return time and not yet returned.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          className="settings-switch"
                          checked={systemSettings.notifyOverdue}
                          onChange={(e) => updateSystemSetting({ notifyOverdue: e.target.checked })}
                        />
                      </label>

                      <label className="settings-toggle-row">
                        <span className="settings-toggle-copy">
                          <strong>Upcoming rental (1 hour)</strong>
                          <span>
                            Notify about 1 hour before a scheduled rental starts so the car is ready.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          className="settings-switch"
                          checked={systemSettings.notifyUpcoming}
                          onChange={(e) => updateSystemSetting({ notifyUpcoming: e.target.checked })}
                        />
                      </label>

                      <label className="settings-toggle-row">
                        <span className="settings-toggle-copy">
                          <strong>Browser push</strong>
                          <span>
                            Also show desktop notifications when the browser tab is in the background.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          className="settings-switch"
                          checked={systemSettings.notifyBrowser}
                          onChange={(e) => toggleBrowserNotifs(e.target.checked)}
                        />
                      </label>
                    </div>

                    {visibleAlerts.length > 0 && (
                      <div className="settings-alert-preview">
                        <span className="settings-role-label">Live right now</span>
                        <ul>
                          {visibleAlerts.slice(0, 3).map((a) => (
                            <li key={a.id}>
                              <strong>{a.title}</strong> — {a.body}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                </div>

                <div className="settings-stack">
                  <article className="settings-card settings-appearance-card">
                    <div className="settings-card-head">
                      <span className="settings-eyebrow">System</span>
                      <h4 className="settings-card-title">Appearance</h4>
                      <p className="settings-card-copy">
                        Choose how the admin panel looks across the workspace.
                      </p>
                    </div>

                    <div className="settings-theme-grid" role="radiogroup" aria-label="Appearance mode">
                      {[
                        { id: 'light', label: 'Light', hint: 'Soft desk view' },
                        { id: 'dark', label: 'Dark', hint: 'Dark gray desk' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={systemSettings.theme === opt.id}
                          className={`settings-theme-option is-${opt.id}${
                            systemSettings.theme === opt.id ? ' is-selected' : ''
                          }`}
                          onClick={() => updateSystemSetting({ theme: opt.id })}
                        >
                          <span className="settings-theme-swatch" aria-hidden="true" />
                          <span className="settings-theme-copy">
                            <strong>{opt.label}</strong>
                            <span>{opt.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="settings-card settings-data-card">
                    <div className="settings-card-head">
                      <span className="settings-eyebrow">Storage</span>
                      <h4 className="settings-card-title">Data &amp; cache</h4>
                      <p className="settings-card-copy">
                        Back up or migrate fleet data, or clear temporary browser cache without
                        deleting records.
                      </p>
                    </div>

                    <div className="settings-data-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={dataBusy}
                        onClick={downloadAppData}
                      >
                        Download data
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={dataBusy}
                        onClick={requestImportData}
                      >
                        {dataBusy ? 'Working…' : 'Import / migrate'}
                      </button>
                      <button
                        type="button"
                        className="btn-outline settings-clear-cache-btn"
                        disabled={dataBusy}
                        onClick={requestClearCache}
                      >
                        Clear cache
                      </button>
                      <input
                        ref={importDataRef}
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          void importAppData(file)
                        }}
                      />
                    </div>
                    {dataMessage && (
                      <p className="settings-data-message" role="status">
                        {dataMessage}
                      </p>
                    )}
                  </article>

                  <article className="settings-card settings-cloud-card">
                    <div className="settings-card-head">
                      <span className="settings-eyebrow">Sync</span>
                      <h4 className="settings-card-title">Cloud connection (Render)</h4>
                      <p className="settings-card-copy">
                        Option C: this desk keeps working offline with local SQLite. Cloud sync
                        stays disabled until you deploy Render and set{' '}
                        <code>VITE_RENDER_API_URL</code>.
                      </p>
                    </div>

                    <ul className="settings-cloud-status">
                      <li>
                        <strong>Local API</strong>
                        <span>{loadError ? 'Unavailable' : 'Running (offline-capable)'}</span>
                      </li>
                      <li>
                        <strong>Internet</strong>
                        <span>{online ? 'Online' : 'Offline — desk still works'}</span>
                      </li>
                      <li>
                        <strong>Cloud URL configured</strong>
                        <span>{isCloudConfigured() ? 'Yes' : 'Not yet'}</span>
                      </li>
                      <li>
                        <strong>Cloud sync enabled</strong>
                        <span>{CLOUD_SYNC_ENABLED ? 'Yes' : 'No (by design until deploy)'}</span>
                      </li>
                      <li>
                        <strong>Pending sync queue</strong>
                        <span>{systemStatus?.pendingSyncCount ?? '—'}</span>
                      </li>
                      <li>
                        <strong>Pending approvals</strong>
                        <span>{systemStatus?.pendingApprovalCount ?? pendingApprovalCount}</span>
                      </li>
                    </ul>
                  </article>

                  <article className="settings-card settings-session-card">
                    <div className="settings-card-head">
                      <span className="settings-eyebrow">Session</span>
                      <h4 className="settings-card-title">Sign out</h4>
                      <p className="settings-card-copy">
                        End this admin session. You’ll need to sign in again to manage the fleet.
                      </p>
                    </div>
                    <button type="button" className="btn-outline settings-logout-btn" onClick={requestLogout}>
                      Log out
                    </button>
                  </article>
                </div>
              </div>
            </section>
          )}
            </>
          )}
        </main>
      </div>

      {previewVehicle && (
        <VehicleModal
          vehicle={previewVehicle}
          eyebrow={formatStatusLabel(getDisplayStatus(previewVehicle, rentals))}
          cancelLabel="Close"
          confirmLabel="Edit"
          onClose={() => setPreviewVehicle(null)}
          onProceed={() => {
            const v = previewVehicle
            setPreviewVehicle(null)
            openEdit(v)
          }}
        />
      )}

      {editForm && (
        <div className="modal-overlay" role="presentation" onClick={() => setEditForm(null)}>
          <div
            className="modal-panel edit-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="edit-modal-header">
              <div className="edit-modal-header-copy">
                <span className="edit-modal-eyebrow">Fleet Management</span>
                <h3 className="modal-title">Edit Vehicle</h3>
                <p className="edit-modal-subtitle">
                  Refine vehicle details, rates, and display image before saving.
                </p>
              </div>
            <button
              type="button"
                className="modal-close edit-modal-close"
              onClick={() => setEditForm(null)}
              aria-label="Close"
            >
              ×
            </button>
            </div>

            <div className="edit-modal-scroll">
              <div className="edit-modal-body">
                <div className="form-grid edit-vehicle-grid">
              <VehicleFields
                data={editForm}
                errors={editErrors}
                onChange={updateEdit}
                fileRef={editFileRef}
                onFile={(e) => handleImageFile(e, true)}
                    locked={editFieldsLocked}
                    onToggleLock={() => setEditFieldsLocked(false)}
                    owners={owners}
                    onOwnerSelect={(id) => applyOwnerSelection(id, true)}
                    crFileRef={crEditFileRef}
                    orFileRef={orEditFileRef}
                    onCrFile={(e) => handleOrcrFile(e, true, 'cr')}
                    onOrFile={(e) => handleOrcrFile(e, true, 'or')}
                    orcrBusy={orcrBusy && orcrTarget === 'edit'}
                    orcrDocHint={orcrTarget === 'edit' ? orcrDocHint : null}
                    orcrProgress={orcrProgress}
              />
            </div>
              </div>
            </div>

            <div className="modal-actions edit-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setEditForm(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={requestSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {addOwnerModal && (
        <AddOwnerModal
          ownershipType={
            addOwnerModal.forEdit
              ? editForm?.ownershipType || 'company'
              : form.ownershipType || 'company'
          }
          onCancel={() => setAddOwnerModal(null)}
          onConfirm={handleAddOwnerConfirm}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel || 'Cancel'}
          danger={confirm.danger}
          hideCancel={Boolean(confirm.hideCancel)}
          onCancel={() => {
            setPendingTab(null)
            setConfirm(null)
          }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}

function sanitizePesoInput(raw) {
  let s = String(raw || '').replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, '')}`
    const [intPart, decPart = ''] = s.split('.')
    s = `${intPart}.${decPart.slice(0, 2)}`
  }
  return s
}

function formatPesoInputDisplay(digits) {
  if (digits === '' || digits === '.') return digits === '.' ? '₱0.' : ''
  const n = Number(digits)
  if (Number.isNaN(n)) return `₱${digits}`
  const decLen = digits.includes('.') ? (digits.split('.')[1] || '').length : 0
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: Math.min(decLen, 2),
    maximumFractionDigits: 2,
  })}`
}

function RatePesoInput({ value, onChange, className, id, placeholder }) {
  const [focused, setFocused] = useState(false)
  const digits = sanitizePesoInput(value)

  const display = focused
    ? digits
    : formatPesoInputDisplay(digits)

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(sanitizePesoInput(e.target.value))}
      className={className}
    />
  )
}

function VehicleFields({
  data,
  errors,
  onChange,
  fileRef,
  onFile,
  locked = false,
  onToggleLock,
  owners = [],
  onOwnerSelect,
  crFileRef,
  orFileRef,
  onCrFile,
  onOrFile,
  orcrBusy = false,
  orcrDocHint = null, // 'cr' | 'or' | null
  orcrProgress = 0,
}) {
  const disabled = locked || orcrBusy
  const crScanning = orcrBusy && orcrDocHint === 'cr'
  const orScanning = orcrBusy && orcrDocHint === 'or'

  return (
    <>
      <div className="field field-full vehicle-form-toolbar">
        <div>
          <span className="field-label">LTO OR &amp; CR scan</span>
          <p className="edit-section-copy">
            Upload the Certificate of Registration (CR) and Official Receipt (OR). Fields are filled
            from both documents (owner, plate, make/series, engine, chassis, body type, seats).
            After a successful scan, fields become read-only — use Edit only to correct mistakes.
          </p>
        </div>
        <div className="vehicle-form-toolbar-actions">
          <input
            ref={crFileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="sr-only"
            onChange={onCrFile}
          />
          <input
            ref={orFileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="sr-only"
            onChange={onOrFile}
          />
          <button
            type="button"
            className="btn-outline"
            disabled={orcrBusy}
            onClick={() => crFileRef?.current?.click()}
          >
            {crScanning
              ? `Scanning… ${orcrProgress}%`
              : data.orcrImage
                ? 'Re-scan CR'
                : 'Upload CR'}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={orcrBusy}
            onClick={() => orFileRef?.current?.click()}
          >
            {orScanning
              ? `Scanning… ${orcrProgress}%`
              : data.orImage
                ? 'Re-scan OR'
                : 'Upload OR'}
          </button>
          {locked && (
            <button
              type="button"
              className="btn-ghost"
              onClick={onToggleLock}
              disabled={orcrBusy}
            >
              Edit
            </button>
          )}
        </div>
        {(data.orcrImage || data.orImage) && (
          <div className="orcr-preview-row">
            {data.orcrImage ? (
              <div className="orcr-preview">
                <span className="orcr-preview-label">CR</span>
                <img src={data.orcrImage} alt="Certificate of Registration" />
              </div>
            ) : null}
            {data.orImage ? (
              <div className="orcr-preview">
                <span className="orcr-preview-label">OR</span>
                <img src={data.orImage} alt="Official Receipt" />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="field field-full edit-section-heading">
        <span className="field-label">Owner &amp; ownership</span>
        <p className="edit-section-copy">Links this vehicle to Vehicle Reports (Owner → Vehicle).</p>
      </div>

      <label className="field">
        <span className="field-label">Owner *</span>
        <select
          value={data.ownerId || ''}
          onChange={(e) => onOwnerSelect?.(e.target.value)}
          disabled={disabled}
          className={errors.ownerId ? 'input-error' : ''}
        >
          <option value="">Select owner…</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.ownershipType === 'thirdParty' ? ' (Third-party)' : ' (Company)'}
            </option>
          ))}
          <option value="__new__">+ Add New Owner</option>
        </select>
        {errors.ownerId && <span className="error-msg">{errors.ownerId}</span>}
      </label>

      <label className="field">
        <span className="field-label">Ownership type *</span>
        <select
          value={data.ownershipType === 'thirdParty' ? 'thirdParty' : 'company'}
          onChange={(e) => onChange('ownershipType', e.target.value)}
          disabled={disabled}
        >
          <option value="company">Company-owned</option>
          <option value="thirdParty">Third-party owned</option>
        </select>
      </label>

      <div className="field field-full edit-section-heading">
        <span className="field-label">Vehicle Details</span>
        <p className="edit-section-copy">
          Core fleet information shown across the system.
          {locked ? ' Read-only after OR/CR scan.' : ''}
        </p>
      </div>

      <label className="field">
        <span className="field-label">Brand *</span>
        <input
          type="text"
          value={data.make}
          onChange={(e) => onChange('make', e.target.value)}
          disabled={disabled}
          className={errors.make ? 'input-error' : ''}
          placeholder="Toyota"
        />
        {errors.make && <span className="error-msg">{errors.make}</span>}
      </label>
      <label className="field">
        <span className="field-label">Model / Series *</span>
        <input
          type="text"
          value={data.series}
          onChange={(e) => onChange('series', e.target.value)}
          disabled={disabled}
          className={errors.series ? 'input-error' : ''}
          placeholder="Wigo"
        />
        {errors.series && <span className="error-msg">{errors.series}</span>}
      </label>
      <label className="field">
        <span className="field-label">Body Type *</span>
        <select
          value={data.bodyType}
          onChange={(e) => onChange('bodyType', e.target.value)}
          disabled={disabled}
          className={errors.bodyType ? 'input-error' : ''}
        >
          {BODY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {errors.bodyType && <span className="error-msg">{errors.bodyType}</span>}
      </label>
      <label className="field">
        <span className="field-label">Seats *</span>
        <input
          type="number"
          min="1"
          value={data.seats}
          onChange={(e) => onChange('seats', e.target.value)}
          disabled={disabled}
          className={errors.seats ? 'input-error' : ''}
          placeholder="5"
        />
        {errors.seats && <span className="error-msg">{errors.seats}</span>}
      </label>
      <label className="field">
        <span className="field-label">Transmission *</span>
        <select
          value={data.transmission}
          onChange={(e) => onChange('transmission', e.target.value)}
          disabled={disabled}
          className={errors.transmission ? 'input-error' : ''}
        >
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
          <option value="Manual / Automatic">Manual / Automatic</option>
        </select>
        {errors.transmission && <span className="error-msg">{errors.transmission}</span>}
      </label>
      <label className="field">
        <span className="field-label">Plate No. *</span>
        <input
          type="text"
          value={data.plateNo}
          maxLength={PLATE_MAX}
          onChange={(e) => onChange('plateNo', sanitizePlateNo(e.target.value))}
          disabled={disabled}
          className={errors.plateNo ? 'input-error' : ''}
          autoCapitalize="characters"
          placeholder="Max 10 letters/digits"
        />
        {errors.plateNo && <span className="error-msg">{errors.plateNo}</span>}
      </label>
      <label className="field">
        <span className="field-label">Engine No. *</span>
        <input
          type="text"
          value={data.engineNo}
          onChange={(e) => onChange('engineNo', e.target.value)}
          disabled={disabled}
          className={errors.engineNo ? 'input-error' : ''}
          placeholder="As on CR"
        />
        {errors.engineNo && <span className="error-msg">{errors.engineNo}</span>}
      </label>
      <label className="field">
        <span className="field-label">Chassis No. *</span>
        <input
          type="text"
          value={data.chassisNo}
          onChange={(e) => onChange('chassisNo', e.target.value)}
          disabled={disabled}
          className={errors.chassisNo ? 'input-error' : ''}
          placeholder="As on CR"
        />
        {errors.chassisNo && <span className="error-msg">{errors.chassisNo}</span>}
      </label>

      <div className="field field-full rate-fields-heading">
        <span className="field-label">City drive rates (₱)</span>
        <p className="edit-section-copy">Keep rate cards clean and accurate for auto-computation.</p>
      </div>
      <label className="field">
        <span className="field-label">5 hours *</span>
        <RatePesoInput
          value={data.hrs5}
          onChange={(v) => onChange('hrs5', v)}
          className={errors.hrs5 ? 'input-error' : ''}
          placeholder="0.00"
        />
        {errors.hrs5 && <span className="error-msg">{errors.hrs5}</span>}
      </label>
      <label className="field">
        <span className="field-label">12 hours *</span>
        <RatePesoInput
          value={data.hrs12}
          onChange={(v) => onChange('hrs12', v)}
          className={errors.hrs12 ? 'input-error' : ''}
          placeholder="0.00"
        />
        {errors.hrs12 && <span className="error-msg">{errors.hrs12}</span>}
      </label>
      <label className="field">
        <span className="field-label">24 hours *</span>
        <RatePesoInput
          value={data.hrs24}
          onChange={(v) => onChange('hrs24', v)}
          className={errors.hrs24 ? 'input-error' : ''}
          placeholder="0.00"
        />
        {errors.hrs24 && <span className="error-msg">{errors.hrs24}</span>}
      </label>
      <label className="field">
        <span className="field-label">Exceeding / hour *</span>
        <RatePesoInput
          value={data.exceedHour}
          onChange={(v) => onChange('exceedHour', v)}
          className={errors.exceedHour ? 'input-error' : ''}
          placeholder="0.00"
        />
        {errors.exceedHour && <span className="error-msg">{errors.exceedHour}</span>}
      </label>

      <div className="field field-full edit-section-heading">
        <span className="field-label">Vehicle Image (optional)</span>
        <p className="edit-section-copy">
          Upload a vehicle photo, or leave blank — the fleet will use the Alatas logo as the default.
        </p>
      </div>

      <div className="field field-full edit-image-panel">
        <div className="edit-image-upload">
          <span className="field-label">Upload Image</span>
          {!String(data.image || '').startsWith('data:') && data.image ? (
            <p className="edit-image-source">Current asset: {data.image}</p>
          ) : (
            <p className="edit-image-source">
              {data.image
                ? 'Upload a cleaner image to replace the current one.'
                : 'No photo selected yet — add one when ready.'}
            </p>
          )}
          <label className="edit-upload-btn">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="file-input"
        />
            <span>Choose Image</span>
          </label>
        </div>

        <div className="edit-image-preview-wrap">
          {data.image ? (
            <div className="admin-image-preview edit-image-preview">
            <img src={data.image} alt="Preview" />
          </div>
          ) : (
            <div className="admin-image-preview edit-image-preview edit-image-default">
              <img src={addVehiclePlaceholder} alt="Add vehicle photo placeholder" />
              <span className="edit-image-default-label">Add vehicle photo</span>
            </div>
        )}
        </div>

        {errors.image && <span className="error-msg">{errors.image}</span>}
      </div>
    </>
  )
}

