import { useEffect, useRef, useState } from 'react'
import { compressImageDataUrl } from '../utils/storage'

export default function StepPhoto({ photoPreview, onCapture, onClear, error }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturing, setCapturing] = useState(false)

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
        setCameraError('Camera is not supported in this browser. Use Chrome or Edge on a device with a webcam.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch {
      setCameraError(
        'Unable to access the webcam. Allow camera permission in the browser, then try again.',
      )
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
      setCameraError('Camera is still loading. Wait a moment, then capture again.')
      return
    }

    setCapturing(true)
    setCameraError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      // Mirror to match the live preview feel
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0)
      const raw = canvas.toDataURL('image/jpeg', 0.88)
      const compressed = await compressImageDataUrl(raw)
      onCapture(compressed)
      stopCamera()
    } catch {
      setCameraError('Could not capture the photo. Please try again.')
    } finally {
      setCapturing(false)
    }
  }

  const handleClear = () => {
    stopCamera()
    onClear()
    setCameraError('')
  }

  return (
    <section className="step-panel">
      <h2 className="step-title">Customer Photo</h2>
      <p className="step-subtitle">
        Live webcam capture for identity verification. Uploads are not allowed.
      </p>
      <p className="photo-skip-note">Camera not required yet — you can continue without a photo for now.</p>

      <div className="photo-area">
        {photoPreview ? (
          <div className="photo-preview-wrap">
            <div className="photo-verified-badge">Verified capture</div>
            <img src={photoPreview} alt="Customer verification" className="photo-preview" />
            <button type="button" className="btn-ghost" onClick={handleClear}>
              Retake with camera
            </button>
          </div>
        ) : (
          <>
            <div className={`photo-stage${cameraActive ? ' live' : ''}`}>
              {cameraActive ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="photo-video mirrored" />
                  <div className="photo-guide" aria-hidden="true">
                    <span className="photo-guide-frame" />
                  </div>
                </>
              ) : (
                <div className="photo-placeholder">
                  <span>Webcam verification</span>
                  <small>Open the camera and capture a live photo of the customer</small>
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
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={captureFromCamera}
                    disabled={capturing}
                  >
                    {capturing ? 'Capturing…' : 'Capture Photo'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={stopCamera}>
                    Close Camera
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {cameraError && <span className="error-msg error-center">{cameraError}</span>}
      {error && <span className="error-msg error-center">{error}</span>}
    </section>
  )
}
