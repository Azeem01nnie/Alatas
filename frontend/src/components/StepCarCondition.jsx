import { useEffect, useRef, useState } from 'react'
import { compressImageDataUrl } from '../utils/storage'

export const CAR_PHOTO_SLOTS = [
  { key: 'front', title: 'Front', hint: 'Full front view of the vehicle.' },
  { key: 'rear', title: 'Rear', hint: 'Full rear view of the vehicle.' },
  { key: 'left', title: 'Left side', hint: 'Driver / left side of the vehicle.' },
  { key: 'right', title: 'Right side', hint: 'Passenger / right side of the vehicle.' },
]

async function readAndCompress(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
  return compressImageDataUrl(dataUrl, 960, 0.8)
}

function CarPhotoSlot({
  title,
  hint,
  preview,
  error,
  busy,
  cameraActive,
  videoRef,
  onToggleCamera,
  onCapture,
  onPick,
  onClear,
  onUploadClick,
  inputRef,
}) {
  return (
    <article className={`photo-upload-card${preview ? ' has-preview' : ''}${error ? ' has-error' : ''}`}>
      <div className="photo-upload-head">
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>

      <div className={`photo-upload-stage${cameraActive ? ' is-camera' : ''}`}>
        {cameraActive ? (
          <video ref={videoRef} autoPlay playsInline muted className="photo-video" />
        ) : preview ? (
          <img src={preview} alt={title} className="photo-upload-preview" />
        ) : (
          <div className="photo-upload-placeholder">
            <span>No image yet</span>
            <small>Upload or take a photo</small>
          </div>
        )}
      </div>

      <div className="photo-upload-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onPick}
        />

        {cameraActive ? (
          <>
            <button type="button" className="btn-primary" disabled={busy} onClick={onCapture}>
              Capture
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={onToggleCamera}>
              Cancel camera
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={onUploadClick}
            >
              {busy ? 'Working…' : preview ? 'Upload new' : 'Upload photo'}
            </button>
            <button type="button" className="btn-outline" disabled={busy} onClick={onToggleCamera}>
              Take photo
            </button>
            {preview && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={onClear}>
                Remove
              </button>
            )}
          </>
        )}
      </div>

      {error && <span className="error-msg">{error}</span>}
    </article>
  )
}

export default function StepCarCondition({ photos, onChange, errors = {} }) {
  const inputRefs = useRef({})
  const videoRefs = useRef({})
  const streamRef = useRef(null)
  const [busyKey, setBusyKey] = useState('')
  const [localError, setLocalError] = useState({})
  const [cameraKey, setCameraKey] = useState('')

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraKey('')
  }

  useEffect(() => () => stopCamera(), [])

  useEffect(() => {
    if (!cameraKey) return undefined
    const video = videoRefs.current[cameraKey]
    if (video && streamRef.current) {
      video.srcObject = streamRef.current
    }
    return undefined
  }, [cameraKey])

  const startCamera = async (slotKey) => {
    setLocalError((prev) => ({ ...prev, [slotKey]: '' }))
    stopCamera()
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLocalError((prev) => ({
          ...prev,
          [slotKey]: 'Camera is not supported here. Please upload a photo instead.',
        }))
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraKey(slotKey)
    } catch {
      setLocalError((prev) => ({
        ...prev,
        [slotKey]: 'Unable to access the camera. Check permissions or upload a photo.',
      }))
    }
  }

  const captureFromCamera = async (slotKey) => {
    const video = videoRefs.current[slotKey]
    if (!video || !video.videoWidth) {
      setLocalError((prev) => ({
        ...prev,
        [slotKey]: 'Camera is not ready yet. Wait a moment and try again.',
      }))
      return
    }

    setBusyKey(slotKey)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      const raw = canvas.toDataURL('image/jpeg', 0.92)
      const compressed = await compressImageDataUrl(raw, 960, 0.8)
      if (!compressed) {
        setLocalError((prev) => ({
          ...prev,
          [slotKey]: 'Could not process the captured photo.',
        }))
        return
      }
      onChange(slotKey, compressed)
      stopCamera()
    } catch {
      setLocalError((prev) => ({
        ...prev,
        [slotKey]: 'Capture failed. Please try again.',
      }))
    } finally {
      setBusyKey('')
    }
  }

  const handleFile = async (slotKey, file, inputEl) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLocalError((prev) => ({ ...prev, [slotKey]: 'Please choose an image file' }))
      return
    }
    stopCamera()
    setBusyKey(slotKey)
    setLocalError((prev) => ({ ...prev, [slotKey]: '' }))
    try {
      const compressed = await readAndCompress(file)
      if (!compressed) {
        setLocalError((prev) => ({
          ...prev,
          [slotKey]: 'Could not process that image. Try another file.',
        }))
        return
      }
      onChange(slotKey, compressed)
    } catch {
      setLocalError((prev) => ({
        ...prev,
        [slotKey]: 'Upload failed. Please try again.',
      }))
    } finally {
      setBusyKey('')
      if (inputEl) inputEl.value = ''
    }
  }

  return (
    <section className="step-panel">
      <h2 className="step-title">Pre-rental Car Photos</h2>
      <p className="step-subtitle">
        Optional — add vehicle photos here now, or leave blank and capture them later on mobile.
      </p>

      <div className="photo-upload-grid photo-upload-grid-4">
        {CAR_PHOTO_SLOTS.map((slot) => (
          <CarPhotoSlot
            key={slot.key}
            title={slot.title}
            hint={slot.hint}
            preview={photos?.[slot.key] || ''}
            error={localError[slot.key] || errors[slot.key]}
            busy={busyKey === slot.key}
            cameraActive={cameraKey === slot.key}
            videoRef={(el) => {
              videoRefs.current[slot.key] = el
            }}
            inputRef={(el) => {
              inputRefs.current[slot.key] = el
            }}
            onToggleCamera={() =>
              cameraKey === slot.key ? stopCamera() : startCamera(slot.key)
            }
            onCapture={() => captureFromCamera(slot.key)}
            onPick={(e) => handleFile(slot.key, e.target.files?.[0], e.target)}
            onUploadClick={() => inputRefs.current[slot.key]?.click()}
            onClear={() => {
              onChange(slot.key, '')
              setLocalError((prev) => ({ ...prev, [slot.key]: '' }))
            }}
          />
        ))}
      </div>
      {errors.carPhotos && <span className="error-msg">{errors.carPhotos}</span>}
    </section>
  )
}
