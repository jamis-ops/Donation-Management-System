import { useEffect, useState, useRef } from 'react'

/**
 * Custom hook for animating numbers from 0 to target value
 * @param {number} end - Target number
 * @param {number} duration - Animation duration in milliseconds
 * @param {boolean} start - Whether to start the animation
 * @returns {number} Current animated value
 */
export function useCountUp(end, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  const startTimeRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!start) {
      setCount(0)
      return
    }

    const startValue = 0
    const endValue = typeof end === 'number' ? end : parseInt(end.toString().replace(/[^0-9]/g, ''), 10)

    if (isNaN(endValue)) {
      return
    }

    const animate = (currentTime) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime
      }

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (easeOutExpo)
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

      const currentCount = Math.floor(startValue + (endValue - startValue) * easeOut)
      setCount(currentCount)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setCount(endValue)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      startTimeRef.current = null
    }
  }, [end, duration, start])

  return count
}
