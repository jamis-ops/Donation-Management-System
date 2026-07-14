import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  HeartHandshake,
  Package,
  GitBranch,
  Truck,
  Users,
  UserCheck,
  UserCog,
  ListTodo,
  BarChart3,
  FileBadge,
  Globe,
  LogOut,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import Logo from '../../shared/Logo'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/beneficiaries', label: 'Beneficiaries', icon: Users },
  { to: '/admin/donations', label: 'Donations', icon: HeartHandshake },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/allocation', label: 'Resource Allocation', icon: GitBranch },
  { to: '/admin/distributions', label: 'Logistics & Distribution', icon: Truck },
  { to: '/admin/tasks', label: 'Task Board', icon: ListTodo },
  { to: '/admin/volunteers', label: 'Volunteers', icon: UserCheck },
  { to: '/admin/donors', label: 'Donors', icon: UserCog },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/certificates', label: 'Certificates & OR', icon: FileBadge },
  { to: '/admin/content', label: 'Website Content', icon: Globe },
  { to: '/admin/staff', label: 'Staff', icon: UserCog },
]

export default function AdminSidebar({ open, onClose }) {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/admin/login'
  }

  return (
    <>
      {open && <div className="admin-sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`admin-sidebar${open ? ' admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar__brand">
          <Logo to="/admin" size="sm" />
        </div>

        <nav className="admin-sidebar__nav">
          <ul>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
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

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__avatar">{user?.name?.charAt(0) || 'A'}</div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
          </div>
          <a href="/" className="admin-sidebar__link-btn" target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Public Site
          </a>
          <button type="button" className="admin-sidebar__logout" onClick={handleLogout}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
