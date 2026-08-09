const STEPS = [
  'Personal Info',
  'Vehicle',
  'Rental',
  'Photos',
  'Terms',
  'Summary',
]

function CheckIcon() {
  return (
    <svg
      className="stepper-check"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5.5 12.5 10 17l8.5-9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
            <span className="stepper-dot">
              {isComplete ? <CheckIcon /> : stepNum}
            </span>
            <span className="stepper-label">{label}</span>
          </div>
        )
      })}
    </nav>
  )
}
