import { useCallback, useEffect, useRef, useState } from 'react'
import Stepper from './Stepper'
import StepCustomerIntake from './StepCustomerIntake'
import StepVehicle from './StepVehicle'
import StepRentalDetails from './StepRentalDetails'
import StepPayment from './StepPayment'
import StepCarCondition, { CAR_PHOTO_SLOTS } from './StepCarCondition'
import StepSummary from './StepSummary'
import LoadingScreen from './LoadingScreen'
import { useVehicles } from '../context/VehicleContext'
import { compressImageDataUrl, compressSignatureDataUrl } from '../utils/storage'
import { formatEmergencyContact, isCompletePhMobile } from '../utils/phone'
import {
  composeTime,
  formatPeriodLabel,
  isValidHour,
  isValidMinute,
  sanitizeTimePart,
  toPeriodDate,
} from '../utils/rentalPeriod'
import {
  parseDurationDays,
  formatDurationDaysLabel,
  buildRentalAutoPatch,
  formatRentalFee,
  parseRentalFeeAmount,
  resolveRentalQuoteTotal,
} from '../utils/rentalFee'
import { isCustomerBlacklisted, upsertCustomerFromPersonal } from '../utils/customers'

const TOTAL_STEPS = 5

const initialPersonal = {
  firstName: '',
  middleName: '',
  lastName: '',
  address: '',
  contactNo: '',
  emergencyName: '',
  emergencyRelation: '',
  emergencyRelationOther: '',
  emergencyPhone: '',
}

const initialRental = {
  duration: '',
  durationOther: '',
  rentalType: '',
  coverage: 'within_city',
  outsideCityDestinationId: '',
  outsideCityDestinationName: '',
  outsideCityFee: '',
  driverWagePerHour: '',
  driverBillableHours: null,
  driverFee: '',
  driverFeeNote: '',
  fromDate: '',
  fromHour: '',
  fromMinute: '',
  fromMeridiem: 'AM',
  toDate: '',
  toHour: '',
  toMinute: '',
  toMeridiem: 'AM',
  rentalFee: '',
  feeNote: '',
  feeHours: null,
}

const AUTO_CAPITALIZE_KEYS = new Set([
  'firstName',
  'middleName',
  'lastName',
  'address',
  'emergencyName',
  'emergencyRelationOther',
])

function forceUppercase(value) {
  return String(value ?? '').toUpperCase()
}

export default function RentCarForm({ onDirtyChange, encodedByName = '', autoApprove = false }) {
  const { vehicles, addRental } = useVehicles()
  const [step, setStep] = useState(1)
  const stepBodyRef = useRef(null)
  const [deskMode, setDeskMode] = useState('check_in') // check_in | booking
  const [personal, setPersonal] = useState(initialPersonal)
  const [vehicleId, setVehicleId] = useState('')
  const [rental, setRental] = useState(initialRental)
  const [photo, setPhoto] = useState('')
  const [licensePhoto, setLicensePhoto] = useState('')
  const [optionalPhoto, setOptionalPhoto] = useState('')
  const [signature, setSignature] = useState('')
  const [carPhotos, setCarPhotos] = useState({})
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [amountPaidInput, setAmountPaidInput] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('form') // form | loading
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)
  const quoteTotal = resolveRentalQuoteTotal(rental)
  const discountAmount = Math.min(
    quoteTotal,
    Math.max(0, parseRentalFeeAmount(discountInput)),
  )
  const netTotal = Math.max(0, quoteTotal - discountAmount)
  const amountPaid = parseRentalFeeAmount(amountPaidInput)
  const balanceDue = Math.max(0, netTotal - amountPaid)

  const isDirty =
    phase === 'form' &&
    (step > 1 ||
      Boolean(vehicleId) ||
      Boolean(photo) ||
      Boolean(licensePhoto) ||
      Boolean(optionalPhoto) ||
      Boolean(signature) ||
      termsAccepted ||
      CAR_PHOTO_SLOTS.some((slot) => Boolean(carPhotos[slot.key])) ||
      (Array.isArray(carPhotos.extras) && carPhotos.extras.length > 0) ||
      Object.values(personal).some((v) => String(v || '').trim()) ||
      Boolean(rental.duration) ||
      Boolean(rental.rentalType) ||
      Boolean(rental.fromDate) ||
      Boolean(rental.toDate) ||
      Boolean(rental.rentalFee) ||
      Boolean(rental.durationOther) ||
      amountPaidInput.trim() !== '' ||
      discountInput.trim() !== '')

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    return () => onDirtyChange?.(false)
  }, [onDirtyChange])

  const updatePersonal = (key, value) => {
    const nextValue = AUTO_CAPITALIZE_KEYS.has(key) ? forceUppercase(value) : value
    setPersonal((prev) => ({ ...prev, [key]: nextValue }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const updateRental = (keyOrPatch, value) => {
    const sanitizeKey = (key, val) => {
      if (
        key === 'fromHour' ||
        key === 'fromMinute' ||
        key === 'toHour' ||
        key === 'toMinute'
      ) {
        return sanitizeTimePart(val)
      }
      if (key === 'durationOther') {
        return forceUppercase(val)
      }
      return val
    }
    if (typeof keyOrPatch === 'object' && keyOrPatch !== null) {
      const patch = {}
      Object.entries(keyOrPatch).forEach(([key, val]) => {
        patch[key] = sanitizeKey(key, val)
      })
      setRental((prev) => ({ ...prev, ...patch }))
      setErrors((prev) => {
        const next = { ...prev }
        Object.keys(patch).forEach((key) => {
          next[key] = ''
        })
        return next
      })
      return
    }

    const key = keyOrPatch
    const nextValue = sanitizeKey(key, value)
    setRental((prev) => ({ ...prev, [key]: nextValue }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const updateCarPhoto = (key, value) => {
    setCarPhotos((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '', carPhotos: '' }))
  }

  // Car photos are optional — never keep required-slot errors around.
  useEffect(() => {
    if (step !== 4) return
    setErrors((prev) => {
      const next = { ...prev }
      let changed = false
      for (const slot of CAR_PHOTO_SLOTS) {
        if (next[slot.key]) {
          next[slot.key] = ''
          changed = true
        }
      }
      if (next.carPhotos) {
        next.carPhotos = ''
        changed = true
      }
      return changed ? next : prev
    })
  }, [step])

  const validateStep = (currentStep) => {
    const nextErrors = {}

    if (currentStep === 1) {
      if (!personal.firstName.trim()) nextErrors.firstName = 'First name is required'
      if (!personal.lastName.trim()) nextErrors.lastName = 'Last name is required'
      if (!personal.address.trim()) nextErrors.address = 'Address is required'
      if (!personal.contactNo.trim()) nextErrors.contactNo = 'Contact number is required'
      else if (!isCompletePhMobile(personal.contactNo)) {
        nextErrors.contactNo = 'Enter a valid number (e.g. +63 912 123 1234)'
      }
      if (!personal.emergencyName.trim()) {
        nextErrors.emergencyName = 'Emergency contact name is required'
      }
      if (!personal.emergencyRelation.trim()) {
        nextErrors.emergencyRelation = 'Relationship is required'
      } else if (
        personal.emergencyRelation === 'Other' &&
        !personal.emergencyRelationOther.trim()
      ) {
        nextErrors.emergencyRelationOther = 'Please specify the relationship'
      }
      if (!personal.emergencyPhone.trim()) {
        nextErrors.emergencyPhone = 'Emergency contact number is required'
      } else if (!isCompletePhMobile(personal.emergencyPhone)) {
        nextErrors.emergencyPhone = 'Enter a valid number (e.g. +63 912 123 1234)'
      }
      if (isCustomerBlacklisted(personal)) {
        nextErrors.contactNo = 'This customer is blacklisted and cannot be rented to'
      }
      if (!photo) nextErrors.photo = 'Add a photo of the customer holding their license'
      if (!licensePhoto) nextErrors.licensePhoto = 'Add a clear photo of the customer'
      if (!signature) nextErrors.signature = 'Customer signature is required'
      if (!termsAccepted) nextErrors.terms = 'You must accept the terms to continue'
    }

    if (currentStep === 2) {
      if (!vehicleId) nextErrors.vehicle = 'Please select a vehicle and click Proceed'

      if (!rental.duration) nextErrors.duration = 'Select a duration'
      if (rental.duration === 'Others') {
        const days = parseDurationDays(rental.durationOther)
        if (!days) nextErrors.durationOther = 'Enter the number of days'
      }
      if (!rental.rentalType) nextErrors.rentalType = 'Select a rental type'

      if (rental.coverage === 'outside_city' && !String(rental.outsideCityDestinationId || '').trim()) {
        nextErrors.outsideCityDestinationId = 'Select an outside-city destination'
      }

      if (
        rental.rentalType === 'With-driver' &&
        rental.duration &&
        !(Number(String(rental.driverFee || '').replace(/[^\d.]/g, '')) > 0)
      ) {
        nextErrors.driverFee =
          'Set driver wage/hour in Settings → Rates & extras before booking With-driver'
      }

      if (!rental.fromDate) nextErrors.fromDate = 'From date is required'
      if (!rental.fromHour.trim()) nextErrors.fromHour = 'From hour is required'
      else if (!isValidHour(rental.fromHour)) nextErrors.fromHour = 'Hour must be 1–12'
      if (rental.fromMinute.trim() === '') nextErrors.fromMinute = 'From minute is required'
      else if (!isValidMinute(rental.fromMinute)) {
        nextErrors.fromMinute = 'Minute must be 0–59'
      }
      if (!rental.fromMeridiem) nextErrors.fromMeridiem = 'Select AM or PM'

      if (!rental.toDate) nextErrors.toDate = 'To date is required'
      if (!rental.toHour.trim()) nextErrors.toHour = 'To hour is required'
      else if (!isValidHour(rental.toHour)) nextErrors.toHour = 'Hour must be 1–12'
      if (rental.toMinute.trim() === '') nextErrors.toMinute = 'To minute is required'
      else if (!isValidMinute(rental.toMinute)) nextErrors.toMinute = 'Minute must be 0–59'
      if (!rental.toMeridiem) nextErrors.toMeridiem = 'Select AM or PM'

      const fromTime = composeTime(rental.fromHour, rental.fromMinute)
      const toTime = composeTime(rental.toHour, rental.toMinute)
      const fromDt = toPeriodDate(rental.fromDate, fromTime, rental.fromMeridiem)
      const toDt = toPeriodDate(rental.toDate, toTime, rental.toMeridiem)

      if (fromDt && toDt && toDt.getTime() <= fromDt.getTime()) {
        nextErrors.toDate = 'To must be after From'
      }

      if (fromDt) {
        const startMs = fromDt.getTime()
        if (deskMode === 'booking' && startMs <= Date.now()) {
          nextErrors.fromHour = 'Booking start must be in the future'
        } else if (deskMode === 'check_in' && startMs < Date.now() - 15 * 60_000) {
          nextErrors.fromHour = 'Check-in start cannot be far in the past'
        }
      }

      if (!rental.rentalFee.trim()) nextErrors.rentalFee = 'Rental fee is required'
    }

    if (currentStep === 3) {
      const total = resolveRentalQuoteTotal(rental)
      const disc = parseRentalFeeAmount(discountInput)
      if (discountInput.trim() !== '' && disc < 0) {
        nextErrors.discount = 'Discount cannot be negative'
      } else if (disc > total + 0.009) {
        nextErrors.discount = 'Discount cannot exceed the rental total'
      }
      const net = Math.max(0, total - Math.min(total, Math.max(0, disc)))
      if (!(total > 0)) {
        nextErrors.amountPaid = 'Rental total is missing. Go back and complete rental details.'
      } else {
        const paid = parseRentalFeeAmount(amountPaidInput)
        if (amountPaidInput.trim() === '') {
          nextErrors.amountPaid = 'Enter amount received (0 if collecting later)'
        } else if (paid < 0) {
          nextErrors.amountPaid = 'Amount cannot be negative'
        } else if (paid > net + 0.009) {
          nextErrors.amountPaid = 'Amount received cannot exceed the total after discount'
        }
      }
    }

    // Step 4 car photos are optional.

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleReset = useCallback(() => {
    setStep(1)
    setDeskMode('check_in')
    setPersonal(initialPersonal)
    setVehicleId('')
    setRental(initialRental)
    setPhoto('')
    setLicensePhoto('')
    setOptionalPhoto('')
    setSignature('')
    setCarPhotos({})
    setTermsAccepted(false)
    setAmountPaidInput('')
    setDiscountInput('')
    setErrors({})
    setSubmitError('')
    setSubmitting(false)
    setPhase('form')
  }, [])

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError('')

    try {
      if (!selectedVehicle) {
        setSubmitError('Selected vehicle is no longer available. Please go back and choose again.')
        setStep(2)
        setSubmitting(false)
        return
      }
      if (isCustomerBlacklisted(personal)) {
        setSubmitError('This customer is blacklisted and cannot be rented to.')
        setSubmitting(false)
        return
      }

      const compressedPhoto = await compressImageDataUrl(photo || '')
      const compressedLicense = await compressImageDataUrl(licensePhoto || '')
      const compressedOptional = optionalPhoto
        ? (await compressImageDataUrl(optionalPhoto)) || optionalPhoto
        : ''
      const compressedSignature = signature
        ? (await compressSignatureDataUrl(signature, 640, 0.92)) || signature
        : ''

      const compressedCarPhotos = {}
      for (const slot of CAR_PHOTO_SLOTS) {
        const raw = carPhotos[slot.key]
        if (!raw) continue
        const compressed = await compressImageDataUrl(raw)
        if (compressed) compressedCarPhotos[slot.key] = compressed
      }
      if (Array.isArray(carPhotos.extras) && carPhotos.extras.length) {
        const extras = []
        for (const [index, item] of carPhotos.extras.entries()) {
          if (!item?.uri) continue
          const compressed = await compressImageDataUrl(item.uri)
          if (!compressed) continue
          extras.push({
            id: item.id || `extra-${index}`,
            uri: compressed,
            label: item.label || `Extra ${index + 1}`,
          })
        }
        if (extras.length) compressedCarPhotos.extras = extras
      }

      const vehicleImage =
        selectedVehicle.image && /^https?:\/\//i.test(selectedVehicle.image)
          ? selectedVehicle.image
          : selectedVehicle.image && selectedVehicle.image.length < 180_000
            ? selectedVehicle.image
            : ''

      const fromTime = composeTime(rental.fromHour, rental.fromMinute)
      const toTime = composeTime(rental.toHour, rental.toMinute)
      const fromDt = toPeriodDate(rental.fromDate, fromTime, rental.fromMeridiem)
      const toDt = toPeriodDate(rental.toDate, toTime, rental.toMeridiem)

      if (fromDt) {
        const startMs = fromDt.getTime()
        if (deskMode === 'booking' && startMs <= Date.now()) {
          setErrors({ fromHour: 'Booking start must be in the future' })
          setStep(3)
          setSubmitting(false)
          return
        }
        if (deskMode === 'check_in' && startMs < Date.now() - 15 * 60_000) {
          setErrors({ fromHour: 'Check-in start cannot be far in the past' })
          setStep(3)
          setSubmitting(false)
          return
        }
      }

      const periodFromLabel = formatPeriodLabel(
        rental.fromDate,
        fromTime,
        rental.fromMeridiem,
      )
      const periodToLabel = formatPeriodLabel(rental.toDate, toTime, rental.toMeridiem)

      const encoder = String(encodedByName || '').trim() || 'Unknown'
      const safe = (value) => String(value ?? '').trim()
      const isMobileClient =
        typeof window !== 'undefined' &&
        (window.matchMedia('(max-width: 860px)').matches ||
          /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''))
      const record = {
        personal: {
          ...personal,
          firstName: safe(personal.firstName),
          middleName: safe(personal.middleName),
          lastName: safe(personal.lastName),
          address: safe(personal.address),
          contactNo: safe(personal.contactNo),
          emergencyContact: formatEmergencyContact(personal),
          encodedBy: encoder,
          ...(compressedOptional ? { optionalPhoto: compressedOptional } : {}),
        },
        vehicleId: selectedVehicle.id,
        vehicle: {
          id: selectedVehicle.id,
          make: selectedVehicle.make,
          series: selectedVehicle.series,
          plateNo: selectedVehicle.plateNo,
          bodyType: selectedVehicle.bodyType,
          engineNo: selectedVehicle.engineNo,
          chassisNo: selectedVehicle.chassisNo,
          image: vehicleImage,
          rates: selectedVehicle.rates || null,
        },
        rental: {
          deskMode,
          duration:
            rental.duration === 'Others' ? rental.durationOther : rental.duration,
          rentalType: rental.rentalType,
          coverage: rental.coverage === 'outside_city' ? 'outside_city' : 'within_city',
          outsideCityDestinationId:
            rental.coverage === 'outside_city'
              ? String(rental.outsideCityDestinationId || '').trim()
              : '',
          outsideCityDestinationName:
            rental.coverage === 'outside_city'
              ? String(rental.outsideCityDestinationName || '').trim()
              : '',
          outsideCityFee:
            rental.coverage === 'outside_city'
              ? String(rental.outsideCityFee || '').trim()
              : '',
          driverWagePerHour:
            rental.rentalType === 'With-driver'
              ? String(rental.driverWagePerHour || '').trim()
              : '',
          driverBillableHours:
            rental.rentalType === 'With-driver' ? rental.driverBillableHours : null,
          driverFee:
            rental.rentalType === 'With-driver'
              ? String(rental.driverFee || '').trim()
              : '',
          driverFeeNote:
            rental.rentalType === 'With-driver'
              ? String(rental.driverFeeNote || '').trim()
              : '',
          rentalFee: rental.rentalFee,
          discountAmount: discountAmount > 0 ? formatRentalFee(discountAmount) : '',
          discountAmountValue: discountAmount,
          totalAmount: formatRentalFee(netTotal),
          totalAmountValue: netTotal,
          amountPaid: formatRentalFee(amountPaid),
          amountPaidValue: amountPaid,
          initialPayment: formatRentalFee(amountPaid),
          initialPaymentValue: amountPaid,
          balanceDue: formatRentalFee(balanceDue),
          balanceDueValue: balanceDue,
          fromDate: rental.fromDate,
          fromHour: rental.fromHour,
          fromMinute: rental.fromMinute,
          fromTime,
          fromMeridiem: rental.fromMeridiem,
          toDate: rental.toDate,
          toHour: rental.toHour,
          toMinute: rental.toMinute,
          toTime,
          toMeridiem: rental.toMeridiem,
          periodFrom: fromDt ? fromDt.toISOString() : periodFromLabel,
          periodTo: toDt ? toDt.toISOString() : periodToLabel,
          periodFromLabel,
          periodToLabel,
        },
        photo: compressedPhoto,
        licensePhoto: compressedLicense,
        signature: compressedSignature,
        carPhotos: compressedCarPhotos,
        termsAccepted,
        deskMode,
        encodedAt: new Date().toISOString(),
        encodedBy: encoder,
        autoApprove: Boolean(autoApprove),
        source: isMobileClient ? 'mobile' : 'desktop',
      }

      await addRental(record)
      try {
        upsertCustomerFromPersonal(record.personal, {
          holdingPhoto: compressedPhoto,
          licensePhoto: compressedLicense,
          optionalPhoto: compressedOptional,
        })
      } catch (custErr) {
        console.warn('Could not save customer profile', custErr)
      }
      setPhase('loading')
    } catch (err) {
      console.error('Submit failed:', err)
      setSubmitError(
        err?.message ||
          'Could not save this registration. Check your connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = async () => {
    if (step === 2 && rental.duration === 'Others') {
      const labeled = formatDurationDaysLabel(rental.durationOther)
      if (labeled && labeled !== rental.durationOther) {
        const next = { ...rental, durationOther: labeled }
        const auto = buildRentalAutoPatch(next, selectedVehicle?.rates)
        setRental({ ...next, ...auto })
      }
    }
    // Step 4 (car photos) is fully optional — always allow continue.
    if (step === 4) {
      setErrors((prev) => {
        const next = { ...prev }
        for (const slot of CAR_PHOTO_SLOTS) next[slot.key] = ''
        next.carPhotos = ''
        return next
      })
      setStep(5)
      return
    }
    if (!validateStep(step)) return
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1)
    } else {
      await handleSubmit()
    }
  }

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1)
  }

  useEffect(() => {
    const body = stepBodyRef.current
    if (body) body.scrollTop = 0
    body?.closest('.admin-main-panel')?.scrollTo?.(0, 0)
  }, [step])

  if (phase === 'loading') {
    return <LoadingScreen onDone={handleReset} />
  }

  const nextDisabled = step === 1 && (!termsAccepted || !signature)

  return (
    <div className="encoder-card rent-car-panel">
      <div className="rent-desk-mode" role="group" aria-label="Rental desk mode">
        <button
          type="button"
          className={`rent-desk-mode-btn${deskMode === 'check_in' ? ' is-active' : ''}`}
          aria-pressed={deskMode === 'check_in'}
          onClick={() => setDeskMode('check_in')}
        >
          Check in
        </button>
        <button
          type="button"
          className={`rent-desk-mode-btn${deskMode === 'booking' ? ' is-active' : ''}`}
          aria-pressed={deskMode === 'booking'}
          onClick={() => setDeskMode('booking')}
        >
          Booking
        </button>
        <p className="rent-desk-mode-hint">
          {deskMode === 'check_in'
            ? 'Walk-in / start now — vehicle goes on rent when accepted.'
            : 'Advance reservation — stays scheduled until the start time.'}
        </p>
      </div>

      <Stepper currentStep={step} />

      <div className="encoder-body" ref={stepBodyRef}>
        {step === 1 && (
          <StepCustomerIntake
            personal={personal}
            onPersonalChange={updatePersonal}
            photo={photo}
            licensePhoto={licensePhoto}
            optionalPhoto={optionalPhoto}
            onHoldingChange={(next) => {
              setPhoto(next)
              setErrors((prev) => ({ ...prev, photo: '' }))
            }}
            onLicenseChange={(next) => {
              setLicensePhoto(next)
              setErrors((prev) => ({ ...prev, licensePhoto: '' }))
            }}
            onOptionalChange={(next) => {
              setOptionalPhoto(next)
              setErrors((prev) => ({ ...prev, optionalPhoto: '' }))
            }}
            termsAccepted={termsAccepted}
            onTermsAcceptedChange={(val) => {
              setTermsAccepted(val)
              setErrors((prev) => ({ ...prev, terms: '' }))
            }}
            signature={signature}
            onSignatureChange={(val) => {
              setSignature(val)
              setErrors((prev) => ({ ...prev, signature: '', terms: '' }))
            }}
            errors={errors}
          />
        )}
        {step === 2 && (
          <div className="step-vehicle-rental">
            <StepVehicle
              selectedId={vehicleId}
              onSelect={(id) => {
                setVehicleId(id)
                setErrors((prev) => ({ ...prev, vehicle: '' }))
              }}
              error={errors.vehicle}
            />
            <StepRentalDetails
              data={rental}
              onChange={updateRental}
              errors={errors}
              vehicle={selectedVehicle}
            />
          </div>
        )}
        {step === 3 && (
          <StepPayment
            rental={rental}
            vehicle={selectedVehicle}
            amountPaidInput={amountPaidInput}
            onAmountPaidChange={(next) => {
              setAmountPaidInput(next)
              setErrors((prev) => ({ ...prev, amountPaid: '' }))
            }}
            discountInput={discountInput}
            onDiscountChange={(next) => {
              setDiscountInput(next)
              setErrors((prev) => ({ ...prev, discount: '' }))
            }}
            error={errors.amountPaid}
            discountError={errors.discount}
          />
        )}
        {step === 4 && (
          <StepCarCondition
            photos={carPhotos}
            onChange={updateCarPhoto}
            errors={{}}
          />
        )}
        {step === 5 && (
          <StepSummary
            personal={personal}
            vehicle={selectedVehicle}
            rental={{
              ...rental,
              discountAmount: discountAmount > 0 ? formatRentalFee(discountAmount) : '',
              totalAmount: formatRentalFee(netTotal),
              amountPaid: formatRentalFee(amountPaid),
              balanceDue: formatRentalFee(balanceDue),
            }}
            photo={photo}
            licensePhoto={licensePhoto}
            optionalPhoto={optionalPhoto}
            signature={signature}
            carPhotos={carPhotos}
            termsAccepted={termsAccepted}
          />
        )}
        {submitError && <p className="error-msg error-center">{submitError}</p>}
      </div>

      <footer className="step-nav">
        <button
          type="button"
          className="btn-ghost"
          onClick={handleBack}
          disabled={step === 1 || submitting}
        >
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleNext}
          disabled={nextDisabled || submitting}
        >
          {submitting ? 'Saving…' : step === TOTAL_STEPS ? 'Submit' : 'Next'}
        </button>
      </footer>
    </div>
  )
}
