/// <reference path="./deno.d.ts" />

/**
 * OR/CR scan via Google Document AI Form Parser (primary cloud).
 * Optional: Gemini when the desk selects it, or as fallback.
 * Secrets:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  (required for Document AI — full SA JSON)
 *   DOCUMENT_AI_PROCESSOR        (projects/.../locations/.../processors/...)
 *   DOCUMENT_AI_LOCATION         (optional, default us — must match processor)
 *   GEMINI_API_KEY               (optional — desk "Gemini" engine)
 *   GEMINI_MODEL                 (optional, default gemini-2.0-flash)
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const BODY_TYPES = [
  "Hatchback",
  "Sedan",
  "MPV",
  "SUV",
  "Pick-up",
  "Van",
  "Motorcycle",
] as const

const KNOWN_MAKES = [
  "Honda",
  "Toyota",
  "Mitsubishi",
  "Nissan",
  "Ford",
  "Hyundai",
  "Suzuki",
  "Isuzu",
  "Chevrolet",
  "Mazda",
  "Kia",
  "BMW",
  "Yamaha",
  "Kawasaki",
  "Bajaj",
  "TVS",
  "Keeway",
  "Kymco",
  "SYM",
  "Rusi",
  "Mitsukoshi",
  "Geely",
  "MG",
  "Subaru",
]

const LTO_LABEL_LINE =
  /^(PLATE\s*(?:NO\.?|NUMBER)?|ENGINE\s*(?:NO\.?|NUMBER)?|CHASSIS\s*(?:NO\.?|NUMBER)?|VIN|FILE\s*(?:NO\.?|NUMBER)?|MAKE\s*\/?\s*BRAND|MAKE|BRAND|SERIES|BODY\s*TYPE|TYPE\s+OF\s+BODY|VEHICLE\s*TYPE|VEHICLE\s*CATEGORY|PASSENGER\s*CAPACITY|NET\s*CAPACITY|SEATS?|COLOR|TYPE\s+OF\s+FUEL|CLASSIFICATION|GROSS\s*WEIGHT|NET\s*WEIGHT|YEAR\s*MODEL|YEAR\s*REBUILT|PISTON|MAX\s*POWER|OWNER'?S?\s*NAME|OWNER'?S?\s*ADDRESS)\b/i

const FIELD_LABEL_TOKENS = new Set([
  "ENGINE",
  "CHASSIS",
  "PLATE",
  "MAKE",
  "SERIES",
  "BRAND",
  "BODY",
  "TYPE",
  "OWNER",
  "ADDRESS",
  "COLOR",
  "FUEL",
  "CLASS",
  "CATEGORY",
  "VEHICLE",
  "NO",
  "NUMBER",
  "NUM",
  "REGISTRATION",
  "CERTIFICATE",
  "OFFICIAL",
  "RECEIPT",
  "AS",
  "ON",
  "CR",
  "OR",
  "LTO",
  "MV",
  "FILE",
  "MODEL",
  "PASSENGER",
  "CAPACITY",
  "YEAR",
  "VIN",
  "FOR",
  "HIRE",
])

const CAR_SERIES_HINT =
  /\b(WIGO|VIOS|INNOVA|FORTUNER|HILUX|HIACE|COMMUTER|MIRAGE|XPANDER|MONTERO|ALMERA|NAVARA|TERRA|URVAN|LIVINA|STRADA|WILDTRAK|CONQUEST)\b/i

type Hint = "cr" | "or" | "auto"

type ScanFields = {
  ownerName: string
  plateNo: string
  make: string
  series: string
  engineNo: string
  chassisNo: string
  bodyType: string
  seats: string
  docType: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function upper(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function flatten(text: string) {
  return String(text || "")
    .replace(/[|[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function textLines(text: string) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function isFieldLabelToken(value: unknown) {
  const t = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (!t) return true
  if (FIELD_LABEL_TOKENS.has(t)) return true
  if (/^(ENGINE|CHASSIS|PLATE|MAKE|SERIES|BODY|TYPE|OWNER|MODEL)(NO|NUM|NUMBER)?$/.test(t)) {
    return true
  }
  return false
}

function looksLikePlate(value: unknown) {
  const t = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (t.length < 5 || t.length > 10) return false
  if (isFieldLabelToken(t)) return false
  // PH plates: letter+digit mix, OR numeric-only (motorcycle/tricycle CRs)
  if (/^\d{5,8}$/.test(t)) return true
  if (!/[A-Z]/.test(t) || !/\d/.test(t)) return false
  if (/^(19|20)\d{2}$/.test(t)) return false
  return true
}

function looksLikeEngine(value: unknown) {
  const t = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (t.length < 6 || t.length > 24) return false
  if (isFieldLabelToken(t)) return false
  if (!/[A-Z]/.test(t) || !/\d/.test(t)) return false
  return true
}

function looksLikeChassis(value: unknown) {
  const t = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (t.length < 8 || t.length > 32) return false
  if (isFieldLabelToken(t)) return false
  if (!/[A-Z]/.test(t) || !/\d/.test(t)) return false
  return true
}

function looksLikeYearOnly(value: unknown) {
  return /^(19|20)\d{2}$/.test(String(value ?? "").replace(/[^0-9]/g, ""))
}

function isPureLabelLine(line: string) {
  const t = String(line || "").trim()
  if (!t) return false
  if (/^YEAR\s*MODEL\b/i.test(t) || /^YEAR\s*REBUILT\b/i.test(t)) return true
  if (!LTO_LABEL_LINE.test(t)) return false
  const rest = t.replace(LTO_LABEL_LINE, "").replace(/^[:.\-\s]+/, "").trim()
  return !rest
}

function valueBlockAfterLabel(text: string, labelRe: RegExp) {
  const lines = textLines(text)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/YEAR\s*MODEL/i.test(line) && !/^SERIES\b/i.test(line)) continue
    if (!labelRe.test(line)) continue
    const sameLine = line.replace(labelRe, "").replace(/^[:.\-\s]+/, "").trim()
    if (
      sameLine &&
      !/^N\/?A$/i.test(sameLine) &&
      !LTO_LABEL_LINE.test(sameLine) &&
      !isFieldLabelToken(sameLine.replace(/[^A-Za-z0-9]/g, ""))
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

    const values: string[] = []
    let v = runEnd + 1
    while (v < lines.length && values.length < runLen && !isPureLabelLine(lines[v])) {
      let cell = lines[v]
      v += 1
      while (v < lines.length && !isPureLabelLine(lines[v]) && /\/\s*$/.test(cell)) {
        cell = `${cell} ${lines[v]}`
        v += 1
      }
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

    const parts: string[] = []
    for (let j = i + 1; j < lines.length && j <= i + 3; j += 1) {
      const next = lines[j]
      if (!next || /^N\/?A$/i.test(next)) break
      if (isPureLabelLine(next) || LTO_LABEL_LINE.test(next)) break
      parts.push(next)
    }
    if (parts.length) return parts.join(" ").trim()
  }
  return ""
}

function mapBodyType(raw: unknown) {
  const t = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!t) return ""
  if (isFieldLabelToken(t.replace(/[^A-Z0-9]/g, "")) && !/MOTOR|TRIKE|HATCH|SEDAN|SUV|VAN|MPV|PICK/.test(t)) {
    return ""
  }
  const lower = t.toLowerCase()
  for (const known of BODY_TYPES) {
    if (known.toLowerCase() === lower) return known
  }
  if (/motor|moto|scooter|moped|tricycle|trike/.test(lower)) return "Motorcycle"
  if (/pick[\s-]?up|pickup/.test(lower)) return "Pick-up"
  if (/suv|crossover/.test(lower)) return "SUV"
  if (/mpv|minivan|wagon|auv/.test(lower)) return "MPV"
  if (/van|commuter|hiace|urvan/.test(lower)) return "Van"
  if (/sedan/.test(lower)) return "Sedan"
  if (/hatch/.test(lower)) return "Hatchback"
  return ""
}

function normalizeSeries(raw: unknown) {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim()
  if (!s || /^N\/?A$/i.test(s)) return ""
  if (looksLikeYearOnly(s)) return ""
  if (/^YEAR\b/i.test(s)) return ""
  if (isFieldLabelToken(s.replace(/[^A-Za-z0-9]/g, ""))) return ""
  const cleaned = s.replace(/[^A-Za-z0-9 \-/]/g, " ").replace(/\s+/g, " ").trim()
  if (cleaned.length < 2 || cleaned.length > 40) return ""
  return cleaned.toUpperCase()
}

function normalizeFields(raw: Record<string, unknown>, hint: Hint): ScanFields {
  let docType = String(raw.docType ?? "").trim().toLowerCase()
  if (hint === "cr") docType = "cr"
  else if (hint === "or") docType = "or"
  else if (!["cr", "or", "both", "unknown"].includes(docType)) {
    docType = "unknown"
  }

  const seatsRaw = String(raw.seats ?? "").replace(/[^\d]/g, "")
  const seatsNum = Number(seatsRaw)
  const seats =
    Number.isFinite(seatsNum) && seatsNum > 0 && seatsNum < 100
      ? String(seatsNum)
      : ""

  let plateNo = upper(raw.plateNo).replace(/[^A-Z0-9]/g, "").slice(0, 10)
  let engineNo = upper(raw.engineNo).replace(/[^A-Z0-9]/g, "")
  let chassisNo = upper(raw.chassisNo).replace(/[^A-Z0-9]/g, "")
  let make = upper(raw.make)
  let series = normalizeSeries(raw.series)
  let ownerName = upper(raw.ownerName)
  let bodyType = mapBodyType(raw.bodyType)

  if (!looksLikePlate(plateNo)) plateNo = ""
  if (!looksLikeEngine(engineNo)) engineNo = ""
  if (!looksLikeChassis(chassisNo)) chassisNo = ""
  if (isFieldLabelToken(make)) make = ""
  if (isFieldLabelToken(ownerName)) ownerName = ""
  if (bodyType === "Motorcycle" && CAR_SERIES_HINT.test(`${make} ${series}`)) {
    bodyType = ""
  }
  if (!bodyType && CAR_SERIES_HINT.test(series)) {
    if (/WIGO|VIOS/.test(series)) bodyType = "Hatchback"
    else if (/FORTUNER|MONTERO|TERRA/.test(series)) bodyType = "SUV"
    else if (/HILUX|NAVARA|STRADA|WILDTRAK|CONQUEST/.test(series)) bodyType = "Pick-up"
    else if (/INNOVA|XPANDER|LIVINA/.test(series)) bodyType = "MPV"
    else if (/HIACE|URVAN|COMMUTER/.test(series)) bodyType = "Van"
  }

  return {
    ownerName,
    plateNo,
    make,
    series,
    engineNo,
    chassisNo,
    bodyType,
    seats,
    docType,
  }
}

function firstMatch(text: string, patterns: RegExp[]) {
  const flat = flatten(text)
  for (const re of patterns) {
    const m = flat.match(re)
    if (m?.[1]) {
      const v = String(m[1]).trim()
      if (v && !/^N\/?A$/i.test(v) && !isFieldLabelToken(v)) return v
    }
  }
  return ""
}

function valueAfterLabel(
  text: string,
  labelRe: RegExp,
  validator: (v: string) => boolean,
) {
  const raw = String(text || "")
  const m = raw.match(labelRe)
  if (!m || m.index == null) return ""
  const after = raw.slice(m.index + m[0].length)
  const tokens = after.match(/[A-Za-z0-9\-]{3,32}/g) || []
  for (const tok of tokens.slice(0, 12)) {
    if (isFieldLabelToken(tok)) continue
    if (validator(tok)) return tok
  }
  return ""
}

function hasAnyField(fields: ScanFields) {
  return Boolean(
    fields.make ||
      fields.series ||
      fields.plateNo ||
      fields.engineNo ||
      fields.chassisNo ||
      fields.ownerName ||
      fields.bodyType ||
      fields.seats,
  )
}

/** Heuristic field mining from Cloud Vision OCR text (LTO CR/OR grids). */
function parseFieldsFromOcrText(text: string, hint: Hint): ScanFields {
  const flat = flatten(text)
  const upperFlat = flat.toUpperCase()

  let docType: string = "unknown"
  if (hint === "cr" || hint === "or") docType = hint
  else if (/CERTIFICATE\s+OF\s+REGISTRATION|\bC\.?\s*R\.?\b/.test(upperFlat)) {
    docType = "cr"
  } else if (/OFFICIAL\s+RECEIPT|\bO\.?\s*R\.?\b/.test(upperFlat)) {
    docType = "or"
  }

  const plateBlock = valueBlockAfterLabel(text, /^PLATE\s*(?:NO\.?|NUMBER)?\b/i)
  const plateNo =
    (plateBlock && looksLikePlate(plateBlock)
      ? plateBlock.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10)
      : "") ||
    valueAfterLabel(text, /PLATE\s*(?:NO\.?|NUMBER|#)?\s*[:.\-]*/i, looksLikePlate) ||
    firstMatch(text, [
      /PLATE\s*NO\.?\s*[:.\-]?\s*(\d{5,8})\b/i,
      /PLATE\s*NO\.?\s*[:.\-]?\s*([A-Z0-9]{5,10})\b/i,
    ])

  const engineBlock = valueBlockAfterLabel(text, /^ENGINE\s*(?:NO\.?|NUMBER)?\b/i)
  const engineNo =
    (engineBlock && looksLikeEngine(engineBlock)
      ? engineBlock.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      : "") ||
    valueAfterLabel(text, /ENGINE\s*(?:NO\.?|NUMBER|#)?\s*[:.\-]*/i, looksLikeEngine) ||
    firstMatch(text, [/ENGINE\s*NO\.?\s*[:.\-]?\s*([A-Z0-9\-]{6,24})\b/i])
  const chassisBlock = valueBlockAfterLabel(text, /^CHASSIS\s*(?:NO\.?|NUMBER)?\b/i)
  const chassisNo =
    (chassisBlock && looksLikeChassis(chassisBlock)
      ? chassisBlock.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      : "") ||
    valueAfterLabel(text, /CHASSIS\s*(?:NO\.?|NUMBER|#)?\s*[:.\-]*/i, looksLikeChassis) ||
    firstMatch(text, [/CHASSIS\s*NO\.?\s*[:.\-]?\s*([A-Z0-9\-]{8,32})\b/i])
  const ownerName =
    valueBlockAfterLabel(text, /^OWNER'?S?\s*NAME\b/i) ||
    firstMatch(text, [
      /(?:NAME\s+OF\s+)?(?:OWNER|REGISTRANT)\s*[:.\-]?\s*([A-Z][A-Z ,.'-]{5,60})/i,
    ])

  const makeBlock = valueBlockAfterLabel(text, /^(?:MAKE\s*\/?\s*BRAND|MAKE|BRAND)\b/i)
  let make = ""
  if (makeBlock) {
    const tok = makeBlock.split(/\s+/)[0]
    const hit = KNOWN_MAKES.find((k) => new RegExp(`^${k}$`, "i").test(tok))
    make = hit || (/^[A-Za-z]{2,20}$/.test(tok) && !isFieldLabelToken(tok) ? tok : "")
  }
  if (!make) {
    make = firstMatch(text, [
      /MAKE\s*\/?\s*BRAND\s*[:.\-]?\s*([A-Z][A-Z0-9\-]{1,20})\b/i,
      /MAKE\s*[:.\-]?\s*([A-Z][A-Z0-9\-]{1,20})\b/i,
    ])
  }
  if (!make) {
    for (const brand of KNOWN_MAKES) {
      if (new RegExp(`\\b${brand}\\b`, "i").test(flat)) {
        make = brand
        break
      }
    }
  }

  // SERIES only — never YEAR MODEL → 2020
  let series =
    normalizeSeries(valueBlockAfterLabel(text, /^SERIES\b/i)) ||
    normalizeSeries(
      firstMatch(text, [
        /\bSERIES\s*[:.\-]?\s*([A-Z0-9][A-Z0-9 \-]{1,35}?)(?=\s+GROSS|\s+NET|\s+YEAR|\s+BODY|\s+MAKE|\s+PLATE|\s+PISTON|$)/i,
      ]),
    )
  const seriesHint = flat.match(CAR_SERIES_HINT)
  if (!series && seriesHint?.[1]) {
    series = seriesHint[1]
  }

  const bodyBlock =
    valueBlockAfterLabel(text, /^(?:BODY\s*TYPE|TYPE\s+OF\s+BODY)\b/i) ||
    valueBlockAfterLabel(text, /^VEHICLE\s*TYPE\b/i)
  let bodyType =
    mapBodyType(bodyBlock) ||
    mapBodyType(
      firstMatch(text, [
        /BODY\s*TYPE\s*[:.\-]?\s*([A-Z][A-Z0-9\-/ ]{2,40})/i,
        /TYPE\s+OF\s+BODY\s*[:.\-]?\s*([A-Z][A-Z0-9\-/ ]{2,40})/i,
        /VEHICLE\s*TYPE\s*[:.\-]?\s*([A-Z][A-Z0-9\-/ ]{2,60})/i,
      ]),
    )

  const seatsBlock = valueBlockAfterLabel(
    text,
    /^(?:PASSENGER\s*CAPACITY|NET\s*CAPACITY|SEATS?)\b/i,
  )
  const seats =
    (seatsBlock && seatsBlock.match(/\b(\d{1,2})\b/)?.[1]) ||
    firstMatch(text, [
      /PASSENGER\s*CAPACITY\s*[:.\-]?\s*(\d{1,2})\b/i,
      /(?:NET\s+)?CAPACITY\s*[:.\-]?\s*(\d{1,2})\b/i,
    ])

  return normalizeFields(
    {
      ownerName,
      plateNo,
      make,
      series,
      engineNo,
      chassisNo,
      bodyType,
      seats,
      docType,
    },
    hint,
  )
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = String(text || "").trim()
  if (!trimmed) throw new Error("Empty model response")

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed

  try {
    return JSON.parse(candidate) as Record<string, unknown>
  } catch {
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    }
    throw new Error("Model did not return JSON")
  }
}

function buildTextPrompt(hint: Hint, ocrText: string) {
  const focus =
    hint === "cr"
      ? "This OCR text is from an LTO Certificate of Registration (CR)."
      : hint === "or"
        ? "This OCR text is from an LTO Official Receipt (OR)."
        : "This OCR text may be from an LTO CR and/or OR."

  return `${focus}

OCR text:
"""
${ocrText.slice(0, 12000)}
"""

Extract vehicle registration fields.
Return ONLY a JSON object with these keys (use empty string when unknown):
{
  "ownerName": "",
  "plateNo": "",
  "make": "",
  "series": "",
  "engineNo": "",
  "chassisNo": "",
  "bodyType": "",
  "seats": "",
  "docType": "cr" | "or" | "both" | "unknown"
}

Rules:
- Prefer values clearly present in the OCR text; do not invent
- NEVER use form labels as values (ENGINE, CHASSIS, PLATE, MAKE, SERIES, BODY, TYPE, BRAND, NO, etc.)
- plateNo must be a real plate: letter+digit mix (e.g. ABC1234) OR numeric motorcycle plates (e.g. 090101). Never the word ENGINE
- make is the brand (Toyota, Honda, Bajaj, …). "MAKE" and "BRAND" are the same field
- series is the model/series name (Wigo, RE COMPACT 4S F, …). Use SERIES — NEVER use YEAR MODEL / year alone (e.g. 2020)
- engineNo and chassisNo must be alphanumeric IDs with both letters and digits, never the next field label
- bodyType is the same as vehicle type / type of body. One of: Hatchback, Sedan, MPV, SUV, Pick-up, Van, Motorcycle (or empty). MOTORCYCLE TRIKE / MOPED / TRICYCLE → Motorcycle
- seats is the same as passenger capacity (a number string)
- Toyota Wigo / Vios are Hatchback — never Motorcycle unless the document clearly says motorcycle`
}

function buildVisionPrompt(hint: Hint) {
  const focus =
    hint === "cr"
      ? "This image is an LTO Certificate of Registration (CR) from the Philippines."
      : hint === "or"
        ? "This image is an LTO Official Receipt (OR) from the Philippines."
        : "This image may be an LTO CR and/or OR from the Philippines."

  return `${focus}

Read the document grid carefully. Each cell has a small label and a larger value under it.
Return ONLY a JSON object with these keys (use empty string when unknown):
{
  "ownerName": "",
  "plateNo": "",
  "make": "",
  "series": "",
  "engineNo": "",
  "chassisNo": "",
  "bodyType": "",
  "seats": "",
  "docType": "cr" | "or" | "both" | "unknown",
  "rawText": ""
}

Rules:
- Prefer values clearly printed on the document; do not invent
- NEVER use form labels as values (ENGINE, CHASSIS, PLATE, MAKE, SERIES, BODY, TYPE, BRAND, NO, etc.)
- plateNo: letter+digit mix (e.g. 519WLL, ABC1234) OR numeric motorcycle plates (e.g. 090101, 020410)
- make = MAKE/BRAND (Honda, Toyota, Bajaj, Mitsukoshi, …)
- series = SERIES field only (e.g. ADV160AP, DAAN HARI, RE COMPACT 4S F). NEVER YEAR MODEL / a year alone
- engineNo / chassisNo: alphanumeric IDs with letters and digits
- bodyType: map BODY TYPE or VEHICLE TYPE to one of Hatchback, Sedan, MPV, SUV, Pick-up, Van, Motorcycle
  (MOTORCYCLE / MOPED / TRICYCLE, MOTORCYCLE WITH SIDECAR, MOTORCYCLE WITHOUT SIDECAR, TRIKE → Motorcycle)
- seats = PASSENGER CAPACITY (number as string)
- rawText: briefly echo the key printed lines you used (optional aid for debugging)
- Toyota Wigo / Vios are Hatchback unless the document clearly says motorcycle`
}

async function scanWithGemini(
  imageBase64: string,
  mimeType: string,
  hint: Hint,
  apiKey: string,
) {
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash"
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const safeMime = mimeType && mimeType.startsWith("image/")
    ? mimeType
    : "image/jpeg"

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildVisionPrompt(hint) },
            {
              inline_data: {
                mime_type: safeMime,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  })

  const geminiJson = await geminiRes.json()
  if (!geminiRes.ok) {
    const message =
      geminiJson?.error?.message || `Gemini scan failed (${geminiRes.status})`
    throw new Error(message)
  }

  const text =
    geminiJson?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text || "")
      .join("") || ""

  const parsed = extractJsonObject(text)
  const fields = normalizeFields(parsed, hint)
  const rawText = String(parsed.rawText || "").trim()
  return { fields, rawText }
}

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri?: string
}

function base64UrlEncode(data: Uint8Array | string) {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data
  let bin = ""
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function pemToBinary(pem: string) {
  const b64 = pem
    .replace(/-----BEGIN[^-]+-----/g, "")
    .replace(/-----END[^-]+-----/g, "")
    .replace(/\s+/g, "")
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

async function getGoogleAccessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: sa.token_uri || "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  )
  const unsigned = `${header}.${claim}`
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sigBuf))}`

  const tokenRes = await fetch(
    sa.token_uri || "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    },
  )
  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(
      tokenJson?.error_description ||
        tokenJson?.error ||
        `Google token exchange failed (${tokenRes.status})`,
    )
  }
  return String(tokenJson.access_token)
}

function layoutTextFromAnchor(
  fullText: string,
  anchor: { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> } |
    undefined,
) {
  if (!anchor?.textSegments?.length || !fullText) return ""
  return anchor.textSegments
    .map((seg) => {
      const start = Number(seg.startIndex || 0)
      const end = Number(seg.endIndex || 0)
      return fullText.slice(start, end)
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

function mapDocAiLabelToField(label: string): keyof ScanFields | "" {
  const u = label.toUpperCase().replace(/\s+/g, " ").trim()
  if (/^PLATE/.test(u)) return "plateNo"
  if (/^ENGINE/.test(u)) return "engineNo"
  if (/^CHASSIS/.test(u)) return "chassisNo"
  if (/MAKE|BRAND/.test(u) && !/YEAR/.test(u)) return "make"
  if (/^SERIES\b/.test(u) || u === "SERIES") return "series"
  if (/BODY\s*TYPE|VEHICLE\s*TYPE|TYPE\s+OF\s+BODY/.test(u)) return "bodyType"
  if (/PASSENGER\s*CAPACITY|NET\s*CAPACITY|^SEATS?\b/.test(u)) return "seats"
  if (/OWNER'?S?\s*NAME|RECEIVED\s+FROM|NAME\s+OF\s+OWNER/.test(u)) {
    return "ownerName"
  }
  return ""
}

function fieldsFromDocumentAi(doc: Record<string, unknown>, hint: Hint): {
  fields: ScanFields
  rawText: string
} {
  const rawText = String(doc.text || "").trim()
  const collected: Record<string, string> = {}

  const pages = (doc.pages as Array<Record<string, unknown>>) || []
  for (const page of pages) {
    const formFields = (page.formFields as Array<Record<string, unknown>>) || []
    for (const ff of formFields) {
      const nameAnchor = (ff.fieldName as { textAnchor?: unknown })?.textAnchor as
        | { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> }
        | undefined
      const valueAnchor = (ff.fieldValue as { textAnchor?: unknown })?.textAnchor as
        | { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> }
        | undefined
      const label = layoutTextFromAnchor(rawText, nameAnchor)
      const value = layoutTextFromAnchor(rawText, valueAnchor)
      if (!label || !value || /^N\/?A$/i.test(value)) continue
      const key = mapDocAiLabelToField(label)
      if (key && !collected[key]) collected[key] = value
    }
  }

  // Fallback: heuristic parse of full OCR text from Document AI
  const heuristic = parseFieldsFromOcrText(rawText, hint)
  const merged = normalizeFields(
    {
      ownerName: collected.ownerName || heuristic.ownerName,
      plateNo: collected.plateNo || heuristic.plateNo,
      make: collected.make || heuristic.make,
      series: collected.series || heuristic.series,
      engineNo: collected.engineNo || heuristic.engineNo,
      chassisNo: collected.chassisNo || heuristic.chassisNo,
      bodyType: collected.bodyType || heuristic.bodyType,
      seats: collected.seats || heuristic.seats,
      docType: heuristic.docType || (hint === "auto" ? "unknown" : hint),
    },
    hint,
  )

  return { fields: merged, rawText }
}

async function scanWithDocumentAi(
  imageBase64: string,
  mimeType: string,
  hint: Hint,
) {
  const saRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || ""
  const processor =
    Deno.env.get("DOCUMENT_AI_PROCESSOR") ||
    Deno.env.get("DOCUMENT_AI_PROCESSOR_NAME") ||
    ""
  const location = Deno.env.get("DOCUMENT_AI_LOCATION") || "us"

  if (!saRaw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured")
  }
  if (!processor) {
    throw new Error(
      "DOCUMENT_AI_PROCESSOR is not configured (projects/.../locations/.../processors/...)",
    )
  }

  let sa: ServiceAccount
  try {
    sa = JSON.parse(saRaw) as ServiceAccount
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON")
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("Service account JSON missing client_email or private_key")
  }

  const accessToken = await getGoogleAccessToken(sa)
  const processorName = processor.startsWith("projects/")
    ? processor
    : `projects/${Deno.env.get("DOCUMENT_AI_PROJECT_ID") || ""}/locations/${location}/processors/${processor}`

  if (!processorName.includes("/processors/")) {
    throw new Error("DOCUMENT_AI_PROCESSOR must be a full processor resource name")
  }

  const locMatch = processorName.match(/\/locations\/([^/]+)\//)
  const apiLocation = locMatch?.[1] || location
  const url =
    `https://${apiLocation}-documentai.googleapis.com/v1/${processorName}:process`

  const safeMime = mimeType && mimeType.startsWith("image/")
    ? mimeType
    : mimeType === "application/pdf"
      ? "application/pdf"
      : "image/jpeg"

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rawDocument: {
        content: imageBase64,
        mimeType: safeMime,
      },
    }),
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(
      json?.error?.message || `Document AI failed (${res.status})`,
    )
  }

  const doc = (json.document || {}) as Record<string, unknown>
  return fieldsFromDocumentAi(doc, hint)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY") || ""
  const hasDocAi = Boolean(
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") &&
      (Deno.env.get("DOCUMENT_AI_PROCESSOR") ||
        Deno.env.get("DOCUMENT_AI_PROCESSOR_NAME")),
  )

  if (!hasDocAi && !geminiKey) {
    return jsonResponse(
      {
        error:
          "Set Document AI secrets (GOOGLE_SERVICE_ACCOUNT_JSON + DOCUMENT_AI_PROCESSOR) or GEMINI_API_KEY",
      },
      503,
    )
  }

  let payload: {
    imageBase64?: string
    mimeType?: string
    hint?: string
    engine?: string
  }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const hintRaw = String(payload.hint || "auto").toLowerCase()
  const hint: Hint =
    hintRaw === "cr" || hintRaw === "or" ? hintRaw : "auto"
  const engineRaw = String(payload.engine || "document-ai").toLowerCase()
  const preferGemini = engineRaw === "gemini"

  let imageBase64 = String(payload.imageBase64 || "").trim()
  if (!imageBase64) {
    return jsonResponse({ error: "imageBase64 is required" }, 400)
  }
  let mimeType = String(payload.mimeType || "image/jpeg").trim() || "image/jpeg"
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1] || mimeType
    imageBase64 = dataUrlMatch[2]
  }

  const errors: string[] = []

  const tryGemini = async () => {
    if (!geminiKey) throw new Error("GEMINI_API_KEY is not configured")
    return scanWithGemini(imageBase64, mimeType, hint, geminiKey)
  }

  const tryDocAi = async () => {
    if (!hasDocAi) {
      throw new Error("Document AI secrets are not configured")
    }
    return scanWithDocumentAi(imageBase64, mimeType, hint)
  }

  // Desk engine selection
  if (preferGemini) {
    try {
      const { fields, rawText } = await tryGemini()
      return jsonResponse({
        fields,
        rawText,
        source: "gemini",
        structureSource: "gemini",
      })
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  // Document AI (default cloud path — replaces Cloud Vision)
  try {
    const { fields, rawText } = await tryDocAi()
    return jsonResponse({
      fields,
      rawText,
      source: "document-ai",
      structureSource: "document-ai",
    })
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }

  // Fallback Gemini if Document AI failed and desk didn't already try it
  if (!preferGemini && geminiKey) {
    try {
      const { fields, rawText } = await tryGemini()
      return jsonResponse({
        fields,
        rawText,
        source: "gemini",
        structureSource: "gemini",
      })
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return jsonResponse(
    {
      error:
        errors.filter(Boolean).join(" | ") ||
        "Scan failed — configure Document AI (service account + processor)",
    },
    500,
  )
})
