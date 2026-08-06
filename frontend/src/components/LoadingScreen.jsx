import { useEffect } from 'react'

const WAIT_MS = 2200

export default function LoadingScreen({ onDone }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div className="app">
      <main className="success-card loading-card">
        <div className="loader" aria-hidden="true" />
        <h1>Successful</h1>
      </main>
    </div>
  )
}
