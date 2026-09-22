import { jsPDF } from 'jspdf'
import letterheadLogoUrl from '../assets/alatas-letterhead-logo.jpeg'

/** Official ALATAS Vehicle Return Damage Inspection & Acknowledgment — matches the Word form. */

const MARGIN_X = 54
const MARGIN_TOP = 36
const PAGE_W = 595.28
const PAGE_H = 841.89
const RIGHT = PAGE_W - MARGIN_X
const WIDTH = RIGHT - MARGIN_X
const BOTTOM = PAGE_H - 40
const FONT = 'times'

const DAMAGE_TYPES = [
  'Scratch',
  'Dent',
  'Cracked/Broken Part',
  'Collision Damage',
  'Tire/Wheel Damage',
  'Glass/Light Damage',
  'Interior Damage',
  'Missing Item/Accessory',
  'Mechanical/Operational Issue',
  'Other',
]

const ATTACHMENT_OPTIONS = [
  'Vehicle return photographs',
  'Video documentation',
  'Repair quotation',
  'Parts/labor estimate',
  'Copy of Rental Agreement',
  'Other',
]

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

function ensureSpace(doc, y, need = 36) {
  if (y + need <= BOTTOM) return y
  doc.addPage()
  return drawLetterhead(doc, doc.__alatasLogo, { withTitle: false })
}

function forceNewPage(doc) {
  doc.addPage()
  return drawLetterhead(doc, doc.__alatasLogo, { withTitle: false })
}

function drawLine(doc, x1, y, x2) {
  doc.setDrawColor(0)
  doc.setLineWidth(0.6)
  doc.line(x1, y, x2, y)
}

function centerText(doc, text, y, size, style = 'normal') {
  doc.setFont(FONT, style)
  doc.setFontSize(size)
  const tw = doc.getTextWidth(text)
  doc.text(text, (PAGE_W - tw) / 2, y)
}

/** Label + underlined fill line (Word style). */
function fillBlank(doc, label, value, y) {
  y = ensureSpace(doc, y, 16)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(11)
  const labelText = `${label} `
  const lw = doc.getTextWidth(labelText)
  doc.text(labelText, MARGIN_X, y)
  const lineStart = MARGIN_X + lw
  drawLine(doc, lineStart, y + 1.5, RIGHT)
  const text = val(value)
  if (text) {
    doc.setFont(FONT, 'bold')
    const clipped = doc.splitTextToSize(text, RIGHT - lineStart - 4)[0] || text
    doc.text(clipped, lineStart + 2, y)
    doc.setFont(FONT, 'normal')
  }
  return y + 15
}

/** Label on first line with underline, then extra blank lines (Word style). */
function fillMultiline(doc, label, value, y, blankLines = 2) {
  y = ensureSpace(doc, y, 14 + blankLines * 14)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(11)
  const labelText = `${label} `
  const lw = doc.getTextWidth(labelText)
  doc.text(labelText, MARGIN_X, y)
  drawLine(doc, MARGIN_X + lw, y + 1.5, RIGHT)

  const text = val(value)
  const firstW = RIGHT - MARGIN_X - lw - 4
  const chunks = text ? doc.splitTextToSize(text, Math.max(40, firstW)) : []
  // First chunk on the label line
  if (chunks[0]) {
    doc.setFont(FONT, 'bold')
    doc.text(chunks[0], MARGIN_X + lw + 2, y)
    doc.setFont(FONT, 'normal')
  }
  y += 14

  let chunkIdx = 1
  for (let i = 0; i < blankLines; i += 1) {
    y = ensureSpace(doc, y, 14)
    drawLine(doc, MARGIN_X, y + 1.5, RIGHT)
    if (chunks[chunkIdx]) {
      doc.setFont(FONT, 'bold')
      doc.text(chunks[chunkIdx], MARGIN_X + 2, y)
      doc.setFont(FONT, 'normal')
      chunkIdx += 1
    }
    y += 14
  }
  while (chunkIdx < chunks.length) {
    y = ensureSpace(doc, y, 14)
    drawLine(doc, MARGIN_X, y + 1.5, RIGHT)
    doc.setFont(FONT, 'bold')
    doc.text(chunks[chunkIdx], MARGIN_X + 2, y)
    doc.setFont(FONT, 'normal')
    chunkIdx += 1
    y += 14
  }
  return y + 2
}

function sectionTitle(doc, title, y, { center = false } = {}) {
  y = ensureSpace(doc, y, 20)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  const t = String(title).toUpperCase()
  if (center) {
    centerText(doc, t, y, 11, 'bold')
  } else {
    doc.text(t, MARGIN_X, y)
  }
  return y + 14
}

function para(doc, text, y, size = 10) {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(size)
  const parts = doc.splitTextToSize(String(text), WIDTH)
  for (const line of parts) {
    y = ensureSpace(doc, y, 12)
    doc.text(line, MARGIN_X, y)
    y += 12
  }
  return y + 2
}

function checkbox(doc, x, y, checked) {
  const s = 9
  doc.setDrawColor(0)
  doc.setLineWidth(0.7)
  doc.rect(x, y - 7.5, s, s)
  if (checked) {
    doc.setFont(FONT, 'bold')
    doc.setFontSize(10)
    doc.text('X', x + 1.6, y - 0.2)
    doc.setFont(FONT, 'normal')
  }
}

/** Word-style inline wrapping checkboxes (not a rigid 2-column grid). */
function flowInlineCheckboxes(doc, items, y, startX = MARGIN_X) {
  let x = startX
  let rowY = y
  doc.setFontSize(10)
  for (const item of items) {
    const label = item.label
    doc.setFont(FONT, 'normal')
    const labelW = doc.getTextWidth(label)
    const blockW = 12 + labelW + 14
    if (x + blockW > RIGHT && x > startX) {
      x = MARGIN_X
      rowY += 15
    }
    rowY = ensureSpace(doc, rowY, 16)
    checkbox(doc, x, rowY, item.checked)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(10)
    doc.text(label, x + 12, rowY)
    x += blockW
  }
  return rowY + 16
}

function detectImageFormat(dataUrl) {
  const raw = String(dataUrl || '')
  if (raw.startsWith('data:image/png')) return 'PNG'
  if (raw.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

function formatWitnessDateTime(inspection) {
  if (inspection.witnessDateTime) return val(inspection.witnessDateTime)
  const date = val(inspection.witnessDate)
  const time = val(inspection.witnessTime)
  const mer = val(inspection.witnessMeridiem)
  if (date && time) return `${date} ${time} ${mer}`.trim()
  return date || `${time} ${mer}`.trim()
}

function drawLetterhead(doc, logoDataUrl, { withTitle = true } = {}) {
  let y = MARGIN_TOP

  // Logo top-right (matches Word header placement)
  if (logoDataUrl) {
    try {
      const logoW = withTitle ? 52 : 44
      const logoH = withTitle ? 52 : 44
      doc.addImage(logoDataUrl, 'JPEG', RIGHT - logoW, y - 6, logoW, logoH)
    } catch (err) {
      console.warn('Letterhead logo embed failed', err)
    }
  }

  // Company name — centered, bold, underlined
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

  if (!withTitle) {
    // Continuation pages: letterhead only (like the Word header)
    return y + 56
  }

  y += 70

  // Document title (first page only)
  centerText(doc, 'VEHICLE RETURN DAMAGE INSPECTION & ACKNOWLEDGMENT', y, 12, 'bold')
  return y + 22
}

export async function downloadDamageReportPdf(inspection = {}, meta = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const plate = inspection.plateNo || meta.plateNo || 'vehicle'
  const logoDataUrl = await loadLetterheadLogo()
  doc.__alatasLogo = logoDataUrl
  let y = drawLetterhead(doc, logoDataUrl, { withTitle: true })

  y = fillBlank(doc, 'Date:', inspection.inspectionDate, y)
  y = fillBlank(
    doc,
    'Related Rental Agreement Date/No.:',
    inspection.rentalAgreementRef || meta.rentalId,
    y,
  )
  y += 4

  y = sectionTitle(doc, 'Renter / Lessee Information', y)
  y = fillBlank(doc, 'Full Name:', inspection.renterName, y)
  y = fillBlank(doc, 'Address:', inspection.renterAddress, y)
  y = fillBlank(doc, 'Contact No.:', inspection.renterContact, y)
  y += 2

  y = sectionTitle(doc, 'Vehicle Information', y)
  y = fillBlank(doc, 'Make/Model:', inspection.makeModel || meta.makeModel, y)
  y = fillBlank(doc, 'Plate No.:', inspection.plateNo || meta.plateNo, y)
  y = fillBlank(doc, 'Engine No.:', inspection.engineNo, y)
  y = fillBlank(doc, 'Chassis No.:', inspection.chassisNo, y)
  y += 2

  y = sectionTitle(doc, 'Return Details', y)
  y = fillBlank(doc, 'Date Returned:', inspection.dateReturned, y)

  // Time Returned: ________   AM / PM
  y = ensureSpace(doc, y, 16)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(11)
  doc.text('Time Returned: ', MARGIN_X, y)
  const timeLabelW = doc.getTextWidth('Time Returned: ')
  const timeLineEnd = MARGIN_X + timeLabelW + 150
  drawLine(doc, MARGIN_X + timeLabelW, y + 1.5, timeLineEnd)
  const timeOnly = val(inspection.timeReturned)
  const mer = val(inspection.timeMeridiem)
  if (timeOnly || mer) {
    doc.setFont(FONT, 'bold')
    doc.text([timeOnly, mer].filter(Boolean).join(' '), MARGIN_X + timeLabelW + 2, y)
    doc.setFont(FONT, 'normal')
  }
  doc.text('AM / PM', timeLineEnd + 10, y)
  y += 15

  y = fillBlank(doc, 'Odometer Reading:', inspection.odometer, y)
  y = fillBlank(doc, 'Fuel Level:', inspection.fuelLevel, y)
  y += 4

  y = sectionTitle(doc, 'Damage / Condition Found Upon Return', y, { center: true })
  y = para(
    doc,
    'Upon return of the above-described vehicle to ALATAS CAR RENTAL SERVICES, the vehicle was physically inspected and the following damage, loss, or abnormal condition was observed:',
    y,
    10,
  )
  y = fillBlank(doc, 'Location/Part:', inspection.damageLocation, y)
  y = fillMultiline(doc, 'Description of Damage:', inspection.damageDescription, y, 2)
  y = fillMultiline(
    doc,
    'Additional Damage / Missing Item / Other Issue:',
    inspection.additionalDamage,
    y,
    1,
  )

  // Damage Type — inline like Word
  y = ensureSpace(doc, y, 18)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  const dtLabel = 'Damage Type: '
  doc.text(dtLabel, MARGIN_X, y)
  const selectedTypes = Array.isArray(inspection.damageTypes) ? inspection.damageTypes : []
  const typeItems = DAMAGE_TYPES.map((t) => {
    if (t === 'Other') {
      const other = val(inspection.damageOther)
      return {
        checked: selectedTypes.includes(t),
        label: other ? `Other: ${other}` : 'Other: __________',
      }
    }
    return { checked: selectedTypes.includes(t), label: t }
  })
  y = flowInlineCheckboxes(doc, typeItems, y, MARGIN_X + doc.getTextWidth(dtLabel))

  // Photos/Videos line
  y = ensureSpace(doc, y, 16)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(11)
  doc.text('Photos/Videos Taken: ', MARGIN_X, y)
  let px = MARGIN_X + doc.getTextWidth('Photos/Videos Taken: ')
  checkbox(doc, px, y, inspection.photosTaken === 'YES')
  doc.text('YES', px + 12, y)
  px += 42
  checkbox(doc, px, y, inspection.photosTaken === 'NO')
  doc.text('NO', px + 12, y)
  px += 48
  doc.text('Number of Photos/Videos: ', px, y)
  px += doc.getTextWidth('Number of Photos/Videos: ')
  drawLine(doc, px, y + 1.5, RIGHT)
  if (val(inspection.photosCount)) {
    doc.setFont(FONT, 'bold')
    doc.text(val(inspection.photosCount), px + 2, y)
    doc.setFont(FONT, 'normal')
  }
  y += 16

  y = sectionTitle(doc, 'Damage Assessment', y)
  const assessRows = [
    {
      checked: inspection.assessment === 'undetermined',
      label:
        'Repair cost has not yet been determined and the vehicle will be submitted for proper inspection/quotation.',
    },
    {
      checked: inspection.assessment === 'estimate',
      label: `Estimated repair cost: P${val(inspection.estimatedCost) || '____________________'}`,
    },
    {
      checked: inspection.assessment === 'final',
      label: 'Final quotation/assessment attached.',
    },
  ]
  for (const row of assessRows) {
    y = ensureSpace(doc, y, 16)
    checkbox(doc, MARGIN_X, y, row.checked)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(10)
    const parts = doc.splitTextToSize(row.label, WIDTH - 14)
    doc.text(parts[0], MARGIN_X + 12, y)
    for (let i = 1; i < parts.length; i += 1) {
      y += 12
      y = ensureSpace(doc, y, 12)
      doc.text(parts[i], MARGIN_X + 12, y)
    }
    y += 14
  }
  y = para(
    doc,
    'If the amount stated above is only an estimate, it is not the final amount. The final amount shall be based on the actual inspection, repair quotation, replacement parts, labor, towing, and other reasonable expenses arising from the damage, subject to the Vehicle Rental Agreement.',
    y,
    9.5,
  )
  y += 4

  // Keep Acknowledgment + Payment + signatures together on page 2 with letterhead
  y = forceNewPage(doc)

  y = sectionTitle(doc, "Renter's Acknowledgment", y, { center: true })
  y = para(
    doc,
    'I, the undersigned RENTER/LESSEE, acknowledge that I was present during, or was informed of, the return inspection and that the damage/condition described in this document was observed and documented upon return of the vehicle.',
    y,
    10,
  )
  y = para(
    doc,
    'My signature below confirms receipt and acknowledgment of this inspection report and the stated condition of the vehicle. Any determination of responsibility and the amount chargeable shall be governed by the Vehicle Rental Agreement and supported, where applicable, by inspection findings, photographs/videos, quotations, receipts, or other relevant records.',
    y,
    10,
  )
  y += 4

  y = sectionTitle(doc, 'Payment / Settlement Status', y)
  const settleItems = [
    {
      checked: inspection.settlement === 'for_assessment',
      label: 'For assessment - amount to be determined',
    },
    {
      checked: inspection.settlement === 'agrees_final',
      label: 'Renter agrees to pay based on final repair quotation/actual cost',
    },
    {
      checked: inspection.settlement === 'paid',
      label: `Paid P${val(inspection.paidAmount) || '__________________'} on ${val(inspection.paidDate) || '__________________'}`,
    },
    {
      checked: inspection.settlement === 'partial',
      label: `Partial payment P${val(inspection.partialAmount) || '____________'}   Balance P${val(inspection.balanceAmount) || '____________'}`,
    },
    {
      checked: inspection.settlement === 'other',
      label: `Other arrangement: ${val(inspection.otherArrangement) || '______________________________________________________________'}`,
    },
  ]
  for (const item of settleItems) {
    y = ensureSpace(doc, y, 16)
    checkbox(doc, MARGIN_X, y, item.checked)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(10)
    const parts = doc.splitTextToSize(item.label, WIDTH - 14)
    doc.text(parts[0], MARGIN_X + 12, y)
    for (let i = 1; i < parts.length; i += 1) {
      y += 12
      y = ensureSpace(doc, y, 12)
      doc.text(parts[i], MARGIN_X + 12, y)
    }
    y += 14
  }
  y = para(
    doc,
    'Payment or settlement under this document does not cover additional concealed or mechanical damage that could not reasonably have been discovered during the initial return inspection and is subsequently determined to be related to the rental period, subject to the Vehicle Rental Agreement and applicable law.',
    y,
    9.5,
  )
  y += 14

  // Signature blocks — match Word: Lessee left, Lessor right
  y = ensureSpace(doc, y, 140)
  const colW = (WIDTH - 36) / 2
  const leftX = MARGIN_X
  const rightX = MARGIN_X + colW + 36
  const sigTop = y

  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  doc.text('LESSEE / RENTER', leftX, sigTop)
  doc.text('LESSOR /', rightX, sigTop)
  doc.text('AUTHORIZED REPRESENTATIVE', rightX, sigTop + 12)

  // Signature labels sit above the line (Word style)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.text('Signature Over Printed Name', leftX + 8, sigTop + 36)
  doc.text('Signature Over Printed Name', rightX + 8, sigTop + 36)

  // Signature lines
  const lineY = sigTop + 58
  drawLine(doc, leftX, lineY, leftX + colW)
  drawLine(doc, rightX, lineY, rightX + colW)
  if (val(inspection.renterName)) {
    doc.setFont(FONT, 'bold')
    doc.setFontSize(10)
    doc.text(val(inspection.renterName), leftX + 2, lineY - 2)
    doc.setFont(FONT, 'normal')
  }
  if (val(inspection.lessorName)) {
    doc.setFont(FONT, 'bold')
    doc.setFontSize(10)
    doc.text(val(inspection.lessorName), rightX + 2, lineY - 2)
    doc.setFont(FONT, 'normal')
  }

  // License / date under Lessee only (Word layout)
  let ly = lineY + 18
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.text('License No: ', leftX, ly)
  let lx = leftX + doc.getTextWidth('License No: ')
  drawLine(doc, lx, ly + 1.5, leftX + colW)
  if (val(inspection.renterLicenseNo)) {
    doc.setFont(FONT, 'bold')
    doc.text(val(inspection.renterLicenseNo), lx + 2, ly)
    doc.setFont(FONT, 'normal')
  }
  ly += 16
  doc.text('License Valid Until: ', leftX, ly)
  lx = leftX + doc.getTextWidth('License Valid Until: ')
  drawLine(doc, lx, ly + 1.5, leftX + colW)
  if (val(inspection.renterLicenseValidUntil)) {
    doc.setFont(FONT, 'bold')
    doc.text(val(inspection.renterLicenseValidUntil), lx + 2, ly)
    doc.setFont(FONT, 'normal')
  }
  ly += 16
  const dateLabel = 'Date: '
  doc.text(dateLabel, leftX, ly)
  lx = leftX + doc.getTextWidth(dateLabel)
  if (val(inspection.renterSignDate)) {
    doc.setFont(FONT, 'bold')
    doc.text(val(inspection.renterSignDate), lx, ly)
    doc.setFont(FONT, 'normal')
  } else {
    doc.text('_____/_____/20___', lx, ly)
  }

  y = Math.max(ly, lineY) + 28

  // WITNESS — heading on its own line, fields on the next (Word layout)
  y = ensureSpace(doc, y, 36)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  doc.text('WITNESS', MARGIN_X, y)
  y += 16

  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  let wx = MARGIN_X
  doc.text('Signature:', wx, y)
  wx += doc.getTextWidth('Signature: ')
  const sigEnd = wx + 130
  drawLine(doc, wx, y + 1.5, sigEnd)
  wx = sigEnd + 12

  doc.text('Printed Name:', wx, y)
  wx += doc.getTextWidth('Printed Name: ')
  const nameEnd = wx + 130
  drawLine(doc, wx, y + 1.5, nameEnd)
  if (val(inspection.witnessName)) {
    doc.setFont(FONT, 'bold')
    doc.text(val(inspection.witnessName), wx + 2, y)
    doc.setFont(FONT, 'normal')
  }
  wx = nameEnd + 12

  doc.text('Date/Time:', wx, y)
  wx += doc.getTextWidth('Date/Time: ')
  drawLine(doc, wx, y + 1.5, RIGHT)
  const witnessDt = formatWitnessDateTime(inspection)
  if (witnessDt) {
    doc.setFont(FONT, 'bold')
    doc.setFontSize(9)
    doc.text(witnessDt, wx + 2, y)
    doc.setFont(FONT, 'normal')
  }
  y += 22

  y = sectionTitle(doc, 'Attachments', y)
  const checklist = Array.isArray(inspection.attachments) ? inspection.attachments : []
  const attachItems = ATTACHMENT_OPTIONS.map((item) => {
    if (item === 'Other') {
      const other = val(inspection.attachmentOther)
      return {
        checked: checklist.includes(item),
        label: other ? `Other: ${other}` : 'Other: ______________________________________________',
      }
    }
    return { checked: checklist.includes(item), label: item }
  })
  y = flowInlineCheckboxes(doc, attachItems, y)

  // Media appendix after official form body
  const media = Array.isArray(inspection.mediaFiles) ? inspection.mediaFiles : []
  if (media.length) {
    y = forceNewPage(doc)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(12)
    doc.text('ATTACHED MEDIA (APPENDIX)', MARGIN_X, y)
    y += 16
    let photoNo = 0
    let videoNo = 0
    for (const item of media) {
      y = ensureSpace(doc, y, item.kind === 'image' ? 220 : 28)
      doc.setFont(FONT, 'bold')
      doc.setFontSize(10)
      let label
      if (item.kind === 'image') {
        photoNo += 1
        label = `Vehicle return photograph ${photoNo}`
      } else {
        videoNo += 1
        label = `Video documentation ${videoNo}`
      }
      doc.text(label, MARGIN_X, y)
      y += 12
      doc.setFont(FONT, 'normal')
      if (item.kind === 'image' && item.dataUrl && String(item.dataUrl).startsWith('data:image')) {
        try {
          const format = detectImageFormat(item.dataUrl)
          const maxW = WIDTH
          const maxH = 280
          doc.addImage(item.dataUrl, format, MARGIN_X, y, maxW, maxH, undefined, 'FAST')
          y += maxH + 14
        } catch (err) {
          doc.text('(Image could not be embedded.)', MARGIN_X, y)
          y += 14
          console.warn('PDF image embed failed', err)
        }
      } else if (item.kind === 'video') {
        doc.text('Video on file with this report (cannot embed video in PDF).', MARGIN_X, y)
        y += 14
      }
    }
  }

  const safePlate = String(plate).replace(/[^\w\-]+/g, '_') || 'vehicle'
  const dateKey = String(inspection.dateReturned || inspection.inspectionDate || '')
    .slice(0, 10)
    .replace(/[^\d\-]/g, '')
  doc.save(
    `ALATAS_Vehicle_Return_Damage_Inspection_Acknowledgment_${safePlate}_${dateKey || 'report'}.pdf`,
  )
}
