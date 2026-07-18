import { Check } from 'lucide-react'

export default function WorkflowStepper({ steps, currentStatus }) {
  const currentIndex = steps.indexOf(currentStatus)

  return (
    <div className="workflow-stepper">
      {steps.map((step, i) => {
        const done = currentIndex > i
        const active = currentIndex === i
        return (
          <div key={step} className={`workflow-stepper__step${done ? ' workflow-stepper__step--done' : ''}${active ? ' workflow-stepper__step--active' : ''}`}>
            <span className="workflow-stepper__dot">{done ? <Check size={12} /> : i + 1}</span>
            <span className="workflow-stepper__label">{step}</span>
            {i < steps.length - 1 && <span className="workflow-stepper__line" />}
          </div>
        )
      })}
    </div>
  )
}
