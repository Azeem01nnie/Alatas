/**
 * Format Philippine mobile numbers as: 09XX XXX XXXX (11 digits)
 * "09" is always locked; digits only.
 */
export function formatPhMobile(input) {
  let digits = String(input || '').replace(/\D/g, '')

  // Normalize from +63 / 63 / 9… forms into local 09…
  if (digits.startsWith('63')) digits = `0${digits.slice(2)}`
  if (digits.startsWith('9')) digits = `0${digits}`
  if (!digits.startsWith('0')) digits = `0${digits}`
  if (!digits.startsWith('09')) digits = `09${digits.slice(1)}`

  // 09 + 2 + 3 + 4 = 11 digits total
  digits = digits.slice(0, 11)
  if (digits.length < 2) digits = '09'

  const a = digits.slice(0, 4) // 09XX
  const b = digits.slice(4, 7) // XXX
  const c = digits.slice(7, 11) // XXXX

  let out = a.length > 2 ? a : '09'
  if (b) out += ` ${b}`
  if (c) out += ` ${c}`
  return out
}

/** Show "09" as soon as the field is focused/clicked. */
export function ensurePhMobilePrefix(value) {
  if (!value || !String(value).replace(/\D/g, '')) return '09'
  return formatPhMobile(value)
}

export function isCompletePhMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return /^09\d{9}$/.test(digits)
}

export function formatEmergencyContact(personal) {
  if (!personal) return '—'
  const name = personal.emergencyName?.trim()
  const relation =
    personal.emergencyRelation === 'Other'
      ? personal.emergencyRelationOther?.trim()
      : personal.emergencyRelation?.trim()
  const phone = personal.emergencyPhone?.trim()
  if (name || relation || phone) {
    const who = [name, relation ? `(${relation})` : ''].filter(Boolean).join(' ')
    return [who, phone].filter(Boolean).join(' — ') || '—'
  }
  return personal.emergencyContact?.trim() || '—'
}
