import StatusBadge from '../../components/admin/shared/StatusBadge'
import PortalStats from '../shared/PortalStats'
import { staffPortal } from '../../data/portalMockData'

export default function StaffDashboard() {
  return (
    <>
      <PortalStats items={staffPortal.stats} />
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Assigned Tasks</h2></div>
        <div className="portal-list">
          {staffPortal.tasks.map((task) => (
            <div key={task.id} className="portal-list-item">
              <div>
                <strong>{task.title}</strong>
                <span>Due: {task.due}</span>
              </div>
              <StatusBadge status={task.priority} />
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
