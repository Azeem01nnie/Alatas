import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  buildXZReading,
  formatPesoXZ,
  getOpenPeriodBounds,
  listZCloses,
  loadXZStore,
  recordZClose,
  resetXZHistory,
} from '../utils/xzReadings'

function formatRange(from, to) {
  if (!from || !to) return '—'
  return `${from.toLocaleString()} → ${to.toLocaleString()}`
}

function downloadReadingPdf(kind, reading, closedBy = '') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(kind === 'Z' ? 'Z-Reading (End of period)' : 'X-Reading (Interim)', margin, y)
  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Period: ${formatRange(reading.from, reading.to)}`, margin, y)
  y += 14
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
  y += 14
  if (closedBy) {
    doc.text(`Closed by: ${closedBy}`, margin, y)
    y += 14
  }
  doc.text(`Rentals: ${reading.count}`, margin, y)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.text(`Total sales: ${formatPesoXZ(reading.revenue)}`, margin, y)
  y += 20
  doc.setFont('helvetica', 'normal')

  doc.setFont('helvetica', 'bold')
  doc.text('Date', margin, y)
  doc.text('Customer', margin + 110, y)
  doc.text('Plate', margin + 250, y)
  doc.text('Amount', margin + 340, y)
  y += 12
  doc.setFont('helvetica', 'normal')

  for (const row of reading.lines || []) {
    if (y > 760) {
      doc.addPage()
      y = margin
    }
    doc.text(String(row.dateLabel || '').slice(0, 22), margin, y)
    doc.text(String(row.customer || '').slice(0, 18), margin + 110, y)
    doc.text(String(row.plate || ''), margin + 250, y)
    doc.text(formatPesoXZ(row.amount), margin + 340, y)
    y += 12
  }

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`${kind}_Reading_${stamp}.pdf`)
}

export default function XZReadings({ rentals = [], vehicles = [], adminName = 'Admin' }) {
  const [storeVersion, setStoreVersion] = useState(0)
  const [tick, setTick] = useState(0)
  const [confirmZ, setConfirmZ] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState('')

  // Keep period end at "now" while this tab stays open so new sales appear.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 5_000)
    return () => window.clearInterval(id)
  }, [])

  const store = useMemo(() => loadXZStore(), [storeVersion])
  const reading = useMemo(() => {
    const bounds = getOpenPeriodBounds(new Date(), store)
    return buildXZReading(rentals, bounds, store, vehicles)
  }, [rentals, store, vehicles, storeVersion, tick])
  const zHistory = useMemo(() => listZCloses(store), [store])

  const refresh = () => setStoreVersion((n) => n + 1)

  const handleTakeX = () => {
    const live = buildXZReading(rentals, getOpenPeriodBounds(new Date(), store), store, vehicles)
    downloadReadingPdf('X', live)
    setMessage('X-reading PDF downloaded (period not closed).')
    setTimeout(() => setMessage(''), 2500)
  }

  const handleConfirmZ = () => {
    const live = buildXZReading(rentals, getOpenPeriodBounds(new Date(), store), store, vehicles)
    const entry = recordZClose({ reading: live, closedBy: adminName })
    downloadReadingPdf('Z', live, entry.closedBy)
    setConfirmZ(false)
    refresh()
    setMessage('Z-reading closed and PDF downloaded. New period started.')
    setTimeout(() => setMessage(''), 3500)
  }

  const handleResetHistory = () => {
    resetXZHistory()
    setConfirmReset(false)
    refresh()
    setMessage('Z history cleared. Open period now starts from today.')
    setTimeout(() => setMessage(''), 3500)
  }

  const acceptedRentals = Array.isArray(rentals)
    ? rentals.filter((r) => {
        const a = String(r?.approvalStatus || 'accepted').toLowerCase()
        const life = String(r?.rentalLifecycle || '').toLowerCase()
        return a !== 'pending' && a !== 'rejected' && life !== 'pending_approval' && life !== 'cancelled'
      }).length
    : 0

  return (
    <section className="xz-readings">
      <header className="xz-readings-header">
        <div>
          <h2 className="xz-readings-title">X &amp; Z Readings</h2>
          <p className="xz-readings-sub">
            Point-of-sale style cash reports for rental sales. <strong>X</strong> is an interim
            snapshot; <strong>Z</strong> closes the current period.
          </p>
        </div>
        {message ? <span className="admin-success">{message}</span> : null}
      </header>

      <div className="xz-period-card">
        <div>
          <p className="xz-period-label">Open period</p>
          <p className="xz-period-range">{formatRange(reading.from, reading.to)}</p>
          <p className="xz-period-meta">
            {reading.sinceZ
              ? `Since last Z-close (${new Date(reading.lastClose.closedAt).toLocaleString()})`
              : 'Since start of today (no Z-close yet)'}
          </p>
          {acceptedRentals === 0 ? (
            <p className="xz-period-meta">
              No rentals loaded yet. Import your backup or encode a rental first.
            </p>
          ) : null}
        </div>
        <div className="xz-period-stats">
          <div>
            <span className="xz-stat-label">Rentals</span>
            <strong className="xz-stat-value">{reading.count}</strong>
          </div>
          <div>
            <span className="xz-stat-label">Sales total</span>
            <strong className="xz-stat-value xz-stat-money">{formatPesoXZ(reading.revenue)}</strong>
          </div>
          <div>
            <span className="xz-stat-label">Average</span>
            <strong className="xz-stat-value">{formatPesoXZ(reading.average)}</strong>
          </div>
        </div>
      </div>

      <div className="xz-actions">
        <button type="button" className="btn-outline" onClick={refresh}>
          Refresh
        </button>
        <button type="button" className="btn-outline" onClick={handleTakeX}>
          Take X-reading
        </button>
        <button type="button" className="btn-primary" onClick={() => setConfirmZ(true)}>
          Take Z-reading (close period)
        </button>
        <button type="button" className="btn-ghost" onClick={() => setConfirmReset(true)}>
          Reset Z history
        </button>
      </div>

      <div className="xz-table-wrap">
        <div className="xz-table-head">
          <h3>Current period sales</h3>
          <span>{reading.count} line{reading.count === 1 ? '' : 's'}</span>
        </div>
        <table className="xz-table">
          <thead>
            <tr>
              <th>Date / time</th>
              <th>Customer</th>
              <th>Plate</th>
              <th>Vehicle</th>
              <th>Duration</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {reading.lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No rental sales in this open period yet.
                </td>
              </tr>
            ) : (
              reading.lines.map((row) => (
                <tr key={row.rentalId}>
                  <td>{row.dateLabel}</td>
                  <td>{row.customer}</td>
                  <td>{row.plate}</td>
                  <td>{row.vehicle}</td>
                  <td>{row.duration}</td>
                  <td className="xz-amount">{formatPesoXZ(row.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Period total</td>
              <td className="xz-amount">{formatPesoXZ(reading.revenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="xz-table-wrap">
        <div className="xz-table-head">
          <h3>Z-reading history</h3>
          <span>{zHistory.length} close{zHistory.length === 1 ? '' : 's'}</span>
        </div>
        <table className="xz-table">
          <thead>
            <tr>
              <th>Closed at</th>
              <th>Period</th>
              <th>Rentals</th>
              <th>Total</th>
              <th>Closed by</th>
            </tr>
          </thead>
          <tbody>
            {zHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No Z-readings yet. Take a Z-reading to close the first period.
                </td>
              </tr>
            ) : (
              zHistory.map((z) => (
                <tr key={z.id}>
                  <td>{new Date(z.closedAt).toLocaleString()}</td>
                  <td>
                    {new Date(z.periodFrom).toLocaleString()} →{' '}
                    {new Date(z.periodTo).toLocaleString()}
                  </td>
                  <td>{z.count}</td>
                  <td className="xz-amount">{formatPesoXZ(z.revenue)}</td>
                  <td>{z.closedBy || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmZ ? (
        <div
          className="modal-overlay confirm-modal-overlay"
          role="presentation"
          onClick={() => setConfirmZ(false)}
        >
          <div
            className="modal-panel confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="xz-z-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="xz-z-title" className="modal-title">
              Take Z-reading?
            </h3>
            <p className="confirm-message">
              This closes the current sales period with{' '}
              <strong>{reading.count}</strong> rental
              {reading.count === 1 ? '' : 's'} totaling{' '}
              <strong>{formatPesoXZ(reading.revenue)}</strong>. A PDF will download and a new
              period will start from now. This cannot be undone from the desk.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-outline confirm-cancel-btn"
                onClick={() => setConfirmZ(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleConfirmZ}>
                Close period (Z)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmReset ? (
        <div
          className="modal-overlay confirm-modal-overlay"
          role="presentation"
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="modal-panel confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="xz-reset-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="xz-reset-title" className="modal-title">
              Reset Z history?
            </h3>
            <p className="confirm-message">
              This clears all saved Z-closes on this computer and restarts the open period from
              the start of today. Use this after switching Supabase or if totals look stuck.
              Rental data is not deleted.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-outline confirm-cancel-btn"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleResetHistory}>
                Reset Z history
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
