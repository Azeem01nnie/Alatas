import { useEffect, useRef, useState } from 'react'
import { compressImageDataUrl } from '../utils/storage'

const SLOTS = [
  {
    key: 'holding',
    title: 'Holding license',
    hint: 'Customer holding their driver’s license next to their face.',
    required: true,
  },
  {
    key: 'license',
    title: 'Customer photo',
    hint: 'Clear photo of the customer (face), or a close-up of the license front.',
    required: true,
  },
  {
    key: 'optional',
    title: 'Optional photo',
    hint: 'Extra ID, second license side, or any other optional customer photo.',
    required: false,
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
  optional,
  preview,
  error,
  busy,
  cameraActive,
  videoRef,
  mirrored,
  videoDevices,
  selectedDeviceId,
  onDeviceChange,
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
        <h3>
          {title}
          {optional ? <span className="photo-optional-tag">Optional</span> : null}
        </h3>
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
            {videoDevices && videoDevices.length > 0 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => onDeviceChange(e.target.value)}
                className="photo-camera-select"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.substring(0, 5)}`}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="btn-primary" disabled={busy} onClick={onCapture}>
              Capture
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={onToggleCamera}>
              Cancel camera
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" disabled={busy} onClick={onUploadClick}>
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
  optionalPreview,
  onHoldingChange,
  onLicenseChange,
  onOptionalChange,
  errors = {},
}) {
  const inputRefs = useRef({})
  const videoRefs = useRef({})
  const streamRef = useRef(null)

  const [busyKey, setBusyKey] = useState('')
  const [localError, setLocalError] = useState({})
  const [cameraKey, setCameraKey] = useState('')
  const [videoDevices, setVideoDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  const previews = {
    holding: holdingPreview,
    license: licensePreview,
    optional: optionalPreview,
  }

  const setters = {
    holding: onHoldingChange,
    license: onLicenseChange,
    optional: onOptionalChange,
  }

  const fieldErrors = {
    holding: errors.photo,
    license: errors.licensePhoto,
    optional: errors.optionalPhoto,
  }

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

  const startCamera = async (slotKey, deviceId = selectedDeviceId) => {
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

      const constraints = deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: { facingMode: 'user' }, audio: false }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setCameraKey(slotKey)

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((d) => d.kind === 'videoinput')
      setVideoDevices(videoInputs)

      if (!deviceId && videoInputs.length > 0) {
        const track = stream.getVideoTracks()[0]
        const activeDevice = videoInputs.find((d) => d.label === track.label)
        if (activeDevice) {
          setSelectedDeviceId(activeDevice.deviceId)
        } else {
          setSelectedDeviceId(videoInputs[0].deviceId)
        }
      } else if (deviceId) {
        setSelectedDeviceId(deviceId)
      }
    } catch {
      setLocalError((prev) => ({
        ...prev,
        [slotKey]: 'Unable to access the camera. Check permissions or upload a photo.',
      }))
    }
  }

  const handleDeviceChange = (deviceId) => {
    if (cameraKey) {
      startCamera(cameraKey, deviceId)
    } else {
      setSelectedDeviceId(deviceId)
    }
  }

  const captureFromCamera = async (slotKey) => {
    const onChange = setters[slotKey]
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

  const handleFile = async (slotKey, file, inputEl) => {
    const onChange = setters[slotKey]
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
        Upload or take the two required photos — holding license and customer photo. You can also
        add one optional photo.
      </p>

      <div className="photo-upload-grid photo-upload-grid-customer">
        {SLOTS.map((slot) => (
          <PhotoSlot
            key={slot.key}
            title={slot.title}
            hint={slot.hint}
            optional={!slot.required}
            preview={previews[slot.key]}
            error={localError[slot.key] || fieldErrors[slot.key]}
            busy={busyKey === slot.key}
            cameraActive={cameraKey === slot.key}
            videoRef={(el) => {
              videoRefs.current[slot.key] = el
            }}
            mirrored
            videoDevices={videoDevices}
            selectedDeviceId={selectedDeviceId}
            onDeviceChange={handleDeviceChange}
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
              setters[slot.key]('')
              setLocalError((prev) => ({ ...prev, [slot.key]: '' }))
            }}
          />
        ))}
      </div>
    </section>
  )
}
