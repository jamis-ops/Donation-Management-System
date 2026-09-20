import * as React from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Standardized Select component matching Rise Above Foundation design system.
 * - Consistent 40px height
 * - Comfortable internal padding with no text/icon touching borders
 * - Neatly aligned SVG chevron indicator with pointer-events: none
 * - Robust focus (#AF101A) and disabled states
 * - Optional inline loading spinner
 */
export const Select = React.forwardRef(
  (
    {
      className,
      wrapperClassName,
      children,
      disabled,
      loading = false,
      error = false,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('form-select-wrapper', wrapperClassName)}>
        <select
          ref={ref}
          disabled={disabled || loading}
          className={cn(
            'form-select-enhanced',
            error && 'form-select-enhanced--error',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <span className="form-select-arrow" aria-hidden="true">
          {loading ? (
            <Loader2 size={15} className="form-select-spinner animate-spin text-slate-400" />
          ) : (
            <ChevronDown size={15} className="form-select-chevron" />
          )}
        </span>
      </div>
    )
  }
)
Select.displayName = 'Select'

/**
 * FormSelect combines a standardized label (with optional icon and hint),
 * the Select component, and helper/error text in a unified group.
 */
export const FormSelect = React.forwardRef(
  (
    {
      label,
      icon: Icon,
      required = false,
      optional = false,
      hint,
      error,
      loading = false,
      wrapperClassName,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const selectId = id || generatedId

    return (
      <div className={cn('form-select-group', wrapperClassName)}>
        {label && (
          <label htmlFor={selectId} className="form-label-with-icon">
            {Icon && <Icon size={14} className="form-label-icon text-slate-500" />}
            <span className="form-label-title">{label}</span>
            {required && <span className="text-red-600 font-bold ml-0.5">*</span>}
            {optional && <span className="field-hint-inline">(Optional)</span>}
          </label>
        )}
        <Select
          id={selectId}
          ref={ref}
          loading={loading}
          error={Boolean(error)}
          {...props}
        >
          {children}
        </Select>
        {hint && !error && <span className="form-field-hint">{hint}</span>}
        {error && <span className="form-field-error text-xs text-red-600 font-medium mt-1 block">{error}</span>}
      </div>
    )
  }
)
FormSelect.displayName = 'FormSelect'

export default Select
