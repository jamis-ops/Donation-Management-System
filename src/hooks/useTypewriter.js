import { useEffect, useState } from 'react'

/**
 * Custom hook for typewriter text animation
 * @param {string} text - Text to animate
 * @param {number} speed - Typing speed in milliseconds
 * @param {boolean} start - Whether to start the animation
 * @returns {string} Current displayed text
 */
export function useTypewriter(text, speed = 100, start = true) {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (!start) {
      setDisplayText('')
      setCurrentIndex(0)
      return
    }

    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)

      return () => clearTimeout(timeout)
    }
  }, [currentIndex, text, speed, start])

  return displayText
}
