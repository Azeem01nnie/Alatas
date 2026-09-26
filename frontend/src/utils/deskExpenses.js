import { fetchDeskExpensesRemote, saveDeskExpensesRemote } from '../api/backend'
import { isSupabaseConfigured } from '../api/supabaseClient'

const STORAGE_KEY = 'alatas-desk-expenses-v1'

function normalizeEntries(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => ({
      id: String(row?.id || ''),
      amount: Math.max(0, Number(row?.amount) || 0),
      note: String(row?.note || '').trim(),
      at: row?.at || new Date().toISOString(),
    }))
    .filter((row) => row.id)
}

export function loadDeskExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return normalizeEntries(JSON.parse(raw))
  } catch {
    return []
  }
}

export function persistDeskExpenses(entries) {
  const next = normalizeEntries(entries)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  return next
}

export function sumDeskExpenses(entries = loadDeskExpenses()) {
  return normalizeEntries(entries).reduce((sum, row) => sum + row.amount, 0)
}

export function addDeskExpense({ amount, note = '' }) {
  const next = [
    {
      id: `dx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      amount: Math.max(0, Number(amount) || 0),
      note: String(note || '').trim(),
      at: new Date().toISOString(),
    },
    ...loadDeskExpenses(),
  ]
  persistDeskExpenses(next)
  if (isSupabaseConfigured) {
    void saveDeskExpensesRemote(next).catch((err) => {
      console.warn('Desk expenses sync failed', err)
    })
  }
  return next
}

export function clearDeskExpenses() {
  persistDeskExpenses([])
  if (isSupabaseConfigured) {
    void saveDeskExpensesRemote([]).catch((err) => {
      console.warn('Desk expenses clear sync failed', err)
    })
  }
  return []
}

export async function pullDeskExpensesFromCloud() {
  if (!isSupabaseConfigured) return loadDeskExpenses()
  try {
    const remote = await fetchDeskExpensesRemote()
    const next = persistDeskExpenses(remote)
    return next
  } catch (err) {
    console.warn('Desk expenses pull failed', err)
    return []
  }
}
