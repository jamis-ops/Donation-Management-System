import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import '../styles/loading-spinner.css'

const LoadingContext = createContext(null)

/**
 * Global processing loading modal with heart + smooth butterfly animation.
 * Features:
 * - Appears in the center of the screen and temporarily prevents clicks
 * - Instant activation with smooth fade-in/fade-out
 * - Smooth minimum display time (~260ms) so quick actions don't flash abruptly
 * - Reference counting for nested or concurrent processing tasks
 * - Lightweight, high-performance GPU CSS keyframe animations
 */
export function LoadingProvider({ children }) {
  const [state, setState] = useState({
    visible: false,
    message: 'Processing…',
    entering: false,
    leaving: false,
  })

  const activeCountRef = useRef(0)
  const showTimeRef = useRef(0)
  const hideTimerRef = useRef(null)
  const cleanupTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  const showLoading = useCallback((message = 'Processing…') => {
    // Clear any pending dismissal
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current)
      cleanupTimerRef.current = null
    }

    if (activeCountRef.current === 0) {
      showTimeRef.current = Date.now()
    }
    activeCountRef.current += 1

    setState({
      visible: true,
      message,
      entering: true,
      leaving: false,
    })

    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    enterTimerRef.current = setTimeout(() => {
      setState((prev) => (prev.visible && !prev.leaving ? { ...prev, entering: false } : prev))
    }, 220)
  }, [])

  const hideLoading = useCallback((force = false) => {
    if (force) {
      activeCountRef.current = 0
    } else {
      activeCountRef.current = Math.max(0, activeCountRef.current - 1)
    }

    if (activeCountRef.current > 0) {
      return
    }

    const elapsed = Date.now() - showTimeRef.current
    const minDisplay = 750 // ms: ensures user can clearly see and enjoy the heart + butterfly animation
    const remainingTime = Math.max(0, minDisplay - elapsed)

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setState((prev) => (prev.visible ? { ...prev, entering: false, leaving: true } : prev))

      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current)
      cleanupTimerRef.current = setTimeout(() => {
        setState({ visible: false, message: 'Processing…', entering: false, leaving: false })
      }, 220) // matches fade-out duration
    }, remainingTime)
  }, [])

  const withLoading = useCallback(async (actionFnOrPromise, message = 'Processing…') => {
    showLoading(message)
    try {
      if (typeof actionFnOrPromise === 'function') {
        return await actionFnOrPromise()
      }
      return await actionFnOrPromise
    } finally {
      hideLoading()
    }
  }, [showLoading, hideLoading])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current)
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    }
  }, [])

  const api = useMemo(
    () => ({
      showLoading,
      hideLoading,
      withLoading,
      isLoading: state.visible,
    }),
    [showLoading, hideLoading, withLoading, state.visible]
  )

  return (
    <LoadingContext.Provider value={api}>
      {children}
      {state.visible && (
        <div
          className={`raf-loading-overlay${state.entering ? ' raf-loading-overlay--entering' : ''}${state.leaving ? ' raf-loading-overlay--leaving' : ''}`}
          aria-live="assertive"
          role="alert"
          aria-busy="true"
        >
          <div className="raf-loading-card">
            {/* Heart + Butterfly Animated Centerpiece */}
            <div className="raf-loading-anim" aria-hidden="true">
              {/* Expanding glowing pulse aura */}
              <div className="raf-loading-aura" />

              {/* Butterfly 1 (Upper flutter orbit) */}
              <svg className="raf-loading-butterfly raf-loading-butterfly--1" viewBox="0 0 32 32">
                <path d="M16 14 C14 8, 4 4, 3 11 C2 16, 11 18, 16 15" fill="currentColor" opacity="0.95" />
                <path d="M16 16 C12 18, 6 22, 8 27 C10 30, 15 25, 16 18" fill="currentColor" opacity="0.8" />
                <path d="M16 14 C18 8, 28 4, 29 11 C30 16, 21 18, 16 15" fill="currentColor" opacity="0.95" />
                <path d="M16 16 C20 18, 26 22, 24 27 C22 30, 17 25, 16 18" fill="currentColor" opacity="0.8" />
                <ellipse cx="16" cy="16" rx="1.1" ry="4.5" fill="currentColor" />
              </svg>

              {/* Central Heart Icon */}
              <svg className="raf-loading-heart-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>

              {/* Butterfly 2 (Lower floating flutter orbit) */}
              <svg className="raf-loading-butterfly raf-loading-butterfly--2" viewBox="0 0 32 32">
                <path d="M16 14 C14 8, 4 4, 3 11 C2 16, 11 18, 16 15" fill="currentColor" opacity="0.95" />
                <path d="M16 16 C12 18, 6 22, 8 27 C10 30, 15 25, 16 18" fill="currentColor" opacity="0.8" />
                <path d="M16 14 C18 8, 28 4, 29 11 C30 16, 21 18, 16 15" fill="currentColor" opacity="0.95" />
                <path d="M16 16 C20 18, 26 22, 24 27 C22 30, 17 25, 16 18" fill="currentColor" opacity="0.8" />
                <ellipse cx="16" cy="16" rx="1.1" ry="4.5" fill="currentColor" />
              </svg>
            </div>

            {/* Message */}
            <div className="raf-loading-text-wrap">
              <span className="raf-loading-message">{state.message || 'Processing…'}</span>
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  )
}

/**
 * Hook to access the global loading modal.
 * Returns { showLoading, hideLoading, withLoading, isLoading }.
 */
export function useLoading() {
  const ctx = useContext(LoadingContext)
  if (!ctx) {
    // Fallback if used outside provider — safe no-op
    return {
      showLoading: () => {},
      hideLoading: () => {},
      withLoading: async (fn) => (typeof fn === 'function' ? fn() : fn),
      isLoading: false,
    }
  }
  return ctx
}
