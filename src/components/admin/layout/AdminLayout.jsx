import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AdminSidebar from './AdminSidebar'

const pageTitles = {
  '/admin': 'Dashboard',
  '/admin/donations': 'Donation Processing',
  '/admin/donors': 'Donor Management',
  '/admin/beneficiaries': 'Beneficiary Management',
  '/admin/inventory': 'Inventory Tracking',
  '/admin/allocation': 'Resource Allocation',
  '/admin/distributions': 'Distribution Logistics',
  '/admin/volunteers': 'Volunteer Management',
  '/admin/staff': 'Staff Management',
  '/admin/tasks': 'Task Management',
  '/admin/reports': 'Reports & Analytics',
  '/admin/certificates': 'Certificates & Official Receipts',
  '/admin/content': 'Website Content',
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
            <Menu size={20} />
          </button>
          <h1 className="admin-topbar__title">{title}</h1>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
