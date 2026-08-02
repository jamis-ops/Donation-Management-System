import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  HeartHandshake,
  Package,
  GitBranch,
  Truck,
  Building2,
  FileText,
  UserCheck,
  UserCog,
  Users,
  Shield,
  BarChart3,
  FileBadge,
  Globe,
  Settings,
  LogOut,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import Logo from '../../shared/Logo'

function buildNav(isSuperAdmin) {
  const overview = {
    type: 'section',
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  }

  const operations = {
    type: 'section',
    label: 'Operations',
    items: [
      { to: '/admin/requests', label: 'Relief Requests', icon: FileText },
      { to: '/admin/donations', label: 'Donations', icon: HeartHandshake },
      { to: '/admin/inventory', label: 'Inventory', icon: Package },
      { to: '/admin/allocation', label: 'Resource Allocation', icon: GitBranch },
      { to: '/admin/distributions', label: 'Logistics & Distribution', icon: Truck },
    ],
  }

  const management = {
    type: 'section',
    label: 'Management',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { to: '/admin/certificates', label: 'Certificates', icon: FileBadge },
      { to: '/admin/content', label: 'Content Management', icon: Globe },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  }

  // Super Admin: User Management dropdown (Admin + people accounts)
  if (isSuperAdmin) {
    return [
      overview,
      {
        type: 'dropdown',
        id: 'user-management',
        label: 'User Management',
        icon: Users,
        children: [
          { to: '/admin/admins', path: '/admin/admins', label: 'Admin Accounts', icon: Shield },
          { to: '/admin/staff', path: '/admin/staff', label: 'Staff Accounts', icon: UserCog },
          { to: '/admin/donors', path: '/admin/donors', label: 'Donors', icon: HeartHandshake },
          { to: '/admin/volunteers', path: '/admin/volunteers', label: 'Volunteers', icon: UserCheck },
          { to: '/admin/beneficiaries', path: '/admin/beneficiaries', label: 'Barangays', icon: Building2 },
        ],
      },
      operations,
      management,
    ]
  }

  // Admin: original flat People & Partners (no dropdown)
  return [
    overview,
    {
      type: 'section',
      label: 'People & Partners',
      items: [
        { to: '/admin/donors', label: 'Donors', icon: HeartHandshake },
        { to: '/admin/beneficiaries', label: 'Barangays', icon: Building2 },
        { to: '/admin/volunteers', label: 'Volunteers', icon: UserCheck },
        { to: '/admin/staff', label: 'Staff', icon: UserCog },
      ],
    },
    operations,
    management,
  ]
}

function isItemActive(pathname, item, navIsActive) {
  if (item.to === '/admin/beneficiaries') {
    return pathname.startsWith('/admin/beneficiaries') || pathname.startsWith('/admin/barangays')
  }
  return navIsActive
}

function isChildActive(pathname, child, navIsActive) {
  if (child.path === '/admin/beneficiaries') {
    return pathname.startsWith('/admin/beneficiaries') || pathname.startsWith('/admin/barangays')
  }
  return navIsActive
}

function isDropdownActive(pathname, children) {
  return children.some((child) => {
    if (child.path === '/admin/beneficiaries') {
      return pathname.startsWith('/admin/beneficiaries') || pathname.startsWith('/admin/barangays')
    }
    return pathname === child.path || pathname.startsWith(`${child.path}/`)
  })
}

export default function AdminSidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const isSuperAdmin = user?.role === 'SuperAdmin' || !!user?.isSuperAdmin
  const nav = useMemo(() => buildNav(isSuperAdmin), [isSuperAdmin])

  const [openMenus, setOpenMenus] = useState(() => ({ 'user-management': true }))

  useEffect(() => {
    nav.forEach((group) => {
      if (group.type !== 'dropdown') return
      if (isDropdownActive(pathname, group.children)) {
        setOpenMenus((prev) => (prev[group.id] ? prev : { ...prev, [group.id]: true }))
      }
    })
  }, [pathname, nav])

  const handleLogout = async () => {
    await logout()
    window.location.href = '/admin/login'
  }

  const toggleMenu = (id) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }))
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
        <div className="admin-sidebar__brand">
          <Logo to="/admin" size="sm" />
        </div>

        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          {nav.map((group, gi) => {
            if (group.type === 'dropdown') {
              const expanded = !!openMenus[group.id]
              const parentActive = isDropdownActive(pathname, group.children)
              const ParentIcon = group.icon

              return (
                <div key={group.id} className="admin-sidebar__dropdown">
                  {gi > 0 && <div className="admin-sidebar__divider" />}
                  <button
                    type="button"
                    className={`admin-sidebar__dropdown-trigger${parentActive ? ' admin-sidebar__dropdown-trigger--active' : ''}`}
                    aria-expanded={expanded}
                    aria-controls={`admin-nav-${group.id}`}
                    onClick={() => toggleMenu(group.id)}
                  >
                    <span className="admin-sidebar__dropdown-trigger-main">
                      <ParentIcon size={17} strokeWidth={2} />
                      {group.label}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`admin-sidebar__chevron${expanded ? ' admin-sidebar__chevron--open' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  <div
                    id={`admin-nav-${group.id}`}
                    className={`admin-sidebar__submenu${expanded ? ' admin-sidebar__submenu--open' : ''}`}
                    hidden={!expanded}
                  >
                    <ul className="admin-sidebar__submenu-list">
                      {group.children.map((child) => {
                        const Icon = child.icon
                        return (
                          <li key={`${child.to}-${child.label}`}>
                            <NavLink
                              to={child.to}
                              className={({ isActive }) =>
                                `admin-sidebar__sublink${isChildActive(pathname, child, isActive) ? ' admin-sidebar__sublink--active' : ''}`
                              }
                              onClick={onClose}
                            >
                              <Icon size={15} strokeWidth={2} />
                              {child.label}
                            </NavLink>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              )
            }

            return (
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
                            `admin-sidebar__link${isItemActive(pathname, item, isActive) ? ' admin-sidebar__link--active' : ''}`
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
            )
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div>
              <strong>{user?.name || 'Admin'}</strong>
              <span>
                {isSuperAdmin ? 'Super Admin' : (user?.role || 'Administrator')}
              </span>
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
