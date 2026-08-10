import { useEffect, useRef, useState } from 'react'
import { compressImageDataUrl } from '../utils/storage'

const SLOTS = [
  {
    key: 'holding',
    title: 'Holding license',
    hint: 'Customer holding their driver’s license next to their face.',
  },
  {
    key: 'license',
    title: 'Customer photo',
    hint: 'Clear photo of the customer (face), or a close-up of the license front.',
  },
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

function PhotoSlot({
  title,
  hint,
  preview,
  error,
  busy,
  cameraActive,
  videoRef,
  mirrored,
  onToggleCamera,
  onCapture,
  onPick,
  onClear,
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
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`photo-video${mirrored ? ' mirrored' : ''}`}
          />
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
              onClick={() => inputRef.current?.click()}
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

export default function StepPhoto({
  holdingPreview,
  licensePreview,
  onHoldingChange,
  onLicenseChange,
  errors = {},
}) {
  const holdingRef = useRef(null)
  const licenseRef = useRef(null)
  const holdingVideoRef = useRef(null)
  const licenseVideoRef = useRef(null)
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
    const video =
      cameraKey === 'holding' ? holdingVideoRef.current : licenseVideoRef.current
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
        video: { facingMode: 'user' },
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

  const captureFromCamera = async (slotKey, onChange) => {
    const video =
      slotKey === 'holding' ? holdingVideoRef.current : licenseVideoRef.current
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
      // Mirror selfie capture to match preview
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
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
      onChange(compressed)
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

  const handleFile = async (slotKey, file, onChange, inputEl) => {
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
      onChange(compressed)
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
      <h2 className="step-title">Customer Photos</h2>
      <p className="step-subtitle">
        Upload or take two clear photos — the customer holding their license, and a photo of the
        customer.
      </p>

      <div className="photo-upload-grid">
        <PhotoSlot
          title={SLOTS[0].title}
          hint={SLOTS[0].hint}
          preview={holdingPreview}
          error={localError.holding || errors.photo}
          busy={busyKey === 'holding'}
          cameraActive={cameraKey === 'holding'}
          videoRef={holdingVideoRef}
          mirrored
          inputRef={holdingRef}
          onToggleCamera={() =>
            cameraKey === 'holding' ? stopCamera() : startCamera('holding')
          }
          onCapture={() => captureFromCamera('holding', onHoldingChange)}
          onPick={(e) =>
            handleFile('holding', e.target.files?.[0], onHoldingChange, e.target)
          }
          onClear={() => {
            onHoldingChange('')
            setLocalError((prev) => ({ ...prev, holding: '' }))
          }}
        />
        <PhotoSlot
          title={SLOTS[1].title}
          hint={SLOTS[1].hint}
          preview={licensePreview}
          error={localError.license || errors.licensePhoto}
          busy={busyKey === 'license'}
          cameraActive={cameraKey === 'license'}
          videoRef={licenseVideoRef}
          mirrored
          inputRef={licenseRef}
          onToggleCamera={() =>
            cameraKey === 'license' ? stopCamera() : startCamera('license')
          }
          onCapture={() => captureFromCamera('license', onLicenseChange)}
          onPick={(e) =>
            handleFile('license', e.target.files?.[0], onLicenseChange, e.target)
          }
          onClear={() => {
            onLicenseChange('')
            setLocalError((prev) => ({ ...prev, license: '' }))
          }}
        />
      </div>
    </section>
  )
}
