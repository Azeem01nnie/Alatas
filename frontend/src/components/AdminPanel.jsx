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
import { useVehicles } from '../context/VehicleContext'
import { BODY_TYPES, VEHICLE_STATUSES } from '../data/vehicles'
import { compressImageDataUrl } from '../utils/storage'
import AdminLogin, { clearAdminSession, isAdminLoggedIn } from './AdminLogin'
import ConfirmModal from './ConfirmModal'
import PremiumDatePicker from './PremiumDatePicker'
import RentCarForm from './RentCarForm'
import RentalCalendar from './RentalCalendar'
import TransactionPage from './TransactionPage'
import VehicleModal from './VehicleModal'

const PROFILE_KEY = 'alatas-admin-profile'
const SYSTEM_SETTINGS_KEY = 'alatas-admin-system-settings'

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

const EDIT_STATUSES = ['Available', 'Under Maintenance']

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

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M19 6v13.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

const MANAGE_STATUS_FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'Available', label: 'Available' },
  { id: 'Rented', label: 'On Rent' },
  { id: 'Under Maintenance', label: 'Maintenance' },
]

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { id: 'calendar', label: 'Calendar', icon: <IconCalendar /> },
  { id: 'rent', label: 'Rent Car', icon: <IconRent /> },
  { id: 'manage', label: 'Manage Vehicle', icon: <IconManage /> },
  { id: 'history', label: 'Rental History', icon: <IconHistory /> },
]

function statusClass(status) {
  if (status === 'Available') return 'status-available'
  if (status === 'Rented') return 'status-rented'
  return 'status-maintenance'
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
  renderItem,
}) {
  const total = items.length
  const visible = expanded ? items : items.slice(0, DASH_QUEUE_PREVIEW)
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
        <button type="button" className="dash-attn-more" onClick={onToggleExpand}>
          {expanded ? 'Show less' : `See more (${hiddenCount})`}
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
  return `₱${Number(amount || 0).toLocaleString('en-PH')}`
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
    addVehicle,
    updateVehicle,
    removeVehicle,
    updateVehicleStatus,
    completeRentalForVehicle,
  } = useVehicles()
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
  const [manageLayout, setManageLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('alatas-manage-layout')
      return saved === 'cards' ? 'cards' : 'list'
    } catch {
      return 'list'
    }
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [previewVehicle, setPreviewVehicle] = useState(null)
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
  })
  const fileRef = useRef(null)
  const editFileRef = useRef(null)
  const profilePhotoRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem('alatas-manage-layout', manageLayout)
    } catch {
      /* ignore */
    }
  }, [manageLayout])

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
    const base = { Available: 0, Rented: 0, 'Under Maintenance': 0 }
    vehicles.forEach((v) => {
      if (base[v.status] !== undefined) base[v.status] += 1
    })
    return base
  }, [vehicles])

  const scheduledRentals = useMemo(
    () => rentals.filter((r) => r.rentalLifecycle === 'scheduled'),
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
    () => vehicles.filter((v) => v.status === 'Under Maintenance'),
    [vehicles],
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
    return vehicles.filter((v) => {
      if (manageStatus !== 'All' && v.status !== manageStatus) return false
      if (!q) return true
      const haystack =
        `${v.make} ${v.series} ${v.plateNo} ${v.bodyType} ${v.transmission}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [vehicles, search, manageStatus])

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
        const name = `${r.personal?.firstName || ''} ${r.personal?.middleName || ''} ${r.personal?.lastName || ''}`
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

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const updateEdit = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
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

  const validateFields = (data) => {
    const next = {}
    ;['make', 'series', 'bodyType', 'plateNo', 'engineNo', 'chassisNo'].forEach((key) => {
      if (!String(data[key] || '').trim()) next[key] = 'Required'
    })
    if (!String(data.seats || '').trim() || Number(data.seats) <= 0) {
      next.seats = 'Required'
    }
    if (!String(data.transmission || '').trim()) next.transmission = 'Required'
    ;['hrs5', 'hrs12', 'hrs24', 'exceedHour'].forEach((key) => {
      const n = Number(data[key])
      if (data[key] === '' || data[key] == null || Number.isNaN(n) || n < 0) {
        next[key] = 'Required'
      }
    })
    return next
  }

  const toVehiclePayload = (data) => ({
    make: data.make.trim(),
    series: data.series.trim(),
    bodyType: data.bodyType.trim(),
    seats: Number(data.seats) || 5,
    transmission: data.transmission.trim(),
    plateNo: data.plateNo.trim(),
    engineNo: data.engineNo.trim(),
    chassisNo: data.chassisNo.trim(),
    image: data.image.trim() || logo,
    status: data.status,
    rates: {
      hrs5: Number(data.hrs5) || 0,
      hrs12: Number(data.hrs12) || 0,
      hrs24: Number(data.hrs24) || 0,
      exceedHour: Number(data.exceedHour) || 0,
    },
  })

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
    const status = EDIT_STATUSES.includes(vehicle.status)
      ? vehicle.status
      : 'Available'
    setEditForm({
      ...vehicle,
      status,
      seats: vehicle.seats ?? 5,
      transmission: vehicle.transmission || 'Automatic',
      hrs5: vehicle.rates?.hrs5 ?? '',
      hrs12: vehicle.rates?.hrs12 ?? '',
      hrs24: vehicle.rates?.hrs24 ?? '',
      exceedHour: vehicle.rates?.exceedHour ?? '',
    })
    setEditErrors({})
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

  const requestRemove = (vehicle) => {
    setConfirm({
      type: 'remove',
      title: 'Remove vehicle?',
      message: `Permanently remove ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo}) from the fleet?`,
      confirmLabel: 'Remove',
      danger: true,
      vehicleId: vehicle.id,
    })
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
      addVehicle(toVehiclePayload(form))
      setForm(EMPTY)
      setShowAddForm(false)
      setMessage('Vehicle added successfully.')
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => setMessage(''), 2500)
    }
    if (confirm.type === 'remove') {
      await removeVehicle(confirm.vehicleId)
    }
    if (confirm.type === 'edit' && editForm) {
      const nextStatus = EDIT_STATUSES.includes(editForm.status)
        ? editForm.status
        : 'Available'
      updateVehicle(editForm.id, {
        ...toVehiclePayload(editForm),
        status: nextStatus,
      })
      setEditForm(null)
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
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowAddForm((prev) => !prev)
                  setErrors({})
                }}
              >
                {showAddForm ? 'Cancel' : 'Add Vehicle'}
              </button>
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
                        onToggleExpand={() =>
                          setDashQueueExpanded((prev) => ({
                            ...prev,
                            upcoming: !prev.upcoming,
                          }))
                        }
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

              {showAddForm && (
                <form className="form-grid manage-add-form" onSubmit={handleSubmit}>
                  <VehicleFields
                    data={form}
                    errors={errors}
                    onChange={update}
                    fileRef={fileRef}
                    onFile={(e) => handleImageFile(e, false)}
                    statusOptions={EDIT_STATUSES}
                  />
                  <div className="field field-full admin-form-actions">
                    <button type="submit" className="btn-primary">
                      Save Vehicle
                    </button>
                  </div>
                </form>
              )}

              <div
                className={`admin-vehicle-list manage-vehicle-list manage-layout-${manageLayout}`}
              >
                {filtered.length === 0 && <p className="empty-state">No vehicles found.</p>}
                {filteredGrouped.map((group) => (
                  <div key={group.bodyType} className="manage-group">
                    <h3 className="manage-group-title">{group.bodyType}</h3>
                    <div
                      className={
                        manageLayout === 'cards' ? 'manage-card-grid' : 'manage-list-stack'
                      }
                    >
                      {group.items.map((v) =>
                        manageLayout === 'cards' ? (
                          <article
                            key={v.id}
                            className="manage-vehicle-card is-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewVehicle(v)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setPreviewVehicle(v)
                              }
                            }}
                          >
                            <div className="manage-card-media">
                              <img src={v.image} alt="" />
                              <span className={`status-badge ${statusClass(v.status)}`}>
                                {v.status === 'Rented' ? 'On Rent' : v.status}
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
                                className="btn-ghost btn-sm manage-card-remove"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  requestRemove(v)
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </article>
                        ) : (
                          <article
                            key={v.id}
                            className="admin-vehicle-row manage-vehicle-row is-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewVehicle(v)}
                            onKeyDown={(e) => {
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
                            <span className={`status-badge ${statusClass(v.status)}`}>
                              {v.status === 'Rented' ? 'On Rent' : v.status}
                            </span>
                            <div className="manage-row-actions">
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
                                className="icon-btn icon-btn-danger"
                                title="Remove"
                                aria-label={`Remove ${v.make} ${v.series}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  requestRemove(v)
                                }}
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
                    Manage your profile, appearance, and rental alerts for the fleet desk.
                  </p>
                </div>
                {profileMessage && <span className="admin-success settings-toast">{profileMessage}</span>}
              </div>

              <div className="settings-layout">
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
            </section>
          )}
            </>
          )}
        </main>
      </div>

      {previewVehicle && (
        <VehicleModal
          vehicle={previewVehicle}
          eyebrow={
            previewVehicle.status === 'Rented' ? 'On Rent' : previewVehicle.status
          }
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
                    statusOptions={EDIT_STATUSES}
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

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel || 'Cancel'}
          danger={confirm.danger}
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

function VehicleFields({
  data,
  errors,
  onChange,
  fileRef,
  onFile,
  statusOptions = VEHICLE_STATUSES,
}) {
  return (
    <>
      <div className="field field-full edit-section-heading">
        <span className="field-label">Vehicle Details</span>
        <p className="edit-section-copy">Core fleet information shown across the system.</p>
      </div>

      <label className="field">
        <span className="field-label">Brand *</span>
        <input
          type="text"
          value={data.make}
          onChange={(e) => onChange('make', e.target.value)}
          className={errors.make ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Model / Series *</span>
        <input
          type="text"
          value={data.series}
          onChange={(e) => onChange('series', e.target.value)}
          className={errors.series ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Body Type *</span>
        <select
          value={data.bodyType}
          onChange={(e) => onChange('bodyType', e.target.value)}
          className={errors.bodyType ? 'input-error' : ''}
        >
          {BODY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Seats *</span>
        <input
          type="number"
          min="1"
          value={data.seats}
          onChange={(e) => onChange('seats', e.target.value)}
          className={errors.seats ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Transmission *</span>
        <select
          value={data.transmission}
          onChange={(e) => onChange('transmission', e.target.value)}
          className={errors.transmission ? 'input-error' : ''}
        >
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
          <option value="Manual / Automatic">Manual / Automatic</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">Plate No. *</span>
        <input
          type="text"
          value={data.plateNo}
          onChange={(e) => onChange('plateNo', e.target.value)}
          className={errors.plateNo ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Engine No. *</span>
        <input
          type="text"
          value={data.engineNo}
          onChange={(e) => onChange('engineNo', e.target.value)}
          className={errors.engineNo ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Chassis No. *</span>
        <input
          type="text"
          value={data.chassisNo}
          onChange={(e) => onChange('chassisNo', e.target.value)}
          className={errors.chassisNo ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Status</span>
        <select
          className="status-select full"
          value={statusOptions.includes(data.status) ? data.status : statusOptions[0]}
          onChange={(e) => onChange('status', e.target.value)}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div className="field field-full rate-fields-heading">
        <span className="field-label">City drive rates (₱)</span>
        <p className="edit-section-copy">Keep rate cards clean and accurate for auto-computation.</p>
      </div>
      <label className="field">
        <span className="field-label">5 hours *</span>
        <input
          type="number"
          min="0"
          value={data.hrs5}
          onChange={(e) => onChange('hrs5', e.target.value)}
          className={errors.hrs5 ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">12 hours *</span>
        <input
          type="number"
          min="0"
          value={data.hrs12}
          onChange={(e) => onChange('hrs12', e.target.value)}
          className={errors.hrs12 ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">24 hours *</span>
        <input
          type="number"
          min="0"
          value={data.hrs24}
          onChange={(e) => onChange('hrs24', e.target.value)}
          className={errors.hrs24 ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Exceeding / hour *</span>
        <input
          type="number"
          min="0"
          value={data.exceedHour}
          onChange={(e) => onChange('exceedHour', e.target.value)}
          className={errors.exceedHour ? 'input-error' : ''}
        />
      </label>

      <div className="field field-full edit-section-heading">
        <span className="field-label">Vehicle Image (optional)</span>
        <p className="edit-section-copy">
          Upload a vehicle photo, or leave blank to use the Alatas logo as the default.
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
                : 'No photo selected — the company logo will be used.'}
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
              <img src={logo} alt="Default Alatas logo" />
              <span className="edit-image-default-label">Default logo</span>
            </div>
          )}
        </div>

        {errors.image && <span className="error-msg">{errors.image}</span>}
      </div>
    </>
  )
}
