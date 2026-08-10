import { jsPDF } from 'jspdf'
import { CONTRACT_TERMS, LIABILITY_CLAUSE, formatContractTerm } from '../data/contract'
import { formatEmergencyContact } from '../utils/phone'

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

async function downloadContractPdf(transaction) {
  const { personal = {}, vehicle = {}, rental = {}, photo, licensePhoto } = transaction
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

  const centerText = (text, opts = {}) => {
    const { size = 11, style = 'normal', gap = 14, color = [17, 17, 17] } = opts
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(String(text), pageWidth / 2, y, { align: 'center' })
    y += gap
  }

  const writeBlock = (text, x, width, opts = {}) => {
    const { size = 9, style = 'normal', color = [17, 17, 17], lineHeight = 12 } = opts
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(String(text), width)
    return { lines, lineHeight, height: lines.length * lineHeight }
  }

  // Centered company branding
  centerText('ALATAS CAR RENTAL SERVICES', { size: 16, style: 'bold', gap: 16 })
  centerText('Rental Contract Agreement', { size: 11, style: 'normal', gap: 12 })
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
    doc.text(title, x, y)

    let localY = y + 14
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      const labelLines = doc.splitTextToSize(label.toUpperCase(), colWidth)
      labelLines.forEach((line) => {
        doc.text(line, x, localY)
        localY += 9
      })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(17, 17, 17)
      const valueLines = doc.splitTextToSize(String(value || '—'), colWidth)
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
    const block = writeBlock(formatContractTerm(term, index), margin, contentWidth, {
      size: 8.5,
      lineHeight: 11,
    })
    ensureSpace(block.height + 4)
    block.lines.forEach((line) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(17, 17, 17)
      doc.text(line, margin, y)
      y += 11
    })
    y += 3
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
  ensureSpace(50)
  const half = contentWidth / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('LESSEE ACKNOWLEDGMENT', margin, y)
  doc.text('TRANSACTION REFERENCE', margin + half + 10, y)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 17, 17)
  doc.text(name, margin, y)
  doc.text(String(transaction.id), margin + half + 10, y)
  y += 6
  doc.setLineWidth(0.6)
  doc.line(margin, y, margin + half - 20, y)
  doc.line(margin + half + 10, y, pageWidth - margin, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`Electronically accepted on ${formatDateTime(transaction.encodedAt)}`, margin, y)
  doc.text('Alatas Car Rental Services', margin + half + 10, y)

  // Customer / license photos
  y += 28
  ensureSpace(220)
  doc.setDrawColor(17, 17, 17)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 17, 17)
  doc.text('CUSTOMER PHOTOS', margin, y)
  y += 14

  const embedImages = []
  if (photo && typeof photo === 'string' && photo.startsWith('data:image')) {
    embedImages.push({ src: photo, label: 'Holding license' })
  }
  if (licensePhoto && typeof licensePhoto === 'string' && licensePhoto.startsWith('data:image')) {
    embedImages.push({ src: licensePhoto, label: 'License' })
  }

  if (embedImages.length > 0) {
    try {
      const photoGap = 14
      const slotW = (contentWidth - photoGap) / Math.max(embedImages.length, 2)
      const maxH = 160
      let rowH = 0

      for (let index = 0; index < embedImages.length; index += 1) {
        const item = embedImages[index]
        const props = doc.getImageProperties(item.src)
        const ratio = Math.min(slotW / props.width, maxH / props.height, 1)
        const imgW = props.width * ratio
        const imgH = props.height * ratio
        const colorFormat = /image\/png/i.test(item.src) ? 'PNG' : 'JPEG'
        const x = margin + index * (slotW + photoGap) + (slotW - imgW) / 2
        ensureSpace(imgH + 24)
        doc.addImage(item.src, colorFormat, x, y, imgW, imgH)
        doc.setDrawColor(17, 17, 17)
        doc.setLineWidth(0.5)
        doc.rect(x, y, imgW, imgH)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(80, 80, 80)
        doc.text(item.label, x + imgW / 2, y + imgH + 12, { align: 'center' })
        rowH = Math.max(rowH, imgH + 18)
      }
      y += rowH + 8
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text('Customer photos could not be embedded in this PDF.', margin, y)
    }
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('No customer photos on file.', margin, y)
  }

  const safeName = name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'contract'
  doc.save(`Alatas_Contract_${safeName}_${transaction.id}.pdf`)
}

export default function TransactionPage({
  transaction,
  onBack,
  backLabel = '← Back to History',
}) {
  const { personal = {}, vehicle = {}, rental = {}, photo, licensePhoto } = transaction

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
              void downloadContractPdf(transaction)
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
        </p>
      </header>

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
            <img src={licensePhoto} alt="Driver license" />
          ) : (
            <div className="transaction-photo-empty">No license photo</div>
          )}
          <figcaption>License Photo</figcaption>
        </figure>
        <figure className="transaction-photo-card">
          {vehicle.image ? (
            <img src={vehicle.image} alt={`${vehicle.make || 'Vehicle'}`} />
          ) : (
            <div className="transaction-photo-empty">No vehicle image</div>
          )}
          <figcaption>Vehicle Photo</figcaption>
        </figure>
      </div>

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
              void downloadContractPdf(transaction)
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
          {CONTRACT_TERMS.map((item, index) => (
            <li key={typeof item === 'string' ? item : item.title || index}>
              {typeof item === 'string' ? (
                item
              ) : (
                <>
                  <strong>{item.title}</strong>
                  <p className="terms-item-body">{item.body}</p>
                </>
              )}
            </li>
          ))}
        </ol>

        <div className="contract-liability">
          <span className="contract-check">{transaction.termsAccepted ? '✓' : '—'}</span>
          <p>{LIABILITY_CLAUSE}</p>
        </div>

        <div className="contract-signature">
          <div>
            <span className="field-label">Lessee Acknowledgment</span>
            <p className="signature-line">{fullName(personal)}</p>
            <small>Electronically accepted on {formatDateTime(transaction.encodedAt)}</small>
          </div>
          <div>
            <span className="field-label">Transaction Reference</span>
            <p className="signature-line">{transaction.id}</p>
            <small>System-generated rental contract record</small>
          </div>
        </div>
      </article>
    </section>
  )
}
