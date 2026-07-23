import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import PortalSidebar from './PortalSidebar'
import NotificationBell from '../../components/admin/shared/NotificationBell'

const titles = {
  '/donor': { title: 'Donor Dashboard', sub: 'Track your donations and certificates.' },
  '/donor/donations': { title: 'My Donations', sub: 'Full history of your contributions.' },
  '/donor/certificates': { title: 'Certificates', sub: 'Download and manage your certificates.' },
  '/donor/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
  '/volunteer-portal': { title: 'Volunteer Dashboard', sub: 'Your tasks, schedule, and hours.' },
  '/volunteer-portal/tasks': { title: 'My Tasks', sub: 'Tasks assigned to you.' },
  '/volunteer-portal/schedule': { title: 'Volunteer Schedule', sub: 'Upcoming events and shifts.' },
  '/volunteer-portal/hours': { title: 'Volunteer Hours', sub: 'Logged hours and activity record.' },
  '/volunteer-portal/certificates': { title: 'Certificates', sub: 'Service and participation certificates.' },
  '/volunteer-portal/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
  '/beneficiary': { title: 'Beneficiary Dashboard', sub: 'Your requests and assistance status.' },
  '/beneficiary/requests': { title: 'My Assistance Requests', sub: 'Submit and track requests.' },
  '/beneficiary/distributions': { title: 'Scheduled Distributions', sub: 'Upcoming pickups and deliveries.' },
  '/beneficiary/proofs': { title: 'Submit Distribution Proof', sub: 'Upload photos or documents after receiving relief goods.' },
  '/beneficiary/history': { title: 'Assistance History', sub: 'Past assistance received.' },
  '/beneficiary/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
  '/staff': { title: 'Staff Dashboard', sub: 'Operations, tasks, and inventory.' },
  '/staff/donations': { title: 'Donation Processing', sub: 'Donations pending your action.' },
  '/staff/inventory': { title: 'Inventory', sub: 'Current stock levels.' },
  '/staff/distributions': { title: 'Distributions', sub: 'Scheduled distribution events.' },
  '/staff/tasks': { title: 'My Tasks', sub: 'Tasks assigned to you.' },
  '/staff/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
}

const roleBadgeColor = {
  Donor: '#AF101A',
  Volunteer: '#2563eb',
  Beneficiary: '#16a34a',
  Staff: '#d97706',
}

export default function PortalLayout({ role }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const page = titles[location.pathname] || { title: 'Portal', sub: '' }
  const badgeColor = roleBadgeColor[role] || '#AF101A'

  return (
    <div className="portal-layout">
      <PortalSidebar role={role} open={open} onClose={() => setOpen(false)} />

      <div className="portal-main">
        <header className="portal-topbar">
          <button
            type="button"
            className="portal-topbar__menu"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>

          <div className="portal-topbar__info">
            <h1>{page.title}</h1>
            {page.sub && <p>{page.sub}</p>}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {(role === 'Staff' || role === 'Beneficiary' || role === 'Volunteer' || role === 'Donor') && (
              <NotificationBell
                linkPrefix={
                  role === 'Staff'
                    ? '/staff'
                    : role === 'Volunteer'
                      ? '/volunteer-portal'
                      : role === 'Donor'
                        ? '/donor'
                        : '/beneficiary'
                }
              />
            )}
            <span
              className="portal-topbar__badge"
              style={{
                background: `${badgeColor}14`,
                color: badgeColor,
              }}
            >
              {role} Portal
            </span>
          </div>
        </header>

        <div className="portal-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
