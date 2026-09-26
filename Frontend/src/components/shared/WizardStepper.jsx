import { Check, Lock } from 'lucide-react'

/**
 * Shared progress navigation for modal-based, sequential workflows.
 * Future steps are locked by default; completed steps remain available so
 * users can go back without bypassing validation in the owning workflow.
 */
export default function WizardStepper({
  steps,
  currentStep,
  onStepChange,
  completedSteps,
  lockedSteps,
  ariaLabel = 'Workflow progress',
  className = '',
}) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentStep))
  const completedSet = completedSteps ? new Set(completedSteps) : null
  const lockedSet = lockedSteps ? new Set(lockedSteps) : null

  return (
    <nav className={`wizard-stepper ${className}`.trim()} aria-label={ariaLabel}>
      <ol className="wizard-stepper__list">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep
          const isCompleted = !isActive && (completedSet ? completedSet.has(step.id) : index < currentIndex)
          const isLocked = !isActive && !isCompleted && (lockedSet ? lockedSet.has(step.id) : index > currentIndex)
          const state = isActive ? 'active' : isCompleted ? 'completed' : isLocked ? 'locked' : 'available'
          const canNavigate = !isLocked && !isActive && typeof onStepChange === 'function'

          return (
            <li
              key={step.id}
              className={`wizard-stepper__item wizard-stepper__item--${state}`}
            >
              <button
                type="button"
                className="wizard-stepper__button"
                onClick={() => canNavigate && onStepChange(step.id)}
                disabled={isLocked}
                aria-disabled={isLocked}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}, ${state}`}
              >
                <span className="wizard-stepper__marker" aria-hidden="true">
                  {isCompleted ? <Check size={15} strokeWidth={3} /> : isLocked ? <Lock size={13} /> : index + 1}
                </span>
                <span className="wizard-stepper__label">{step.label}</span>
              </button>

              {index < steps.length - 1 ? (
                <span className="wizard-stepper__connector" aria-hidden="true" />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
