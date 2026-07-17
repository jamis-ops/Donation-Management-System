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
      {items.map((item) => {
        const Icon = iconMap[item.label]
        return (
          <div key={item.label} className="portal-stat-card">
            {Icon && (
              <div className="portal-stat-card__icon">
                <Icon size={18} strokeWidth={2} />
              </div>
            )}
            <span className="portal-stat-card__value">{item.value}</span>
            <span className="portal-stat-card__label">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}
