import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/shared/Logo'
import { heroBg } from '../assets'
import { verifyEmail } from '../api/auth'

export default function VerifyPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState(() => (
    token
      ? { status: 'loading', title: '', message: '' }
      : {
          status: 'error',
          title: 'Invalid link',
          message: 'This verification link is missing its token. Please use the link from your email.',
        }
  ))

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    verifyEmail(token)
      .then((res) => {
        if (cancelled) return
        setState({
          status: res.ok ? 'ok' : 'error',
          title: res.title || (res.ok ? 'Email verified' : 'Verification failed'),
          message: res.message || '',
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          title: 'Verification failed',
          message: err.message || 'Could not verify your email. The link may have expired.',
        })
      })
    return () => { cancelled = true }
  }, [token])

  const ok = state.status === 'ok'

  return (
    <div className="auth-page">
      <div className="auth-page__visual">
        <img src={heroBg} alt="" className="auth-page__visual-image" />
        <div className="auth-page__visual-overlay">
          <p>Join the mission to rise above together</p>
        </div>
      </div>
      <div className="auth-page__form-wrap">
        <div className="auth-card">
          <Logo className="auth-card__logo" />
          {state.status === 'loading' ? (
            <>
              <h1>Verifying your email…</h1>
              <p className="auth-card__subtitle">Please wait a moment while we activate your account.</p>
            </>
          ) : (
            <>
              <div className={`auth-verify-status auth-verify-status--${ok ? 'ok' : 'error'}`} aria-hidden>
                {ok ? '✓' : '!'}
              </div>
              <h1>{state.title}</h1>
              <p className="auth-card__subtitle">{state.message}</p>
              <Link to="/login?verified=1" className="btn btn--primary btn--lg auth-form__submit">
                {ok ? 'Continue to Sign In' : 'Back to Sign In'}
              </Link>
            </>
          )}
          <Link to="/" className="auth-back-link">Back to website</Link>
        </div>
      </div>
    </div>
  )
}
