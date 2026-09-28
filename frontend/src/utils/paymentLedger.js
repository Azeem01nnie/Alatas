const VALID_TYPES = new Set([
  'deposit',
  'payment',
  'refund',
  'discount',
  'overdue_collection',
  'additional_charge',
])

export function createPaymentEntry(type, amount, details = {}) {
  const safeType = VALID_TYPES.has(type) ? type : 'payment'
  const value = Math.max(0, Number(amount) || 0)
  const occurredAt = details.occurredAt || new Date().toISOString()
  return {
    id:
      details.id ||
      `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: safeType,
    amount: value,
    direction:
      safeType === 'refund' || safeType === 'discount' ? 'out' : 'in',
    method: String(details.method || 'cash').trim().toLowerCase(),
    reference: String(details.reference || '').trim(),
    note: String(details.note || '').trim(),
    recordedBy: String(details.recordedBy || '').trim() || 'Unknown',
    occurredAt,
    createdAt: details.createdAt || occurredAt,
  }
}

export function appendPaymentEntry(ledger, entry) {
  const rows = Array.isArray(ledger) ? ledger.filter(Boolean) : []
  if (!entry?.id || rows.some((row) => String(row.id) === String(entry.id))) return rows
  return [...rows, entry]
}

export function normalizePaymentLedger(ledger) {
  if (!Array.isArray(ledger)) return []
  return ledger
    .filter((entry) => entry && VALID_TYPES.has(entry.type))
    .map((entry) => ({
      ...entry,
      amount: Math.max(0, Number(entry.amount) || 0),
    }))
}

