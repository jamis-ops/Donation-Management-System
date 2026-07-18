import { useState } from 'react'
import ChartTooltip from './ChartTooltip'

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

function changeInfo(cur, prev, prevLabel) {
  if (prev === undefined || prevLabel === undefined) return { change: null, dir: 'flat' }
  if (prev === 0) {
    return cur > 0
      ? { change: `New activity vs ${prevLabel}`, dir: 'up' }
      : { change: `No change vs ${prevLabel}`, dir: 'flat' }
  }
  const pct = ((cur - prev) / prev) * 100
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct
  return {
    change: `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}% vs ${prevLabel}`,
    dir,
  }
}

export default function LineChart({ title, labels, series }) {
  const [tip, setTip] = useState(null)
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
      <div className="admin-chart__plot">
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
                <path
                  d={toPath(points)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="admin-chart__line"
                  pathLength="1"
                />
                {points.map((p, i) => {
                  const active = tip && tip.seriesKey === s.key && tip.index === i
                  const info = changeInfo(s.values[i], s.values[i - 1], labels[i - 1])
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={active ? 6 : 4}
                      fill="#fff"
                      stroke={s.color}
                      strokeWidth="2"
                      className="admin-chart__point"
                      style={{ animationDelay: `${0.3 + i * 0.06}s` }}
                      onMouseEnter={() =>
                        setTip({
                          seriesKey: s.key,
                          index: i,
                          left: `${(p.x / CHART.width) * 100}%`,
                          top: `${(p.y / CHART.height) * 100}%`,
                          label: `${s.label} · ${labels[i]}`,
                          value: s.values[i].toLocaleString(),
                          change: info.change,
                          dir: info.dir,
                        })
                      }
                      onMouseLeave={() => setTip(null)}
                    />
                  )
                })}
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
        <ChartTooltip tip={tip} />
      </div>
    </div>
  )
}
