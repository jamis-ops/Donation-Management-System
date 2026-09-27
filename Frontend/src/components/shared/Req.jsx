/** Label text with a red asterisk for required fields. */
export default function Req({ children, required = false }) {
  if (!children) {
    return required ? <span className="req" aria-hidden="true"> *</span> : null
  }

  return (
    <span className="req-label">
      <span>{children}</span>
      {required ? <span className="req" aria-hidden="true">*</span> : null}
    </span>
  )
}
