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

export default function StepCarCondition({ photos, onChange }) {
  const inputRefs = useRef({})
  const extraInputRef = useRef(null)
  const videoRefs = useRef({})
  const streamRef = useRef(null)
  const [busyKey, setBusyKey] = useState('')
  const [localError, setLocalError] = useState({})
  const [cameraKey, setCameraKey] = useState('')
  const [extraBusy, setExtraBusy] = useState(false)
  const [extraError, setExtraError] = useState('')

  const extras = Array.isArray(photos?.extras) ? photos.extras : []

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
    if (slotKey === 'extra') setExtraError('')
    else setLocalError((prev) => ({ ...prev, [slotKey]: '' }))
    stopCamera()
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const msg = 'Camera is not supported here. Please upload a photo instead.'
        if (slotKey === 'extra') setExtraError(msg)
        else setLocalError((prev) => ({ ...prev, [slotKey]: msg }))
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraKey(slotKey)
    } catch {
      const msg = 'Unable to access the camera. Check permissions or upload a photo.'
      if (slotKey === 'extra') setExtraError(msg)
      else setLocalError((prev) => ({ ...prev, [slotKey]: msg }))
    }
  }

  const captureFromCamera = async (slotKey) => {
    const video = videoRefs.current[slotKey]
    if (!video || !video.videoWidth) {
      const msg = 'Camera is not ready yet. Wait a moment and try again.'
      if (slotKey === 'extra') setExtraError(msg)
      else setLocalError((prev) => ({ ...prev, [slotKey]: msg }))
      return
    }

    if (slotKey === 'extra') setExtraBusy(true)
    else setBusyKey(slotKey)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      const raw = canvas.toDataURL('image/jpeg', 0.92)
      const compressed = await compressImageDataUrl(raw, 960, 0.8)
      if (!compressed) {
        const msg = 'Could not process the captured photo.'
        if (slotKey === 'extra') setExtraError(msg)
        else setLocalError((prev) => ({ ...prev, [slotKey]: msg }))
        return
      }
      if (slotKey === 'extra') {
        onChange('extras', [
          ...extras,
          {
            id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            uri: compressed,
            label: `Extra ${extras.length + 1}`,
          },
        ])
        setExtraError('')
      } else {
        onChange(slotKey, compressed)
      }
      stopCamera()
    } catch {
      const msg = 'Capture failed. Please try again.'
      if (slotKey === 'extra') setExtraError(msg)
      else setLocalError((prev) => ({ ...prev, [slotKey]: msg }))
    } finally {
      if (slotKey === 'extra') setExtraBusy(false)
      else setBusyKey('')
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

  const addExtraFile = async (file, inputEl) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setExtraError('Please choose an image file')
      return
    }
    stopCamera()
    setExtraBusy(true)
    setExtraError('')
    try {
      const compressed = await readAndCompress(file)
      if (!compressed) {
        setExtraError('Could not process that image. Try another file.')
        return
      }
      const next = [
        ...extras,
        {
          id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          uri: compressed,
          label: `Extra ${extras.length + 1}`,
        },
      ]
      onChange('extras', next)
    } catch {
      setExtraError('Upload failed. Please try again.')
    } finally {
      setExtraBusy(false)
      if (inputEl) inputEl.value = ''
    }
  }

  const removeExtra = (id) => {
    onChange(
      'extras',
      extras.filter((item) => item.id !== id),
    )
  }

  return (
    <section className="step-panel">
      <h2 className="step-title">Pre-rental Car Photos</h2>
      <p className="step-subtitle">
        Optional — you can skip this step. Add vehicle sides now, or attach photos later from the
        rental transaction. Extra photos are also optional.
      </p>

      <div className="photo-upload-grid photo-upload-grid-4">
        {CAR_PHOTO_SLOTS.map((slot) => (
          <CarPhotoSlot
            key={slot.key}
            title={`${slot.title} (optional)`}
            hint={slot.hint}
            preview={photos?.[slot.key] || ''}
            error={localError[slot.key] || ''}
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

      <div className="car-photo-extras">
        <div className="car-photo-extras-head">
          <h3>Extra photos</h3>
          <p>Add as many as you need — damage close-ups, odometer, accessories, or other angles.</p>
        </div>

        <div className="car-photo-extras-grid">
          {extras.map((item, index) => (
            <figure key={item.id || `extra-${index}`} className="car-photo-extra-card">
              <img src={item.uri} alt={item.label || `Extra ${index + 1}`} />
              <figcaption>{item.label || `Extra ${index + 1}`}</figcaption>
              <button
                type="button"
                className="btn-ghost btn-sm car-photo-extra-remove"
                onClick={() => removeExtra(item.id)}
              >
                Remove
              </button>
            </figure>
          ))}

          <div className="car-photo-extra-add">
            <input
              ref={extraInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => addExtraFile(e.target.files?.[0], e.target)}
            />
            {cameraKey === 'extra' ? (
              <>
                <div className="car-photo-extra-camera">
                  <video
                    ref={(el) => {
                      videoRefs.current.extra = el
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="photo-video"
                  />
                </div>
                <div className="car-photo-extra-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={extraBusy}
                    onClick={() => captureFromCamera('extra')}
                  >
                    {extraBusy ? 'Working…' : 'Capture'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={extraBusy}
                    onClick={stopCamera}
                  >
                    Cancel camera
                  </button>
                </div>
              </>
            ) : (
              <div className="car-photo-extra-actions">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={extraBusy}
                  onClick={() => extraInputRef.current?.click()}
                >
                  {extraBusy ? 'Adding…' : 'Upload photo'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={extraBusy}
                  onClick={() => startCamera('extra')}
                >
                  Take photo
                </button>
              </div>
            )}
          </div>
        </div>
        {extraError ? <span className="error-msg">{extraError}</span> : null}
      </div>
    </section>
  )
}
