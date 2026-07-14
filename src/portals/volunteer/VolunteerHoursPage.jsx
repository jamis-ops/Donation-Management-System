export default function VolunteerHoursPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Volunteer Hours</h2></div>
      <div className="portal-stats portal-stats--inline">
        <div className="portal-stat-card">
          <span className="portal-stat-card__value">48</span>
          <span className="portal-stat-card__label">Total Hours</span>
        </div>
        <div className="portal-stat-card">
          <span className="portal-stat-card__value">12</span>
          <span className="portal-stat-card__label">This Month</span>
        </div>
      </div>
      <p className="portal-note">Hours are updated after each completed activity.</p>
    </section>
  )
}
