import { useEffect, useState } from 'react'
import {
  Coins,
  Users,
  Package,
  UserCheck,
  ClipboardList,
  Building2,
  MapPinned,
} from 'lucide-react'
import { impactStats as mockStats } from '../../data/mockData'
import { fetchPublishedContent } from '../../api/resources'
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

function mapCmsStat(item) {
  const meta = item.meta || {}
  return {
    label: item.title,
    value: meta.value || item.summary || '',
  }
}

export default function StatsSection() {
  const [stats, setStats] = useState(mockStats)

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('impact', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        setStats(items.map(mapCmsStat))
      }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <section id="impact" className="section stats-section">
      <div className="container">
        <SectionHeading
          eyebrow="Impact Statistics"
          title="Our achievements at a glance"
          description="Transparent metrics reflecting the collective impact of donors, volunteers, and partners."
        />
        <div className="stats-grid">
          {stats.map((stat, index) => {
            const Icon = statIcons[index % statIcons.length]
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
