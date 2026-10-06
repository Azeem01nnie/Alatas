function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!/^data:|^blob:/i.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

/** Separable box blur on a single-channel Float32Array. */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const span = r * 2 + 1
  for (let y = 0; y < h; y += 1) {
    const row = y * w
    let acc = 0
    for (let x = -r; x <= r; x += 1) acc += src[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x += 1) {
      tmp[row + x] = acc / span
      const add = src[row + Math.min(w - 1, x + r + 1)]
      const sub = src[row + Math.max(0, x - r)]
      acc += add - sub
    }
  }
  for (let x = 0; x < w; x += 1) {
    let acc = 0
    for (let y = -r; y <= r; y += 1) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y += 1) {
      out[y * w + x] = acc / span
      const add = tmp[Math.min(h - 1, y + r + 1) * w + x]
      const sub = tmp[Math.max(0, y - r) * w + x]
      acc += add - sub
    }
  }
  return out
}

function percentileRange(lum, lowP = 0.01, highP = 0.99) {
  const hist = new Uint32Array(256)
  for (let i = 0; i < lum.length; i += 1) hist[Math.max(0, Math.min(255, lum[i] | 0))] += 1
  const total = lum.length
  let lo = 0
  let hi = 255
  let acc = 0
  for (let v = 0; v < 256; v += 1) {
    acc += hist[v]
    if (acc >= total * lowP) {
      lo = v
      break
    }
  }
  acc = 0
  for (let v = 255; v >= 0; v -= 1) {
    acc += hist[v]
    if (acc >= total * (1 - highP)) {
      hi = v
      break
    }
  }
  if (hi - lo < 10) return [0, 255]
  return [lo, hi]
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)

/**
 * Upscale + sharpen a photo for reading fine print.
 * mode 'enhance': colour, contrast stretch + unsharp mask.
 * mode 'text': grayscale with strong local contrast (document look).
 */
export async function enhancePhoto(src, mode = 'enhance') {
  const img = await loadImage(src)
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight) || 1
  const scale = Math.min(3, Math.max(1, 2400 / longEdge))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)

  const image = ctx.getImageData(0, 0, w, h)
  const d = image.data
  const n = w * h
  const lum = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i += 1, p += 4) {
    lum[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]
  }
  const [lo, hi] = percentileRange(lum)
  const stretch = 255 / (hi - lo)

  if (mode === 'text') {
    const radius = Math.max(8, Math.round(Math.min(w, h) / 40))
    const local = boxBlur(lum, w, h, radius)
    const fine = boxBlur(lum, w, h, Math.max(1, Math.round(scale)))
    // Divide by the local background (scanner-style): flattens shadows/glare so
    // the paper goes white and ink stays dark.
    for (let i = 0, p = 0; i < n; i += 1, p += 4) {
      const sharp = lum[i] + 1.6 * (lum[i] - fine[i])
      const ratio = sharp / Math.max(local[i], 1)
      const v = clamp255((255 * (ratio - 0.62)) / 0.36)
      d[p] = v
      d[p + 1] = v
      d[p + 2] = v
    }
  } else {
    const blur = boxBlur(lum, w, h, Math.max(1, Math.round(scale * 1.2)))
    for (let i = 0, p = 0; i < n; i += 1, p += 4) {
      const detail = (lum[i] - blur[i]) * 1.4
      for (let c = 0; c < 3; c += 1) {
        d[p + c] = clamp255((d[p + c] - lo) * stretch + detail)
      }
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}
