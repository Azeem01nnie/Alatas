import { getDocument, GlobalWorkerOptions, version as pdfjsVersion } from 'pdfjs-dist/build/pdf.mjs'

const PDF_MIME = 'application/pdf'

function ensureWorkerSrc() {
  if (GlobalWorkerOptions.workerSrc) return
  try {
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  } catch {
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`
  }
}

ensureWorkerSrc()

export function isPdfFile(file) {
  if (!file) return false
  const type = String(file.type || '').toLowerCase()
  if (type === PDF_MIME || type === 'application/x-pdf') return true
  return /\.pdf$/i.test(String(file.name || ''))
}

export function isOrcrImageFile(file) {
  if (!file) return false
  const type = String(file.type || '').toLowerCase()
  if (type.startsWith('image/')) {
    return /png|jpe?g|webp|gif|bmp/i.test(type) || type === 'image/*'
  }
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(String(file.name || ''))
}

/**
 * Render the first page of a PDF to a PNG data URL for OCR / preview.
 * @param {File|Blob|ArrayBuffer} source
 * @param {{ scale?: number }} [options]
 * @returns {Promise<string>}
 */
export async function pdfFirstPageToDataUrl(source, options = {}) {
  ensureWorkerSrc()
  const scale = Math.min(2.5, Math.max(1.25, Number(options.scale) || 1.8))
  const buffer =
    source instanceof ArrayBuffer
      ? source
      : source instanceof Blob
        ? await source.arrayBuffer()
        : null
  if (!buffer) throw new Error('Invalid PDF')

  // pdf.js may transfer/detach the buffer — always pass a fresh copy.
  const bytes = new Uint8Array(buffer.slice(0))

  async function load(disableWorker) {
    const loadingTask = getDocument({
      data: bytes.slice(0),
      disableWorker: Boolean(disableWorker),
      useSystemFonts: true,
    })
    return loadingTask.promise
  }

  let pdf
  try {
    pdf = await load(false)
  } catch (workerErr) {
    console.warn('PDF worker failed, retrying on main thread', workerErr)
    pdf = await load(true)
  }

  try {
    if (!pdf.numPages) throw new Error('PDF has no pages')
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not create canvas for PDF')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    }).promise

    return canvas.toDataURL('image/png')
  } finally {
    try {
      await pdf.destroy()
    } catch {
      /* ignore */
    }
  }
}
