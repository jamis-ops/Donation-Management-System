import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  HeartHandshake,
  History,
  FileBadge,
  ClipboardList,
  CalendarDays,
  Clock3,
  Award,
  HandHeart,
  Package,
  Truck,
  ListTodo,
  LogOut,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/shared/Logo'

const portalMenus = {
  Donor: {
    title: 'Donor Portal',
    base: '/donor',
    items: [
      { to: '/donor', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/donor/donations', label: 'My Donations', icon: History },
      { to: '/donor/certificates', label: 'Certificates & OR', icon: FileBadge },
    ],
  },
  Volunteer: {
    title: 'Volunteer Portal',
    base: '/volunteer-portal',
    items: [
      { to: '/volunteer-portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/volunteer-portal/tasks', label: 'My Tasks', icon: ClipboardList },
      { to: '/volunteer-portal/schedule', label: 'Schedule', icon: CalendarDays },
      { to: '/volunteer-portal/hours', label: 'Volunteer Hours', icon: Clock3 },
      { to: '/volunteer-portal/certificates', label: 'Certificates', icon: Award },
    ],
  },
  Beneficiary: {
    title: 'Beneficiary Portal',
    base: '/beneficiary',
    items: [
      { to: '/beneficiary', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/beneficiary/requests', label: 'My Requests', icon: HandHeart },
      { to: '/beneficiary/distributions', label: 'Distributions', icon: Truck },
      { to: '/beneficiary/history', label: 'Assistance History', icon: History },
    ],
  },
  Staff: {
    title: 'Staff Portal',
    base: '/staff',
    items: [
      { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/staff/donations', label: 'Donations', icon: HeartHandshake },
      { to: '/staff/inventory', label: 'Inventory', icon: Package },
      { to: '/staff/distributions', label: 'Distributions', icon: Truck },
      { to: '/staff/tasks', label: 'My Tasks', icon: ListTodo },
    ],
  },
}

export default function PortalSidebar({ role, open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const menu = portalMenus[role]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (!menu) return null

  return (
    <>
      {open && <div className="portal-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`portal-sidebar${open ? ' portal-sidebar--open' : ''}`}>
        <div className="portal-sidebar__brand">
          <Logo to={menu.base} size="sm" />
          <span className="portal-sidebar__portal-name">{menu.title}</span>
        </div>

        <nav className="portal-sidebar__nav">
          <ul>
            {menu.items.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `portal-sidebar__link${isActive ? ' portal-sidebar__link--active' : ''}`
                    }
                    onClick={onClose}
                  >
                    <Icon size={18} strokeWidth={2} />
                    {item.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="portal-sidebar__footer">
          <div className="portal-sidebar__user">
            <div className="portal-sidebar__avatar">{user?.name?.charAt(0) || 'U'}</div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
          </div>
          <a href="/" className="portal-sidebar__link-btn" target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            Public Website
          </a>
          <button type="button" className="portal-sidebar__logout" onClick={handleLogout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
