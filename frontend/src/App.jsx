import { useCallback, useState } from 'react'
import Stepper from './components/Stepper'
import StepPersonalInfo from './components/StepPersonalInfo'
import StepVehicle from './components/StepVehicle'
import StepRentalDetails from './components/StepRentalDetails'
import StepPhoto from './components/StepPhoto'
import StepTerms from './components/StepTerms'
import StepSummary from './components/StepSummary'
import LoadingScreen from './components/LoadingScreen'
import AdminPanel from './components/AdminPanel'
import { useVehicles } from './context/VehicleContext'
import { compressImageDataUrl } from './utils/storage'
import {
  composeTime,
  formatPeriodLabel,
  isValidHour,
  isValidMinute,
  sanitizeTimePart,
  toPeriodDate,
} from './utils/rentalPeriod'
import './App.css'

const TOTAL_STEPS = 6

const initialPersonal = {
  firstName: '',
  middleName: '',
  lastName: '',
  address: '',
  contactNo: '',
  emergencyContact: '',
}

const initialRental = {
  duration: '',
  durationOther: '',
  rentalType: '',
  fromDate: '',
  fromHour: '',
  fromMinute: '',
  fromMeridiem: 'AM',
  toDate: '',
  toHour: '',
  toMinute: '',
  toMeridiem: 'AM',
  rentalFee: '',
}

function App() {
  const { vehicles, addRental } = useVehicles()
  const [view, setView] = useState('encoder')
  const [step, setStep] = useState(1)
  const [personal, setPersonal] = useState(initialPersonal)
  const [vehicleId, setVehicleId] = useState('')
  const [rental, setRental] = useState(initialRental)
  const [photo, setPhoto] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('form') // form | loading
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  const updatePersonal = (key, value) => {
    setPersonal((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const updateRental = (key, value) => {
    const nextValue =
      key === 'fromHour' ||
      key === 'fromMinute' ||
      key === 'toHour' ||
      key === 'toMinute'
        ? sanitizeTimePart(value)
        : value
    setRental((prev) => ({ ...prev, [key]: nextValue }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const validateStep = (currentStep) => {
    const nextErrors = {}

    if (currentStep === 1) {
      if (!personal.firstName.trim()) nextErrors.firstName = 'First name is required'
      if (!personal.lastName.trim()) nextErrors.lastName = 'Last name is required'
      if (!personal.address.trim()) nextErrors.address = 'Address is required'
      if (!personal.contactNo.trim()) nextErrors.contactNo = 'Contact number is required'
      if (!personal.emergencyContact.trim()) {
        nextErrors.emergencyContact = 'Emergency contact is required'
      }
    }

    if (currentStep === 2) {
      if (!vehicleId) nextErrors.vehicle = 'Please select a vehicle and click Proceed'
    }

    if (currentStep === 3) {
      if (!rental.duration) nextErrors.duration = 'Select a duration'
      if (rental.duration === 'Others' && !rental.durationOther.trim()) {
        nextErrors.durationOther = 'Please specify the duration'
      }
      if (!rental.rentalType) nextErrors.rentalType = 'Select a rental type'

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
      const now = Date.now()

      if (fromDt && fromDt.getTime() < now) {
        nextErrors.fromDate = 'From date & time cannot be in the past'
      }
      if (toDt && toDt.getTime() < now) {
        nextErrors.toDate = 'To date & time cannot be in the past'
      }
      if (fromDt && toDt && toDt.getTime() <= fromDt.getTime()) {
        nextErrors.toDate = 'To must be after From'
      }

      if (!rental.rentalFee.trim()) nextErrors.rentalFee = 'Rental fee is required'
    }

    if (currentStep === 6) {
      const fromTime = composeTime(rental.fromHour, rental.fromMinute)
      const toTime = composeTime(rental.toHour, rental.toMinute)
      const fromDt = toPeriodDate(rental.fromDate, fromTime, rental.fromMeridiem)
      const toDt = toPeriodDate(rental.toDate, toTime, rental.toMeridiem)
      const now = Date.now()
      if (fromDt && fromDt.getTime() < now) {
        nextErrors.fromDate = 'From date & time has already passed. Please update the rental period.'
      }
      if (toDt && toDt.getTime() < now) {
        nextErrors.toDate = 'To date & time has already passed. Please update the rental period.'
      }
      if (nextErrors.fromDate || nextErrors.toDate) {
        setErrors(nextErrors)
        setStep(3)
        return false
      }
    }

    if (currentStep === 4) {
      if (!photo) nextErrors.photo = 'Customer photo is required'
    }

    if (currentStep === 5) {
      if (!termsAccepted) nextErrors.terms = 'You must accept the terms to continue'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleReset = useCallback(() => {
    setStep(1)
    setPersonal(initialPersonal)
    setVehicleId('')
    setRental(initialRental)
    setPhoto('')
    setTermsAccepted(false)
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

      const compressedPhoto = await compressImageDataUrl(photo || '')
      // Prefer lightweight vehicle image: keep http URLs, skip huge data URLs
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
      const periodFromLabel = formatPeriodLabel(
        rental.fromDate,
        fromTime,
        rental.fromMeridiem,
      )
      const periodToLabel = formatPeriodLabel(rental.toDate, toTime, rental.toMeridiem)

      const record = {
        personal,
        vehicle: {
          id: selectedVehicle.id,
          make: selectedVehicle.make,
          series: selectedVehicle.series,
          plateNo: selectedVehicle.plateNo,
          bodyType: selectedVehicle.bodyType,
          engineNo: selectedVehicle.engineNo,
          chassisNo: selectedVehicle.chassisNo,
          image: vehicleImage,
        },
        rental: {
          duration:
            rental.duration === 'Others' ? rental.durationOther : rental.duration,
          rentalType: rental.rentalType,
          rentalFee: rental.rentalFee,
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
        termsAccepted,
        encodedAt: new Date().toISOString(),
      }

      addRental(record)
      setPhase('loading')
    } catch (err) {
      console.error('Submit failed:', err)
      setSubmitError(
        'Could not save this registration. Storage may be full — try a smaller photo or clear old history in Admin.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = async () => {
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

  if (view === 'admin') {
    return <AdminPanel onBack={() => setView('encoder')} />
  }

  if (phase === 'loading') {
    return <LoadingScreen onDone={handleReset} />
  }

  const nextDisabled = step === 5 && !termsAccepted

  return (
    <div className="app">
      <header className="app-header">
        <h1>Alatas Car Rental Services</h1>
        <div className="header-actions">
          <p>Lessee / Renter Registration</p>
          <button type="button" className="btn-outline" onClick={() => setView('admin')}>
            Admin Panel
          </button>
        </div>
      </header>

      <main className="encoder-card">
        <Stepper currentStep={step} />

        <div className="encoder-body">
          {step === 1 && (
            <StepPersonalInfo data={personal} onChange={updatePersonal} errors={errors} />
          )}
          {step === 2 && (
            <StepVehicle
              selectedId={vehicleId}
              onSelect={(id) => {
                setVehicleId(id)
                setErrors((prev) => ({ ...prev, vehicle: '' }))
              }}
              error={errors.vehicle}
            />
          )}
          {step === 3 && (
            <StepRentalDetails data={rental} onChange={updateRental} errors={errors} />
          )}
          {step === 4 && (
            <StepPhoto
              photoPreview={photo}
              onCapture={setPhoto}
              onClear={() => setPhoto('')}
              error={errors.photo}
            />
          )}
          {step === 5 && (
            <StepTerms
              accepted={termsAccepted}
              onChange={(val) => {
                setTermsAccepted(val)
                setErrors((prev) => ({ ...prev, terms: '' }))
              }}
              error={errors.terms}
            />
          )}
          {step === 6 && (
            <StepSummary
              personal={personal}
              vehicle={selectedVehicle}
              rental={rental}
              photo={photo}
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
      </main>
    </div>
  )
}

export default App
