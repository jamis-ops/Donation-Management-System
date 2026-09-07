/** Label text with a red asterisk for required fields. */
export default function Req({ children, required = false }) {
  return (
    <>
      {children}
      {required ? <span className="req" aria-hidden="true"> *</span> : null}
    </>
  )
}
