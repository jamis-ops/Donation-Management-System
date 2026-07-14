import { useAuth } from '../context/AuthContext'

export default function PortalPlaceholderPage() {
  const { user } = useAuth()

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Portal</h1>
          <p>
            Logged in as <strong>{user?.name || 'User'}</strong> ({user?.role || 'Role'}).
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <div className="info-panel">
            <h2>Next step</h2>
            <p>
              Your <strong>{user?.role}</strong> dashboard will be built next (database is ready for
              login). Tell me which portal you want first: Donor, Volunteer, Beneficiary, or Staff.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

