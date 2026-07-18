export default function ChartTooltip({ tip }) {
  if (!tip) return null

  return (
    <div
      className="chart-tooltip"
      style={{ left: tip.left, top: tip.top }}
      role="tooltip"
      aria-live="polite"
    >
      {tip.label && <span className="chart-tooltip__label">{tip.label}</span>}
      <span className="chart-tooltip__value">{tip.value}</span>
      {tip.change && (
        <span className={`chart-tooltip__change chart-tooltip__change--${tip.dir || 'flat'}`}>
          {tip.dir === 'up' ? '▲' : tip.dir === 'down' ? '▼' : '■'} {tip.change}
        </span>
      )}
      {tip.sub && <span className="chart-tooltip__sub">{tip.sub}</span>}
    </div>
  )
}
