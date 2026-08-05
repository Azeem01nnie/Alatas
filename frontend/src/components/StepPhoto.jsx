import { useEffect, useRef, useState } from 'react'
import { compressImageDataUrl } from '../utils/storage'

export default function StepPhoto({ photoPreview, onCapture, onClear, error }) {
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => {})
  }, [cameraActive])

  const startCamera = async () => {
    setCameraError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not supported in this browser. Please upload a photo instead.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch {
      setCameraError('Unable to access the camera. Check permissions or upload a photo.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }

  const captureFromCamera = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setCameraError('Camera is still loading. Please wait a moment and try again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const raw = canvas.toDataURL('image/jpeg', 0.85)
    const compressed = await compressImageDataUrl(raw)
    onCapture(compressed)
    stopCamera()
    setCameraError('')
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCameraError('Please choose an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const compressed = await compressImageDataUrl(reader.result)
      onCapture(compressed)
      setCameraError('')
      stopCamera()
    }
    reader.onerror = () => setCameraError('Failed to read the selected file.')
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleClear = () => {
    stopCamera()
    onClear()
    setCameraError('')
  }

  return (
    <section className="step-panel">
      <h2 className="step-title">Customer Photo</h2>
      <p className="step-subtitle">Take a live photo or upload an image of the customer.</p>

      <div className="photo-area">
        {photoPreview ? (
          <div className="photo-preview-wrap">
            <img src={photoPreview} alt="Customer" className="photo-preview" />
            <button type="button" className="btn-ghost" onClick={handleClear}>
              Retake
            </button>
          </div>
        ) : (
          <>
            <div className={`photo-stage${cameraActive ? ' live' : ''}`}>
              {cameraActive ? (
                <video ref={videoRef} autoPlay playsInline muted className="photo-video" />
              ) : (
                <div className="photo-placeholder">
                  <span>No photo yet</span>
                  <small>Open the camera or upload an image</small>
                </div>
              )}
            </div>

            <div className="photo-actions">
              {!cameraActive ? (
                <button type="button" className="btn-primary" onClick={startCamera}>
                  Open Camera
                </button>
              ) : (
                <>
                  <button type="button" className="btn-primary" onClick={captureFromCamera}>
                    Capture Photo
                  </button>
                  <button type="button" className="btn-ghost" onClick={stopCamera}>
                    Close Camera
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn-outline"
                onClick={() => fileRef.current?.click()}
              >
                Upload Photo
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFile}
            />
          </>
        )}
      </div>

      {cameraError && <span className="error-msg error-center">{cameraError}</span>}
      {error && <span className="error-msg error-center">{error}</span>}
    </section>
  )
}
