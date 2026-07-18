import { useRef, useState } from 'react'
import ChartTooltip from './ChartTooltip'

export default function BarChart({ title, data, valueKey = 'value', labelKey = 'label', unit = '' }) {
  const plotRef = useRef(null)
  const [tip, setTip] = useState(null)
  const max = Math.max(...data.map((d) => d[valueKey]), 1)
  const total = data.reduce((sum, d) => sum + d[valueKey], 0)

  const showTip = (event, item, i) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect) return
    const prev = data[i - 1]
    let change = null
    let dir = 'flat'
    if (prev) {
      const prevVal = prev[valueKey]
      if (prevVal > 0) {
        const pct = ((item[valueKey] - prevVal) / prevVal) * 100
        dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
        change = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs ${prev[labelKey]}`
      } else if (item[valueKey] > 0) {
        change = `New vs ${prev[labelKey]}`
        dir = 'up'
      }
    }
    const share = total > 0 ? Math.round((item[valueKey] / total) * 100) : 0
    setTip({
      left: `${event.clientX - rect.left}px`,
      top: `${event.clientY - rect.top}px`,
      label: item[labelKey],
      value: `${unit}${item[valueKey].toLocaleString()}`,
      change,
      dir,
      sub: `${share}% of total`,
    })
  }

  return (
    <div className="admin-chart">
      {title && <h3 className="admin-chart__title">{title}</h3>}
      <div className="admin-chart__plot" ref={plotRef} onMouseLeave={() => setTip(null)}>
        <div className="admin-bar-chart">
          {data.map((item, i) => {
            const pct = (item[valueKey] / max) * 100
            return (
              <div
                key={item[labelKey]}
                className="admin-bar-chart__item"
                onMouseEnter={(e) => showTip(e, item, i)}
                onMouseMove={(e) => showTip(e, item, i)}
              >
                <span className="admin-bar-chart__label">{item[labelKey]}</span>
                <div className="admin-bar-chart__track">
                  <div
                    className="admin-bar-chart__fill"
                    style={{ width: `${pct}%`, animationDelay: `${i * 0.07}s` }}
                  >
                    <span className="admin-bar-chart__value">
                      {unit}{item[valueKey].toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <ChartTooltip tip={tip} />
      </div>
    </div>
  )
}
