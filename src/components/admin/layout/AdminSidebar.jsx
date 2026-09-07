import { useEffect, useMemo, useState, useCallback } from 'react'
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
  ChevronDown,
  Settings,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import Logo from '../../shared/Logo'
import { adminBadgesApi } from '../../../api/resources'
import { BADGES_CHANGED } from '../../../utils/badgeSync'

function buildNav(isSuperAdmin) {
  // Super Admin: Admin Management & Settings
  if (isSuperAdmin) {
    return [
      {
        type: 'section',
        label: 'Administration',
        items: [
          { to: '/admin/admins', label: 'Admin Management', icon: Shield },
          { to: '/admin/settings', label: 'Settings', icon: Settings },
        ],
      },
    ]
  }

  const overview = {
    type: 'section',
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  }

  const peopleAndPartners = {
    type: 'section',
    label: 'People & Partners',
    items: [
      { to: '/admin/staff', label: 'Staff', icon: UserCog },
      { to: '/admin/donors', label: 'Donors', icon: HeartHandshake },
      { to: '/admin/volunteers', label: 'Volunteers & Interns', icon: UserCheck },
      { to: '/admin/beneficiaries', label: 'Barangays', icon: Building2 },
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
    ],
  }

  return [
    overview,
    peopleAndPartners,
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
  const [badges, setBadges] = useState({})

  const fetchBadges = useCallback(async () => {
    try {
      const res = await adminBadgesApi.get()
      if (res?.ok && res?.data) {
        setBadges(res.data)
      }
    } catch {
      // ignore badge fetch error in background
    }
  }, [])

  useEffect(() => {
    fetchBadges()
    const interval = setInterval(fetchBadges, 15000)
    const handleBadgeRefresh = () => {
      fetchBadges()
    }
    const handleFocus = () => {
      fetchBadges()
    }

    window.addEventListener(BADGES_CHANGED, handleBadgeRefresh)
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener(BADGES_CHANGED, handleBadgeRefresh)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchBadges])

  // Automatically mark section as seen when Admin visits it
  useEffect(() => {
    const knownSections = [
      '/admin/volunteers',
      '/admin/beneficiaries',
      '/admin/requests',
      '/admin/donations',
      '/admin/certificates',
      '/admin/distributions',
      '/admin/allocation',
    ]

    const matched = knownSections.find((route) => {
      if (route === '/admin/beneficiaries') {
        return pathname.startsWith('/admin/beneficiaries') || pathname.startsWith('/admin/barangays')
      }
      return pathname === route || pathname.startsWith(`${route}/`)
    })

    if (matched) {
      // Clear badge locally immediately
      setBadges((prev) => {
        if (!prev[matched]) return prev
        return { ...prev, [matched]: 0 }
      })
      // Persist seen timestamp in backend
      adminBadgesApi.markSeen(matched).catch(() => {})
    }
  }, [pathname, badges])

  useEffect(() => {
    nav.forEach((group) => {
      if (group.type !== 'dropdown') return
      if (isDropdownActive(pathname, group.children)) {
        setOpenMenus((prev) => (prev[group.id] ? prev : { ...prev, [group.id]: true }))
      }
    })
  }, [pathname, nav])

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
          <Logo
            to={isSuperAdmin ? (pathname === '/admin/database' ? '/admin/admins' : '/admin/database') : '/admin'}
            size="sm"
          />
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
                      size={15}
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
                        const count = badges[child.to] || 0
                        return (
                          <li key={`${child.to}-${child.label}`}>
                            <NavLink
                              to={child.to}
                              className={({ isActive }) =>
                                `admin-sidebar__sublink${isChildActive(pathname, child, isActive) ? ' admin-sidebar__sublink--active' : ''}`
                              }
                              onClick={onClose}
                            >
                              <span className="admin-sidebar__link-main">
                                <Icon size={15} strokeWidth={2} />
                                <span>{child.label}</span>
                              </span>
                              {count > 0 && (
                                <span className="admin-sidebar__badge admin-sidebar__badge--sub" aria-label={`${count} pending items`}>
                                  {count > 99 ? '99+' : count}
                                </span>
                              )}
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
                    const count = badges[item.to] || 0
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
                          <span className="admin-sidebar__link-main">
                            <Icon size={17} strokeWidth={2} />
                            <span>{item.label}</span>
                          </span>
                          {count > 0 && (
                            <span className="admin-sidebar__badge" aria-label={`${count} pending items`}>
                              {count > 99 ? '99+' : count}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

      </aside>
    </>
  )
}
