import StatusBadge from '../../components/admin/shared/StatusBadge'

export default function VolunteerCertificatesPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Volunteer Certificates</h2></div>
      <div className="portal-list">
        <div className="portal-list-item">
          <div>
            <strong>Certificate of Volunteer Service</strong>
            <span>Toledo Medical Mission — 2026-06-28</span>
          </div>
          <StatusBadge status="Generated" />
        </div>
      </div>
    </section>
  )
}
