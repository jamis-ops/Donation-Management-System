import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AdminSidebar from './AdminSidebar'
import NotificationBell from '../shared/NotificationBell'

const pageTitles = {
  '/admin': 'Dashboard',
  '/admin/donations': 'Donation Processing',
  '/admin/donors': 'Donor Management',
  '/admin/beneficiaries': 'Beneficiary Management',
  '/admin/inventory': 'Inventory Tracking',
  '/admin/allocation': 'Resource Allocation',
  '/admin/distributions': 'Logistics & Distribution',
  '/admin/volunteers': 'Volunteer Management',
  '/admin/staff': 'Staff Management',
  '/admin/reports': 'Reports & Analytics',
  '/admin/certificates': 'Certificates',
  '/admin/content': 'Content Management',
  '/admin/settings': 'Account Settings',
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Admin'

  return (
    <div className="admin-layout">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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

          <div className="admin-topbar__title-group">
            <h1 className="admin-topbar__title">{title}</h1>
          </div>

          <div className="admin-topbar__spacer" />

          <div className="admin-topbar__right">
            <NotificationBell linkPrefix="/admin" />
            <span className="admin-topbar__badge">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--admin-brand)',
                  display: 'inline-block',
                }}
              />
              Rise Above Foundation
            </span>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
