import StatusBadge from '../../components/admin/shared/StatusBadge'
import { beneficiaryPortal } from '../../data/portalMockData'

export default function BeneficiaryDistributionsPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Scheduled Distributions</h2></div>
      <div className="portal-list">
        {beneficiaryPortal.distributions.map((d) => (
          <div key={d.date + d.location} className="portal-list-item">
            <div>
              <strong>{d.location}</strong>
              <span>{d.date} · {d.type}</span>
            </div>
            <StatusBadge status={d.status} />
          </div>
        ))}
      </div>
    </section>
  )
}
