import { TrendingUp, TrendingDown, HeartHandshake, Users, Package, Truck } from 'lucide-react'

const icons = {
  donations: HeartHandshake,
  beneficiaries: Users,
  inventory: Package,
  deliveries: Truck,
}

export default function StatCard({ label, value, change, trend, icon }) {
  const Icon = icons[icon] || HeartHandshake
  const TrendIcon = trend === 'down' ? TrendingDown : TrendingUp

  return (
    <article className={`admin-metric-card admin-metric-card--${trend || 'up'}`}>
      <div className="admin-metric-card__icon">
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="admin-metric-card__body">
        <span className="admin-metric-card__value">{value}</span>
        <span className="admin-metric-card__label">{label}</span>
        {change && (
          <span className="admin-metric-card__change">
            <TrendIcon size={13} />
            {change}
          </span>
        )}
      </div>
    </article>
  )
}
