import '../../styles/loading-spinner.css'

/**
 * Smooth and cute loading spinner component
 * Variants: default, small, large, inline, page
 */
export default function LoadingSpinner({ 
  variant = 'default', 
  message = 'Loading...', 
  size = 'medium',
  showMessage = true 
}) {
  const sizeClass = size === 'small' ? 'loading-spinner--small' : 
                    size === 'large' ? 'loading-spinner--large' : ''
  
  const variantClass = variant === 'inline' ? 'loading-spinner--inline' :
                       variant === 'page' ? 'loading-spinner--page' :
                       variant === 'card' ? 'loading-spinner--card' : ''

  if (variant === 'dots') {
    return (
      <div className={`loading-dots ${variantClass}`}>
        <div className="loading-dots__dot"></div>
        <div className="loading-dots__dot"></div>
        <div className="loading-dots__dot"></div>
        {showMessage && message && <span className="loading-dots__text">{message}</span>}
      </div>
    )
  }

  if (variant === 'pulse') {
    return (
      <div className={`loading-pulse ${variantClass}`}>
        <div className="loading-pulse__circle"></div>
        {showMessage && message && <span className="loading-pulse__text">{message}</span>}
      </div>
    )
  }

  if (variant === 'bars') {
    return (
      <div className={`loading-bars ${variantClass}`}>
        <div className="loading-bars__bar"></div>
        <div className="loading-bars__bar"></div>
        <div className="loading-bars__bar"></div>
        <div className="loading-bars__bar"></div>
        {showMessage && message && <span className="loading-bars__text">{message}</span>}
      </div>
    )
  }

  // Default spinner
  return (
    <div className={`loading-spinner ${sizeClass} ${variantClass}`}>
      <div className="loading-spinner__ring">
        <div className="loading-spinner__ring-segment"></div>
      </div>
      {showMessage && message && <span className="loading-spinner__text">{message}</span>}
    </div>
  )
}

/**
 * Full-page loading overlay
 */
export function LoadingOverlay({ message = 'Loading...', transparent = false }) {
  return (
    <div className={`loading-overlay ${transparent ? 'loading-overlay--transparent' : ''}`}>
      <div className="loading-overlay__content">
        <div className="loading-spinner__ring loading-spinner__ring--large">
          <div className="loading-spinner__ring-segment"></div>
        </div>
        <span className="loading-overlay__text">{message}</span>
      </div>
    </div>
  )
}

/**
 * Cute heart-beat loading (for donation/beneficiary contexts)
 */
export function LoadingHeart({ message = 'Loading...' }) {
  return (
    <div className="loading-heart">
      <svg className="loading-heart__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      {message && <span className="loading-heart__text">{message}</span>}
    </div>
  )
}

/**
 * Skeleton loader for content placeholders
 */
export function SkeletonLoader({ lines = 3, height = '1rem', gap = '0.75rem' }) {
  return (
    <div className="skeleton-loader" style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className="skeleton-loader__line" 
          style={{ 
            height,
            width: i === lines - 1 && lines > 1 ? '80%' : '100%' 
          }}
        />
      ))}
    </div>
  )
}

/**
 * Inline loading indicator (for buttons, small spaces)
 */
export function InlineLoader({ size = 16 }) {
  return (
    <svg 
      className="inline-loader" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none"
    >
      <circle 
        className="inline-loader__circle" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinecap="round"
      />
    </svg>
  )
}
