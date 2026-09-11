import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Check,
} from 'lucide-react'
import Logo from '../../components/shared/Logo'
import PasswordRequirements from '../../components/shared/PasswordRequirements'
import { checkPasswordRequirements } from '../../utils/validation'
import { heroBg } from '../../assets'
import { useLoading } from '../../context/LoadingContext'
import { notify } from '../../utils/toast'
import { forgotPasswordApi } from '../../api/resources'

/**
 * Custom SVG Vector Artwork for Step 1: Smartphone with Password Lock (Rise Above Crimson Theme)
 */
function PhoneLockIllustration() {
  return (
    <div className="forgot-art-wrap" aria-hidden="true">
      <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft Warm Brand Ambient Glow */}
        <circle cx="90" cy="90" r="68" fill="#FFF1F2" />
        <circle cx="90" cy="90" r="54" fill="#FFE4E6" opacity="0.75" />
        
        {/* Sparkles / Decorative Elements */}
        <path d="M42 56L44 48L52 46L44 44L42 36L40 44L32 46L40 48L42 56Z" fill="#AF101A" opacity="0.85" />
        <path d="M142 62L143.5 56L149.5 54.5L143.5 53L142 47L140.5 53L134.5 54.5L140.5 56L142 62Z" fill="#AF101A" opacity="0.85" />
        <circle cx="36" cy="120" r="3" fill="#FDA4AF" />
        <circle cx="146" cy="116" r="3.5" fill="#FDA4AF" />

        {/* Smartphone Body */}
        <g filter="drop-shadow(0px 8px 16px rgba(175, 16, 26, 0.15))">
          {/* Outer Frame */}
          <rect x="62" y="32" width="56" height="112" rx="14" fill="#0F172A" />
          {/* Inner Screen */}
          <rect x="65.5" y="35.5" width="49" height="105" rx="10.5" fill="#AF101A" />
          {/* Screen Glass Reflection */}
          <rect x="65.5" y="35.5" width="49" height="105" rx="10.5" fill="url(#brand_grad_1)" />
          {/* Speaker Notch */}
          <rect x="83" y="38.5" width="14" height="2.5" rx="1.25" fill="#0F172A" />
          {/* Home Indicator */}
          <rect x="82" y="134" width="16" height="2" rx="1" fill="#FFFFFF" opacity="0.6" />

          {/* Screen Content: Password Lock Screen */}
          <g transform="translate(73, 70)">
            {/* Lock Icon */}
            <rect x="9" y="10" width="16" height="12" rx="2.5" fill="#FFFFFF" />
            <path d="M12 10V6.5C12 4.01472 14.0147 2 16.5 2V2C18.9853 2 21 4.01472 21 6.5V10" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="17" cy="15" r="1.5" fill="#AF101A" />
            
            {/* Password Dots XXX */}
            <g transform="translate(5, 28)">
              <circle cx="4" cy="4" r="3" fill="#FFFFFF" />
              <circle cx="12" cy="4" r="3" fill="#FFFFFF" />
              <circle cx="20" cy="4" r="3" fill="#FFFFFF" />
            </g>
          </g>
        </g>

        <defs>
          <linearGradient id="brand_grad_1" x1="65.5" y1="35.5" x2="114.5" y2="140.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D64545" />
            <stop offset="1" stopColor="#8B0D15" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

/**
 * Custom SVG Vector Artwork for Step 2: Smartphone with Email Notification (Rise Above Crimson Theme)
 */
function PhoneMailIllustration() {
  return (
    <div className="forgot-art-wrap" aria-hidden="true">
      <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft Warm Brand Ambient Glow */}
        <circle cx="90" cy="90" r="68" fill="#FFF1F2" />
        <circle cx="90" cy="90" r="54" fill="#FFE4E6" opacity="0.75" />
        
        {/* Sparkles / Decorative Elements */}
        <path d="M42 56L44 48L52 46L44 44L42 36L40 44L32 46L40 48L42 56Z" fill="#AF101A" opacity="0.85" />
        <path d="M142 62L143.5 56L149.5 54.5L143.5 53L142 47L140.5 53L134.5 54.5L140.5 56L142 62Z" fill="#AF101A" opacity="0.85" />
        <circle cx="36" cy="120" r="3" fill="#FDA4AF" />
        <circle cx="146" cy="116" r="3.5" fill="#FDA4AF" />

        {/* Smartphone Body */}
        <g filter="drop-shadow(0px 8px 16px rgba(175, 16, 26, 0.15))">
          {/* Outer Frame */}
          <rect x="62" y="32" width="56" height="112" rx="14" fill="#0F172A" />
          {/* Inner Screen */}
          <rect x="65.5" y="35.5" width="49" height="105" rx="10.5" fill="#AF101A" />
          {/* Screen Glass Reflection */}
          <rect x="65.5" y="35.5" width="49" height="105" rx="10.5" fill="url(#brand_grad_2)" />
          {/* Speaker Notch */}
          <rect x="83" y="38.5" width="14" height="2.5" rx="1.25" fill="#0F172A" />
          {/* Home Indicator */}
          <rect x="82" y="134" width="16" height="2" rx="1" fill="#FFFFFF" opacity="0.6" />

          {/* Screen Content: Mail Notification Envelope */}
          <g transform="translate(73, 68)">
            {/* Envelope Base */}
            <rect x="3" y="10" width="28" height="20" rx="3" fill="#FFFFFF" />
            {/* Envelope Flap Lines */}
            <path d="M4 11L17 21L30 11" stroke="#AF101A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 29L13 20" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M30 29L21 20" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
            {/* Flying Sparkle */}
            <circle cx="27" cy="6" r="3" fill="#F59E0B" />
          </g>
        </g>

        <defs>
          <linearGradient id="brand_grad_2" x1="65.5" y1="35.5" x2="114.5" y2="140.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D64545" />
            <stop offset="1" stopColor="#8B0D15" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

/**
 * Custom SVG Vector Artwork for Step 3: Smartphone with Shield Security Lock (Rise Above Crimson Theme)
 */
function PhoneShieldIllustration() {
  return (
    <div className="forgot-art-wrap" aria-hidden="true">
      <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft Warm Brand Ambient Glow */}
        <circle cx="90" cy="90" r="68" fill="#FFF1F2" />
        <circle cx="90" cy="90" r="54" fill="#FFE4E6" opacity="0.75" />
        
        {/* Sparkles / Decorative Elements */}
        <path d="M42 56L44 48L52 46L44 44L42 36L40 44L32 46L40 48L42 56Z" fill="#AF101A" opacity="0.85" />
        <path d="M142 62L143.5 56L149.5 54.5L143.5 53L142 47L140.5 53L134.5 54.5L140.5 56L142 62Z" fill="#AF101A" opacity="0.85" />
        <circle cx="36" cy="120" r="3" fill="#FDA4AF" />
        <circle cx="146" cy="116" r="3.5" fill="#FDA4AF" />

        {/* Smartphone Body */}
        <g filter="drop-shadow(0px 8px 16px rgba(175, 16, 26, 0.15))">
          {/* Outer Frame */}
          <rect x="62" y="32" width="56" height="112" rx="14" fill="#0F172A" />
          {/* Inner Screen */}
          <rect x="65.5" y="35.5" width="49" height="105" rx="10.5" fill="#AF101A" />
          {/* Screen Glass Reflection */}
          <rect x="65.5" y="35.5" width="49" height="105" rx="10.5" fill="url(#brand_grad_3)" />
          {/* Speaker Notch */}
          <rect x="83" y="38.5" width="14" height="2.5" rx="1.25" fill="#0F172A" />
          {/* Home Indicator */}
          <rect x="82" y="134" width="16" height="2" rx="1" fill="#FFFFFF" opacity="0.6" />

          {/* Screen Content: Shield Security */}
          <g transform="translate(73, 66)">
            {/* Shield Outline & Fill */}
            <path
              d="M17 4L6 8.5V17.5C6 24.5 10.7 31 17 33C23.3 31 28 24.5 28 17.5V8.5L17 4Z"
              fill="#FFFFFF"
            />
            {/* Checkmark inside Shield */}
            <path
              d="M12 18.5L15.5 22L22 14"
              stroke="#AF101A"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        <defs>
          <linearGradient id="brand_grad_3" x1="65.5" y1="35.5" x2="114.5" y2="140.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D64545" />
            <stop offset="1" stopColor="#8B0D15" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

/**
 * Mask an email for privacy (e.g. james.isidro@gmail.com -> j***o@gmail.com)
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email
  const [user, domain] = email.split('@')
  if (user.length <= 2) return `${user[0]}***@${domain}`
  return `${user[0]}***${user[user.length - 1]}@${domain}`
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showLoading, hideLoading } = useLoading()

  // Steps: 'email' (1) -> 'code' (2) -> 'password' (3) -> 'success' (4)
  const [step, setStep] = useState('email')

  // Form State
  const [email, setEmail] = useState(() => searchParams.get('email') || '')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Status & Feedback
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Refs for 6-digit OTP inputs
  const otpInputRefs = useRef([])

  // Password Validation
  const passwordCheck = checkPasswordRequirements(newPassword)
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Focus first OTP input when transitioning to step 'code'
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus()
      }, 100)
    }
  }, [step])

  // ─────────────────────────────────────────────────────────────
  // STEP 1: SUBMIT EMAIL -> SEND VERIFICATION CODE
  // ─────────────────────────────────────────────────────────────
  const handleSendCode = async (e) => {
    if (e) e.preventDefault()
    setError('')
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Please enter your registered email address.')
      return
    }

    setLoading(true)
    showLoading('Sending verification code…')
    try {
      const res = await forgotPasswordApi.sendCode(trimmedEmail)
      if (res.ok) {
        notify.success('Verification code sent! Please check your email inbox.')
        setStep('code')
        setResendCooldown(30)
      } else {
        setError(res.error || 'Failed to send verification code. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to server. Please try again.')
    } finally {
      hideLoading()
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2: RESEND CODE
  // ─────────────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return
    setError('')
    setLoading(true)
    showLoading('Resending code…')
    try {
      const res = await forgotPasswordApi.resendCode(email.trim().toLowerCase())
      if (res.ok) {
        notify.success('A new verification code has been sent!')
        setOtpDigits(['', '', '', '', '', ''])
        setResendCooldown(30)
        otpInputRefs.current[0]?.focus()
      } else {
        setError(res.error || 'Failed to resend code.')
      }
    } catch (err) {
      setError(err.message || 'Could not resend code.')
    } finally {
      hideLoading()
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2: OTP INPUT HANDLERS (Auto-jump, backspace, paste)
  // ─────────────────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '')

    if (!cleaned) {
      const next = [...otpDigits]
      next[index] = ''
      setOtpDigits(next)
      return
    }

    // Handle single character
    const char = cleaned.slice(-1)
    const next = [...otpDigits]
    next[index] = char
    setOtpDigits(next)

    // Automatically focus next input box
    if (index < 5 && char) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      // Jump back to previous box on backspace
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    const next = ['', '', '', '', '', '']
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    setOtpDigits(next)

    // Focus on the next empty box or the last box
    const focusIndex = Math.min(pasted.length, 5)
    otpInputRefs.current[focusIndex]?.focus()
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2: VERIFY CODE
  // ─────────────────────────────────────────────────────────────
  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault()
    setError('')
    const code = otpDigits.join('').trim()
    if (code.length !== 6) {
      setError('Please enter the full 6-digit verification code.')
      return
    }

    setLoading(true)
    showLoading('Verifying code…')
    try {
      const res = await forgotPasswordApi.verifyCode(email.trim().toLowerCase(), code)
      if (res.ok && res.resetToken) {
        setResetToken(res.resetToken)
        notify.success('Code verified!')
        setStep('password')
      } else {
        setError(res.error || 'Invalid or expired verification code.')
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.')
    } finally {
      hideLoading()
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3: RESET PASSWORD
  // ─────────────────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault()
    setError('')

    if (!passwordCheck.isValid) {
      setError('Please meet all password requirements listed below.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setLoading(true)
    showLoading('Updating password…')
    try {
      const res = await forgotPasswordApi.resetPassword(
        email.trim().toLowerCase(),
        resetToken,
        newPassword,
        confirmPassword
      )
      if (res.ok) {
        notify.success('Password reset successfully!')
        setStep('success')
      } else {
        setError(res.error || 'Failed to update password. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Could not update password.')
    } finally {
      hideLoading()
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BACK NAVIGATION
  // ─────────────────────────────────────────────────────────────
  const handleBack = () => {
    setError('')
    if (step === 'code') {
      setStep('email')
    } else if (step === 'password') {
      setStep('code')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="auth-page">
      {/* Visual Left Banner */}
      <div className="auth-page__visual">
        <img src={heroBg} alt="" className="auth-page__visual-image" />
        <div className="auth-page__visual-overlay">
          <p>Rise Above Foundation Cebu</p>
          <span style={{ fontSize: '0.95rem', opacity: 0.9, marginTop: '4px' }}>
            Restoring Hope &amp; Rebuilding Lives
          </span>
        </div>
      </div>

      {/* Main Form Wrapper */}
      <div className="auth-page__form-wrap">
        <div className="auth-card forgot-pw-card">
          
          {/* Top Back Navigation */}
          {step !== 'success' && (
            <button
              type="button"
              onClick={handleBack}
              className="forgot-pw-back-btn"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
              <span>Forgot Password</span>
            </button>
          )}

          {/* Error Banner */}
          {error && (
            <div className="auth-card__error" role="alert" style={{ marginTop: '0.75rem' }}>
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* =========================================================
              SCREEN 1: ENTER REGISTERED EMAIL
              ========================================================= */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="forgot-pw-form">
              <PhoneLockIllustration />

              <div className="forgot-pw-text-block">
                <h2 className="forgot-pw-title">Please enter your registered email ID.</h2>
                <p className="forgot-pw-subtitle">
                  We will send a verification code to your registered email ID.
                </p>
              </div>

              <div className="forgot-pw-input-field">
                <div className="forgot-pw-input-wrap">
                  <Mail size={18} className="forgot-pw-input-icon" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    autoComplete="email"
                    className="forgot-pw-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg forgot-pw-submit"
                disabled={loading || !email.trim()}
              >
                {loading ? 'Sending Code...' : 'Next'}
              </button>

              <div className="forgot-pw-footer-nav">
                <Link to="/login" className="auth-link-btn">
                  Remember your password? Sign In
                </Link>
              </div>
            </form>
          )}

          {/* =========================================================
              SCREEN 2: ENTER 6-DIGIT VERIFICATION CODE
              ========================================================= */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="forgot-pw-form">
              <PhoneMailIllustration />

              <div className="forgot-pw-text-block">
                <h2 className="forgot-pw-title">Please enter your verification code.</h2>
                <p className="forgot-pw-subtitle">
                  We have sent a verification code to your registered email ID{' '}
                  <strong style={{ color: '#0F172A', wordBreak: 'break-all' }}>
                    ({maskEmail(email)})
                  </strong>.
                </p>
              </div>

              {/* 6-Digit OTP Boxes */}
              <div className="forgot-pw-otp-container" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpInputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`forgot-pw-otp-box ${digit ? 'forgot-pw-otp-box--filled' : ''}`}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>

              {/* Resend Code Section */}
              <div className="forgot-pw-resend-row">
                <span>Didn't receive the code?</span>
                {resendCooldown > 0 ? (
                  <span className="forgot-pw-resend-timer">
                    Resend in <strong>00:{resendCooldown < 10 ? `0${resendCooldown}` : resendCooldown}</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="forgot-pw-resend-btn"
                    disabled={loading}
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg forgot-pw-submit"
                disabled={loading || otpDigits.join('').length !== 6}
              >
                {loading ? 'Verifying...' : 'Done'}
              </button>
            </form>
          )}

          {/* =========================================================
              SCREEN 3: ENTER NEW PASSWORD & CONFIRM
              ========================================================= */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="forgot-pw-form">
              <PhoneShieldIllustration />

              <div className="forgot-pw-text-block">
                <h2 className="forgot-pw-title">Please enter a new password</h2>
                <p className="forgot-pw-subtitle">
                  Create a strong and secure password for your account.
                </p>
              </div>

              {/* New Password Input */}
              <div className="forgot-pw-input-field">
                <div className="forgot-pw-input-wrap">
                  <Lock size={18} className="forgot-pw-input-icon" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password"
                    autoComplete="new-password"
                    className="forgot-pw-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="forgot-pw-eye-btn"
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Re-enter Password Input */}
              <div className="forgot-pw-input-field">
                <div className="forgot-pw-input-wrap">
                  <Lock size={18} className="forgot-pw-input-icon" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter Password"
                    autoComplete="new-password"
                    className="forgot-pw-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="forgot-pw-eye-btn"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Password Match Status */}
              {confirmPassword.length > 0 && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: passwordsMatch ? '#16A34A' : '#DC2626',
                    marginTop: '-0.25rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  {passwordsMatch ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}

              {/* Live Password Requirements Widget */}
              <PasswordRequirements password={newPassword} />

              <button
                type="submit"
                className="btn btn--primary btn--lg forgot-pw-submit"
                disabled={loading || !passwordCheck.isValid || !passwordsMatch}
                style={{ marginTop: '0.75rem' }}
              >
                {loading ? 'Updating Password...' : 'Change Password'}
              </button>
            </form>
          )}

          {/* =========================================================
              SCREEN 4: SUCCESS CONFIRMATION
              ========================================================= */}
          {step === 'success' && (
            <div className="forgot-pw-success-view">
              <div className="forgot-pw-success-icon-wrap">
                <CheckCircle2 size={54} className="forgot-pw-success-icon" />
              </div>

              <h2 className="forgot-pw-title" style={{ marginTop: '1rem', color: '#16A34A' }}>
                Password Reset Successful!
              </h2>

              <p className="forgot-pw-subtitle" style={{ maxWidth: '340px', margin: '0.5rem auto 1.75rem' }}>
                Your password has been securely updated in our system. You can now sign in with your new credentials.
              </p>

              <Link to="/login" className="btn btn--primary btn--lg forgot-pw-submit">
                Proceed to Sign In
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
