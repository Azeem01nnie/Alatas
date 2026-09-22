import { useMemo, useState } from 'react'
import DamageInspectionModal from './DamageInspectionModal'
import { downloadDamageReportPdf } from '../utils/damageReportPdf'

const SETTLEMENT_LABELS = {
  for_assessment: 'For assessment',
  agrees_final: 'Agrees to final quote',
  paid: 'Paid',
  partial: 'Partial',
  other: 'Other',
}

function customerName(rental) {
  const p = rental?.personal || {}
  const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim()
  return name || 'Customer'
}

function inspectionOf(rental) {
  const insp = rental?.rental?.returnInspection
  if (!insp || typeof insp !== 'object' || Array.isArray(insp)) return null
  // Ignore accidental OK wrappers saved as inspection ({ condition: 'ok', ... })
  if (String(insp.condition || '').toLowerCase() === 'ok' && !insp.damageLocation) {
    return null
  }
  const hasDamageContent =
    Boolean(String(insp.damageLocation || '').trim()) ||
    Boolean(String(insp.damageDescription || '').trim()) ||
    (Array.isArray(insp.damageTypes) && insp.damageTypes.length > 0) ||
    String(insp.condition || '').toLowerCase() === 'damaged'
  return hasDamageContent ? insp : null
}

function isDamageRental(rental) {
  const condition = String(rental?.rental?.returnCondition || '').toLowerCase()
  const insp = inspectionOf(rental)
  // Only real damage completions with an inspection form — not OK returns.
  return condition === 'damaged' && Boolean(insp)
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString()
}

function toSortKey(rental, inspection) {
  return (
    inspection?.dateReturned ||
    inspection?.inspectionDate ||
    inspection?.submittedAt ||
    rental?.completedAt ||
    rental?.updatedAt ||
    rental?.createdAt ||
    ''
  )
}

export default function DamageReports({ rentals = [], vehicles = [], adminName = 'Admin' }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (Array.isArray(rentals) ? rentals : [])
      .filter(isDamageRental)
      .map((rental) => {
        const inspection = inspectionOf(rental) || {}
        const fleet = vehicles.find(
          (v) =>
            String(v.id) === String(rental.vehicleId || rental.vehicle?.id || '') ||
            (v.plateNo &&
              rental.vehicle?.plateNo &&
              String(v.plateNo).toUpperCase() === String(rental.vehicle.plateNo).toUpperCase()),
        )
        const plate =
          inspection.plateNo || rental.vehicle?.plateNo || fleet?.plateNo || '—'
        const vehicleLabel =
          inspection.makeModel ||
          `${rental.vehicle?.make || fleet?.make || ''} ${rental.vehicle?.series || fleet?.series || ''}`.trim() ||
          '—'
        const renter = inspection.renterName || customerName(rental)
        const dateKey = toSortKey(rental, inspection)
        return {
          id: rental.id,
          rental,
          inspection,
          fleet,
          dateKey,
          dateLabel: formatDate(dateKey),
          plate,
          vehicleLabel,
          renter,
          location: inspection.damageLocation || '—',
          settlement:
            SETTLEMENT_LABELS[inspection.settlement] ||
            inspection.settlement ||
            '—',
          types: Array.isArray(inspection.damageTypes)
            ? inspection.damageTypes.join(', ')
            : '—',
        }
      })
      .filter((row) => {
        if (!q) return true
        const hay = `${row.plate} ${row.vehicleLabel} ${row.renter} ${row.location} ${row.types}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))
  }, [rentals, vehicles, search])

  const handleDownloadRow = async (e, row) => {
    e.stopPropagation()
    try {
      await downloadDamageReportPdf(row.inspection, {
        plateNo: row.plate,
        makeModel: row.vehicleLabel,
        rentalId: row.id,
      })
    } catch (err) {
      console.error(err)
      window.alert(err?.message || 'Could not generate PDF.')
    }
  }

  return (
    <section className="damage-reports">
      <header className="damage-reports-header">
        <div>
          <h2 className="damage-reports-title">Damage Reports</h2>
          <p className="damage-reports-sub">
            Return inspections recorded when a rental was completed as damaged.
          </p>
        </div>
        <label className="field search-field damage-reports-search">
          <span className="field-label">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Plate, renter, vehicle…"
          />
        </label>
      </header>

      <div className="damage-reports-table-wrap">
        <table className="damage-reports-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Plate</th>
              <th>Vehicle</th>
              <th>Renter</th>
              <th>Damage</th>
              <th>Settlement</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  No damage reports yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="damage-reports-row"
                  tabIndex={0}
                  role="button"
                  aria-label={`Open damage report for ${row.plate}`}
                  onClick={() => setSelected(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(row)
                    }
                  }}
                >
                  <td>{row.dateLabel}</td>
                  <td>{row.plate}</td>
                  <td>{row.vehicleLabel}</td>
                  <td>{row.renter}</td>
                  <td>
                    <span className="damage-reports-loc">{row.location}</span>
                    {row.types !== '—' ? (
                      <span className="damage-reports-types">{row.types}</span>
                    ) : null}
                  </td>
                  <td>{row.settlement}</td>
                  <td className="damage-reports-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={(e) => handleDownloadRow(e, row)}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setSelected(row)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DamageInspectionModal
        open={Boolean(selected)}
        readOnly
        vehicle={selected?.fleet || selected?.rental?.vehicle}
        rental={selected?.rental}
        initialInspection={selected?.inspection || null}
        adminName={adminName}
        onCancel={() => setSelected(null)}
        onSubmit={async () => {}}
      />
    </section>
  )
}
