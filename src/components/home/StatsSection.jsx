import {
  Coins,
  Users,
  Package,
  UserCheck,
  ClipboardList,
  Building2,
  MapPinned,
} from 'lucide-react'
import { impactStats } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'

const statIcons = [
  Coins,
  Users,
  Package,
  UserCheck,
  ClipboardList,
  Building2,
  MapPinned,
]

export default function StatsSection() {
  return (
    <section id="impact" className="section stats-section">
      <div className="container">
        <SectionHeading
          eyebrow="Impact Statistics"
          title="Our achievements at a glance"
          description="Transparent metrics reflecting the collective impact of donors, volunteers, and partners."
        />
        <div className="stats-grid">
          {impactStats.map((stat, index) => {
            const Icon = statIcons[index]
            return (
              <div key={stat.label} className="stat-card">
                <span className="stat-card__icon" aria-hidden="true">
                  {Icon && <Icon size={24} strokeWidth={2} />}
                </span>
                <span className="stat-card__value">{stat.value}</span>
                <span className="stat-card__label">{stat.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
