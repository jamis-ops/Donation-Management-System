import { Link } from 'react-router-dom'
import {
  HeartHandshake,
  Users,
  Package,
  ClipboardList,
  Clock,
  Award,
  CheckCircle,
  Calendar,
} from 'lucide-react'

const iconMap = {
  'Total Donated': HeartHandshake,
  'Donations Made': HeartHandshake,
  'Pending Verification': ClipboardList,
  'Certificates Ready': Award,
  'Hours Rendered': Clock,
  'Assigned Tasks': ClipboardList,
  'Upcoming Events': Calendar,
  Certificates: Award,
  'Active Requests': ClipboardList,
  'Approved Assistance': CheckCircle,
  'Scheduled Pickups': Calendar,
  'Total Received': Package,
  'Donations to Verify': HeartHandshake,
  'Inventory Updates': Package,
  'Distributions Today': Users,
}

export default function PortalStats({ items }) {
  return (
    <div className="portal-stats">
      {(items || []).map((item) => {
        const Icon = iconMap[item.label] || item.icon
        const destination = item.to || item.link || item.href
        const cardContent = (
          <>
            {Icon && (
              <div className="portal-stat-card__icon">
                {typeof Icon === 'function' ? <Icon size={18} strokeWidth={2} /> : null}
              </div>
            )}
            <span className="portal-stat-card__value">{item.value}</span>
            <span className="portal-stat-card__label">{item.label}</span>
          </>
        )

        if (destination) {
          return (
            <Link
              key={item.label}
              to={destination}
              className={`portal-stat-card portal-stat-card--clickable ${item.active ? 'portal-stat-card--active' : ''}`}
              title={`View ${item.label}`}
            >
              {cardContent}
            </Link>
          )
        }

        if (item.onClick) {
          return (
            <div
              key={item.label}
              className={`portal-stat-card portal-stat-card--clickable ${item.active ? 'portal-stat-card--active' : ''}`}
              onClick={item.onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.onClick(e) } }}
              title={`Filter by ${item.label}`}
            >
              {cardContent}
            </div>
          )
        }

        return (
          <div key={item.label} className="portal-stat-card">
            {cardContent}
          </div>
        )
      })}
    </div>
  )
}
