import { useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { CONTRACT_TERMS, LIABILITY_CLAUSE, CONTRACT_DOCUMENT_TITLE, getContractClauseNumber } from '../data/contract'
import { formatEmergencyContact } from '../utils/phone'
import { compressImageDataUrl } from '../utils/storage'
import { collectPhotographerCredits, formatTakenByLabel, mergePhotographerCredits } from '../utils/photoCredits'
import ConfirmModal from './ConfirmModal'

const CAR_SLOTS = [
  { key: 'front', label: 'Front' },
  { key: 'rear', label: 'Rear' },
  { key: 'left', label: 'Left side' },
  { key: 'right', label: 'Right side' },
]

function normalizeCarPhotos(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { extras: [] }
  return {
    ...value,
    extras: Array.isArray(value.extras) ? value.extras : [],
  }
}

async function readAndCompress(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
  return compressImageDataUrl(dataUrl, 720, 0.72)
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function fullName(personal = {}) {
  return [personal.firstName, personal.middleName, personal.lastName]
    .filter(Boolean)
    .join(' ')
}

function isUsableImageSrc(value) {
  if (!value || typeof value !== 'string') return false
  const src = value.trim()
  return src.startsWith('data:image') || /^https?:\/\//i.test(src)
}

/** Normalize data-URL or remote Storage URL into a JPEG/PNG data-URL for jsPDF. */
async function resolveImageForPdf(src) {
  if (!isUsableImageSrc(src)) return null
  const trimmed = String(src).trim()
  if (trimmed.startsWith('data:image')) return trimmed

  try {
    const res = await fetch(trimmed, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const maxEdge = 1400
    let width = bitmap.width
    let height = bitmap.height
    if (width > maxEdge || height > maxEdge) {
      const ratio = Math.min(maxEdge / width, maxEdge / height)
      width = Math.max(1, Math.round(width * ratio))
      height = Math.max(1, Math.round(height * ratio))
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return null
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const mime = String(blob.type || '').toLowerCase()
    if (mime.includes('png')) return canvas.toDataURL('image/png')
    return canvas.toDataURL('image/jpeg', 0.86)
  } catch {
    return null
  }
}

async function resolveImageItems(items) {
  const resolved = await Promise.all(
    items.map(async (item) => {
      const src = await resolveImageForPdf(item.src)
      return src ? { ...item, src } : null
    }),
  )
  return resolved.filter(Boolean)
}

async function downloadContractPdf(transaction) {
  const {
    personal = {},
    vehicle = {},
    rental = {},
    photo,
    licensePhoto,
    signature,
    carPhotos = {},
  } = transaction
  const name = fullName(personal) || 'Lessee'
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (needed = 16) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  const toPdfText = (text) =>
    String(text ?? '')
      .replace(/\u20b1/g, 'PHP ') // ₱ — Helvetica has no peso glyph (shows as ±)
      .replace(/₱/g, 'PHP ')
      .replace(/±(?=\s*\d)/g, 'PHP ')
      .replace(/[•●]/g, '-')

  const centerText = (text, opts = {}) => {
    const { size = 11, style = 'normal', gap = 14, color = [17, 17, 17] } = opts
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(toPdfText(text), pageWidth / 2, y, { align: 'center' })
    y += gap
  }

  const writeBlock = (text, x, width, opts = {}) => {
    const { size = 9, style = 'normal', color = [17, 17, 17], lineHeight = 12 } = opts
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(toPdfText(text), width)
    return { lines, lineHeight, height: lines.length * lineHeight }
  }

  // Centered company branding
  centerText('ALATAS CAR RENTAL SERVICES', { size: 16, style: 'bold', gap: 16 })
  centerText(CONTRACT_DOCUMENT_TITLE, { size: 10, style: 'bold', gap: 12 })
  centerText(`Transaction ID: ${transaction.id}`, {
    size: 8,
    color: [90, 90, 90],
    gap: 10,
  })
  centerText(`Encoded: ${formatDateTime(transaction.encodedAt)}`, {
    size: 8,
    color: [90, 90, 90],
    gap: 18,
  })

  doc.setDrawColor(17, 17, 17)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 16

  // 3-column section: Lessee / Vehicle / Rental Details
  const gap = 14
  const colWidth = (contentWidth - gap * 2) / 3
  const col1X = margin
  const col2X = margin + colWidth + gap
  const col3X = margin + (colWidth + gap) * 2

  const drawColumn = (x, title, rows) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(17, 17, 17)
    doc.text(toPdfText(title), x, y)

    let localY = y + 14
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      const labelLines = doc.splitTextToSize(toPdfText(label.toUpperCase()), colWidth)
      labelLines.forEach((line) => {
        doc.text(line, x, localY)
        localY += 9
      })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(17, 17, 17)
      const valueLines = doc.splitTextToSize(toPdfText(String(value || '—')), colWidth)
      valueLines.forEach((line) => {
        doc.text(line, x, localY)
        localY += 11
      })
      localY += 4
    })
    return localY
  }

  const lesseeY = drawColumn(col1X, 'LESSEE / RENTER', [
    ['Full Name', name],
    ['Address', personal.address || '—'],
    ['Contact No.', personal.contactNo || '—'],
    ['Emergency Contact', formatEmergencyContact(personal)],
  ])

  const vehicleY = drawColumn(col2X, 'VEHICLE', [
    ['Make', vehicle.make || '—'],
    ['Series', vehicle.series || '—'],
    ['Type of Body', vehicle.bodyType || '—'],
    ['Plate No.', vehicle.plateNo || '—'],
    ['Engine No.', vehicle.engineNo || '—'],
    ['Chassis No.', vehicle.chassisNo || '—'],
  ])

  const rentalY = drawColumn(col3X, 'RENTAL DETAILS', [
    ['Duration', rental.duration || '—'],
    ['Rental Type', rental.rentalType || '—'],
    ['From', rental.periodFromLabel || formatDateTime(rental.periodFrom)],
    ['To', rental.periodToLabel || formatDateTime(rental.periodTo)],
    ['Rental Fee', rental.rentalFee || '—'],
  ])

  y = Math.max(lesseeY, vehicleY, rentalY) + 8
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  // Contract terms (full width)
  ensureSpace(24)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 17, 17)
  doc.text('CONTRACT TERMS', margin, y)
  y += 14

  const fromLabel = rental.periodFromLabel || formatDateTime(rental.periodFrom)
  const toLabel = rental.periodToLabel || formatDateTime(rental.periodTo)
  const intro = `This agreement was acknowledged by ${name} for the rental of ${vehicle.make || ''} ${vehicle.series || ''} (${vehicle.plateNo || ''}) covering ${fromLabel} to ${toLabel}.`
  const introBlock = writeBlock(intro, margin, contentWidth, { size: 9, lineHeight: 12 })
  introBlock.lines.forEach((line) => {
    ensureSpace(12)
    doc.text(line, margin, y)
    y += 12
  })
  y += 8

  CONTRACT_TERMS.forEach((term, index) => {
    const isSection = term?.type === 'section'
    const title = isSection
      ? String(term.title || '')
      : `${getContractClauseNumber(CONTRACT_TERMS, index)}. ${term.title}`
    const body = isSection ? '' : String(term.body || '')

    const titleBlock = writeBlock(title, margin, contentWidth, {
      size: isSection ? 9 : 9,
      lineHeight: 12,
      style: 'bold',
    })
    ensureSpace(titleBlock.height + (body ? 8 : 6))
    titleBlock.lines.forEach((line) => {
      ensureSpace(12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(isSection ? 9 : 9)
      doc.setTextColor(17, 17, 17)
      doc.text(line, margin, y)
      y += 12
    })

    if (body) {
      y += 3
      const bodyBlock = writeBlock(body, margin, contentWidth, {
        size: 8.5,
        lineHeight: 11,
        style: 'normal',
      })
      bodyBlock.lines.forEach((line) => {
        ensureSpace(11)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(17, 17, 17)
        doc.text(line, margin, y)
        y += 11
      })
    }

    y += isSection ? 8 : 10
  })

  y += 8
  ensureSpace(60)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('LIABILITY ACKNOWLEDGMENT', margin, y)
  y += 14

  const liability = `${transaction.termsAccepted ? '[ACCEPTED] ' : '[NOT ACCEPTED] '}${LIABILITY_CLAUSE}`
  const liabilityBlock = writeBlock(liability, margin, contentWidth, {
    size: 8.5,
    style: 'bold',
    lineHeight: 11,
  })
  liabilityBlock.lines.forEach((line) => {
    ensureSpace(11)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(line, margin, y)
    y += 11
  })

  y += 20
  ensureSpace(90)
  const half = contentWidth / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('LESSEE ACKNOWLEDGMENT', margin, y)
  doc.text('TRANSACTION REFERENCE', margin + half + 10, y)
  y += 14

  const signatureSrc = await resolveImageForPdf(signature)
  if (signatureSrc) {
    try {
      const props = doc.getImageProperties(signatureSrc)
      const maxW = half - 28
      const maxH = 48
      const ratio = Math.min(maxW / props.width, maxH / props.height, 1)
      const imgW = props.width * ratio
      const imgH = props.height * ratio
      const colorFormat = /image\/png/i.test(signatureSrc) ? 'PNG' : 'JPEG'
      doc.addImage(signatureSrc, colorFormat, margin, y, imgW, imgH)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(17, 17, 17)
      doc.text(String(transaction.id), margin + half + 10, y + Math.max(14, imgH / 2))
      y += Math.max(imgH, 20) + 4
    } catch {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(17, 17, 17)
      doc.text(name, margin, y)
      doc.text(String(transaction.id), margin + half + 10, y)
      y += 6
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(17, 17, 17)
    doc.text(name, margin, y)
    doc.text(String(transaction.id), margin + half + 10, y)
    y += 6
  }

  doc.setLineWidth(0.6)
  doc.line(margin, y, margin + half - 20, y)
  doc.line(margin + half + 10, y, pageWidth - margin, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`Electronically accepted on ${formatDateTime(transaction.encodedAt)}`, margin, y)
  doc.text('Alatas Car Rental Services', margin + half + 10, y)

  const drawImageRow = (title, items) => {
    y += 28
    ensureSpace(220)
    doc.setDrawColor(17, 17, 17)
    doc.setLineWidth(0.8)
    doc.line(margin, y, pageWidth - margin, y)
    y += 18

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(17, 17, 17)
    doc.text(title, margin, y)
    y += 14

    if (!items.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text('No images on file.', margin, y)
      return
    }

    try {
      const photoGap = 12
      const cols = Math.min(items.length, 2)
      const slotW = (contentWidth - photoGap * (cols - 1)) / cols
      const maxH = 150
      let rowH = 0
      let col = 0

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        if (col === 0 && index > 0) {
          y += rowH + 10
          rowH = 0
          ensureSpace(maxH + 30)
        }
        const props = doc.getImageProperties(item.src)
        const ratio = Math.min(slotW / props.width, maxH / props.height, 1)
        const imgW = props.width * ratio
        const imgH = props.height * ratio
        const colorFormat = /image\/png/i.test(item.src) ? 'PNG' : 'JPEG'
        const x = margin + col * (slotW + photoGap) + (slotW - imgW) / 2
        doc.addImage(item.src, colorFormat, x, y, imgW, imgH)
        doc.setDrawColor(17, 17, 17)
        doc.setLineWidth(0.5)
        doc.rect(x, y, imgW, imgH)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(80, 80, 80)
        doc.text(item.label, x + imgW / 2, y + imgH + 12, { align: 'center' })
        rowH = Math.max(rowH, imgH + 18)
        col = (col + 1) % cols
      }
      y += rowH + 8
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text('Images could not be embedded in this PDF.', margin, y)
    }
  }

  const customerImageCandidates = []
  if (isUsableImageSrc(photo)) {
    customerImageCandidates.push({ src: photo, label: 'Holding license' })
  }
  if (isUsableImageSrc(licensePhoto)) {
    customerImageCandidates.push({ src: licensePhoto, label: 'Customer photo' })
  }
  if (isUsableImageSrc(personal?.optionalPhoto)) {
    customerImageCandidates.push({ src: personal.optionalPhoto, label: 'Optional photo' })
  }
  const customerImages = await resolveImageItems(customerImageCandidates)
  drawImageRow('CUSTOMER PHOTOS', customerImages)

  const carImageCandidates = [
    ...[
      ['front', 'Front'],
      ['rear', 'Rear'],
      ['left', 'Left side'],
      ['right', 'Right side'],
    ]
      .filter(([key]) => isUsableImageSrc(carPhotos?.[key]))
      .map(([key, label]) => ({ src: carPhotos[key], label })),
    ...(Array.isArray(carPhotos?.extras)
      ? carPhotos.extras
          .filter((item) => isUsableImageSrc(item?.uri))
          .map((item, index) => ({
            src: item.uri,
            label: item.label || `Extra ${index + 1}`,
          }))
      : []),
  ]
  const carImageItems = await resolveImageItems(carImageCandidates)
  drawImageRow('PRE-RENTAL CAR PHOTOS', carImageItems)

  const safeName = name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'contract'
  doc.save(`Alatas_Contract_${safeName}_${transaction.id}.pdf`)
}

export default function TransactionPage({
  transaction,
  onBack,
  backLabel = '← Back to History',
  canEditCarPhotos = false,
  addedByName = '',
  onSaveCarPhotos,
}) {
  const {
    personal = {},
    vehicle = {},
    rental = {},
    photo,
    licensePhoto,
    signature,
  } = transaction

  const [carPhotos, setCarPhotos] = useState(() => normalizeCarPhotos(transaction.carPhotos))
  const [photoBusy, setPhotoBusy] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoSuccess, setPhotoSuccess] = useState('')
  const [photoDirty, setPhotoDirty] = useState(false)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [customerPhotosOpen, setCustomerPhotosOpen] = useState(true)
  const [carPhotosOpen, setCarPhotosOpen] = useState(true)
  const slotInputRefs = useRef({})
  const extraInputRef = useRef(null)

  useEffect(() => {
    setCarPhotos(normalizeCarPhotos(transaction.carPhotos))
    setPhotoDirty(false)
    setSaveConfirmOpen(false)
    setPhotoSuccess('')
    setPhotoError('')
    // Only re-sync when opening a different rental — not on every parent object refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction.id])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const sync = () => {
      if (mq.matches) {
        setCustomerPhotosOpen(false)
        setCarPhotosOpen(false)
      } else {
        setCustomerPhotosOpen(true)
        setCarPhotosOpen(true)
      }
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const optionalPhoto = personal?.optionalPhoto || ''
  const sessionPhotographer = String(addedByName || '').trim()
  const photographer = collectPhotographerCredits(
    carPhotos,
    transaction.carPhotosAddedBy || sessionPhotographer,
  )
  const takenByLabel = formatTakenByLabel(photographer)
  const customerPhotoCount =
    (photo ? 1 : 0) + (licensePhoto ? 1 : 0) + (optionalPhoto ? 1 : 0) + (vehicle.image ? 1 : 0)
  const extraPhotos = Array.isArray(carPhotos?.extras)
    ? carPhotos.extras.filter(
        (item) =>
          item?.uri &&
          (String(item.uri).startsWith('data:image') || /^https?:\/\//i.test(String(item.uri))),
      )
    : []
  const carPhotoCount =
    CAR_SLOTS.filter((slot) => Boolean(carPhotos?.[slot.key])).length + extraPhotos.length

  const applyDraftPhotos = (nextPhotos) => {
    const mergedCredit = mergePhotographerCredits(
      transaction.carPhotosAddedBy,
      carPhotos?._addedBy,
      nextPhotos?._addedBy,
      sessionPhotographer,
      Array.isArray(nextPhotos?.extras) ? nextPhotos.extras.map((item) => item?.addedBy) : [],
    )
    const stamped = {
      ...nextPhotos,
      ...(mergedCredit ? { _addedBy: mergedCredit } : {}),
    }
    setCarPhotos(stamped)
    setPhotoDirty(true)
    setPhotoError('')
    setPhotoSuccess('')
  }

  const persistCarPhotos = async () => {
    if (!canEditCarPhotos || typeof onSaveCarPhotos !== 'function') return
    const mergedCredit = mergePhotographerCredits(
      transaction.carPhotosAddedBy,
      carPhotos?._addedBy,
      sessionPhotographer,
      Array.isArray(carPhotos?.extras) ? carPhotos.extras.map((item) => item?.addedBy) : [],
    )
    const stamped = {
      ...carPhotos,
      ...(mergedCredit ? { _addedBy: mergedCredit } : {}),
    }
    setPhotoBusy('save')
    setPhotoError('')
    setPhotoSuccess('')
    try {
      const saved = await onSaveCarPhotos(transaction.id, stamped, sessionPhotographer)
      const next = normalizeCarPhotos(saved?.carPhotos || stamped)
      setCarPhotos(next)
      setPhotoDirty(false)
      setSaveConfirmOpen(false)
      setPhotoSuccess('Photos saved. They will stay after refresh.')
    } catch (err) {
      setPhotoError(err?.message || 'Could not save car photos.')
      setSaveConfirmOpen(false)
    } finally {
      setPhotoBusy('')
    }
  }

  const handleSlotFile = async (slotKey, file, inputEl) => {
    if (!file || !canEditCarPhotos) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file')
      return
    }
    setPhotoBusy(slotKey)
    setPhotoError('')
    try {
      const compressed = await readAndCompress(file)
      if (!compressed) {
        setPhotoError('Could not process that image. Try another file.')
        return
      }
      applyDraftPhotos({
        ...carPhotos,
        [slotKey]: compressed,
      })
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setPhotoBusy('')
      if (inputEl) inputEl.value = ''
    }
  }

  const handleExtraFile = async (file, inputEl) => {
    if (!file || !canEditCarPhotos) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file')
      return
    }
    setPhotoBusy('extra')
    setPhotoError('')
    try {
      const compressed = await readAndCompress(file)
      if (!compressed) {
        setPhotoError('Could not process that image. Try another file.')
        return
      }
      const extras = Array.isArray(carPhotos.extras) ? carPhotos.extras : []
      applyDraftPhotos({
        ...carPhotos,
        extras: [
          ...extras,
          {
            id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            uri: compressed,
            label: `Extra ${extras.length + 1}`,
            addedBy: sessionPhotographer || undefined,
          },
        ],
      })
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setPhotoBusy('')
      if (inputEl) inputEl.value = ''
    }
  }

  const removeExtra = (id) => {
    if (!canEditCarPhotos) return
    const extras = (Array.isArray(carPhotos.extras) ? carPhotos.extras : []).filter(
      (item) => item.id !== id,
    )
    applyDraftPhotos({ ...carPhotos, extras })
  }

  const removeSlot = (slotKey) => {
    if (!canEditCarPhotos || !slotKey) return
    applyDraftPhotos({ ...carPhotos, [slotKey]: '' })
  }

  return (
    <section className="transaction-page">
      <div className="transaction-toolbar">
        <button type="button" className="btn-ghost" onClick={onBack}>
          {backLabel}
        </button>
        <div className="transaction-toolbar-actions">
          <span className="transaction-id">Transaction ID: {transaction.id}</span>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              void downloadContractPdf({ ...transaction, carPhotos })
            }}
          >
            Download Contract PDF
          </button>
        </div>
      </div>

      <header className="transaction-header">
        <h2 className="step-title">Rental Transaction</h2>
        <p className="step-subtitle">
          Encoded {formatDateTime(transaction.encodedAt)} · Contract accepted:{' '}
          {transaction.termsAccepted ? 'Yes' : 'No'}
          {signature ? ' · Signed' : ''}
        </p>
      </header>

      <section className={`transaction-collapse${customerPhotosOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="transaction-collapse-toggle"
          aria-expanded={customerPhotosOpen}
          onClick={() => setCustomerPhotosOpen((v) => !v)}
        >
          <span className="transaction-collapse-copy">
            <strong>Customer & vehicle photos</strong>
            <small>
              {customerPhotoCount
                ? `${customerPhotoCount} photo${customerPhotoCount === 1 ? '' : 's'}`
                : 'No photos yet'}
            </small>
          </span>
          <span className={`transaction-collapse-chevron${customerPhotosOpen ? ' is-open' : ''}`} aria-hidden="true">
            ▾
          </span>
        </button>
        <div className="transaction-collapse-body">
          <div className="transaction-photos">
            <figure className="transaction-photo-card">
              {photo ? (
                <img src={photo} alt="Customer holding license" />
              ) : (
                <div className="transaction-photo-empty">No holding-license photo</div>
              )}
              <figcaption>Holding License</figcaption>
            </figure>
            <figure className="transaction-photo-card">
              {licensePhoto ? (
                <img src={licensePhoto} alt="Customer" />
              ) : (
                <div className="transaction-photo-empty">No customer photo</div>
              )}
              <figcaption>Customer Photo</figcaption>
            </figure>
            {optionalPhoto ? (
              <figure className="transaction-photo-card">
                <img src={optionalPhoto} alt="Optional customer" />
                <figcaption>Optional Photo</figcaption>
              </figure>
            ) : null}
            <figure className="transaction-photo-card">
              {vehicle.image ? (
                <img src={vehicle.image} alt={`${vehicle.make || 'Vehicle'}`} />
              ) : (
                <div className="transaction-photo-empty">No vehicle image</div>
              )}
              <figcaption>Vehicle Photo</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section
        className={`transaction-car-photos-block transaction-collapse${carPhotosOpen ? ' is-open' : ''}`}
      >
        <button
          type="button"
          className="transaction-collapse-toggle"
          aria-expanded={carPhotosOpen}
          onClick={() => setCarPhotosOpen((v) => !v)}
        >
          <span className="transaction-collapse-copy">
            <strong>Pre-rental car photos</strong>
            <small>
              {carPhotoCount
                ? `${carPhotoCount} photo${carPhotoCount === 1 ? '' : 's'}${photographer ? ` · ${takenByLabel}` : ''}`
                : photographer
                  ? `None yet · signed in as ${sessionPhotographer || photographer}`
                  : 'Optional — add photos if needed'}
            </small>
          </span>
          <span className={`transaction-collapse-chevron${carPhotosOpen ? ' is-open' : ''}`} aria-hidden="true">
            ▾
          </span>
        </button>

        <div className="transaction-collapse-body">
          <div className="transaction-car-photos-head">
            <div>
              <h3 className="transaction-car-photos-desktop-title">Pre-rental car photos</h3>
              <p>
                {canEditCarPhotos
                  ? 'Optional — click an empty slot or Add photo to attach as many as you need.'
                  : 'Vehicle condition photos for this rental.'}
              </p>
              {takenByLabel ? (
                <p className="transaction-photo-credit">{takenByLabel}</p>
              ) : null}
            </div>
            {canEditCarPhotos ? (
              <div className="transaction-car-photos-actions">
                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => handleExtraFile(e.target.files?.[0], e.target)}
                />
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={Boolean(photoBusy)}
                  onClick={() => extraInputRef.current?.click()}
                >
                  {photoBusy === 'extra' ? 'Adding…' : 'Add photo'}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={Boolean(photoBusy) || !photoDirty}
                  onClick={() => setSaveConfirmOpen(true)}
                >
                  {photoBusy === 'save' ? 'Saving…' : 'Save photo'}
                </button>
              </div>
            ) : null}
          </div>

          {photoError ? <span className="error-msg">{photoError}</span> : null}
          {photoSuccess ? <span className="success-msg">{photoSuccess}</span> : null}

          <div className="transaction-photos transaction-car-photos">
            {CAR_SLOTS.map((slot) => {
              const preview = carPhotos?.[slot.key]
              const empty = !preview
              return (
                <figure key={slot.key} className="transaction-photo-card">
                  {preview ? (
                    <img src={preview} alt={`Car ${slot.label}`} />
                  ) : canEditCarPhotos ? (
                    <button
                      type="button"
                      className="transaction-photo-add"
                      disabled={Boolean(photoBusy)}
                      onClick={() => slotInputRefs.current[slot.key]?.click()}
                    >
                      <span>{photoBusy === slot.key ? 'Adding…' : 'Click to add'}</span>
                      <small>{slot.label}</small>
                    </button>
                  ) : (
                    <div className="transaction-photo-empty">No {slot.label.toLowerCase()} photo</div>
                  )}
                  <figcaption>{slot.label}</figcaption>
                  {canEditCarPhotos && preview ? (
                    <button
                      type="button"
                      className="btn-ghost btn-sm transaction-photo-remove"
                      disabled={Boolean(photoBusy)}
                      onClick={() => removeSlot(slot.key)}
                    >
                      Remove
                    </button>
                  ) : null}
                  {canEditCarPhotos && empty ? (
                    <input
                      ref={(el) => {
                        slotInputRefs.current[slot.key] = el
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(e) => handleSlotFile(slot.key, e.target.files?.[0], e.target)}
                    />
                  ) : null}
                </figure>
              )
            })}
            {extraPhotos.map((item, index) => (
              <figure key={item.id || `extra-${index}`} className="transaction-photo-card">
                <img src={item.uri} alt={item.label || `Extra ${index + 1}`} />
                <figcaption>
                  {item.label || `Extra ${index + 1}`}
                  {item.addedBy ? ` · ${item.addedBy}` : ''}
                </figcaption>
                {canEditCarPhotos ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm transaction-photo-remove"
                    disabled={Boolean(photoBusy)}
                    onClick={() => removeExtra(item.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </figure>
            ))}
            {canEditCarPhotos ? (
              <button
                type="button"
                className="transaction-photo-card transaction-photo-add-card"
                disabled={Boolean(photoBusy)}
                onClick={() => extraInputRef.current?.click()}
              >
                <span className="transaction-photo-add">
                  <span>{photoBusy === 'extra' ? 'Adding…' : '+ Add photo'}</span>
                  <small>Unlimited extras</small>
                </span>
                <figcaption>More photos</figcaption>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="transaction-grid">
        <article className="transaction-card">
          <h3>Lessee / Renter</h3>
          <dl className="transaction-dl">
            <div>
              <dt>Full Name</dt>
              <dd>{fullName(personal)}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{personal.address || '—'}</dd>
            </div>
            <div>
              <dt>Contact No.</dt>
              <dd>{personal.contactNo || '—'}</dd>
            </div>
            <div>
              <dt>Emergency Contact</dt>
              <dd>{formatEmergencyContact(personal)}</dd>
            </div>
            {personal.emergencyName && (
              <>
                <div>
                  <dt>Emergency Name</dt>
                  <dd>{personal.emergencyName}</dd>
                </div>
                <div>
                  <dt>Relationship</dt>
                  <dd>
                    {personal.emergencyRelation === 'Other'
                      ? personal.emergencyRelationOther || 'Other'
                      : personal.emergencyRelation || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Emergency No.</dt>
                  <dd>{personal.emergencyPhone || '—'}</dd>
                </div>
              </>
            )}
          </dl>
        </article>

        <article className="transaction-card">
          <h3>Vehicle</h3>
          <dl className="transaction-dl">
            <div>
              <dt>Make</dt>
              <dd>{vehicle.make || '—'}</dd>
            </div>
            <div>
              <dt>Series</dt>
              <dd>{vehicle.series || '—'}</dd>
            </div>
            <div>
              <dt>Type of Body</dt>
              <dd>{vehicle.bodyType || '—'}</dd>
            </div>
            <div>
              <dt>Plate No.</dt>
              <dd>{vehicle.plateNo || '—'}</dd>
            </div>
            <div>
              <dt>Engine No.</dt>
              <dd>{vehicle.engineNo || '—'}</dd>
            </div>
            <div>
              <dt>Chassis No.</dt>
              <dd>{vehicle.chassisNo || '—'}</dd>
            </div>
          </dl>
        </article>

        <article className="transaction-card">
          <h3>Rental Details</h3>
          <dl className="transaction-dl">
            <div>
              <dt>Duration</dt>
              <dd>{rental.duration || '—'}</dd>
            </div>
            <div>
              <dt>Rental Type</dt>
              <dd>{rental.rentalType || '—'}</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>{rental.periodFromLabel || formatDateTime(rental.periodFrom)}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{rental.periodToLabel || formatDateTime(rental.periodTo)}</dd>
            </div>
            <div>
              <dt>Rental Fee</dt>
              <dd>{rental.rentalFee || '—'}</dd>
            </div>
          </dl>
        </article>
      </div>

      <article className="transaction-contract">
        <div className="contract-heading-row">
          <h3>Rental Contract</h3>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => {
              void downloadContractPdf({ ...transaction, carPhotos })
            }}
          >
            Download PDF
          </button>
        </div>
        <p className="contract-intro">
          This agreement was acknowledged by <strong>{fullName(personal)}</strong> for the rental
          of <strong>
            {vehicle.make} {vehicle.series}
          </strong>{' '}
          ({vehicle.plateNo}) covering {rental.periodFromLabel || formatDateTime(rental.periodFrom)} to{' '}
          {rental.periodToLabel || formatDateTime(rental.periodTo)}.
        </p>

        <ol className="contract-terms">
          {CONTRACT_TERMS.map((item, index) => {
            if (item?.type === 'section') {
              return (
                <li key={item.title || index} className="terms-section-heading">
                  <strong>{item.title}</strong>
                </li>
              )
            }
            const num = getContractClauseNumber(CONTRACT_TERMS, index)
            return (
              <li key={item.title || index} value={num}>
                <strong>
                  {num}. {item.title}
                </strong>
                <p className="terms-item-body">{item.body}</p>
              </li>
            )
          })}
        </ol>

        <div className="contract-liability">
          <span className="contract-check">{transaction.termsAccepted ? '✓' : '—'}</span>
          <p>{LIABILITY_CLAUSE}</p>
        </div>

        <div className="contract-signature">
          <div>
            <span className="field-label">Lessee Acknowledgment</span>
            {signature ? (
              <img src={signature} alt="Customer signature" className="summary-signature" />
            ) : (
              <p className="signature-line">{fullName(personal)}</p>
            )}
            <small>Electronically accepted on {formatDateTime(transaction.encodedAt)}</small>
          </div>
          <div>
            <span className="field-label">Transaction Reference</span>
            <p className="signature-line">{transaction.id}</p>
            <small>System-generated rental contract record</small>
          </div>
        </div>
      </article>

      {saveConfirmOpen ? (
        <ConfirmModal
          title="Save vehicle photos?"
          message={`This photo is taken by ${sessionPhotographer || photographer || 'the current user'}. Do you want to save it?`}
          confirmLabel={photoBusy === 'save' ? 'Saving…' : 'Yes, save'}
          cancelLabel="Cancel"
          confirmDisabled={photoBusy === 'save'}
          onCancel={() => {
            if (photoBusy === 'save') return
            setSaveConfirmOpen(false)
          }}
          onConfirm={() => {
            void persistCarPhotos()
          }}
        />
      ) : null}
    </section>
  )
}
