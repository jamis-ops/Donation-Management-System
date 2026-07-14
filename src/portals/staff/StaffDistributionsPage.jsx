import StatusBadge from '../../components/admin/shared/StatusBadge'

const distributions = [
  { location: 'Talisay', date: '2026-07-02', status: 'Scheduled' },
  { location: 'Minglanilla', date: '2026-07-08', status: 'Planning' },
]

export default function StaffDistributionsPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Distribution Schedule</h2></div>
      <div className="portal-list">
        {distributions.map((d) => (
          <div key={d.location} className="portal-list-item">
            <div>
              <strong>{d.location}</strong>
              <span>{d.date}</span>
            </div>
            <StatusBadge status={d.status} />
          </div>
        ))}
      </div>
    </section>
  )
}
