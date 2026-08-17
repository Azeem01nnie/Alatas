const MAX_EDGE = 720
const JPEG_QUALITY = 0.72

/** Resize/compress a data-URL or blob URL image for localStorage-friendly size. */
export function compressImageDataUrl(dataUrl, maxEdge = MAX_EDGE, quality = JPEG_QUALITY) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve('')
      return
    }
    // Keep remote URLs as-is (not base64)
    if (/^https?:\/\//i.test(dataUrl)) {
      resolve(dataUrl)
      return
    }
    if (!dataUrl.startsWith('data:image')) {
      resolve(dataUrl)
      return
    }

    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
    return { ok: true }
  } catch (err) {
    // Quota exceeded — try trimming older rentals if this is the rentals key
    return { ok: false, error: err }
  }
}

/** Resize/compress a data-URL; force white background then JPEG (for signatures). */
export function compressSignatureDataUrl(dataUrl, maxEdge = 640, quality = 0.92) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve('')
      return
    }
    if (!dataUrl.startsWith('data:image')) {
      resolve(dataUrl)
      return
    }

    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export function estimateJsonBytes(value) {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return JSON.stringify(value).length
  }
}
