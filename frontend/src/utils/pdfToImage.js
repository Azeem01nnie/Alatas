import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorker

const PDF_MIME = 'application/pdf'

export function isPdfFile(file) {
  if (!file) return false
  const type = String(file.type || '').toLowerCase()
  if (type === PDF_MIME || type === 'application/x-pdf') return true
  return /\.pdf$/i.test(String(file.name || ''))
}

/**
 * Render the first page of a PDF to a PNG data URL for OCR / preview.
 * @param {File|Blob|ArrayBuffer} source
 * @param {{ scale?: number }} [options]
 * @returns {Promise<string>}
 */
export async function pdfFirstPageToDataUrl(source, options = {}) {
  const scale = Math.min(3, Math.max(1.5, Number(options.scale) || 2.2))
  const data =
    source instanceof ArrayBuffer
      ? source
      : await (source instanceof Blob ? source.arrayBuffer() : Promise.reject(new Error('Invalid PDF')))

  const loadingTask = getDocument({
    data: new Uint8Array(data),
    disableWorker: false,
  })
  const pdf = await loadingTask.promise
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
