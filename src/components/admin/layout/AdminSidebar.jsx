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

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin/beneficiaries', label: 'Beneficiaries', icon: Users },
      { to: '/admin/donors', label: 'Donors', icon: HeartHandshake },
      { to: '/admin/volunteers', label: 'Volunteers', icon: UserCheck },
      { to: '/admin/staff', label: 'Staff', icon: UserCog },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/donations', label: 'Donations', icon: HeartHandshake },
      { to: '/admin/inventory', label: 'Inventory', icon: Package },
      { to: '/admin/allocation', label: 'Resource Allocation', icon: GitBranch },
      { to: '/admin/distributions', label: 'Logistics & Distribution', icon: Truck },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/tasks', label: 'Task Board', icon: ListTodo },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { to: '/admin/certificates', label: 'Certificates & OR', icon: FileBadge },
      { to: '/admin/content', label: 'Content Management', icon: Globe },
    ],
  },
]

export default function AdminSidebar({ open, onClose }) {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/admin/login'
  }

  return (
    <>
      {open && (
        <div
          className="admin-sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`admin-sidebar${open ? ' admin-sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="admin-sidebar__brand">
          <Logo to="/admin" size="sm" />
        </div>

        {/* Navigation */}
        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="admin-sidebar__divider" />}
              <span className="admin-sidebar__section-label">{group.label}</span>
              <ul>
                {group.items.map((item) => {
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
                        <Icon size={17} strokeWidth={2} />
                        {item.label}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div>
              <strong>{user?.name || 'Admin'}</strong>
              <span>{user?.role || 'Administrator'}</span>
            </div>
          </div>

          <a
            href="/"
            className="admin-sidebar__link-btn"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} />
            View Public Site
          </a>

          <button
            type="button"
            className="admin-sidebar__logout"
            onClick={handleLogout}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
