export default function DonutChart({ title, data, labelKey = 'label', valueKey = 'value' }) {
  const total = data.reduce((sum, d) => sum + d[valueKey], 0)
  const colors = ['#AF101A', '#C42828', '#D64545', '#7A0B12', '#E88989']
  let cumulative = 0
  const radius = 54
  const cx = 70
  const cy = 70

  const slices = data.map((item, i) => {
    const start = cumulative / total
    cumulative += item[valueKey]
    const end = cumulative / total
    const startAngle = start * 2 * Math.PI - Math.PI / 2
    const endAngle = end * 2 * Math.PI - Math.PI / 2
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const large = end - start > 0.5 ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
    return { d, color: colors[i % colors.length], label: item[labelKey], value: item[valueKey] }
  })

  return (
    <div className="admin-chart admin-chart--donut">
      {title && <h3 className="admin-chart__title">{title}</h3>}
      <div className="admin-donut">
        <svg viewBox="0 0 140 140" className="admin-donut__svg" role="img" aria-label={title}>
          {slices.map((slice) => (
            <path key={slice.label} d={slice.d} fill={slice.color} />
          ))}
          <circle cx={cx} cy={cy} r={32} fill="#fff" />
          <text x={cx} y={cy - 2} textAnchor="middle" className="admin-donut__total">{total.toLocaleString()}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" className="admin-donut__sub">Total</text>
        </svg>
        <ul className="admin-donut__legend">
          {slices.map((slice) => (
            <li key={slice.label}>
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
