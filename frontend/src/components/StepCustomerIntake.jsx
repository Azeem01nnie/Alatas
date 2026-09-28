import StepPersonalInfo from './StepPersonalInfo'
import StepPhoto from './StepPhoto'
import StepTerms from './StepTerms'

export default function StepCustomerIntake({
  personal,
  onPersonalChange,
  photo,
  licensePhoto,
  optionalPhoto,
  onHoldingChange,
  onLicenseChange,
  onOptionalChange,
  termsAccepted,
  onTermsAcceptedChange,
  signature,
  onSignatureChange,
  errors,
  bookingMode = false,
}) {
  const applySavedPhotos = (customer) => {
    if (!customer || customer.blacklisted) {
      onHoldingChange('')
      onLicenseChange('')
      onOptionalChange('')
      return
    }
    onHoldingChange(customer.holdingPhoto || '')
    onLicenseChange(customer.licensePhoto || '')
    onOptionalChange(customer.optionalPhoto || '')
  }

  return (
    <section className="step-panel step-customer-intake">
      <header className="intake-head">
        <div>
          <h2 className="step-title">Customer</h2>
          <p className="step-subtitle">
            {bookingMode
              ? 'Enter the customer information for this advance reservation.'
              : 'Details, license photos, and signature — one short form.'}
          </p>
        </div>
      </header>

      <div className="intake-sections">
        <div className="intake-section intake-personal">
          <h3 className="intake-section-title">Personal info</h3>
          <StepPersonalInfo
            data={personal}
            onChange={onPersonalChange}
            errors={errors}
            embedded
            onCustomerLoaded={applySavedPhotos}
          />
        </div>

        {bookingMode ? (
          <div className="intake-section intake-booking-notice">
            <h3 className="intake-section-title">Signature at pickup</h3>
            <p className="intake-section-hint">
              Save this reservation now. When the customer arrives, open the booking and select
              Use Confirmation to verify ID photos, record vehicle photos, and collect the final
              agreement signature.
            </p>
          </div>
        ) : (
          <>
        <div className="intake-section intake-photos">
          <h3 className="intake-section-title">ID photos</h3>
          <p className="intake-section-hint">
            Saved on the customer profile for next time. You can still replace them if the license
            changed.
          </p>
          <StepPhoto
            holdingPreview={photo}
            licensePreview={licensePhoto}
            optionalPreview={optionalPhoto}
            onHoldingChange={onHoldingChange}
            onLicenseChange={onLicenseChange}
            onOptionalChange={onOptionalChange}
            errors={errors}
            compact
          />
        </div>

        <div className="intake-section intake-terms">
          <h3 className="intake-section-title">Terms &amp; signature</h3>
          <StepTerms
            accepted={termsAccepted}
            onAcceptedChange={onTermsAcceptedChange}
            signature={signature}
            onSignatureChange={onSignatureChange}
            error={errors.terms}
            signatureError={errors.signature}
            compact
          />
        </div>
          </>
        )}
      </div>
    </section>
  )
}
