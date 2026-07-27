import { Link } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import { heroBg } from '../assets'

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-page__visual">
        <img src={heroBg} alt="" className="auth-page__visual-image" />
        <div className="auth-page__visual-overlay">
          <p>Join the mission to rise above together</p>
        </div>
      </div>

      <div className="auth-page__form-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
            <Logo />
          </div>
          <h1>Barangay Partner Registration</h1>
          <p className="auth-card__subtitle" style={{ fontSize: '1rem', marginBottom: '2.5rem' }}>
            Barangay partners are registered by invitation only. If your barangay would like to partner with Rise Above Foundation, please contact us or nominate your barangay for consideration.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
            <Link to="/contact" className="btn btn--primary btn--lg" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              Contact Us
            </Link>
            <Link to="/assistance" className="btn btn--outline btn--lg" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              Nominate a Barangay
            </Link>
          </div>

          <p className="auth-alt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <Link to="/" className="auth-back-link">Back to website</Link>
        </div>
      </div>
    </div>
  )
}
