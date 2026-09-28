const ERROR_KEY = 'alatas-error-monitor'
const MAX_ERRORS = 100
export const ERROR_MONITOR_EVENT = 'alatas-error-monitor-change'

function readErrors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ERROR_MONITOR_EVENT))
}

export function reportAppError(error, context = {}) {
  const message = String(error?.message || error || 'Unknown error').slice(0, 500)
  const stack = String(error?.stack || '').slice(0, 2000)
  const row = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    stack,
    area: String(context.area || 'application').slice(0, 80),
    operation: String(context.operation || '').slice(0, 120),
    severity: context.severity === 'warning' ? 'warning' : 'error',
    occurredAt: new Date().toISOString(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  }
  try {
    localStorage.setItem(ERROR_KEY, JSON.stringify([row, ...readErrors()].slice(0, MAX_ERRORS)))
    emit()
  } catch {
    // Monitoring must never break the main workflow.
  }
  return row
}

export function getErrorReport() {
  const entries = readErrors()
  return {
    count: entries.length,
    entries,
    latest: entries[0] || null,
  }
}

export function clearErrorReport() {
  try {
    localStorage.removeItem(ERROR_KEY)
    emit()
  } catch {
    // ignore unavailable storage
  }
}

export function installGlobalErrorMonitoring() {
  if (typeof window === 'undefined') return () => {}
  const onError = (event) => {
    reportAppError(event.error || event.message, {
      area: 'window',
      operation: `${event.filename || ''}:${event.lineno || 0}`,
    })
  }
  const onRejection = (event) => {
    reportAppError(event.reason, { area: 'promise', operation: 'unhandled rejection' })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

