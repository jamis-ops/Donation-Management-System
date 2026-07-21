import { Link } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import { heroBg } from '../assets'

/**
 * Shown after a successful email verification (redirect from api/verify.php).
 * No password setup — users sign in with the password they chose at registration.
 */
export default function VerifiedPage() {
  return (
    <div className="auth-page">
      <div className="auth-page__visual">
        <img src={heroBg} alt="" className="auth-page__visual-image" />
        <div className="auth-page__visual-overlay">
          <p>Join the mission to rise above together</p>
        </div>
      </div>
      <div className="auth-page__form-wrap">
        <div className="auth-card auth-card--verified">
          <Logo className="auth-card__logo" />
          <div className="auth-verify-status auth-verify-status--ok" aria-hidden>✓</div>
          <h1>Your account has been successfully verified</h1>
          <p className="auth-card__subtitle">
            You can sign in now using the email and password you created during registration.
            No new password is required.
          </p>
          <Link to="/login" className="btn btn--primary btn--lg auth-form__submit">
            Continue to Sign In
          </Link>
          <Link to="/" className="auth-back-link">Back to website</Link>
        </div>
      </div>
    </div>
  )
}
