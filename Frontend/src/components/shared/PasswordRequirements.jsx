import React, { useMemo } from 'react'
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react'
import { checkPasswordRequirements } from '../../utils/validation'

/**
 * PasswordRequirements
 * Displays a live checklist of password security criteria:
 * - 8+ chars
 * - Uppercase
 * - Lowercase
 * - Number
 * - Special character
 *
 * @param {Object} props
 * @param {string} props.password - The password string currently being typed
 * @param {string} [props.className] - Optional extra class
 * @param {boolean} [props.showStrengthBar=true] - Whether to show the strength progress bar
 */
export default function PasswordRequirements({
  password = '',
  className = '',
  showStrengthBar = true,
}) {
  const { results, metCount, totalCount, isValid } = useMemo(
    () => checkPasswordRequirements(password),
    [password]
  )

  // Strength text and level
  const strengthLevel = useMemo(() => {
    if (!password) return { label: 'Empty', color: 'var(--text-muted, #64748b)', percent: 0 }
    if (metCount <= 2) return { label: 'Weak', color: '#ef4444', percent: (metCount / totalCount) * 100 }
    if (metCount < 5) return { label: 'Moderate', color: '#f59e0b', percent: (metCount / totalCount) * 100 }
    return { label: 'Strong', color: '#10b981', percent: 100 }
  }, [password, metCount, totalCount])

  return (
    <div
      className={`password-requirements ${isValid ? 'password-requirements--valid' : ''} ${className}`}
      aria-live="polite"
    >
      <div className="password-requirements__header">
        <span className="password-requirements__title">
          <ShieldCheck size={15} className="password-requirements__shield" />
          Password Requirements
        </span>
        {showStrengthBar && password.length > 0 && (
          <span
            className="password-requirements__badge"
            style={{ color: strengthLevel.color }}
          >
            {strengthLevel.label} ({metCount}/{totalCount})
          </span>
        )}
      </div>

      {showStrengthBar && (
        <div className="password-requirements__bar-track" role="progressbar" aria-valuenow={metCount} aria-valuemin={0} aria-valuemax={5}>
          <div
            className="password-requirements__bar-fill"
            style={{
              width: `${strengthLevel.percent}%`,
              backgroundColor: strengthLevel.color,
            }}
          />
        </div>
      )}

      <ul className="password-requirements__list">
        {results.map((rule) => (
          <li
            key={rule.id}
            className={`password-requirements__item ${
              rule.met ? 'password-requirements__item--met' : 'password-requirements__item--unmet'
            }`}
          >
            {rule.met ? (
              <CheckCircle2 size={14} className="password-requirements__icon password-requirements__icon--check" />
            ) : (
              <Circle size={14} className="password-requirements__icon password-requirements__icon--circle" />
            )}
            <span className="password-requirements__label">{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
