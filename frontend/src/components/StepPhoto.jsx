import { useRef, useState } from 'react'
import { compressImageDataUrl } from '../utils/storage'

const SLOTS = [
  {
    key: 'holding',
    title: 'Holding license',
    hint: 'Customer holding their driver’s license next to their face.',
    accept: 'image/*',
  },
  {
    key: 'license',
    title: 'License photo',
    hint: 'Clear close-up of the driver’s license (front).',
    accept: 'image/*',
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

function UploadSlot({
  title,
  hint,
  preview,
  error,
  busy,
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

      <div className="photo-upload-stage">
        {preview ? (
          <img src={preview} alt={title} className="photo-upload-preview" />
        ) : (
          <div className="photo-upload-placeholder">
            <span>No image yet</span>
            <small>JPG, PNG, or WEBP</small>
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
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : preview ? 'Replace photo' : 'Upload photo'}
        </button>
        {preview && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={onClear}>
            Remove
          </button>
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
  const [busyKey, setBusyKey] = useState('')
  const [localError, setLocalError] = useState({})

  const handleFile = async (slotKey, file, onChange, inputEl) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLocalError((prev) => ({ ...prev, [slotKey]: 'Please choose an image file' }))
      return
    }
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
      <h2 className="step-title">License Photos</h2>
      <p className="step-subtitle">
        Upload two clear photos for verification — the customer holding their license, and the
        license itself.
      </p>

      <div className="photo-upload-grid">
        <UploadSlot
          title={SLOTS[0].title}
          hint={SLOTS[0].hint}
          preview={holdingPreview}
          error={localError.holding || errors.photo}
          busy={busyKey === 'holding'}
          inputRef={holdingRef}
          onPick={(e) =>
            handleFile('holding', e.target.files?.[0], onHoldingChange, e.target)
          }
          onClear={() => {
            onHoldingChange('')
            setLocalError((prev) => ({ ...prev, holding: '' }))
          }}
        />
        <UploadSlot
          title={SLOTS[1].title}
          hint={SLOTS[1].hint}
          preview={licensePreview}
          error={localError.license || errors.licensePhoto}
          busy={busyKey === 'license'}
          inputRef={licenseRef}
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
