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
 * Prefer Gemini via Supabase Edge Function; fall back to local Tesseract OCR.
 * @param {string} dataUrl
 * @param {(n: number) => void} [onProgress]
 * @param {'cr'|'or'|'auto'} [hint]
 * @returns {Promise<{ rawText?: string, fields: object, source: 'gemini'|'tesseract' }>}
 */
export async function scanOrcrDocument(dataUrl, onProgress, hint = 'auto') {
  const progress = typeof onProgress === 'function' ? onProgress : () => {}

  if (isSupabaseConfigured) {
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
        },
      })
      progress(70)

      if (error) throw error
      if (data?.error) throw new Error(String(data.error))

      const fields = data?.fields || {}
      if (hasAnyField(fields)) {
        progress(100)
        return { fields, source: 'gemini', rawText: '' }
      }
      console.warn('[orcrScan] Gemini returned no fields; falling back to Tesseract')
    } catch (err) {
      console.warn('[orcrScan] Gemini scan unavailable, using Tesseract', err)
    }
  }

  progress(20)
  const { scanOrcrImage } = await import('../utils/orcrOcr')
  const local = await scanOrcrImage(dataUrl, progress, hint)
  return {
    ...local,
    fields: local?.fields || {},
    source: 'tesseract',
  }
}
