import { useCallback, useState } from 'react'

function eventAnchor(event) {
  const rect = event.currentTarget?.getBoundingClientRect()
  const hasPointer = Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
    && (event.clientX !== 0 || event.clientY !== 0)

  return {
    x: hasPointer ? event.clientX : (rect ? rect.left + rect.width / 2 : window.innerWidth / 2),
    y: hasPointer ? event.clientY : (rect ? rect.top : window.innerHeight / 2),
  }
}

export function useChartTooltip() {
  const [tip, setTip] = useState(null)

  const showTooltip = useCallback((event, content) => {
    setTip({ ...content, ...eventAnchor(event) })
  }, [])

  const hideTooltip = useCallback(() => setTip(null), [])

  const bindTooltip = useCallback((content) => ({
    tabIndex: 0,
    onPointerEnter: (event) => showTooltip(event, content),
    onPointerMove: (event) => showTooltip(event, content),
    onPointerLeave: hideTooltip,
    onFocus: (event) => showTooltip(event, content),
    onBlur: hideTooltip,
  }), [hideTooltip, showTooltip])

  return { tip, showTooltip, hideTooltip, bindTooltip }
}
