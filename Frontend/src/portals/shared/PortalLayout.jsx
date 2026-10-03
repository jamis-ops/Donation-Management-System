import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import PortalSidebar from './PortalSidebar'
import NotificationBell from '../../admin/components/shared/NotificationBell'
import UserProfileMenu from '../../components/shared/UserProfileMenu'

const titles = {
  '/donor': { title: 'Donor Dashboard', sub: 'Track your donations and certificates.' },
  '/donor/donations': { title: 'My Donations', sub: 'Full history of your contributions.' },
  '/donor/impact': { title: 'Donation Impact', sub: 'See where your donations went and the communities they reached.' },
  '/donor/certificates': { title: 'Certificates', sub: 'Download and manage your certificates.' },
  '/donor/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
  '/volunteer-portal': { title: 'Volunteer Dashboard', sub: 'Your tasks, schedule, and activities.' },
  '/volunteer-portal/tasks': { title: 'My Tasks', sub: 'Tasks assigned to you.' },
  '/volunteer-portal/distributions': { title: 'Assigned Distributions', sub: 'Read-only delivery plans assigned to your account.' },
  '/volunteer-portal/schedule': { title: 'Volunteer Schedule', sub: 'Upcoming events and shifts.' },
  '/volunteer-portal/certificates': { title: 'Certificates', sub: 'Service and participation certificates.' },
  '/volunteer-portal/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
  '/intern-portal': { title: 'Intern Dashboard', sub: 'Your duties, schedule, and activities.' },
  '/intern-portal/tasks': { title: 'My Tasks', sub: 'Internship tasks assigned to you.' },
  '/intern-portal/distributions': { title: 'Assigned Distributions', sub: 'Read-only delivery plans assigned to your account.' },
  '/intern-portal/schedule': { title: 'Intern Schedule', sub: 'Upcoming duties and events.' },
  '/intern-portal/hours': { title: 'Duty Hours', sub: 'Review your recorded internship hours.' },
  '/intern-portal/certificates': { title: 'Certificates', sub: 'Internship service and participation certificates.' },
  '/intern-portal/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
  '/beneficiary': { title: 'Barangay Dashboard', sub: 'Your requests and assistance status.' },
  '/beneficiary/requests': { title: 'My Assistance Requests', sub: 'Submit and track requests.' },
  '/beneficiary/proofs': { title: 'Submit Distribution Proof', sub: 'Upload photos or documents after receiving relief goods.' },
  '/beneficiary/history': { title: 'Assistance History', sub: 'Past assistance received.' },
  '/beneficiary/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
  '/staff': { title: 'Staff Dashboard', sub: 'Operations, tasks, and inventory.' },
  '/staff/donations': { title: 'Donations', sub: 'Review, verify funds, and manage donations.' },
  '/staff/inventory': { title: 'Inventory', sub: 'Current stock levels.' },
  '/staff/distributions': { title: 'Distributions', sub: 'Scheduled distribution events.' },
  '/staff/tasks': { title: 'My Tasks', sub: 'Tasks assigned to you.' },
  '/staff/settings': { title: 'Account Settings', sub: 'Update your profile and password.' },
}

const portalSettingsPaths = {
  Donor: '/donor/settings',
  Volunteer: '/volunteer-portal/settings',
  Intern: '/intern-portal/settings',
  Beneficiary: '/beneficiary/settings',
  Staff: '/staff/settings',
}

export default function PortalLayout({ role }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const page = titles[location.pathname] || { title: 'Portal', sub: '' }

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

          <div className="portal-topbar__actions">
            {(role === 'Staff' || role === 'Beneficiary' || role === 'Volunteer' || role === 'Intern' || role === 'Donor') && (
              <NotificationBell
                linkPrefix={
                  role === 'Staff'
                    ? '/staff'
                    : role === 'Volunteer' || role === 'Intern'
                      ? role === 'Intern' ? '/intern-portal' : '/volunteer-portal'
                      : role === 'Donor'
                        ? '/donor'
                        : '/beneficiary'
                }
              />
            )}
            <UserProfileMenu
              settingsPath={portalSettingsPaths[role] || '/admin/settings'}
              roleLabel={`${role} Portal`}
            />
          </div>
        </header>

        <div className="portal-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
