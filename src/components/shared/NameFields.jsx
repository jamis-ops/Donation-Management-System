import Req from './Req'

/**
 * Standard Last Name / First Name / Middle Initial row.
 * value: { lastName, firstName, middleInitial }
 */
export default function NameFields({
  value = {},
  onChange,
  required = true,
  lastLabel = 'Last Name',
  firstLabel = 'First Name',
  middleLabel = 'MI',
  disabled = false,
}) {
  const set = (key, v) => onChange?.({ ...value, [key]: v })

  return (
    <div className="form-row form-row--names">
      <label className="name-fields__field">
        <span className="name-fields__label">
          {required ? <Req required>{lastLabel}</Req> : lastLabel}
        </span>
        <input
          required={required}
          disabled={disabled}
          value={value.lastName || ''}
          onChange={(e) => set('lastName', e.target.value)}
          placeholder="Dela Cruz"
          autoComplete="family-name"
        />
      </label>
      <label className="name-fields__field">
        <span className="name-fields__label">
          {required ? <Req required>{firstLabel}</Req> : firstLabel}
        </span>
        <input
          required={required}
          disabled={disabled}
          value={value.firstName || ''}
          onChange={(e) => set('firstName', e.target.value)}
          placeholder="Juan"
          autoComplete="given-name"
        />
      </label>
      <label className="name-fields__field name-fields__field--mi">
        <span className="name-fields__label">{middleLabel}</span>
        <input
          disabled={disabled}
          maxLength={5}
          value={value.middleInitial || ''}
          onChange={(e) => set('middleInitial', e.target.value.replace(/[^a-zA-Z.]/g, '').slice(0, 5))}
          placeholder="A"
          autoComplete="additional-name"
          aria-label="Middle Initial"
        />
      </label>
    </div>
  )
}
