const CHART = {
  width: 560,
  height: 240,
  pad: { top: 16, right: 16, bottom: 32, left: 44 },
}

function buildPoints(values, max, innerW, innerH) {
  const step = innerW / Math.max(values.length - 1, 1)
  return values.map((v, i) => ({
    x: CHART.pad.left + i * step,
    y: CHART.pad.top + innerH - (v / max) * innerH,
  }))
}

function toPath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

export default function LineChart({ title, labels, series }) {
  const innerW = CHART.width - CHART.pad.left - CHART.pad.right
  const innerH = CHART.height - CHART.pad.top - CHART.pad.bottom
  const max = Math.max(...series.flatMap((s) => s.values), 1)
  const gridLines = 4

  return (
    <div className="admin-chart">
      {title && <h3 className="admin-chart__title">{title}</h3>}
      <div className="admin-chart__legend">
        {series.map((s) => (
          <span key={s.key} className="admin-chart__legend-item">
            <span className="admin-chart__legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="admin-chart__svg" role="img" aria-label={title}>
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = CHART.pad.top + (innerH / gridLines) * i
          return (
            <line
              key={i}
              x1={CHART.pad.left}
              y1={y}
              x2={CHART.width - CHART.pad.right}
              y2={y}
              className="admin-chart__grid"
            />
          )
        })}
        {series.map((s) => {
          const points = buildPoints(s.values, max, innerW, innerH)
          return (
            <g key={s.key}>
              <path d={toPath(points)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke={s.color} strokeWidth="2" />
              ))}
            </g>
          )
        })}
        {labels.map((label, i) => {
          const x = CHART.pad.left + (innerW / Math.max(labels.length - 1, 1)) * i
          return (
            <text key={label} x={x} y={CHART.height - 8} textAnchor="middle" className="admin-chart__axis-label">
              {label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
