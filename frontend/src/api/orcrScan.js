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

function cloudErrorMessage(err) {
  if (!err) return 'Cloud scan failed'
  if (typeof err === 'string') return err
  const msg = String(err.message || err.error || '').trim()
  return msg || 'Cloud scan failed'
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

  if (useTesseract) {
    progress(20)
    const { scanOrcrImage, sanitizeScanFields } = await import('../utils/orcrOcr')
    const local = await scanOrcrImage(dataUrl, progress, hint)
    return {
      ...local,
      fields: sanitizeScanFields(local?.fields || {}),
      source: 'tesseract',
    }
  }

  if (!isSupabaseConfigured) {
    throw new Error(
      'Cloud scan needs Supabase. Configure VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, or switch to Tesseract.',
    )
  }

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

  if (error) {
    let detail = cloudErrorMessage(error)
    try {
      const body = await error?.context?.json?.()
      if (body?.error) detail = String(body.error)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (data?.error) throw new Error(String(data.error))

  let fields = data?.fields || {}
  const rawText = String(data?.rawText || '')
  const cloudSource = data?.source === 'gemini' ? 'gemini' : 'document-ai'

  const { parseOrCrText, mergeScanFields, sanitizeScanFields } = await import(
    '../utils/orcrOcr'
  )
  fields = sanitizeScanFields(fields)
  if (rawText) {
    const mined = parseOrCrText(rawText, hint)
    fields = mergeScanFields(fields, mined)
  }
  fields = sanitizeScanFields(fields)

  progress(100)
  return {
    fields: fields || {},
    source: cloudSource,
    rawText,
  }
}
