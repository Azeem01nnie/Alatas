const STEPS = [
  'Personal Info',
  'Vehicle',
  'Rental',
  'Photo',
  'Terms',
  'Summary',
]

export default function Stepper({ currentStep }) {
  return (
    <nav className="stepper" aria-label="Registration progress">
      {STEPS.map((label, index) => {
        const stepNum = index + 1
        const isActive = stepNum === currentStep
        const isComplete = stepNum < currentStep

        return (
          <div
            key={label}
            className={`stepper-item${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}`}
          >
            <span className="stepper-dot">{isComplete ? '✓' : stepNum}</span>
            <span className="stepper-label">{label}</span>
          </div>
        )
      })}
    </nav>
  )
}
