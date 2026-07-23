import { VOLUNTEER_SKILLS } from '../../constants/options'

/**
 * Multi-select skill checkboxes — same layout as Preferred Programs.
 */
export default function SkillTagPicker({
  value = [],
  other = '',
  onChange,
  onOtherChange,
  label = 'Skills',
  required = false,
  showOther = true,
}) {
  const selected = Array.isArray(value) ? value : []

  const toggle = (skill) => {
    const next = selected.includes(skill)
      ? selected.filter((s) => s !== skill)
      : [...selected, skill]
    onChange?.(next)
  }

  return (
    <fieldset>
      <legend>
        {label}
        {required ? <span className="req" aria-hidden> *</span> : null}
      </legend>
      <div className="checkbox-grid">
        {VOLUNTEER_SKILLS.map((skill) => (
          <label key={skill} className="checkbox-label">
            <input
              type="checkbox"
              checked={selected.includes(skill)}
              onChange={() => toggle(skill)}
            />
            {skill}
          </label>
        ))}
      </div>
      {showOther && (
        <label style={{ marginTop: '0.75rem' }}>
          Other (optional)
          <input
            type="text"
            value={other}
            placeholder="e.g. Forklift license, scuba certified…"
            onChange={(e) => onOtherChange?.(e.target.value)}
          />
        </label>
      )}
    </fieldset>
  )
}
