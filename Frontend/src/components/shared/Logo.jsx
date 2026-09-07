import { Link } from 'react-router-dom'
import { logo } from '../../assets'

export default function Logo({ to = '/', className = '', showText = true, size = 'md', onClick }) {
  return (
    <Link to={to} className={`brand-logo brand-logo--${size} ${className}`.trim()} onClick={onClick}>
      <img src={logo} alt="Rise Above Foundation Cebu" className="brand-logo__image" />
      {showText && (
        <span className="brand-logo__text">
          <span className="brand-logo__title">Rise Above</span>
          <span className="brand-logo__subtitle">Foundation Cebu</span>
        </span>
      )}
    </Link>
  )
}
