import { useState } from 'react'
import ChartTooltip from './ChartTooltip'

export default function DonutChart({ title, data, labelKey = 'label', valueKey = 'value' }) {
  const [active, setActive] = useState(null)
  const [tip, setTip] = useState(null)
  const total = data.reduce((sum, d) => sum + d[valueKey], 0)
  const colors = ['#AF101A', '#C42828', '#D64545', '#7A0B12', '#E88989']
  const radius = 54
  const cx = 70
  const cy = 70

  const slices = data.reduce((acc, item, i) => {
    const start = acc.cumulative / total
    const nextCumulative = acc.cumulative + item[valueKey]
    const end = nextCumulative / total
    const startAngle = start * 2 * Math.PI - Math.PI / 2
    const endAngle = end * 2 * Math.PI - Math.PI / 2
    const midAngle = (startAngle + endAngle) / 2
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const large = end - start > 0.5 ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`

    acc.slices.push({
      d,
      color: colors[i % colors.length],
      label: item[labelKey],
      value: item[valueKey],
      percent: total > 0 ? Math.round((item[valueKey] / total) * 100) : 0,
      cxMid: cx + radius * 0.62 * Math.cos(midAngle),
      cyMid: cy + radius * 0.62 * Math.sin(midAngle),
    })
    acc.cumulative = nextCumulative
    return acc
  }, { slices: [], cumulative: 0 }).slices

  const showTip = (slice, i) => {
    setActive(i)
    setTip({
      left: `${(slice.cxMid / 140) * 100}%`,
      top: `${(slice.cyMid / 140) * 100}%`,
      label: slice.label,
      value: slice.value.toLocaleString(),
      sub: `${slice.percent}% of total`,
    })
  }

  const clearTip = () => {
    setActive(null)
    setTip(null)
  }

  return (
    <div className="admin-chart admin-chart--donut">
      {title && <h3 className="admin-chart__title">{title}</h3>}
      <div className="admin-donut">
        <div className="admin-chart__plot admin-donut__plot">
          <svg
            viewBox="0 0 140 140"
            className={`admin-donut__svg${active !== null ? ' admin-donut__svg--has-hover' : ''}`}
            role="img"
            aria-label={title}
          >
            {slices.map((slice, i) => (
              <path
                key={slice.label}
                d={slice.d}
                fill={slice.color}
                className={`admin-donut__slice${active === i ? ' is-active' : ''}`}
                style={{ animationDelay: `${i * 0.08}s` }}
                onMouseEnter={() => showTip(slice, i)}
                onMouseLeave={clearTip}
              />
            ))}
            <circle cx={cx} cy={cy} r={32} fill="#fff" />
            <text x={cx} y={cy - 2} textAnchor="middle" className="admin-donut__total">{total.toLocaleString()}</text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="admin-donut__sub">Total</text>
          </svg>
          <ChartTooltip tip={tip} />
        </div>
        <ul className="admin-donut__legend">
          {slices.map((slice, i) => (
            <li
              key={slice.label}
              className={active === i ? 'is-active' : ''}
              onMouseEnter={() => showTip(slice, i)}
              onMouseLeave={clearTip}
            >
              <span className="admin-donut__dot" style={{ background: slice.color }} />
              <span>{slice.label}</span>
              <strong>{slice.value.toLocaleString()}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
