/// <reference path="./deno.d.ts" />

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

function mapBodyType(raw: unknown) {
  const t = String(raw ?? "").trim()
  if (!t) return ""
  const lower = t.toLowerCase()
  for (const known of BODY_TYPES) {
    if (known.toLowerCase() === lower) return known
  }
  if (/motor|moto|scooter|moped|tricycle/.test(lower)) return "Motorcycle"
  if (/pick[\s-]?up|pickup/.test(lower)) return "Pick-up"
  if (/suv|crossover/.test(lower)) return "SUV"
  if (/mpv|minivan|wagon/.test(lower)) return "MPV"
  if (/van|commuter|hiace|urvan/.test(lower)) return "Van"
  if (/sedan/.test(lower)) return "Sedan"
  if (/hatch/.test(lower)) return "Hatchback"
  return ""
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

  return {
    ownerName: upper(raw.ownerName),
    plateNo: upper(raw.plateNo).replace(/[^A-Z0-9]/g, "").slice(0, 10),
    make: upper(raw.make),
    series: upper(raw.series),
    engineNo: upper(raw.engineNo).replace(/\s+/g, ""),
    chassisNo: upper(raw.chassisNo).replace(/\s+/g, ""),
    bodyType: mapBodyType(raw.bodyType),
    seats,
    docType,
  }
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

function buildPrompt(hint: Hint) {
  const focus =
    hint === "cr"
      ? "This is likely an LTO Certificate of Registration (CR)."
      : hint === "or"
        ? "This is likely an LTO Official Receipt (OR)."
        : "This may be an LTO Certificate of Registration (CR) and/or Official Receipt (OR)."

  return `${focus}

Extract vehicle registration fields from this Philippine LTO document image.
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
- ownerName is the registered owner / registrant full name
- plateNo is the plate number only (letters/digits)
- make is brand (Toyota, Honda, etc.)
- series is model/series (Wigo, Vios, ADV160, etc.)
- engineNo and chassisNo exactly as printed when readable
- bodyType must be one of: Hatchback, Sedan, MPV, SUV, Pick-up, Van, Motorcycle (or empty)
- seats is passenger capacity as a number string
- Prefer CR for engine/chassis/make/series; OR often has owner and plate
- Do not invent values you cannot see`
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY") || ""
  if (!apiKey) {
    return jsonResponse(
      { error: "GEMINI_API_KEY is not configured on the Edge Function" },
      503,
    )
  }

  let payload: {
    imageBase64?: string
    mimeType?: string
    hint?: string
  }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const hintRaw = String(payload.hint || "auto").toLowerCase()
  const hint: Hint =
    hintRaw === "cr" || hintRaw === "or" ? hintRaw : "auto"

  let mimeType = String(payload.mimeType || "image/jpeg").toLowerCase()
  if (!mimeType.startsWith("image/")) mimeType = "image/jpeg"

  let imageBase64 = String(payload.imageBase64 || "").trim()
  if (!imageBase64) {
    return jsonResponse({ error: "imageBase64 is required" }, 400)
  }
  // Strip data-URL prefix if a client sends the full data URL by mistake.
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase() || mimeType
    imageBase64 = dataUrlMatch[2]
  }

  const model =
    Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash"
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
              { text: buildPrompt(hint) },
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
        geminiJson?.error?.message ||
        `Gemini request failed (${geminiRes.status})`
      return jsonResponse({ error: message }, 502)
    }

    const text =
      geminiJson?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text || "")
        .join("") || ""

    const parsed = extractJsonObject(text)
    const fields = normalizeFields(parsed, hint)
    return jsonResponse({ fields, source: "gemini" })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse({ error: message || "Scan failed" }, 500)
  }
})
