import { volunteerPortal } from '../../data/portalMockData'

export default function VolunteerSchedulePage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Upcoming Schedule</h2></div>
      <div className="portal-list">
        {volunteerPortal.schedule.map((item) => (
          <div key={item.date + item.event} className="portal-list-item">
            <div>
              <strong>{item.event}</strong>
              <span>{item.date} · {item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
