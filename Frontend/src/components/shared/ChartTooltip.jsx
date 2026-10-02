import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../styles/chart-tooltip.css'

const VIEWPORT_GAP = 10
const ANCHOR_GAP = 12

export default function ChartTooltip({ tip }) {
  const cardRef = useRef(null)
  const [position, setPosition] = useState(null)

  useLayoutEffect(() => {
    if (!tip || !cardRef.current) {
      setPosition(null)
      return
    }

    const card = cardRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const left = Math.min(
      Math.max(tip.x - card.width / 2, VIEWPORT_GAP),
      Math.max(VIEWPORT_GAP, viewportWidth - card.width - VIEWPORT_GAP),
    )

    let top = tip.y - card.height - ANCHOR_GAP
    let placement = 'top'
    if (top < VIEWPORT_GAP) {
      top = tip.y + ANCHOR_GAP
      placement = 'bottom'
    }
    if (top + card.height > viewportHeight - VIEWPORT_GAP) {
      top = Math.max(VIEWPORT_GAP, viewportHeight - card.height - VIEWPORT_GAP)
    }

    const arrowX = Math.min(Math.max(tip.x - left, 13), Math.max(13, card.width - 13))
    setPosition({ left, top, placement, arrowX })
  }, [tip])

  if (!tip || typeof document === 'undefined') return null

  const items = Array.isArray(tip.items) ? tip.items : []

  return createPortal(
    <div
      ref={cardRef}
      className={`raf-chart-tooltip raf-chart-tooltip--${position?.placement || 'top'}`}
      style={{
        left: position?.left ?? tip.x,
        top: position?.top ?? tip.y,
        '--raf-tooltip-arrow-x': `${position?.arrowX || 18}px`,
        visibility: position ? 'visible' : 'hidden',
      }}
      role="tooltip"
      aria-live="polite"
    >
      {tip.label && <span className="raf-chart-tooltip__label">{tip.label}</span>}
      {tip.value !== undefined && tip.value !== null && <strong className="raf-chart-tooltip__value">{tip.value}</strong>}
      {items.length > 0 && (
        <span className="raf-chart-tooltip__items">
          {items.map((item, index) => (
            <span className="raf-chart-tooltip__item" key={`${item.label || 'detail'}-${index}`}>
              <span>{item.label}</span><strong>{item.value}</strong>
            </span>
          ))}
        </span>
      )}
      {tip.change && (
        <span className={`raf-chart-tooltip__change raf-chart-tooltip__change--${tip.dir || 'flat'}`}>
          {tip.dir === 'up' ? '▲' : tip.dir === 'down' ? '▼' : '■'} {tip.change}
        </span>
      )}
      {tip.sub && <span className="raf-chart-tooltip__sub">{tip.sub}</span>}
    </div>,
    document.body,
  )
}
