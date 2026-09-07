import { useEffect, useState } from 'react'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { Menu, PanelLeft } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { isSuperAdminRole } from '../../../utils/roleRoutes'
import AdminSidebar from './AdminSidebar'
import AdminSecondarySidebar from './AdminSecondarySidebar'
import NotificationBell from '../shared/NotificationBell'
import UserProfileMenu from '../../shared/UserProfileMenu'

const pageTitles = {
  '/admin': 'Dashboard',
  '/admin/donations': 'Donation Processing',
  '/admin/donors': 'Donor Management',
  '/admin/beneficiaries': 'Barangays',
  '/admin/requests': 'Relief Requests',
  '/admin/inventory': 'Inventory Tracking',
  '/admin/allocation': 'Resource Allocation',
  '/admin/distributions': 'Logistics & Distribution',
  '/admin/volunteers': 'Volunteer & Intern Management',
  '/admin/staff': 'Staff Management',
  '/admin/admins': 'Admin Management',
  '/admin/reports': 'Reports & Analytics',
  '/admin/certificates': 'Certificates',
  '/admin/content': 'Content Management',
  '/admin/settings': 'Settings',
  '/admin/database': 'Database Management',
}

const SECONDARY_COLLAPSE_KEY = 'admin.secondarySidebar.collapsed'

function useBarangayModule(pathname) {
  return pathname.startsWith('/admin/beneficiaries') || pathname.startsWith('/admin/barangays')
}

const SUPER_ADMIN_ALLOWED_PATHS = ['/admin/admins', '/admin/settings', '/admin/database']

export default function AdminLayout() {
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminRole(user?.role, user)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [secondaryMobileOpen, setSecondaryMobileOpen] = useState(false)
  const [secondaryCollapsed, setSecondaryCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SECONDARY_COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const location = useLocation()
  const showSecondary = !isSuperAdmin && useBarangayModule(location.pathname)

  useEffect(() => {
    try {
      localStorage.setItem(SECONDARY_COLLAPSE_KEY, secondaryCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [secondaryCollapsed])

  useEffect(() => {
    setSidebarOpen(false)
    setSecondaryMobileOpen(false)
  }, [location.pathname])

  if (isSuperAdmin && !SUPER_ADMIN_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/admin/admins" replace />
  }

  let title = pageTitles[location.pathname]
  if (!title) {
    if (useBarangayModule(location.pathname) && location.pathname !== '/admin/beneficiaries') {
      title = 'Barangay Details'
    } else {
      title = 'Admin'
    }
  }

  const layoutClass = [
    'admin-layout',
    showSecondary ? 'admin-layout--secondary' : '',
    showSecondary && secondaryCollapsed ? 'admin-layout--secondary-collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={layoutClass}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {showSecondary && (
        <AdminSecondarySidebar
          collapsed={secondaryCollapsed}
          onToggleCollapse={() => setSecondaryCollapsed((c) => !c)}
          mobileOpen={secondaryMobileOpen}
          onMobileClose={() => setSecondaryMobileOpen(false)}
        />
      )}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-topbar__menu"
            aria-label="Toggle menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={19} />
          </button>

          {showSecondary && (
            <button
              type="button"
              className="admin-topbar__secondary-menu"
              aria-label="Toggle barangay list"
              onClick={() => setSecondaryMobileOpen(true)}
            >
              <PanelLeft size={18} />
              <span>Barangays</span>
            </button>
          )}

          <div className="admin-topbar__title-group">
            <h1 className="admin-topbar__title">{title}</h1>
          </div>

          <div className="admin-topbar__spacer" />

          <div className="admin-topbar__right">
            <NotificationBell linkPrefix="/admin" />
            <UserProfileMenu
              settingsPath="/admin/settings"
              roleLabel={isSuperAdmin ? 'Super Admin' : 'System Admin'}
            />
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
