/**
 * Format Philippine mobile numbers as: +63 912 123 1234
 * "+63" is always locked; remaining 10 digits start with 9.
 */
export function formatPhMobile(input) {
  let digits = String(input || '').replace(/\D/g, '')

  if (digits.startsWith('09')) digits = `63${digits.slice(1)}`
  else if (digits.startsWith('63')) digits = digits
  else if (digits.startsWith('9')) digits = `63${digits}`
  else if (digits.startsWith('0')) digits = `63${digits.slice(1)}`
  else if (digits) digits = `63${digits}`

  digits = digits.slice(0, 12)
  if (digits.length < 2) return '+63'
  if (!digits.startsWith('63')) digits = `63${digits}`.slice(0, 12)

  const rest = digits.slice(2)
  const a = rest.slice(0, 3)
  const b = rest.slice(3, 6)
  const c = rest.slice(6, 10)

  let out = '+63'
  if (a) out += ` ${a}`
  if (b) out += ` ${b}`
  if (c) out += ` ${c}`
  return out
}

/** Show "+63" as soon as the field is focused/clicked. */
export function ensurePhMobilePrefix(value) {
  if (!value || !String(value).replace(/\D/g, '')) return '+63'
  return formatPhMobile(value)
}

export function isCompletePhMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return /^09\d{9}$/.test(digits) || /^9\d{9}$/.test(digits) || /^639\d{9}$/.test(digits)
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
