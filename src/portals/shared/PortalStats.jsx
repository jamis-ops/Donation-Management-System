export default function PortalStats({ items }) {
  return (
    <div className="portal-stats">
      {items.map((item) => (
        <div key={item.label} className="portal-stat-card">
          <span className="portal-stat-card__value">{item.value}</span>
          <span className="portal-stat-card__label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
