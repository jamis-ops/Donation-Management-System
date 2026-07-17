export default function BarChart({ title, data, valueKey = 'value', labelKey = 'label', unit = '' }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1)

  return (
    <div className="admin-chart">
      {title && <h3 className="admin-chart__title">{title}</h3>}
      <div className="admin-bar-chart">
        {data.map((item) => {
          const pct = (item[valueKey] / max) * 100
          return (
            <div key={item[labelKey]} className="admin-bar-chart__item">
              <span className="admin-bar-chart__label">{item[labelKey]}</span>
              <div className="admin-bar-chart__track">
                <div className="admin-bar-chart__fill" style={{ width: `${pct}%` }}>
                  <span className="admin-bar-chart__value">
                    {unit}{item[valueKey].toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
