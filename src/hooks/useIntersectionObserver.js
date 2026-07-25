import { useEffect, useState, useRef } from 'react'

/**
 * Custom hook for detecting when an element enters the viewport
 * @param {Object} options - IntersectionObserver options
 * @returns {Array} [ref, isIntersecting]
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const elementRef = useRef(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting
        setIsIntersecting(isVisible)
        
        // Once it has intersected, keep it true (for one-time animations)
        if (isVisible && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px',
        ...options,
      }
    )

    observer.observe(element)

    return () => {
      if (element) {
        observer.unobserve(element)
      }
    }
  }, [hasIntersected, options])

  return [elementRef, isIntersecting, hasIntersected]
}
