import { useEffect, useRef, useState } from 'react'

/** Adds `.is-visible` when the element enters the viewport (fade/slide animations). */
export default function Reveal({ as: Tag = 'div', className = '', children, delay = 0, style, ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const mergedStyle = {
    ...(delay ? { transitionDelay: `${delay}ms` } : null),
    ...style,
  }

  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={Object.keys(mergedStyle).length ? mergedStyle : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
