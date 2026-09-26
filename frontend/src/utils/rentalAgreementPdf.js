import { jsPDF } from 'jspdf'
import {
  CONTRACT_TERMS,
  LIABILITY_CLAUSE,
  getContractClauseNumber,
} from '../data/contract'
import { formatEmergencyContact } from '../utils/phone'
import letterheadLogoUrl from '../assets/alatas-letterhead-logo.jpeg'

/** Official ALATAS Vehicle Rental Agreement PDF — matches Vehicle_Rental_Agreement.docx */

const MARGIN_X = 54
const MARGIN_TOP = 36
const PAGE_W = 595.28
const PAGE_H = 841.89
const RIGHT = PAGE_W - MARGIN_X
const WIDTH = RIGHT - MARGIN_X
const BOTTOM = PAGE_H - 42
const FONT = 'times'

const DURATION_PRESETS = ['5hrs', '12hrs', '24hrs']

let cachedLogoDataUrl = null

async function loadLetterheadLogo() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl
  try {
    const res = await fetch(letterheadLogoUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    cachedLogoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('logo read failed'))
      reader.readAsDataURL(blob)
    })
    return cachedLogoDataUrl
  } catch {
    return null
  }
}

function val(v) {
  return String(v ?? '').trim()
}

function toPdfText(text) {
  return String(text ?? '')
    .replace(/\u20b1/g, 'PHP ')
    .replace(/₱/g, 'PHP ')
    .replace(/±(?=\s*\d)/g, 'PHP ')
    .replace(/[•●]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
}

function drawLine(doc, x1, y, x2) {
  doc.setDrawColor(0)
  doc.setLineWidth(0.55)
  doc.line(x1, y, x2, y)
}

function centerText(doc, text, y, size, style = 'normal') {
  doc.setFont(FONT, style)
  doc.setFontSize(size)
  const t = toPdfText(text)
  doc.text(t, (PAGE_W - doc.getTextWidth(t)) / 2, y)
}

function drawLetterhead(doc, logoDataUrl, { withTitle = true } = {}) {
  let y = MARGIN_TOP
  if (logoDataUrl) {
    try {
      const logoW = withTitle ? 52 : 44
      const logoH = withTitle ? 52 : 44
      doc.addImage(logoDataUrl, 'JPEG', RIGHT - logoW, y - 6, logoW, logoH)
    } catch (err) {
      console.warn('Letterhead logo embed failed', err)
    }
  }

  const company = 'ALATAS CAR RENTAL SERVICES'
  doc.setFont(FONT, 'bold')
  doc.setFontSize(withTitle ? 14 : 12)
  const cw = doc.getTextWidth(company)
  const cx = (PAGE_W - cw) / 2
  doc.text(company, cx, y + 10)
  drawLine(doc, cx, y + 12.5, cx + cw)

  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  centerText(doc, 'PHIDCO LOT, BALIWASAN, ZAMBOANGA CITY', y + 26, 10)
  centerText(doc, 'Contact No.: 09263943351', y + 38, 10)

  if (!withTitle) return y + 56

  y += 68
  centerText(doc, 'VEHICLE RENTAL AGREEMENT, RELEASE & ACKNOWLEDGMENT', y, 12, 'bold')
  return y + 20
}

function ensureSpace(doc, y, need = 36) {
  if (y + need <= BOTTOM) return y
  doc.addPage()
  return drawLetterhead(doc, doc.__alatasLogo, { withTitle: false })
}

function forceNewPage(doc) {
  doc.addPage()
  return drawLetterhead(doc, doc.__alatasLogo, { withTitle: false })
}

function sectionTitle(doc, title, y, { center = false } = {}) {
  y = ensureSpace(doc, y, 28)
  y += 6
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  const t = toPdfText(String(title).toUpperCase())
  if (center) centerText(doc, t, y, 11, 'bold')
  else doc.text(t, MARGIN_X, y)
  return y + 18
}

function fillBlank(doc, label, value, y, { underline = true } = {}) {
  y = ensureSpace(doc, y, 18)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  const labelText = `${label} `
  const lw = doc.getTextWidth(labelText)
  doc.text(labelText, MARGIN_X, y)
  const text = val(value)
  if (underline) {
    drawLine(doc, MARGIN_X + lw, y + 1.5, RIGHT)
  }
  if (text) {
    doc.setFont(FONT, 'bold')
    const clipped = doc.splitTextToSize(toPdfText(text), RIGHT - MARGIN_X - lw - 4)[0]
    doc.text(clipped, MARGIN_X + lw + 2, y)
    doc.setFont(FONT, 'normal')
  }
  return y + 17
}

function para(doc, text, y, size = 9.5) {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(size)
  const parts = doc.splitTextToSize(toPdfText(text), WIDTH)
  for (const line of parts) {
    y = ensureSpace(doc, y, 14)
    doc.text(line, MARGIN_X, y)
    y += 13
  }
  return y + 4
}

function checkbox(doc, x, y, checked) {
  const s = 8
  doc.setDrawColor(0)
  doc.setLineWidth(0.7)
  doc.rect(x, y - 6.5, s, s)
  if (checked) {
    doc.setFont(FONT, 'bold')
    doc.setFontSize(9)
    doc.text('X', x + 1.5, y - 0.2)
    doc.setFont(FONT, 'normal')
  }
}

function fullName(personal = {}) {
  return [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ')
}

function parseWhen(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatExecDay(d) {
  if (!d) return { day: '____', month: '_______________', year: '____' }
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return {
    day: String(d.getDate()),
    month: months[d.getMonth()],
    year: String(d.getFullYear()).slice(-2),
  }
}

function formatPeriodParts(value, label) {
  if (label && !value) {
    return { date: String(label), time: '', meridiem: '' }
  }
  const d = parseWhen(value)
  if (!d) {
    return { date: val(label) || '____/____/20____', time: '____:____', meridiem: 'AM / PM' }
  }
  let h = d.getHours()
  const mer = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return {
    date: `${mo}/${dd}/20${yy}`,
    time: `${h}:${mm}`,
    meridiem: mer,
  }
}

function matchDuration(rental = {}) {
  const raw = val(rental.duration)
  const other = val(rental.durationOther)
  const preset = DURATION_PRESETS.find((p) => p.toLowerCase() === raw.toLowerCase())
  if (preset) return { preset, other: '' }
  if (raw === 'Others' || other) return { preset: 'Others', other: other || raw }
  if (raw) return { preset: 'Others', other: raw }
  return { preset: '', other: '' }
}

function matchRentalType(rental = {}) {
  const t = val(rental.rentalType).toLowerCase()
  if (t.includes('self')) return 'Self-Drive'
  if (t.includes('driver')) return 'With-Driver'
  return val(rental.rentalType)
}

function isUsableImageSrc(value) {
  if (!value || typeof value !== 'string') return false
  const src = value.trim()
  return src.startsWith('data:image') || /^https?:\/\//i.test(src)
}

async function resolveImageForPdf(src) {
  if (!isUsableImageSrc(src)) return null
  const trimmed = String(src).trim()
  if (trimmed.startsWith('data:image')) return trimmed
  try {
    const res = await fetch(trimmed, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const maxEdge = 1400
    let width = bitmap.width
    let height = bitmap.height
    if (width > maxEdge || height > maxEdge) {
      const ratio = Math.min(maxEdge / width, maxEdge / height)
      width = Math.max(1, Math.round(width * ratio))
      height = Math.max(1, Math.round(height * ratio))
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return null
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const mime = String(blob.type || '').toLowerCase()
    if (mime.includes('png')) return canvas.toDataURL('image/png')
    return canvas.toDataURL('image/jpeg', 0.86)
  } catch {
    return null
  }
}

async function resolveImageItems(items) {
  const resolved = await Promise.all(
    items.map(async (item) => {
      const src = await resolveImageForPdf(item.src)
      return src ? { ...item, src } : null
    }),
  )
  return resolved.filter(Boolean)
}

function detectImageFormat(dataUrl) {
  const raw = String(dataUrl || '')
  if (raw.startsWith('data:image/png')) return 'PNG'
  if (raw.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

/**
 * Download the official Vehicle Rental Agreement PDF for a completed / history rental.
 */
export async function downloadRentalAgreementPdf(transaction = {}, options = {}) {
  const {
    personal = {},
    vehicle = {},
    rental = {},
    photo,
    licensePhoto,
    signature,
    carPhotos = {},
  } = transaction

  const name = fullName(personal) || 'Lessee'
  const lessorName =
    String(
      options.lessorName ||
        transaction.lessorName ||
        transaction.encodedBy ||
        '',
    ).trim() || 'Authorized Representative'
  const logoDataUrl = await loadLetterheadLogo()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.__alatasLogo = logoDataUrl
  let y = drawLetterhead(doc, logoDataUrl, { withTitle: true })

  // Execution date
  const exec = formatExecDay(parseWhen(transaction.encodedAt) || new Date())
  y = ensureSpace(doc, y, 28)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  const execLine = `This Vehicle Rental Agreement ("Agreement") is executed on this ${exec.day} day of ${exec.month} 20${exec.year}, in Zamboanga City, Philippines.`
  y = para(doc, execLine, y, 10)
  y += 10

  // LESSOR
  y = sectionTitle(doc, 'Lessor', y)
  y = para(doc, 'ALATAS CAR RENTAL SERVICES', y, 10)
  y = para(doc, 'PHIDCO Lot, Baliwasan, Zamboanga City', y, 10)
  y = para(doc, 'Contact No.: 0926-394-3351', y, 10)
  y += 8

  // LESSEE
  y = sectionTitle(doc, 'Lessee / Renter', y)
  y = fillBlank(doc, 'Full Name:', name, y, { underline: false })
  y = fillBlank(doc, 'Address:', personal.address, y, { underline: false })
  y = fillBlank(doc, 'Contact No.:', personal.contactNo, y, { underline: false })
  y = fillBlank(doc, 'Emergency Contact / No.:', formatEmergencyContact(personal), y, {
    underline: false,
  })
  y += 4
  y = para(
    doc,
    'The LESSEE warrants that all information provided is true and correct. Any false declaration shall automatically void this Agreement.',
    y,
    9.5,
  )
  y += 8

  // VEHICLE DETAILS
  y = sectionTitle(doc, 'Vehicle Details', y)
  y = fillBlank(doc, 'MAKE:', vehicle.make, y, { underline: false })
  y = fillBlank(doc, 'Series:', vehicle.series, y, { underline: false })
  y = fillBlank(doc, 'Type of Body:', vehicle.bodyType, y, { underline: false })
  y = fillBlank(doc, 'Plate No.:', vehicle.plateNo, y, { underline: false })
  y = fillBlank(doc, 'Engine No.:', vehicle.engineNo, y, { underline: false })
  y = fillBlank(doc, 'Chassis no.:', vehicle.chassisNo, y, { underline: false })
  y += 8

  // RENTAL DETAILS
  y = sectionTitle(doc, 'Rental Details', y)
  const dur = matchDuration(rental)
  y = ensureSpace(doc, y, 36)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.text('Duration:', MARGIN_X, y)
  let dx = MARGIN_X + doc.getTextWidth('Duration: ') + 4
  for (const opt of DURATION_PRESETS) {
    checkbox(doc, dx, y, dur.preset === opt)
    doc.text(opt, dx + 11, y)
    dx += doc.getTextWidth(opt) + 28
  }
  y += 16
  checkbox(doc, MARGIN_X, y, dur.preset === 'Others')
  doc.text('Others:', MARGIN_X + 12, y)
  const otherStart = MARGIN_X + 12 + doc.getTextWidth('Others: ')
  drawLine(doc, otherStart, y + 1.5, otherStart + 160)
  if (dur.preset === 'Others' && dur.other) {
    doc.setFont(FONT, 'bold')
    doc.text(toPdfText(dur.other), otherStart + 2, y)
    doc.setFont(FONT, 'normal')
  }
  y += 18

  doc.text('Rental Type:', MARGIN_X, y)
  y += 16
  const rType = matchRentalType(rental)
  checkbox(doc, MARGIN_X, y, rType === 'Self-Drive')
  doc.text('Self-Drive', MARGIN_X + 12, y)
  checkbox(doc, MARGIN_X + 100, y, rType === 'With-Driver')
  doc.text('With-Driver', MARGIN_X + 112, y)
  y += 18

  doc.setFont(FONT, 'bold')
  doc.text('Rental Period:', MARGIN_X, y)
  doc.setFont(FONT, 'normal')
  y += 16

  const fromParts = formatPeriodParts(rental.periodFrom, rental.periodFromLabel)
  const toParts = formatPeriodParts(rental.periodTo, rental.periodToLabel)

  const writePeriod = (prefix, parts) => {
    y = ensureSpace(doc, y, 14)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(10)
    doc.text(`${prefix} `, MARGIN_X, y)
    let px = MARGIN_X + doc.getTextWidth(`${prefix} `)
    drawLine(doc, px, y + 1.5, px + 150)
    doc.setFont(FONT, 'bold')
    doc.text(toPdfText(parts.date), px + 2, y)
    doc.setFont(FONT, 'normal')
    px += 158
    doc.text('at ', px, y)
    px += doc.getTextWidth('at ')
    drawLine(doc, px, y + 1.5, px + 70)
    doc.setFont(FONT, 'bold')
    doc.text(toPdfText(parts.time), px + 2, y)
    doc.setFont(FONT, 'normal')
    px += 78
    doc.text(parts.meridiem || 'AM / PM', px, y)
    y += 16
  }
  writePeriod('From', fromParts)
  writePeriod('To', toParts)
  y += 10

  // RENTAL FEES
  y = sectionTitle(doc, 'Rental Fees & Payment', y)
  y = fillBlank(doc, 'Rental Fee: PHP', rental.rentalFee, y, { underline: false })

  // TERMS start on a new page with letterhead
  y = forceNewPage(doc)
  y = sectionTitle(doc, 'Terms, Conditions, and Undertaking', y, { center: true })

  CONTRACT_TERMS.forEach((term, index) => {
    const isSection = term?.type === 'section'
    if (isSection) {
      y += 4
      y = sectionTitle(doc, term.title, y, { center: true })
      return
    }

    const num = getContractClauseNumber(CONTRACT_TERMS, index)
    const title = `${num}. ${term.title}`
    const body = String(term.body || '')

    y = ensureSpace(doc, y, 28)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(10)
    const titleLines = doc.splitTextToSize(toPdfText(title), WIDTH)
    for (const line of titleLines) {
      y = ensureSpace(doc, y, 12)
      doc.text(line, MARGIN_X, y)
      y += 12
    }

    doc.setFont(FONT, 'normal')
    doc.setFontSize(9.5)
    const bodyLines = doc.splitTextToSize(toPdfText(body), WIDTH)
    for (const line of bodyLines) {
      y = ensureSpace(doc, y, 11)
      doc.text(line, MARGIN_X, y)
      y += 11
    }
    y += 6
  })

  y += 6
  // Liability confirmation checkbox — yellow highlight (matches Word form emphasis)
  y = ensureSpace(doc, y, 40)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(9)
  const confLines = doc.splitTextToSize(toPdfText(LIABILITY_CLAUSE), WIDTH - 14)
  const confLineH = 12
  const highlightTop = y - 9
  const highlightH = confLines.length * confLineH + 4
  doc.setFillColor(255, 255, 0)
  doc.rect(MARGIN_X - 2, highlightTop, WIDTH + 4, highlightH, 'F')

  checkbox(doc, MARGIN_X, y, Boolean(transaction.termsAccepted))
  doc.setFont(FONT, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text(confLines[0], MARGIN_X + 12, y)
  for (let i = 1; i < confLines.length; i += 1) {
    y += confLineH
    y = ensureSpace(doc, y, 12)
    doc.text(confLines[i], MARGIN_X + 12, y)
  }
  y += 24

  // Signatures
  y = ensureSpace(doc, y, 110)
  const colW = (WIDTH - 28) / 2
  const leftX = MARGIN_X
  const rightX = MARGIN_X + colW + 28
  const sigTop = y

  doc.setFont(FONT, 'bold')
  doc.setFontSize(10)
  doc.text('LESSEE / RENTER', leftX, sigTop)
  doc.text('LESSOR / AUTHORIZED REPRESENTATIVE', rightX, sigTop)

  const signatureSrc = await resolveImageForPdf(signature)
  let sigImgH = 0
  if (signatureSrc) {
    try {
      const props = doc.getImageProperties(signatureSrc)
      const maxW = colW - 10
      const maxH = 42
      const ratio = Math.min(maxW / props.width, maxH / props.height, 1)
      const imgW = props.width * ratio
      sigImgH = props.height * ratio
      const format = detectImageFormat(signatureSrc)
      doc.addImage(signatureSrc, format, leftX, sigTop + 10, imgW, sigImgH)
    } catch {
      sigImgH = 0
    }
  }

  const lineY = sigTop + Math.max(58, sigImgH + 18)
  drawLine(doc, leftX, lineY, leftX + colW)
  drawLine(doc, rightX, lineY, rightX + colW)

  doc.setFont(FONT, 'bold')
  doc.setFontSize(10)
  if (!signatureSrc) doc.text(name, leftX + 2, lineY - 2)
  doc.text(lessorName, rightX + 2, lineY - 2)

  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.text('Signature Over Printed Name', leftX, lineY + 12)
  doc.text('Signature Over Printed Name', rightX, lineY + 12)
  y = lineY + 28

  // Reference line
  y = ensureSpace(doc, y, 20)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8)
  doc.text(
    toPdfText(
      `Agreement Ref: ${transaction.id || '—'}  ·  Encoded: ${
        parseWhen(transaction.encodedAt)?.toLocaleString?.() || val(transaction.encodedAt) || '—'
      }`,
    ),
    MARGIN_X,
    y,
  )
  y += 16

  // Photo appendix (customer + car) — after official form body
  const customerCandidates = []
  if (isUsableImageSrc(photo)) customerCandidates.push({ src: photo, label: 'Holding license' })
  if (isUsableImageSrc(licensePhoto)) {
    customerCandidates.push({ src: licensePhoto, label: 'Customer photo' })
  }
  if (isUsableImageSrc(personal?.optionalPhoto)) {
    customerCandidates.push({ src: personal.optionalPhoto, label: 'Optional photo' })
  }
  const customerImages = await resolveImageItems(customerCandidates)

  const carCandidates = [
    ...[
      ['front', 'Front'],
      ['rear', 'Rear'],
      ['left', 'Left side'],
      ['right', 'Right side'],
    ]
      .filter(([key]) => isUsableImageSrc(carPhotos?.[key]))
      .map(([key, label]) => ({ src: carPhotos[key], label })),
    ...(Array.isArray(carPhotos?.extras)
      ? carPhotos.extras
          .filter((item) => isUsableImageSrc(item?.uri))
          .map((item, index) => ({
            src: item.uri,
            label: item.label || `Extra ${index + 1}`,
          }))
      : []),
  ]
  const carImages = await resolveImageItems(carCandidates)

  const drawAppendix = (title, items) => {
    if (!items.length) return
    y = ensureSpace(doc, y, 200)
    // Prefer starting appendix sections on a fresh page when near bottom
    if (y > MARGIN_TOP + 120) {
      doc.addPage()
      y = drawLetterhead(doc, doc.__alatasLogo, { withTitle: false })
    }
    doc.setFont(FONT, 'bold')
    doc.setFontSize(11)
    doc.text(title, MARGIN_X, y)
    y += 14

    for (const item of items) {
      y = ensureSpace(doc, y, 200)
      doc.setFont(FONT, 'bold')
      doc.setFontSize(10)
      doc.text(item.label, MARGIN_X, y)
      y += 10
      try {
        const props = doc.getImageProperties(item.src)
        const maxW = WIDTH
        const maxH = 260
        const ratio = Math.min(maxW / props.width, maxH / props.height, 1)
        const imgW = props.width * ratio
        const imgH = props.height * ratio
        const format = detectImageFormat(item.src)
        doc.addImage(item.src, format, MARGIN_X, y, imgW, imgH)
        y += imgH + 16
      } catch {
        doc.setFont(FONT, 'normal')
        doc.setFontSize(9)
        doc.text('(Image could not be embedded.)', MARGIN_X, y)
        y += 14
      }
    }
  }

  drawAppendix('CUSTOMER PHOTOS (APPENDIX)', customerImages)
  drawAppendix('PRE-RENTAL CAR PHOTOS (APPENDIX)', carImages)

  const safeName = name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'contract'
  doc.save(`Vehicle_Rental_Agreement_${safeName}_${transaction.id || 'report'}.pdf`)
}
