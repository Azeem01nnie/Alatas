import { useEffect, useState } from 'react'
import {
  formatRentalFee,
  parseRentalFeeAmount,
  resolveBalanceDue,
  resolveRentalQuoteTotal,
} from '../utils/rentalFee'

function digitsOnly(value) {
  return String(value ?? '').replace(/[^\d.]/g, '')
}

function sanitizeMoneyInput(raw) {
  const cleaned = digitsOnly(raw)
  const parts = cleaned.split('.')
  return parts.length <= 1
    ? cleaned
    : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
}

export default function StepPayment({
  rental,
  vehicle,
  amountPaidInput,
  onAmountPaidChange,
  discountInput,
  onDiscountChange,
  error,
  discountError,
}) {
  const [discountOpen, setDiscountOpen] = useState(
    () => String(discountInput || '').trim() !== '',
  )

  useEffect(() => {
    if (String(discountInput || '').trim() !== '') setDiscountOpen(true)
  }, [discountInput])

  const quoteTotal = resolveRentalQuoteTotal(rental)
  const discount = Math.min(
    quoteTotal,
    Math.max(0, parseRentalFeeAmount(discountInput)),
  )
  const total = Math.max(0, quoteTotal - discount)
  const paid = parseRentalFeeAmount(amountPaidInput)
  const balance = resolveBalanceDue({
    ...rental,
    totalAmount: total,
    amountPaid: paid,
  })

  const city = parseRentalFeeAmount(rental?.rentalFee)
  const outside =
    String(rental?.coverage || '').toLowerCase() === 'outside_city'
      ? parseRentalFeeAmount(rental?.outsideCityFee)
      : 0
  const driver =
    String(rental?.rentalType || '').toLowerCase() === 'with-driver'
      ? parseRentalFeeAmount(rental?.driverFee)
      : 0

  const onPaidChange = (raw) => {
    onAmountPaidChange(sanitizeMoneyInput(raw))
  }

  const onDiscChange = (raw) => {
    onDiscountChange(sanitizeMoneyInput(raw))
  }

  const fillFull = () => {
    onAmountPaidChange(total > 0 ? String(total) : '0')
  }

  const fillZero = () => {
    onAmountPaidChange('0')
  }

  return (
    <section className="step-panel step-payment">
      <header className="step-payment-head">
        <div>
          <h2 className="step-title">Payment</h2>
          <p className="step-subtitle">
            Confirm the rental total, record what was paid now, then continue to car photos.
          </p>
        </div>
        {vehicle ? (
          <div className="rental-vehicle-chip">
            {vehicle.image ? (
              <img src={vehicle.image} alt="" className="rental-vehicle-chip-thumb" />
            ) : (
              <div className="rental-vehicle-chip-thumb rental-vehicle-chip-thumb--empty" aria-hidden />
            )}
            <div>
              <strong>
                {vehicle.make} — {vehicle.series}
              </strong>
              <span>
                {vehicle.bodyType} · {vehicle.plateNo}
              </span>
            </div>
          </div>
        ) : null}
      </header>

      <div className="step-payment-grid">
        <div className="step-payment-breakdown">
          <h3 className="step-payment-section-title">Charges</h3>
          <ul className="step-payment-lines">
            <li>
              <span>City package</span>
              <strong>{city > 0 ? formatRentalFee(city) : '—'}</strong>
            </li>
            {outside > 0 ? (
              <li>
                <span>
                  Outside city
                  {rental.outsideCityDestinationName
                    ? ` · ${rental.outsideCityDestinationName}`
                    : ''}
                </span>
                <strong>{formatRentalFee(outside)}</strong>
              </li>
            ) : null}
            {driver > 0 ? (
              <li>
                <span>Driver wage</span>
                <strong>{formatRentalFee(driver)}</strong>
              </li>
            ) : null}
            {discount > 0 ? (
              <li className="is-discount">
                <span>Discount</span>
                <strong>−{formatRentalFee(discount)}</strong>
              </li>
            ) : null}
            <li className="is-total">
              <span>Total</span>
              <strong>{quoteTotal > 0 || discount > 0 ? formatRentalFee(total) : '—'}</strong>
            </li>
          </ul>
        </div>

        <div className="step-payment-receive">
          <h3 className="step-payment-section-title">Receive payment</h3>

          <div className="step-payment-discount">
            <button
              type="button"
              className={`step-payment-discount-toggle${discountOpen ? ' is-open' : ''}`}
              onClick={() => setDiscountOpen((open) => !open)}
              aria-expanded={discountOpen}
            >
              <span>Discount</span>
              <span className="step-payment-discount-arrow" aria-hidden>
                ›
              </span>
            </button>

            {discountOpen ? (
              <label className="field step-payment-discount-field">
                <span className="field-label">Discount amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountInput}
                  onChange={(e) => onDiscChange(e.target.value)}
                  placeholder="0"
                  className={discountError ? 'input-error' : ''}
                  aria-describedby="payment-discount-hint"
                  autoFocus
                />
                <span id="payment-discount-hint" className="field-hint">
                  Optional. Subtracted from the rental total before payment.
                </span>
                {discountError ? <span className="error-msg">{discountError}</span> : null}
              </label>
            ) : null}
          </div>

          <label className="field">
            <span className="field-label">Amount received</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountPaidInput}
              onChange={(e) => onPaidChange(e.target.value)}
              placeholder="0"
              className={error ? 'input-error' : ''}
              aria-describedby="payment-amount-hint"
            />
            <span id="payment-amount-hint" className="field-hint">
              Enter what the renter pays now. Leave 0 if collecting later.
            </span>
            {error ? <span className="error-msg">{error}</span> : null}
          </label>

          <div className="step-payment-quick">
            <button type="button" className="btn-outline" onClick={fillZero}>
              Pay later
            </button>
            <button type="button" className="btn-outline" onClick={fillFull} disabled={total <= 0}>
              Pay full
            </button>
          </div>

          <div className="step-payment-balance">
            <div>
              <span className="field-label">Received</span>
              <strong>{formatRentalFee(paid)}</strong>
            </div>
            <div>
              <span className="field-label">Balance due</span>
              <strong className={balance > 0 ? 'is-due' : 'is-settled'}>
                {formatRentalFee(balance)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
