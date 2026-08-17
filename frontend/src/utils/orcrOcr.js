import { createWorker } from 'tesseract.js'
import { autoCapitalizeWords } from './owners'

const STOP_NAME = new Set(
  [
    'REPUBLIC',
    'PHILIPPINES',
    'DEPARTMENT',
    'TRANSPORTATION',
    'LAND',
    'OFFICE',
    'CERTIFICATE',
    'REGISTRATION',
    'PRIVATE',
    'MOTORCYCLE',
    'MOPED',
    'TRICYCLE',
    'WITHOUT',
    'SIDECAR',
    'OFFICIAL',
    'RECEIPT',
    'ASSISTANT',
    'SECRETARY',
    'REGISTRANT',
    'SIGNATURE',
    'NEW',
    'UNIT',
    'FIELD',
    'CLASSIFICATION',
    'CATEGORY',
    'VEHICLE',
    'TYPE',
    'BODY',
    'SERIES',
    'MAKE',
    'BRAND',
    'ENGINE',
    'CHASSIS',
    'PLATE',
    'OWNER',
    'ADDRESS',
    'COLOR',
    'FUEL',
    'GAS',
    'DIESEL',
    'GROSS',
    'WEIGHT',
    'YEAR',
    'MODEL',
    'PASSENGER',
    'CAPACITY',
    'ENCUMBERED',
    'DETAILS',
    'FIRST',
    'AMOUNT',
    'REMARKS',
    'CITY',
    'PROVINCE',
    'SOUTHERN',
    'LEYTE',
    'MAASIN',
    'CAPITAL',
    'PUROK',
    'ATTY',
    'PHP',
  ].map((s) => s.toUpperCase()),
)

const KNOWN_MAKES = [
  'Honda',
  'Toyota',
  'Mitsubishi',
  'Nissan',
  'Ford',
  'Hyundai',
  'Suzuki',
  'Isuzu',
  'Chevrolet',
  'Mazda',
  'Kia',
  'BMW',
  'Yamaha',
  'Kawasaki',
  'Suzuki',
  'Geely',
  'MG',
  'Subaru',
]

function flatten(text) {
  return String(text || '')
    .replace(/[|\[\]]/g, ' ')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstMatch(text, patterns) {
  const flat = flatten(text)
  for (const re of patterns) {
    const m = flat.match(re)
    if (m?.[1]) {
      const v = String(m[1]).trim()
      if (v && !/^N\/?A$/i.test(v)) return v
    }
  }
  return ''
}

function normalizeOwnerName(raw) {
  let name = String(raw || '')
    .replace(/[^A-Za-z ,.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[,;]+$/, '')
    .trim()
  if (!name) return ''

  if (name.includes(',')) {
    const [last, ...rest] = name.split(',').map((p) => p.trim()).filter(Boolean)
    if (last && rest.length) name = `${rest.join(' ')} ${last}`
  }

  name = name
    .replace(/\b(PUROK|BRGY|BARANGAY|CITY|PROVINCE|STREET|ADDRESS)\b.*$/i, '')
    .trim()

  const words = name.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return ''
  if (words.some((w) => STOP_NAME.has(w.toUpperCase()))) return ''
  if (words.every((w) => w.length <= 2)) return ''
  return autoCapitalizeWords(words.join(' '))
}

function mapBodyType(raw) {
  const t = String(raw || '').toUpperCase()
  if (!t || /^N\/?A$/.test(t)) return ''
  if (/MOTORCYCLE|MOPED|TRICYCLE|SCOOTER|SIDECAR/.test(t)) return 'Motorcycle'
  if (/HATCH/.test(t)) return 'Hatchback'
  if (/SEDAN/.test(t)) return 'Sedan'
  if (/MPV|AUV/.test(t)) return 'MPV'
  if (/SUV|CROSSOVER/.test(t)) return 'SUV'
  if (/PICK\s*-?\s*UP|PICKUP/.test(t)) return 'Pick-up'
  if (/VAN|UTILITY/.test(t)) return 'Van'
  return ''
}

function pickPlate(text) {
  const labeled = firstMatch(text, [
    /PLATE\s*NO\.?\s*[:.\-]?\s*([A-Z0-9]{5,10})\b/i,
  ])
  if (labeled) return labeled.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)

  // LTO motorcycle / car plates appearing near top of CR values row
  const flat = flatten(text).toUpperCase()
  const candidates = flat.match(/\b([A-Z]{1,3}\d{2,4}[A-Z]{0,3})\b/g) || []
  for (const c of candidates) {
    if (c.length < 5 || c.length > 8) continue
    if (/^\d+$/.test(c)) continue
    if (!/[A-Z]/.test(c) || !/\d/.test(c)) continue
    // skip pure years / office codes
    if (/^(19|20)\d{2}$/.test(c)) continue
    return c
  }
  return ''
}

function pickEngine(text) {
  const labeled = firstMatch(text, [
    /ENGINE\s*NO\.?\s*[:.\-]?\s*([A-Z0-9\-]{6,24})\b/i,
  ])
  if (labeled) {
    const cleaned = labeled.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length >= 6) return cleaned
  }

  const flat = flatten(text).toUpperCase()
  // e.g. KF51E7041285 / KFS51E7041285 (OCR may insert extra S)
  const m = flat.match(/\b([A-Z]{2,5}\d{1,3}[A-Z]?\d{5,12})\b/)
  return m?.[1] || ''
}

function pickChassis(text) {
  const labeled = firstMatch(text, [
    /CHASSIS\s*NO\.?\s*[:.\-]?\s*([A-Z0-9\-]{8,32})\b/i,
  ])
  if (labeled) {
    const cleaned = labeled.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length >= 8) return cleaned
  }
  const m = flatten(text)
    .toUpperCase()
    .match(/\b(MH[A-Z0-9]{14,17})\b/)
  return m?.[1] || ''
}

function pickMake(text) {
  const labeled = firstMatch(text, [
    /MAKE\s*\/?\s*BRAND\s*[:.\-]?\s*([A-Z][A-Z0-9\-]{1,20})\b/i,
    /MAKE\s*[:.\-]?\s*([A-Z][A-Z0-9\-]{1,20})\b/i,
  ])
  if (labeled) {
    const hit = KNOWN_MAKES.find((k) => new RegExp(`^${k}$`, 'i').test(labeled))
    return hit || autoCapitalizeWords(labeled)
  }
  const flat = flatten(text)
  for (const brand of KNOWN_MAKES) {
    if (new RegExp(`\\b${brand}\\b`, 'i').test(flat)) return brand
  }
  return ''
}

function pickSeries(text) {
  const labeled = firstMatch(text, [
    /\bSERIES\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-]{1,20})\b/i,
  ])
  if (labeled && !/CATEGOR|VEHICLE|TYPE|BODY|FUEL|COLOR|CLASS|PRIVATE/i.test(labeled)) {
    return autoCapitalizeWords(labeled)
  }

  // Common motorcycle series like ADV160AP (OCR may read ADV160AF)
  const flat = flatten(text).toUpperCase()
  const m = flat.match(/\b(ADV\d{2,4}[A-Z]?)\b/) || flat.match(/\b([A-Z]{2,4}\d{2,4}[A-Z]{0,2})\b/)
  if (!m?.[1]) return ''
  const v = m[1]
  if (/L154|KF51|MH1|PHP|L3/.test(v)) return ''
  if (v.length < 4) return ''
  return autoCapitalizeWords(v)
}

function pickOwner(text) {
  const labeled = normalizeOwnerName(
    firstMatch(text, [
      /OWNER'?S?\s*NAME\s*[:.\-]?\s*([A-Z][A-Z .'-]{2,60}?)(?=\s+OWNER'?S?\s*ADDRESS|\s+ENCUMBER|\s+O\.?R\.?\s*NO|\s+REMARKS|$)/i,
      /NAME\s+OF\s+OWNER\s*[:.\-]?\s*([A-Z][A-Z .'-]{2,60}?)(?=\s+ADDRESS|\s+OWNER|$)/i,
      /RECEIVED\s+FROM\s*[:.\-]?\s*([A-Z][A-Z ,.'-]{2,60}?)(?=\s+Address|\s+TIN|\s+LTO|\s+Transaction|$)/i,
    ]),
  )
  if (labeled) return labeled

  // Noise-tolerant: ALL-CAPS person name lines (2–4 words), not form keywords
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[^A-Za-z\s]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (const line of lines) {
    const upper = line.toUpperCase()
    if (!/^[A-Z]+(?:\s+[A-Z]+){1,3}$/.test(upper)) continue
    const words = upper.split(/\s+/)
    if (words.some((w) => STOP_NAME.has(w))) continue
    if (words.some((w) => w.length < 3)) continue
    const name = normalizeOwnerName(upper)
    if (name) return name
  }
  return ''
}

function pickSeats(text) {
  const labeled = firstMatch(text, [
    /PASSENGER\s*CAPACITY\s*[:.\-]?\s*(\d{1,2})\b/i,
  ])
  if (labeled) return labeled
  // CR often has a lone small number near capacity; prefer 1–9 for motorcycles
  return ''
}

function pickBody(text) {
  const labeled = firstMatch(text, [
    /BODY\s*TYPE\s*[:.\-]?\s*([A-Z0-9 /()-]{3,60}?)(?=\s+SERIES|\s+GROSS|\s+NET|\s+YEAR|\s+PISTON|\s+MAKE|$)/i,
    /VEHICLE\s*TYPE\s*[:.\-]?\s*([A-Z0-9 /()-]{3,60}?)(?=\s+VEHICLE\s*CATEGOR|\s+MAKE|\s+PASSENGER|$)/i,
  ])
  const mapped = mapBodyType(labeled)
  if (mapped) return mapped
  if (/MOTORCYCLE|MOPED|TRICYCLE|SIDECAR/i.test(text)) return 'Motorcycle'
  return ''
}

function extractFromCr(text) {
  const flat = flatten(text)
  const isCr =
    /CERTIFICATE\s+OF\s+REGISTRATION/i.test(flat) ||
    /MAKE\s*\/?\s*BRAND/i.test(flat) ||
    /CHASSIS/i.test(flat) ||
    (/LAND\s+TRANSPORTATION\s+OFFICE/i.test(flat) && /CR\s*NO/i.test(flat))

  return {
    docType: isCr ? 'cr' : 'unknown',
    plateNo: pickPlate(text),
    engineNo: pickEngine(text),
    chassisNo: pickChassis(text),
    make: pickMake(text),
    series: pickSeries(text),
    ownerName: pickOwner(text),
    bodyType: pickBody(text),
    seats: pickSeats(text),
  }
}

function extractFromOr(text) {
  const flat = flatten(text)
  const isOr =
    /OFFICIAL\s+RECEIPT/i.test(flat) ||
    /RECEIVED\s+FROM/i.test(flat) ||
    /MVUC/i.test(flat)

  return {
    docType: isOr ? 'or' : 'unknown',
    ownerName: pickOwner(text),
    plateNo: pickPlate(text),
    bodyType: pickBody(text),
    make: pickMake(text),
    series: '',
    engineNo: '',
    chassisNo: '',
    seats: '',
  }
}

function mergeFields(primary, secondary) {
  const keys = ['make', 'series', 'plateNo', 'engineNo', 'chassisNo', 'ownerName', 'bodyType', 'seats']
  const out = { ...(primary || {}) }
  for (const key of keys) {
    if (secondary?.[key]) out[key] = secondary[key]
  }
  return out
}

function scoreFields(fields) {
  return ['make', 'series', 'plateNo', 'engineNo', 'chassisNo', 'ownerName', 'bodyType', 'seats'].filter(
    (k) => Boolean(fields?.[k]),
  ).length
}

export function parseOrCrText(text, hint = 'auto') {
  const cr = extractFromCr(text)
  const or = extractFromOr(text)

  if (hint === 'cr') return { ...cr, docType: 'cr' }
  if (hint === 'or') return { ...or, docType: 'or' }

  if (cr.docType === 'cr' && or.docType === 'or') {
    return { ...mergeFields(cr, or), docType: 'both' }
  }
  if (cr.docType === 'cr') return cr
  if (or.docType === 'or') return or

  // Even without clear doc header, keep whatever values we mined
  const merged = mergeFields(cr, or)
  return {
    ...merged,
    docType: scoreFields(merged) > 0 ? 'unknown' : 'unknown',
  }
}

/**
 * Enhance LTO security-paper photos for Tesseract (browser canvas).
 */
export async function enhanceOrcrImage(dataUrl) {
  if (typeof document === 'undefined') return dataUrl

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const maxSide = 2200
        const scale = Math.min(3, maxSide / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * Math.max(scale, 1.5)))
        const h = Math.max(1, Math.round(img.height * Math.max(scale, 1.5)))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        const imageData = ctx.getImageData(0, 0, w, h)
        const d = imageData.data
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]
          const g = d[i + 1]
          const b = d[i + 2]
          // Suppress blue security tint; keep dark ink
          let gray = 0.5 * r + 0.4 * g + 0.1 * b
          gray = (gray - 128) * 1.55 + 128
          const v = gray >= 170 ? 255 : gray <= 110 ? 0 : gray
          d[i] = d[i + 1] = d[i + 2] = v
        }
        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/**
 * Run OCR on an OR or CR image and map to form fields.
 */
export async function scanOrcrImage(dataUrl, onProgress, hint = 'auto') {
  const enhanced = await enhanceOrcrImage(dataUrl)
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m?.status === 'recognizing text' && typeof onProgress === 'function') {
        onProgress(Math.round((m.progress || 0) * 100))
      }
    },
  })

  try {
    const texts = []
    // Multiple page-seg modes help with LTO grid layouts
    for (const psm of ['6', '4', '11']) {
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        preserve_interword_spaces: '1',
      })
      const { data } = await worker.recognize(enhanced)
      if (data?.text) texts.push(data.text)
      // also try original once on first pass if enhanced is weak
      if (psm === '6') {
        const raw = await worker.recognize(dataUrl)
        if (raw?.data?.text) texts.push(raw.data.text)
      }
    }

    const combined = texts.join('\n')
    let best = parseOrCrText(combined, hint)
    let bestScore = scoreFields(best)

    for (const text of texts) {
      const fields = parseOrCrText(text, hint)
      const score = scoreFields(fields)
      if (score > bestScore) {
        best = fields
        bestScore = score
      }
    }

    // Final merge across all parses so one pass's plate + another's owner combine
    let mergedAll = {}
    for (const text of texts) {
      mergedAll = mergeFields(mergedAll, parseOrCrText(text, hint))
    }
    mergedAll = mergeFields(mergedAll, best)
    if (scoreFields(mergedAll) >= bestScore) best = { ...mergedAll, docType: best.docType || mergedAll.docType }

    return { rawText: combined, fields: best }
  } finally {
    await worker.terminate()
  }
}

export function mergeScanFields(existing, incoming) {
  return mergeFields(existing || {}, incoming || {})
}
