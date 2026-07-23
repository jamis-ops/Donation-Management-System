import Req from './Req'

/**
 * Standard Last Name / First Name / Middle Initial row.
 * value: { lastName, firstName, middleInitial }
 */
export default function NameFields({
  value = {},
  onChange,
  required = true,
  lastLabel = 'Last Name (LN)',
  firstLabel = 'First Name (FN)',
  middleLabel = 'Middle Initial (MI)',
  disabled = false,
}) {
  const set = (key, v) => onChange?.({ ...value, [key]: v })

  return (
    <div className="form-row form-row--names">
      <label>
        {required ? <Req required>{lastLabel}</Req> : lastLabel}
        <input
          required={required}
          disabled={disabled}
          value={value.lastName || ''}
          onChange={(e) => set('lastName', e.target.value)}
          placeholder="Dela Cruz"
          autoComplete="family-name"
        />
      </label>
      <label>
        {required ? <Req required>{firstLabel}</Req> : firstLabel}
        <input
          required={required}
          disabled={disabled}
          value={value.firstName || ''}
          onChange={(e) => set('firstName', e.target.value)}
          placeholder="Juan"
          autoComplete="given-name"
        />
      </label>
      <label>
        {middleLabel}
        <input
          disabled={disabled}
          maxLength={5}
          value={value.middleInitial || ''}
          onChange={(e) => set('middleInitial', e.target.value.replace(/[^a-zA-Z.]/g, '').slice(0, 5))}
          placeholder="A"
          autoComplete="additional-name"
        />
      </label>
    </div>
  )
}
