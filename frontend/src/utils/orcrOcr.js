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
  'Bajaj',
  'TVS',
  'Keeway',
  'Kymco',
  'SYM',
  'Rusi',
  'Mitsukoshi',
  'Motorrad',
  'Geely',
  'MG',
  'Subaru',
]

const BIKE_MAKES = new Set([
  'YAMAHA',
  'KAWASAKI',
  'SUZUKI',
  'HONDA',
  'BAJAJ',
  'TVS',
  'KEEWAY',
  'KYMCO',
  'SYM',
  'RUSI',
  'MITSUKOSHI',
])
const CAR_SERIES_HINT =
  /\b(WIGO|VIOS|INNOVA|FORTUNER|HILUX|HIACE|COMMUTER|MIRAGE|XPANDER|MONTERO|ALMERA|NAVARA|TERRA|URVAN|LIVINA|CALIBRE|STRADA|WILDTRAK|CONQUEST)\b/i

/** Next form-field label line (LTO CR grid + OR payment receipt). */
const LTO_LABEL_LINE =
  /^(PLATE\s*(?:NO\.?|NUMBER)?|ENGINE\s*(?:NO\.?|NUMBER)?|CHASSIS\s*(?:NO\.?|NUMBER)?|VIN|FILE\s*(?:NO\.?|NUMBER)?|MAKE\s*\/?\s*BRAND|MAKE|BRAND|SERIES|BODY\s*TYPE|TYPE\s+OF\s+BODY|VEHICLE\s*TYPE|VEHICLE\s*CATEGORY|PASSENGER\s*CAPACITY|NET\s*CAPACITY|SEATS?|COLOR|TYPE\s+OF\s+FUEL|CLASSIFICATION|GROSS\s*WEIGHT|NET\s*WEIGHT|YEAR\s*MODEL|YEAR\s*REBUILT|PISTON|MAX\s*POWER|OWNER'?S?\s*NAME|OWNER'?S?\s*ADDRESS|RECEIVED\s+FROM|TRANSACTION|NEXT\s*RENEWAL|ADDRESS|TIN|MVUC)\b/i

/** Form labels OCR often captures instead of the real value. */
const FIELD_LABEL_TOKENS = new Set([
  'ENGINE',
  'CHASSIS',
  'PLATE',
  'MAKE',
  'SERIES',
  'BRAND',
  'BODY',
  'TYPE',
  'OWNER',
  'ADDRESS',
  'COLOR',
  'FUEL',
  'CLASS',
  'CATEGORY',
  'VEHICLE',
  'NO',
  'NUMBER',
  'NUM',
  'REGISTRATION',
  'CERTIFICATE',
  'OFFICIAL',
  'RECEIPT',
  'AS',
  'ON',
  'CR',
  'OR',
  'LTO',
  'MV',
  'FILE',
  'MODEL',
  'TRANSMISSION',
  'AUTOMATIC',
  'MANUAL',
  'AVAILABLE',
  'PRIVATE',
  'PASSENGER',
  'CAPACITY',
  'GROSS',
  'WEIGHT',
  'YEAR',
  'VIN',
  'FOR',
  'HIRE',
  'NEW',
  'USED',
  'IMPORTED',
  'CBU',
  'TRANSACTION',
  'CLASSIFICATION',
  'RENEWAL',
  'TIN',
  'MVUC',
  'PHP',
  'TOTAL',
  'AMOUNT',
  'PAID',
])

function flatten(text) {
  return String(text || '')
    .replace(/[|\[\]]/g, ' ')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function isFieldLabelToken(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!t) return true
  if (FIELD_LABEL_TOKENS.has(t)) return true
  if (/^(ENGINE|CHASSIS|PLATE|MAKE|SERIES|BODY|TYPE|OWNER|MODEL)(NO|NUM|NUMBER)?$/.test(t)) {
    return true
  }
  if (/^(AS)?ON(CR|OR)$/.test(t)) return true
  return false
}

function looksLikePlate(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (t.length < 5 || t.length > 10) return false
  if (isFieldLabelToken(t)) return false
  // PH plates: letter+digit mix, OR numeric-only (common on motorcycle/tricycle CRs)
  if (/^\d{5,8}$/.test(t)) return true
  if (!/[A-Z]/.test(t) || !/\d/.test(t)) return false
  if (/^(19|20)\d{2}$/.test(t)) return false
  return true
}

/** Fix common Tesseract confusions on plate tokens — carefully, without breaking L154JX. */
function normalizePlateToken(raw) {
  const spaced = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const original = spaced.replace(/\s/g, '')
  if (!original) return ''

  // Leading S→5 only (519WLL read as S19WLL) — do not remap L/I globally
  if (/^S\d{2}[A-Z]{2,3}$/.test(original)) {
    const fixed = `5${original.slice(1)}`
    if (looksLikePlate(fixed)) return fixed
  }

  // Mostly-digit motorcycle plates with O/I OCR noise (O90101 → 090101)
  const digitish = original
    .replace(/[OQD]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[S]/g, '5')
    .replace(/[BZ]/g, '8')
  if (/^\d{5,8}$/.test(digitish)) return digitish

  // Classic PH: ABC1234 / AB1234 / ABC 1234
  const classic = original.match(/^([A-Z]{1,3})(\d{3,4})([A-Z]{0,3})$/)
  if (classic && looksLikePlate(original)) return original.slice(0, 10)

  if (looksLikePlate(original)) return original.slice(0, 10)
  if (looksLikePlate(digitish) && /^\d{5,8}$/.test(digitish)) return digitish
  return ''
}

function editDistance(a, b) {
  const s = String(a || '')
  const t = String(b || '')
  if (s === t) return 0
  if (!s.length) return t.length
  if (!t.length) return s.length
  const row = Array.from({ length: t.length + 1 }, (_, i) => i)
  for (let i = 0; i < s.length; i += 1) {
    let prev = i + 1
    for (let j = 0; j < t.length; j += 1) {
      const cur = s[i] === t[j] ? row[j] : Math.min(row[j], row[j + 1], prev) + 1
      row[j] = prev
      prev = cur
    }
    row[t.length] = prev
  }
  return row[t.length]
}

/** Map OCR-garbled brand tokens onto known makes (HONOA→Honda, TOY0TA→Toyota). */
function resolveMakeToken(tok) {
  const raw = String(tok || '').replace(/[^A-Za-z0-9]/g, '')
  if (!raw || isJunkMakeToken(raw)) return ''
  const upper = raw
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
  const exact = KNOWN_MAKES.find(
    (k) => k.toUpperCase() === upper || k.toUpperCase() === raw.toUpperCase(),
  )
  if (exact) return exact
  let best = ''
  let bestD = 99
  for (const k of KNOWN_MAKES) {
    const ku = k.toUpperCase()
    const d = editDistance(upper, ku)
    const maxAllow = ku.length <= 4 ? 1 : 2
    if (d <= maxAllow && d < bestD) {
      best = k
      bestD = d
    }
  }
  if (best) return best
  if (/^[A-Za-z]{3,16}$/.test(raw) && !isFieldLabelToken(raw)) {
    return autoCapitalizeWords(raw)
  }
  return ''
}

function isJunkMakeToken(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (!t) return true
  if (isFieldLabelToken(t)) return true
  if (
    /^(PASSEN|PASSENCER|PASSENGER|CAPACITY|GROSS|WEIGHT|CLASSIFICATION|PRIVATE|HIRE|COLOR|FUEL|GAS|DIESEL|CATEGORY|VEHICLE|MOTORCYCLE|MOPED|TRICYCLE|SIDECAR|HATCHBACK|SEDAN|AUTOMATIC|MANUAL|AVAILABLE)$/.test(
      t,
    )
  ) {
    return true
  }
  // Fuzzy: PASSENCER / PASSENGER*
  if (t.length >= 6 && t.startsWith('PASSEN')) return true
  return false
}

function looksLikeEngine(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (t.length < 6 || t.length > 24) return false
  if (isFieldLabelToken(t)) return false
  if (!/[A-Z]/.test(t) || !/\d/.test(t)) return false
  return true
}

function looksLikeChassis(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (t.length < 8 || t.length > 32) return false
  if (isFieldLabelToken(t)) return false
  if (!/[A-Z]/.test(t) || !/\d/.test(t)) return false
  return true
}

function firstMatch(text, patterns) {
  const flat = flatten(text)
  for (const re of patterns) {
    const m = flat.match(re)
    if (m?.[1]) {
      const v = String(m[1]).trim()
      if (v && !/^N\/?A$/i.test(v) && !isFieldLabelToken(v)) return v
    }
  }
  return ''
}

/** After a label, take the first nearby token that passes validator (skips other labels). */
function valueAfterLabel(text, labelRe, validator) {
  const raw = String(text || '')
  const m = raw.match(labelRe)
  if (!m || m.index == null) return ''
  const after = raw.slice(m.index + m[0].length)
  const tokens = after.match(/[A-Za-z0-9\-]{3,32}/g) || []
  for (const tok of tokens.slice(0, 12)) {
    if (isFieldLabelToken(tok)) continue
    if (validator(tok)) return tok
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
  // Allow middle initial (1 letter) — e.g. LOUIE LYLE O DELA CRUZ
  if (words.length < 2 || words.length > 6) return ''
  if (words.some((w) => STOP_NAME.has(w.toUpperCase()))) return ''
  if (words.filter((w) => w.length >= 3).length < 2) return ''
  return autoCapitalizeWords(words.join(' '))
}

function mapBodyType(raw) {
  const t = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || /^N\/?A$/.test(t)) return ''
  // Whole string can be a label word — only reject if it's ONLY a label
  if (isFieldLabelToken(t.replace(/[^A-Z0-9]/g, '')) && !/MOTOR|TRIKE|HATCH|SEDAN|SUV|VAN|MPV|PICK/.test(t)) {
    return ''
  }
  if (/MOTORCYCLE|MOPED|TRICYCLE|SCOOTER|SIDECAR|TRIKE/.test(t)) return 'Motorcycle'
  if (/HATCH/.test(t) || /PASSENGER\s*CAR.*HATCH/i.test(t)) return 'Hatchback'
  if (/SEDAN/.test(t) || /PASSENGER\s*CAR.*SEDAN/i.test(t)) return 'Sedan'
  if (/MPV|AUV|WAGON/.test(t)) return 'MPV'
  if (/SUV|CROSSOVER|SPORTS?\s*UTIL/.test(t)) return 'SUV'
  if (/PICK\s*-?\s*UP|PICKUP/.test(t)) return 'Pick-up'
  if (/VAN|UTILITY|COMMUTER/.test(t)) return 'Van'
  // OR often prints "Passenger Car" without body — leave empty for form default
  return ''
}

function textLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/**
 * LTO CR cells: label on one line, value on the next (may be multi-word).
 * Also handles Cloud Vision's common layout: a run of labels, then a run of values
 *   PLATE NO. / ENGINE NO. / CHASSIS NO. / VIN
 *   020410 / 161FMJ… / LF3PCK… / N/A
 */
function isPureLabelLine(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (/^YEAR\s*MODEL\b/i.test(t) || /^YEAR\s*REBUILT\b/i.test(t)) return true
  if (!LTO_LABEL_LINE.test(t)) return false
  const rest = t.replace(LTO_LABEL_LINE, '').replace(/^[:.\-\s]+/, '').trim()
  return !rest
}

function valueBlockAfterLabel(text, labelRe) {
  const lines = textLines(text)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    // Avoid YEAR MODEL matching a bare "MODEL" / "SERIES" label
    if (/YEAR\s*MODEL/i.test(line) && !/^SERIES\b/i.test(line)) continue
    if (!labelRe.test(line)) continue

    const sameLine = line.replace(labelRe, '').replace(/^[:.\-\s]+/, '').trim()
    if (
      sameLine &&
      !/^N\/?A$/i.test(sameLine) &&
      !LTO_LABEL_LINE.test(sameLine) &&
      !isFieldLabelToken(sameLine.replace(/[^A-Za-z0-9]/g, ''))
    ) {
      return sameLine
    }

    // Expand to full label run (Vision often dumps all column headers, then all values)
    let runStart = i
    while (runStart > 0 && isPureLabelLine(lines[runStart - 1])) runStart -= 1
    let runEnd = i
    while (runEnd + 1 < lines.length && isPureLabelLine(lines[runEnd + 1])) runEnd += 1
    const indexInRun = i - runStart
    const runLen = runEnd - runStart + 1

    const values = []
    let v = runEnd + 1
    while (v < lines.length && values.length < runLen && !isPureLabelLine(lines[v])) {
      let cell = lines[v]
      v += 1
      // Join wrapped cells: "MOTORCYCLE / MOPED /" + "TRICYCLE"
      while (v < lines.length && !isPureLabelLine(lines[v]) && /\/\s*$/.test(cell)) {
        cell = `${cell} ${lines[v]}`
        v += 1
      }
      // Join "MOTORCYCLE WITH" + "SIDECAR TC"
      while (
        v < lines.length &&
        !isPureLabelLine(lines[v]) &&
        /MOTORCYCLE\s+WITH\s*$/i.test(cell) &&
        /^(SIDECAR|TC)\b/i.test(lines[v])
      ) {
        cell = `${cell} ${lines[v]}`
        v += 1
      }
      values.push(cell.trim())
    }

    if (values.length >= indexInRun + 1) {
      const hit = values[indexInRun]
      if (hit && !/^N\/?A$/i.test(hit)) return hit
    }

    // Interleaved fallback: label then immediate value
    const parts = []
    for (let j = i + 1; j < lines.length && j <= i + 3; j += 1) {
      const next = lines[j]
      if (!next || /^N\/?A$/i.test(next)) break
      if (isPureLabelLine(next) || LTO_LABEL_LINE.test(next)) break
      // Don't glue next grid cell (gross weight / year) onto SERIES / MAKE values
      if (parts.length >= 1 && /^\d{2,4}$/.test(next.replace(/[^0-9]/g, '') || '')) break
      if (parts.length >= 1 && /^(GROSS|NET|YEAR|PISTON)\b/i.test(next)) break
      parts.push(next)
      // SERIES / MAKE / PLATE are usually a single cell value
      if (/^(?:SERIES|MAKE|BRAND|PLATE|ENGINE|CHASSIS)\b/i.test(line) && parts.length >= 1) {
        break
      }
    }
    if (parts.length) return parts.join(' ').trim()
  }
  return ''
}

function looksLikeYearOnly(value) {
  return /^(19|20)\d{2}$/.test(String(value || '').replace(/[^0-9]/g, ''))
}

function normalizeSeries(raw) {
  let s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s || /^N\/?A$/i.test(s)) return ''
  if (looksLikeYearOnly(s)) return ''
  if (/^YEAR\b/i.test(s)) return ''

  // Prefer known bike/car series tokens inside noisy OCR (e.g. "ADV160AP 265 N/A")
  const adv = s.toUpperCase().match(/\b(ADV\d{2,4}[A-Z]{0,2})\b/)
  if (adv?.[1]) return adv[1]
  const known = s.match(CAR_SERIES_HINT)
  if (known?.[1]) return String(known[1]).toUpperCase()

  // Drop trailing weight / N/A / rebuilt junk joined from next grid cells
  s = s
    .replace(/\s+N\/?A\b.*$/i, '')
    .replace(/\s+\d{2,4}(\s+N\/?A)?\s*$/i, '')
    .replace(/\s+(GROSS|NET|YEAR|PISTON|WEIGHT)\b.*$/i, '')
    .trim()

  if (isFieldLabelToken(s.replace(/[^A-Za-z0-9]/g, ''))) return ''
  if (KNOWN_MAKES.some((k) => new RegExp(`^${k}$`, 'i').test(s))) return ''
  if (isJunkMakeToken(s)) return ''

  const cleaned = s.replace(/[^A-Za-z0-9 \-/]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 2 || cleaned.length > 40) return ''
  const parts = cleaned.split(/\s+/)
  // Multi-word series (RE COMPACT 4S F) — keep full string
  if (parts.length >= 2 && parts.filter((p) => /[A-Za-z]{2,}/.test(p)).length >= 2) {
    return cleaned.toUpperCase()
  }
  // Single model code (ADV160AP) — drop any leftover numeric junk tokens
  if (/^[A-Z0-9][A-Z0-9-]{2,20}$/i.test(parts[0]) && !/^\d+$/.test(parts[0])) {
    return parts[0].toUpperCase()
  }
  return cleaned.toUpperCase()
}

/**
 * LTO CR often prints a label row then a value row:
 * MAKE/BRAND  SERIES  BODY TYPE
 * TOYOTA      WIGO    HATCHBACK
 */
function parseVehicleParticularsRow(text) {
  const lines = textLines(text)
  const out = { make: '', series: '', bodyType: '', plateNo: '', seats: '' }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const upper = line.toUpperCase()
    const hasMake = /MAKE|BRAND/.test(upper)
    const hasSeries = /\bSERIES\b/.test(upper) && !/YEAR\s*MODEL/.test(upper)
    const hasBody = /BODY\s*TYPE|TYPE\s+OF\s+BODY|VEHICLE\s*TYPE/.test(upper)

    if (hasMake && (hasSeries || hasBody)) {
      const next = lines[i + 1] || ''
      const tokens = next
        .split(/\s{1,}|[/|]+/)
        .map((t) => t.trim())
        .filter((t) => t && !isFieldLabelToken(t))
      if (tokens.length) {
        const makeHit =
          tokens
            .map((t) => resolveMakeToken(t))
            .find((t) => t && KNOWN_MAKES.some((k) => k === t)) ||
          tokens.find((t) => resolveMakeToken(t))
        if (makeHit) out.make = resolveMakeToken(makeHit) || autoCapitalizeWords(makeHit)
        const seriesHit =
          tokens.find((t) => CAR_SERIES_HINT.test(t)) ||
          tokens.find(
            (t, idx) =>
              idx > 0 &&
              !looksLikeYearOnly(t) &&
              /^[A-Z0-9][A-Z0-9-]{1,20}$/i.test(t) &&
              !KNOWN_MAKES.some((k) => new RegExp(`^${k}$`, 'i').test(t)),
          )
        if (seriesHit) out.series = normalizeSeries(seriesHit)
        for (const t of tokens) {
          const body = mapBodyType(t)
          if (body) {
            out.bodyType = body
            break
          }
        }
        // Two-token body like "HATCH BACK" / "MOTORCYCLE TRIKE"
        if (!out.bodyType && tokens.length >= 2) {
          for (let j = 0; j < tokens.length - 1; j += 1) {
            const body = mapBodyType(`${tokens[j]} ${tokens[j + 1]}`)
            if (body) {
              out.bodyType = body
              break
            }
          }
        }
      }
    }

    // Single-label lines with value on same or next line
    const singleSpecs = [
      { re: /^(?:MAKE\s*\/?\s*BRAND|MAKE|BRAND)\s*[:.\-]?\s*(.*)$/i, key: 'make' },
      // SERIES only — never YEAR MODEL
      { re: /^SERIES\s*[:.\-]?\s*(.*)$/i, key: 'series' },
      {
        re: /^(?:BODY\s*TYPE|TYPE\s+OF\s+BODY|VEHICLE\s*TYPE)\s*[:.\-]?\s*(.*)$/i,
        key: 'bodyType',
      },
      {
        re: /^(?:PLATE\s*(?:NO\.?|NUMBER)?)\s*[:.\-]?\s*(.*)$/i,
        key: 'plateNo',
      },
      {
        re: /^(?:PASSENGER\s*CAPACITY|NET\s*CAPACITY|SEATS?)\s*[:.\-]?\s*(.*)$/i,
        key: 'seats',
      },
    ]
    for (const spec of singleSpecs) {
      const m = line.match(spec.re)
      if (!m) continue
      let val = String(m[1] || '').trim()
      if (!val || isFieldLabelToken(val.replace(/[^A-Za-z0-9]/g, ''))) {
        val = lines[i + 1] || ''
      }
      if (!val) continue
      if (spec.key === 'make') {
        const tok = val.split(/\s+/)[0]
        if (isFieldLabelToken(tok)) continue
        const hit = KNOWN_MAKES.find((k) => new RegExp(`^${k}$`, 'i').test(tok))
        if (hit || /^[A-Za-z]{2,20}$/.test(tok)) {
          out.make = hit || autoCapitalizeWords(tok)
        }
      } else if (spec.key === 'series') {
        const norm = normalizeSeries(val)
        if (norm) out.series = norm
      } else if (spec.key === 'bodyType') {
        const body = mapBodyType(val) || mapBodyType(val.split(/\s+/).slice(0, 3).join(' '))
        if (body) out.bodyType = body
      } else if (spec.key === 'plateNo') {
        const hit = normalizePlateToken(val) || normalizePlateToken(val.split(/\s+/)[0])
        if (hit) out.plateNo = hit
      } else if (spec.key === 'seats') {
        const n = String(val).match(/\b(\d{1,2})\b/)
        if (n) out.seats = n[1]
      }
    }
  }

  return out
}

function pickPlate(text) {
  const block = valueBlockAfterLabel(text, /^PLATE\s*(?:NO\.?|NUMBER|N[O0])?\b/i)
  if (block) {
    // Try whole block, then first token (OCR may append junk)
    const whole = normalizePlateToken(block)
    if (whole) return whole
    for (const tok of String(block).split(/[\s|/]+/)) {
      const hit = normalizePlateToken(tok)
      if (hit) return hit
    }
  }

  const row = parseVehicleParticularsRow(text)
  if (row.plateNo) {
    const hit = normalizePlateToken(row.plateNo)
    if (hit) return hit
  }

  const after = valueAfterLabel(
    text,
    /PLATE\s*(?:NO\.?|NUMBER|N[O0]|#)?\s*[:.\-]*/i,
    (tok) => Boolean(normalizePlateToken(tok)),
  )
  if (after) {
    const hit = normalizePlateToken(after)
    if (hit) return hit
  }

  const labeled = firstMatch(text, [
    /PLATE\s*N[O0]\.?\s*[:.\-]?\s*([A-Z]{1,3}\s*\d{2,4}\s*[A-Z]{0,3})\b/i,
    /PLATE\s*N[O0]\.?\s*[:.\-]?\s*([O0-9IL]{5,8})\b/i,
    /PLATE\s*N[O0]\.?\s*[:.\-]?\s*([A-Z0-9]{5,10})\b/i,
  ])
  if (labeled) {
    const hit = normalizePlateToken(labeled)
    if (hit) return hit
  }

  const flat = flatten(text).toUpperCase()
  // Standalone letter+digit plates
  const alphaNum = flat.match(/\b([A-Z]{1,3}\d{2,4}[A-Z]{0,3})\b/g) || []
  for (const c of alphaNum) {
    const hit = normalizePlateToken(c)
    if (hit) return hit
  }

  // Independent 5–8 digit tokens (motorcycle/tricycle). Word boundaries keep
  // these from being carved out of a longer FILE NO (12–17 digits).
  const numeric = flat.match(/\b\d{5,8}\b/g) || []
  for (const n of numeric) {
    const hit = normalizePlateToken(n)
    if (hit) return hit
  }

  // Last resort: OCR often writes O for 0 in a near-numeric token after PLATE
  const nearPlate = flat.match(/PLATE[^A-Z0-9]{0,16}([A-Z0-9]{5,10})/)
  if (nearPlate?.[1]) {
    const hit = normalizePlateToken(nearPlate[1])
    if (hit) return hit
  }

  return ''
}

function pickEngine(text) {
  const block = valueBlockAfterLabel(text, /^ENGINE\s*(?:NO\.?|NUMBER)?\b/i)
  if (block) {
    const cleaned = block.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (looksLikeEngine(cleaned)) return cleaned
  }

  const after = valueAfterLabel(
    text,
    /ENGINE\s*(?:NO\.?|NUMBER|#)?\s*[:.\-]*/i,
    looksLikeEngine,
  )
  if (after) return after.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const labeled = firstMatch(text, [
    /ENGINE\s*NO\.?\s*[:.\-]?\s*([A-Z0-9\-]{6,24})\b/i,
  ])
  if (labeled && looksLikeEngine(labeled)) {
    return labeled.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  const flat = flatten(text).toUpperCase()
  const m = flat.match(/\b([A-Z]{2,5}\d{1,3}[A-Z]?\d{5,12})\b/)
  if (m?.[1] && looksLikeEngine(m[1])) return m[1]
  return ''
}

function pickChassis(text, engineNo = '') {
  const eng = String(engineNo || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  const accept = (raw) => {
    const cleaned = String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    if (!looksLikeChassis(cleaned)) return ''
    if (eng && cleaned === eng) return ''
    return cleaned
  }

  const block = valueBlockAfterLabel(text, /^CHASSIS\s*(?:NO\.?|NUMBER)?\b/i)
  const fromBlock = accept(block)
  if (fromBlock) return fromBlock

  const after = valueAfterLabel(
    text,
    /CHASSIS\s*(?:NO\.?|NUMBER|#)?\s*[:.\-]*/i,
    (tok) => Boolean(accept(tok)),
  )
  const fromAfter = accept(after)
  if (fromAfter) return fromAfter

  const labeled = firstMatch(text, [
    /CHASSIS\s*NO\.?\s*[:.\-]?\s*([A-Z0-9\-]{8,32})\b/i,
  ])
  const fromLabeled = accept(labeled)
  if (fromLabeled) return fromLabeled

  const flat = flatten(text).toUpperCase()
  // Prefer VIN-style chassis (Honda MH1…, Bajaj MD…, etc.)
  for (const re of [
    /\b(MH[A-Z0-9]{14,17})\b/,
    /\b(LF[A-Z0-9]{14,17})\b/,
    /\b(MD[A-Z0-9]{14,17})\b/,
    /\b([A-Z0-9]{17})\b/,
  ]) {
    const m = flat.match(re)
    const hit = accept(m?.[1])
    if (hit) return hit
  }
  return ''
}

function pickMake(text) {
  // Prefer known brands anywhere — avoids OCR grabbing PASSENGER/PASSENCER as make
  const flat = flatten(text)
  for (const brand of KNOWN_MAKES) {
    if (new RegExp(`\\b${brand}\\b`, 'i').test(flat)) return brand
  }
  // Fuzzy scan tokens against known brands
  const tokens = flat.match(/[A-Za-z][A-Za-z0-9]{2,16}/g) || []
  for (const tok of tokens) {
    if (isJunkMakeToken(tok)) continue
    const hit = resolveMakeToken(tok)
    if (hit && KNOWN_MAKES.some((k) => k === hit)) return hit
  }

  const block = valueBlockAfterLabel(text, /^(?:MAKE\s*\/?\s*BRAND|MAKE|BRAND)\b/i)
  if (block) {
    const resolved = resolveMakeToken(block.split(/\s+/)[0])
    if (resolved) return resolved
  }

  const row = parseVehicleParticularsRow(text)
  if (row.make) {
    const resolved = resolveMakeToken(row.make)
    if (resolved) return resolved
  }

  const after = valueAfterLabel(
    text,
    /MAKE\s*(?:\/\s*BRAND)?\s*[:.\-]*/i,
    (tok) => Boolean(resolveMakeToken(tok)),
  )
  if (after) {
    const resolved = resolveMakeToken(after)
    if (resolved) return resolved
  }

  const labeled = firstMatch(text, [
    /MAKE\s*\/?\s*BRAND\s*[:.\-]?\s*([A-Z][A-Z0-9\-]{1,20})\b/i,
    /\bBRAND\s*[:.\-]?\s*([A-Z][A-Z0-9\-]{1,20})\b/i,
    /MAKE\s*[:.\-]?\s*([A-Z][A-Z0-9\-]{1,20})\b/i,
  ])
  if (labeled) {
    const resolved = resolveMakeToken(labeled)
    if (resolved) return resolved
  }
  return ''
}

function pickSeries(text) {
  const block = valueBlockAfterLabel(text, /^SERIES\b/i)
  const fromBlock = normalizeSeries(block)
  if (fromBlock) return fromBlock

  const row = parseVehicleParticularsRow(text)
  if (row.series) return row.series

  // Never match YEAR MODEL — only SERIES
  const after = valueAfterLabel(
    text,
    /\bSERIES\s*[:.\-]*/i,
    (tok) =>
      !isFieldLabelToken(tok) &&
      !looksLikeYearOnly(tok) &&
      /^[A-Z0-9][A-Z0-9-]{1,20}$/i.test(tok) &&
      !KNOWN_MAKES.some((k) => new RegExp(`^${k}$`, 'i').test(tok)),
  )
  if (after) {
    const norm = normalizeSeries(after)
    if (norm) return norm
  }

  const labeled = firstMatch(text, [
    /\bSERIES\s*[:.\-]?\s*([A-Z0-9][A-Z0-9 \-]{1,35}?)(?=\s+GROSS|\s+NET|\s+YEAR|\s+BODY|\s+MAKE|\s+PLATE|\s+PISTON|$)/i,
  ])
  const fromLabeled = normalizeSeries(labeled)
  if (fromLabeled) return fromLabeled

  const flat = flatten(text).toUpperCase()
  const known = flat.match(CAR_SERIES_HINT)
  if (known?.[1]) return autoCapitalizeWords(known[1])

  const m = flat.match(/\b(ADV\d{2,4}[A-Z]?)\b/)
  if (!m?.[1]) return ''
  const v = m[1]
  if (/L154|KF51|MH1|PHP|L3/.test(v)) return ''
  if (v.length < 4) return ''
  return autoCapitalizeWords(v)
}

function pickSeats(text) {
  const block = valueBlockAfterLabel(
    text,
    /^(?:PASSEN[CG]ER\s*CAPACITY|PASSENCER\s*CAPACITY|NET\s*CAPACITY|SEATS?)\b/i,
  )
  if (block) {
    const n = block.match(/\b(\d{1,2})\b/)
    if (n && Number(n[1]) > 0 && Number(n[1]) < 100) return n[1]
  }

  const row = parseVehicleParticularsRow(text)
  if (row.seats) return row.seats

  const labeled = firstMatch(text, [
    /PASSEN[CG]ER\s*CAPACITY\s*[:.\-]?\s*(\d{1,2})\b/i,
    /PASSENCER\s*CAPACITY\s*[:.\-]?\s*(\d{1,2})\b/i,
    /NET\s*CAPACITY\s*[:.\-]?\s*(\d{1,2})\b/i,
    /\bSEATS?\s*[:.\-]?\s*(\d{1,2})\b/i,
    /CAPACITY\s*\(?\s*PASSEN[CG]ER\s*\)?\s*[:.\-]?\s*(\d{1,2})\b/i,
  ])
  if (labeled) return labeled

  const after = valueAfterLabel(
    text,
    /PASSEN[CG]ER\s*CAPACITY|PASSENCER\s*CAPACITY|NET\s*CAPACITY|\bSEATS?\b/i,
    (tok) => /^\d{1,2}$/.test(tok) && Number(tok) > 0 && Number(tok) < 100,
  )
  return after || ''
}

function pickBody(text, { make = '', series = '' } = {}) {
  const block =
    valueBlockAfterLabel(text, /^(?:BODY\s*TYPE|TYPE\s+OF\s+BODY)\b/i) ||
    valueBlockAfterLabel(text, /^VEHICLE\s*TYPE\b/i)
  let mapped = mapBodyType(block) || mapBodyType(String(block).split(/\s+/).slice(0, 3).join(' '))

  const row = parseVehicleParticularsRow(text)
  if (!mapped) mapped = row.bodyType || ''

  if (!mapped) {
    const labeled = firstMatch(text, [
      /BODY\s*TYPE\s*[:.\-]?\s*([A-Z0-9 /()-]{3,60}?)(?=\s+SERIES|\s+GROSS|\s+NET|\s+YEAR|\s+PISTON|\s+MAKE|\s+PLATE|$)/i,
      /TYPE\s+OF\s+BODY\s*[:.\-]?\s*([A-Z0-9 /()-]{3,60}?)(?=\s+SERIES|\s+GROSS|\s+MAKE|\s+PLATE|$)/i,
      /VEHICLE\s*TYPE\s*[:.\-]?\s*([A-Z0-9 /()-]{3,60}?)(?=\s+VEHICLE\s*CATEGOR|\s+MAKE|\s+PASSENGER|\s+PLATE|\s+GROSS|\s+NEXT|\s+MVUC|$)/i,
    ])
    mapped = mapBodyType(labeled)
    if (!mapped && labeled) {
      mapped = mapBodyType(String(labeled).split(/\s+/).slice(0, 3).join(' '))
    }
  }

  if (mapped === 'Motorcycle' && /AS\s*ON\s*(CR|OR)/i.test(text)) {
    // "AS ON CR" documents — only keep motorcycle when body/vehicle type says so
    if (
      !/BODY\s*TYPE\s*[:.\-]?\s*MOTORCYCLE/i.test(text) &&
      !/VEHICLE\s*TYPE[\s\S]{0,40}MOTORCYCLE/i.test(text) &&
      !/MOTORCYCLE\s+TRIKE/i.test(text)
    ) {
      mapped = ''
    }
  }

  const makeU = String(make || '').toUpperCase()
  const seriesU = String(series || '').toUpperCase()
  const carHint = CAR_SERIES_HINT.test(seriesU) || CAR_SERIES_HINT.test(flatten(text))
  const bikeMake =
    BIKE_MAKES.has(makeU) &&
    !/TOYOTA|MITSUBISHI|NISSAN|FORD|HYUNDAI|ISUZU|CHEVROLET|MAZDA|KIA|GEELY|SUBARU|MG/.test(
      makeU,
    )

  if (carHint && mapped === 'Motorcycle') mapped = ''
  if (carHint && !mapped) {
    if (/WIGO|VIOS/i.test(seriesU) || /WIGO|VIOS/i.test(text)) return 'Hatchback'
    if (/FORTUNER|MONTERO|TERRA/i.test(seriesU)) return 'SUV'
    if (/HILUX|NAVARA|STRADA|WILDTRAK|CONQUEST/i.test(seriesU)) return 'Pick-up'
    if (/INNOVA|XPANDER|LIVINA/i.test(seriesU)) return 'MPV'
    if (/HIACE|URVAN|COMMUTER/i.test(seriesU)) return 'Van'
  }

  if (mapped) return mapped
  if (
    !carHint &&
    bikeMake &&
    /BODY\s*TYPE|VEHICLE\s*TYPE|MOTORCYCLE\s+TRIKE|MOPED|TRICYCLE/i.test(text)
  ) {
    return 'Motorcycle'
  }
  return ''
}

function pickOwner(text) {
  // OR payment receipt: RECEIVED FROM (Last Name, First Name Middle Name)
  const receivedBlock =
    valueBlockAfterLabel(text, /^RECEIVED\s+FROM\b/i) ||
    firstMatch(text, [
      /RECEIVED\s+FROM\s*(?:\([^)]*\))?\s*[:.\-]?\s*([A-Z][A-Z ,.'-]{2,80}?)(?=\s+ADDRESS|\s+TIN|\s+PAYMENT|\s+TRANSACTION|\s+PLATE|$)/i,
    ])
  const fromReceived = normalizeOwnerName(receivedBlock)
  if (fromReceived) return fromReceived

  const labeled = normalizeOwnerName(
    firstMatch(text, [
      /OWNER'?S?\s*NAME\s*[:.\-]?\s*([A-Z][A-Z .'-]{2,60}?)(?=\s+OWNER'?S?\s*ADDRESS|\s+ENCUMBER|\s+O\.?R\.?\s*NO|\s+REMARKS|$)/i,
      /NAME\s+OF\s+OWNER\s*[:.\-]?\s*([A-Z][A-Z .'-]{2,60}?)(?=\s+ADDRESS|\s+OWNER|$)/i,
    ]),
  )
  if (labeled) return labeled

  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[^A-Za-z,\s]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (const line of lines) {
    if (/RECEIVED|ADDRESS|TRANSACTION|PAYMENT|BREAKDOWN|MVUC|TOTAL/i.test(line)) continue
    const name = normalizeOwnerName(line)
    if (name) return name
  }
  return ''
}

/**
 * LTO Official Receipt (MVUC / payment) — label: value on same or next line.
 * e.g. Plate No: WBO586, Engine: K14B…, Vehicle Type: Passenger Car HATCHBACK
 */
function extractOrPaymentFields(text) {
  const out = {
    ownerName: '',
    plateNo: '',
    engineNo: '',
    chassisNo: '',
    bodyType: '',
    make: '',
    series: '',
    seats: '',
  }

  out.ownerName = pickOwner(text)

  const plate =
    valueBlockAfterLabel(text, /^PLATE\s*(?:NO\.?|NUMBER)?\b/i) ||
    firstMatch(text, [
      /PLATE\s*N[O0]\.?\s*[:.\-]?\s*([A-Z0-9]{5,10})\b/i,
      /PLATE\s*(?:NO\.?|NUMBER)?\s*[:.\-]?\s*([A-Z]{1,3}\d{2,4}[A-Z0-9]{0,3})\b/i,
    ])
  out.plateNo = normalizePlateToken(plate)

  const engine =
    valueBlockAfterLabel(text, /^ENGINE\b/i) ||
    firstMatch(text, [/ENGINE\s*(?:NO\.?|NUMBER|#)?\s*[:.\-]?\s*([A-Z0-9\-]{6,24})\b/i])
  if (engine && looksLikeEngine(engine)) {
    out.engineNo = engine.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  const chassis =
    valueBlockAfterLabel(text, /^CHASSIS\b/i) ||
    firstMatch(text, [/CHASSIS\s*(?:NO\.?|NUMBER|#)?\s*[:.\-]?\s*([A-Z0-9\-]{8,32})\b/i])
  if (chassis && looksLikeChassis(chassis)) {
    out.chassisNo = chassis.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  const vehicleType =
    valueBlockAfterLabel(text, /^VEHICLE\s*TYPE\b/i) ||
    firstMatch(text, [
      /VEHICLE\s*TYPE\s*[:.\-]?\s*([A-Z][A-Z0-9 /()-]{2,60}?)(?=\s+GROSS|\s+NEXT|\s+FILE|\s+MVUC|\s+BREAKDOWN|$)/i,
    ])
  out.bodyType =
    mapBodyType(vehicleType) ||
    mapBodyType(String(vehicleType).split(/\s+/).slice(-2).join(' ')) ||
    mapBodyType(String(vehicleType).split(/\s+/).slice(-1).join(' '))

  // Optional make/series if OR text happens to include them
  out.make = pickMake(text)
  out.series = pickSeries(text)
  out.seats = pickSeats(text)

  return out
}

function extractFromCr(text) {
  const flat = flatten(text)
  const isCr =
    /CERTIFICATE\s+OF\s+REGISTRATION/i.test(flat) ||
    /MAKE\s*\/?\s*BRAND/i.test(flat) ||
    (/CHASSIS/i.test(flat) && /YEAR\s*MODEL/i.test(flat)) ||
    (/LAND\s+TRANSPORTATION\s+OFFICE/i.test(flat) && /CR\s*NO/i.test(flat))

  const row = parseVehicleParticularsRow(text)
  const make = pickMake(text) || row.make
  const series = pickSeries(text) || row.series
  const engineNo = pickEngine(text)
  let chassisNo = pickChassis(text, engineNo)
  if (chassisNo && engineNo && chassisNo === engineNo) {
    chassisNo = pickChassis(text, engineNo) // already rejects equal; force MH hunt
    if (chassisNo === engineNo) chassisNo = ''
  }
  return {
    docType: isCr ? 'cr' : 'unknown',
    plateNo: pickPlate(text) || row.plateNo,
    engineNo,
    chassisNo,
    make,
    series,
    ownerName: pickOwner(text),
    bodyType: pickBody(text, { make, series }) || row.bodyType,
    seats: pickSeats(text) || row.seats,
  }
}

function extractFromOr(text) {
  const flat = flatten(text)
  const isOr =
    /OFFICIAL\s+RECEIPT/i.test(flat) ||
    /RECEIVED\s+FROM/i.test(flat) ||
    /BREAKDOWN\s+OF\s+PAYMENT/i.test(flat) ||
    /PAYMENT\s+DETAILS/i.test(flat) ||
    /MVUC/i.test(flat) ||
    /TOTAL\s+AMOUNT\s+PAID/i.test(flat)

  const paid = extractOrPaymentFields(text)
  const make = paid.make || pickMake(text)
  const series = paid.series || ''
  return {
    docType: isOr ? 'or' : 'unknown',
    ownerName: paid.ownerName || pickOwner(text),
    plateNo: paid.plateNo || pickPlate(text),
    engineNo: paid.engineNo || pickEngine(text),
    chassisNo: paid.chassisNo || pickChassis(text),
    bodyType: paid.bodyType || pickBody(text, { make, series }),
    make,
    series,
    seats: paid.seats || '',
  }
}

function mergeFields(primary, secondary) {
  const keys = ['make', 'series', 'plateNo', 'engineNo', 'chassisNo', 'ownerName', 'bodyType', 'seats']
  const out = { ...(primary || {}) }
  for (const key of keys) {
    const next = secondary?.[key]
    if (!next) continue
    if (key === 'plateNo' && !looksLikePlate(next)) continue
    if (key === 'engineNo' && !looksLikeEngine(next)) continue
    if (key === 'chassisNo' && !looksLikeChassis(next)) continue
    if (key === 'bodyType' && isFieldLabelToken(next)) continue
    if (
      (key === 'make' || key === 'series' || key === 'ownerName') &&
      isFieldLabelToken(next)
    ) {
      continue
    }
    // Prefer existing valid plate/engine/chassis over a weaker replacement
    if (key === 'plateNo' && looksLikePlate(out.plateNo) && !looksLikePlate(next)) continue
    if (key === 'engineNo' && looksLikeEngine(out.engineNo) && !looksLikeEngine(next)) continue
    if (key === 'chassisNo' && looksLikeChassis(out.chassisNo) && !looksLikeChassis(next)) {
      continue
    }
    out[key] = next
  }
  return out
}

function scoreFields(fields) {
  const weights = {
    plateNo: 3,
    engineNo: 3,
    chassisNo: 3,
    make: 2,
    series: 2,
    ownerName: 1,
    bodyType: 1,
    seats: 1,
  }
  let score = 0
  for (const [k, w] of Object.entries(weights)) {
    if (fields?.[k]) score += w
  }
  return score
}

/** Prefer values that appear across multiple OCR passes. */
function consensusFields(parsedList) {
  const keys = [
    'make',
    'series',
    'plateNo',
    'engineNo',
    'chassisNo',
    'ownerName',
    'bodyType',
    'seats',
  ]
  const out = {}
  for (const key of keys) {
    const votes = new Map()
    for (const fields of parsedList) {
      let v = fields?.[key]
      if (!v) continue
      if (key === 'plateNo') v = normalizePlateToken(v) || v
      if (key === 'make') v = resolveMakeToken(v) || v
      if (key === 'series') v = normalizeSeries(v) || v
      if (!v) continue
      const norm = String(v).trim()
      if (!norm) continue
      votes.set(norm, (votes.get(norm) || 0) + 1)
    }
    let best = ''
    let bestN = 0
    for (const [v, n] of votes) {
      if (n > bestN || (n === bestN && v.length > best.length)) {
        best = v
        bestN = n
      }
    }
    if (best) out[key] = best
  }
  return sanitizeScanFields(out)
}

/** Drop label-like OCR mistakes before applying to the form. */
export function sanitizeScanFields(fields = {}) {
  const next = { ...(fields || {}) }
  if (next.plateNo) {
    const plate = normalizePlateToken(next.plateNo)
    next.plateNo = plate && looksLikePlate(plate) ? plate : ''
  }
  if (next.engineNo && !looksLikeEngine(next.engineNo)) next.engineNo = ''
  if (next.chassisNo && !looksLikeChassis(next.chassisNo)) next.chassisNo = ''
  if (next.make && (isFieldLabelToken(next.make) || isJunkMakeToken(next.make))) {
    next.make = ''
  }
  if (next.series) {
    const norm = normalizeSeries(next.series)
    next.series = norm
  }
  if (next.engineNo && next.chassisNo) {
    const e = String(next.engineNo).toUpperCase().replace(/[^A-Z0-9]/g, '')
    const c = String(next.chassisNo).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (e && e === c) next.chassisNo = ''
  }
  if (next.ownerName && isFieldLabelToken(next.ownerName)) next.ownerName = ''
  if (next.bodyType) {
    const mapped = mapBodyType(next.bodyType)
    const carHint =
      CAR_SERIES_HINT.test(String(next.series || '')) ||
      CAR_SERIES_HINT.test(String(next.make || ''))
    if (mapped === 'Motorcycle' && carHint) next.bodyType = ''
    else next.bodyType = mapped || ''
  }
  return next
}

export function parseOrCrText(text, hint = 'auto') {
  const cr = extractFromCr(text)
  const or = extractFromOr(text)

  let merged
  if (hint === 'cr') merged = { ...cr, docType: 'cr' }
  else if (hint === 'or') merged = { ...or, docType: 'or' }
  else if (cr.docType === 'cr' && or.docType === 'or') {
    merged = { ...mergeFields(cr, or), docType: 'both' }
  } else if (cr.docType === 'cr') merged = cr
  else if (or.docType === 'or') merged = or
  else merged = { ...mergeFields(cr, or), docType: 'unknown' }

  return sanitizeScanFields(merged)
}

/**
 * Build OCR-friendly variants of an LTO OR/CR photo (browser canvas).
 * Returns one or more data URLs — soft contrast usually beats hard binary on pink CR paper.
 */
export async function enhanceOrcrImage(dataUrl) {
  const variants = await prepareOrcrVariants(dataUrl)
  return variants[0] || dataUrl
}

/** @returns {Promise<string[]>} */
export async function prepareOrcrVariants(dataUrl) {
  if (typeof document === 'undefined') return [dataUrl]

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const maxSide = 2200
        const longest = Math.max(img.width, img.height) || 1
        // Upscale small phone photos; cap huge ones
        const scale = Math.min(2.5, Math.max(1.15, maxSide / longest))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        if (w * h > 5_000_000) {
          resolve([dataUrl])
          return
        }

        const renderRegion = (y0Ratio, y1Ratio, mode) => {
          const srcY = Math.floor(img.height * y0Ratio)
          const srcH = Math.max(1, Math.floor(img.height * (y1Ratio - y0Ratio)))
          const destW = Math.max(1, Math.round(img.width * scale))
          const destH = Math.max(1, Math.round(srcH * scale))
          const canvas = document.createElement('canvas')
          canvas.width = destW
          canvas.height = destH
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return null
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, destW, destH)
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, destW, destH)

          const imageData = ctx.getImageData(0, 0, destW, destH)
          const d = imageData.data
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i]
            const g = d[i + 1]
            const b = d[i + 2]
            let gray = 0.299 * r + 0.587 * g + 0.114 * b
            const chroma = Math.max(r, g, b) - Math.min(r, g, b)
            // Bleach pink/blue LTO security paper toward white
            if (chroma > 12 && gray > 115) {
              gray = Math.min(255, gray + 32 + chroma * 0.3)
            }
            if (r > 140 && b > 120 && g < r - 10) {
              gray = Math.min(255, gray + 24)
            }

            if (mode === 'soft') {
              gray = (gray - 128) * 1.45 + 128
              gray = Math.max(0, Math.min(255, gray))
            } else if (mode === 'hard') {
              gray = (gray - 128) * 1.85 + 128
              gray = gray >= 168 ? 255 : gray <= 120 ? 0 : gray
            } else if (mode === 'ink') {
              gray = (gray - 110) * 1.35 + 128
              gray = Math.max(0, Math.min(255, gray))
            } else {
              gray = (gray - 124) * 1.15 + 128
              gray = Math.max(0, Math.min(255, gray))
            }
            d[i] = d[i + 1] = d[i + 2] = gray
          }
          ctx.putImageData(imageData, 0, 0)
          return canvas.toDataURL('image/png')
        }

        const out = []
        const push = (url) => {
          if (url) out.push(url)
        }

        // Full-frame soft + ink (best for pink CR paper)
        push(renderRegion(0, 1, 'soft'))
        push(renderRegion(0, 1, 'ink'))
        // Top band — plate / owner / make often live here
        push(renderRegion(0, 0.48, 'soft'))
        // Middle band — engine / chassis / series grid
        push(renderRegion(0.28, 0.78, 'ink'))

        resolve(out.length ? out : [dataUrl])
      } catch {
        resolve([dataUrl])
      }
    }
    img.onerror = () => resolve([dataUrl])
    img.src = dataUrl
  })
}

async function createOrcrWorker(onProgress) {
  const logger = (m) => {
    if (m?.status === 'recognizing text' && typeof onProgress === 'function') {
      onProgress(Math.round((m.progress || 0) * 100))
    }
  }

  // Same-origin public/ assets (copied by vite.config.js). CDN Workers are blocked on Vercel.
  const root = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  const base = `${root}tesseract`
  return createWorker('eng', 1, {
    logger,
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/tesseract-core-simd-lstm.wasm.js`,
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    workerBlobURL: true,
    errorHandler: (err) => console.error('Tesseract worker error', err),
  })
}

/**
 * Run OCR on an OR or CR image and map to form fields.
 */
export async function scanOrcrImage(dataUrl, onProgress, hint = 'auto') {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('No image data to scan')
  }

  const progress = typeof onProgress === 'function' ? onProgress : () => {}

  let variants = [dataUrl]
  try {
    variants = await prepareOrcrVariants(dataUrl)
    // soft full, ink full, then original (region crops help but cost time)
    variants = [variants[0], variants[1], variants[2], dataUrl].filter(Boolean)
  } catch (err) {
    console.warn('OR/CR enhance skipped', err)
  }

  const worker = await createOrcrWorker(onProgress)

  try {
    const texts = []
    // Open alphabet for names; whitelist for IDs; sparse for plate/engine cells
    const passes = [
      { psm: '6', whitelist: null },
      {
        psm: '6',
        whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /-'.,()",
      },
      { psm: '11', whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ' },
    ]
    const images = variants.slice(0, 3)
    let step = 0
    const total = images.length * passes.length

    for (const image of images) {
      for (const pass of passes) {
        step += 1
        progress(Math.min(94, Math.round((step / total) * 88) + 8))
        const params = {
          tessedit_pageseg_mode: pass.psm,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
          tessedit_char_whitelist: pass.whitelist || '',
        }
        await worker.setParameters(params)
        try {
          const result = await worker.recognize(image)
          if (result?.data?.text?.trim()) texts.push(result.data.text)
        } catch (recErr) {
          console.warn('Tesseract recognize failed', pass.psm, recErr)
        }
      }
    }

    progress(96)
    const parsed = texts.map((text) => parseOrCrText(text, hint))
    const combined = texts.join('\n')
    const fromCombined = parseOrCrText(combined, hint)
    parsed.push(fromCombined)

    let best = fromCombined
    let bestScore = scoreFields(best)
    for (const fields of parsed) {
      const score = scoreFields(fields)
      if (score > bestScore) {
        best = fields
        bestScore = score
      }
    }

    const voted = consensusFields(parsed)
    if (scoreFields(voted) >= bestScore) {
      best = { ...voted, docType: best.docType || voted.docType }
    } else {
      best = mergeFields(best, voted)
      best = sanitizeScanFields(best)
    }

    // Final fill from combined text for any remaining holes
    best = mergeFields(best, fromCombined)
    best = sanitizeScanFields(best)

    progress(100)
    return { rawText: combined, fields: best }
  } finally {
    try {
      await worker.terminate()
    } catch {
      /* ignore */
    }
  }
}

export function mergeScanFields(existing, incoming) {
  return mergeFields(
    sanitizeScanFields(existing || {}),
    sanitizeScanFields(incoming || {}),
  )
}
