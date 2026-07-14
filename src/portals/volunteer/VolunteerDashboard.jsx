import StatusBadge from '../../components/admin/shared/StatusBadge'
import PortalStats from '../shared/PortalStats'
import { volunteerPortal } from '../../data/portalMockData'
import { Link } from 'react-router-dom'

export default function VolunteerDashboard() {
  return (
    <>
      <PortalStats items={volunteerPortal.stats} />
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Assigned Tasks</h2>
          <Link to="/volunteer-portal/tasks" className="portal-link">View all</Link>
        </div>
        <div className="portal-list">
          {volunteerPortal.tasks.map((task) => (
            <div key={task.id} className="portal-list-item">
              <div>
                <strong>{task.title}</strong>
                <span>Due: {task.due}</span>
              </div>
              <StatusBadge status={task.status} />
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
