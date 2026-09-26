import { isSupabaseConfigured, requireSupabase } from './supabaseClient'

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || '')
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i)
  if (match) {
    return { mimeType: match[1].toLowerCase(), imageBase64: match[2] }
  }
  if (raw && !raw.includes(',')) {
    return { mimeType: 'image/jpeg', imageBase64: raw }
  }
  return { mimeType: 'image/jpeg', imageBase64: '' }
}

function hasAnyField(fields) {
  if (!fields || typeof fields !== 'object') return false
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

/**
 * Scan OR/CR with Document AI / Gemini (cloud) or Tesseract (local).
 * @param {string} dataUrl
 * @param {(n: number) => void} [onProgress]
 * @param {'cr'|'or'|'auto'} [hint]
 * @param {'document-ai'|'gemini'|'tesseract'} [engine]
 */
export async function scanOrcrDocument(
  dataUrl,
  onProgress,
  hint = 'auto',
  engine = 'document-ai',
) {
  const progress = typeof onProgress === 'function' ? onProgress : () => {}
  const useTesseract = engine === 'tesseract'
  const cloudEngine = engine === 'gemini' ? 'gemini' : 'document-ai'

  if (!useTesseract && isSupabaseConfigured) {
    try {
      progress(8)
      const { mimeType, imageBase64 } = parseDataUrl(dataUrl)
      if (!imageBase64) throw new Error('Invalid image data')

      const supabase = requireSupabase()
      progress(18)
      const { data, error } = await supabase.functions.invoke('scan-orcr', {
        body: {
          imageBase64,
          mimeType,
          hint: hint === 'or' || hint === 'cr' ? hint : 'auto',
          engine: cloudEngine,
        },
      })
      progress(70)

      if (error) throw error
      if (data?.error) throw new Error(String(data.error))

      let fields = data?.fields || {}
      const rawText = String(data?.rawText || '')
      const cloudSource =
        data?.source === 'document-ai'
          ? 'document-ai'
          : data?.source === 'gemini'
            ? 'gemini'
            : 'document-ai'

      const { parseOrCrText, mergeScanFields, sanitizeScanFields } = await import(
        '../utils/orcrOcr'
      )
      fields = sanitizeScanFields(fields)
      if (rawText) {
        const mined = parseOrCrText(rawText, hint)
        fields = mergeScanFields(fields, mined)
      }
      fields = sanitizeScanFields(fields)

      if (hasAnyField(fields) || rawText) {
        progress(100)
        return {
          fields: fields || {},
          source: cloudSource,
          rawText,
        }
      }
      console.warn('[orcrScan] Cloud scan returned no fields; falling back to Tesseract')
    } catch (err) {
      console.warn('[orcrScan] Cloud scan unavailable, using Tesseract', err)
    }
  }

  progress(20)
  const { scanOrcrImage, sanitizeScanFields } = await import('../utils/orcrOcr')
  const local = await scanOrcrImage(dataUrl, progress, hint)
  return {
    ...local,
    fields: sanitizeScanFields(local?.fields || {}),
    source: 'tesseract',
  }
}
