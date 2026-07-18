export default function StockLevelBar({ level, percent, quantity, unit }) {
  const colors = {
    sufficient: { bar: '#16a34a', bg: 'rgba(22,163,74,0.12)', label: 'Sufficient' },
    moderate: { bar: '#d97706', bg: 'rgba(217,119,6,0.12)', label: 'Moderate' },
    low: { bar: '#dc2626', bg: 'rgba(220,38,38,0.12)', label: 'Low Stock' },
  }
  const c = colors[level] || colors.sufficient
  const width = Math.min(100, Math.max(8, percent ?? 50))

  return (
    <div className="stock-bar">
      <div className="stock-bar__header">
        <span className="stock-bar__label" style={{ color: c.bar }}>{c.label}</span>
        <span className="stock-bar__qty">{quantity} {unit}</span>
      </div>
      <div className="stock-bar__track" style={{ background: c.bg }}>
        <div className="stock-bar__fill" style={{ width: `${width}%`, background: c.bar }} />
      </div>
    </div>
  )
}
