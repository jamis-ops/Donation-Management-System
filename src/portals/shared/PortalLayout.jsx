import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import PortalSidebar from './PortalSidebar'

const titles = {
  '/donor': 'Donor Dashboard',
  '/donor/donations': 'My Donations',
  '/donor/certificates': 'Certificates & Official Receipts',
  '/volunteer-portal': 'Volunteer Dashboard',
  '/volunteer-portal/tasks': 'My Tasks',
  '/volunteer-portal/schedule': 'Volunteer Schedule',
  '/volunteer-portal/hours': 'Volunteer Hours',
  '/volunteer-portal/certificates': 'Volunteer Certificates',
  '/beneficiary': 'Beneficiary Dashboard',
  '/beneficiary/requests': 'My Assistance Requests',
  '/beneficiary/distributions': 'Scheduled Distributions',
  '/beneficiary/history': 'Assistance History',
  '/staff': 'Staff Dashboard',
  '/staff/donations': 'Donation Processing',
  '/staff/inventory': 'Inventory',
  '/staff/distributions': 'Distributions',
  '/staff/tasks': 'My Tasks',
}

export default function PortalLayout({ role }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] || 'Portal'

  return (
    <div className="portal-layout">
      <PortalSidebar role={role} open={open} onClose={() => setOpen(false)} />
      <div className="portal-main">
        <header className="portal-topbar">
          <button type="button" className="portal-topbar__menu" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div>
            <h1>{title}</h1>
            <p>Welcome back. Manage your {role.toLowerCase()} activities here.</p>
          </div>
        </header>
        <div className="portal-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
