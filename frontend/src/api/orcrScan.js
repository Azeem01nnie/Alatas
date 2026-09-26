/**
 * OR/CR scan — local Tesseract only (browser).
 */
export async function scanOrcrDocument(dataUrl, onProgress, hint = 'auto') {
  const progress = typeof onProgress === 'function' ? onProgress : () => {}
  progress(12)
  const { scanOrcrImage, sanitizeScanFields } = await import('../utils/orcrOcr')
  const local = await scanOrcrImage(dataUrl, progress, hint)
  return {
    ...local,
    fields: sanitizeScanFields(local?.fields || {}),
    source: 'tesseract',
  }
}
