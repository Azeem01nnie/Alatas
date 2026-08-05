import { useEffect, useState } from 'react'

const WAIT_MS = 60_000

export default function LoadingScreen({ onDone }) {
  const [secondsLeft, setSecondsLeft] = useState(60)

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const remaining = Math.max(0, WAIT_MS - (Date.now() - start))
      setSecondsLeft(Math.ceil(remaining / 1000))
      if (remaining <= 0) {
        clearInterval(tick)
        onDone()
      }
    }, 200)

    return () => clearInterval(tick)
  }, [onDone])

  return (
    <div className="app">
      <main className="success-card loading-card">
        <div className="loader" aria-hidden="true" />
        <h1>Thank you for choosing Alatas Car rental and services</h1>
        <p>
          Your registration has been recorded successfully.
          <br />
          Returning to the start in <strong>{secondsLeft}s</strong>
        </p>
        <button type="button" className="btn-outline" onClick={onDone}>
          Don&apos;t want to wait — Continue now
        </button>
      </main>
    </div>
  )
}
