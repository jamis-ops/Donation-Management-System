import { Link } from 'react-router-dom'
import {
  HeartHandshake, FileBadge, ArrowRight, Heart, Users, GraduationCap,
  Stethoscope, Home, Package, Gift, Clock, CheckSquare, Award, Calendar,
  Trophy, Star, TrendingUp, Inbox,
} from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

const iconMap = {
  heartHandshake: HeartHandshake,
  gift: Gift,
  clock: Clock,
  award: Award,
}

const activityIconMap = {
  checkCircle: CheckSquare,
  heart: Heart,
  package: Package,
  fileText: FileBadge,
  upload: ArrowRight,
}

const milestoneIconMap = {
  heart: Heart,
  trophy: Trophy,
  calendar: Calendar,
  star: Star,
  users: Users,
  award: Award,
}

const emptyImpact = {
  familiesHelped: 0,
  mealsProvided: 0,
  childrenEducated: 0,
  medicalConsultations: 0,
  housesBuilt: 0,
  disasterReliefPackages: 0,
}

export default function DonorDashboard() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())

  const impact = data?.impactStats || emptyImpact
  const donations = data?.donations || []
  const milestones = data?.milestones || []
  const activity = data?.recentActivity || []
  const achievedMilestones = milestones.filter((m) => m.achieved)
  const nextMilestone = milestones.find((m) => !m.achieved)

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <div className="portal-stats">
            {(data.stats || []).map((item) => {
              const Icon = iconMap[item.icon]
              return (
                <div key={item.label} className="portal-stat-card">
                  {Icon && (
                    <div className="portal-stat-card__icon">
                      <Icon size={20} />
                    </div>
                  )}
                  <span className="portal-stat-card__value">{item.value}</span>
                  <span className="portal-stat-card__label">{item.label}</span>
                </div>
              )
            })}
          </div>

          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Your Impact Summary</h2>
              <Link to="/donor/impact" className="portal-panel__link">View Details</Link>
            </div>
            <div className="donor-impact-grid">
              <div className="donor-impact-card">
                <div className="donor-impact-card__icon">
                  <Users size={24} />
                </div>
                <div className="donor-impact-card__content">
                  <span className="donor-impact-card__value">{impact.familiesHelped}</span>
                  <span className="donor-impact-card__label">Families Helped</span>
                </div>
              </div>
              <div className="donor-impact-card">
                <div className="donor-impact-card__icon donor-impact-card__icon--green">
                  <Heart size={24} />
                </div>
                <div className="donor-impact-card__content">
                  <span className="donor-impact-card__value">{Number(impact.mealsProvided || 0).toLocaleString()}</span>
                  <span className="donor-impact-card__label">Meals Provided</span>
                </div>
              </div>
              <div className="donor-impact-card">
                <div className="donor-impact-card__icon donor-impact-card__icon--blue">
                  <GraduationCap size={24} />
                </div>
                <div className="donor-impact-card__content">
                  <span className="donor-impact-card__value">{impact.childrenEducated}</span>
                  <span className="donor-impact-card__label">Children Educated</span>
                </div>
              </div>
              <div className="donor-impact-card">
                <div className="donor-impact-card__icon donor-impact-card__icon--purple">
                  <Stethoscope size={24} />
                </div>
                <div className="donor-impact-card__content">
                  <span className="donor-impact-card__value">{impact.medicalConsultations}</span>
                  <span className="donor-impact-card__label">Medical Consultations</span>
                </div>
              </div>
              <div className="donor-impact-card">
                <div className="donor-impact-card__icon donor-impact-card__icon--orange">
                  <Home size={24} />
                </div>
                <div className="donor-impact-card__content">
                  <span className="donor-impact-card__value">{impact.housesBuilt}</span>
                  <span className="donor-impact-card__label">Houses Built</span>
                </div>
              </div>
              <div className="donor-impact-card">
                <div className="donor-impact-card__icon donor-impact-card__icon--crimson">
                  <Package size={24} />
                </div>
                <div className="donor-impact-card__content">
                  <span className="donor-impact-card__value">{impact.disasterReliefPackages}</span>
                  <span className="donor-impact-card__label">Relief Packages</span>
                </div>
              </div>
            </div>
          </section>

          <section className="portal-panel portal-quick-actions">
            <div className="portal-panel__header">
              <h2>Quick Actions</h2>
            </div>
            <div className="portal-quick-actions__grid">
              <Link to="/donate" className="portal-quick-action">
                <HeartHandshake size={24} />
                <span>Make Donation</span>
              </Link>
              <Link to="/donor/donations" className="portal-quick-action">
                <TrendingUp size={24} />
                <span>Track Donations</span>
              </Link>
              <Link to="/donor/impact" className="portal-quick-action">
                <Heart size={24} />
                <span>View Impact</span>
              </Link>
              <Link to="/donor/certificates" className="portal-quick-action">
                <FileBadge size={24} />
                <span>Certificates</span>
              </Link>
            </div>
          </section>

          <div className="portal-dashboard-grid">
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Recent Donations</h2>
                <Link to="/donor/donations" className="portal-panel__link">View All</Link>
              </div>
              {donations.length === 0 ? (
                <div className="portal-empty">
                  <Gift size={28} />
                  <p>No donations yet. Make your first contribution to get started.</p>
                </div>
              ) : (
                <ul className="donor-donation-list">
                  {donations.slice(0, 5).map((d) => (
                    <li key={d.id} className="donor-donation-item">
                      <div className="donor-donation-item__main">
                        <strong>{d.amount}</strong>
                        <span>{d.type} · {d.date}</span>
                        {d.program && (
                          <span className="donor-donation-item__program">{d.program}</span>
                        )}
                      </div>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Recent Activity</h2>
              </div>
              {activity.length === 0 ? (
                <div className="portal-empty">
                  <Inbox size={28} />
                  <p>Activity updates will appear here as your donations progress.</p>
                </div>
              ) : (
                <ul className="portal-activity-list">
                  {activity.slice(0, 5).map((item, idx) => {
                    const Icon = activityIconMap[item.icon] || CheckSquare
                    return (
                      <li key={`${item.title}-${idx}`} className="portal-activity-item">
                        <div className="portal-activity-item__icon">
                          <Icon size={16} />
                        </div>
                        <div className="portal-activity-item__content">
                          <strong>{item.title}</strong>
                          <span className="portal-activity-item__date">{item.date}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Your Milestones</h2>
              <span className="portal-panel__count">{achievedMilestones.length} achieved</span>
            </div>
            <div className="donor-milestones-grid">
              {milestones.slice(0, 6).map((milestone) => {
                const Icon = milestoneIconMap[milestone.icon] || Trophy
                return (
                  <div
                    key={milestone.id}
                    className={`donor-milestone ${milestone.achieved ? 'donor-milestone--achieved' : 'donor-milestone--locked'}`}
                  >
                    <div className="donor-milestone__icon">
                      <Icon size={20} />
                    </div>
                    <div className="donor-milestone__content">
                      <strong>{milestone.title}</strong>
                      <span>{milestone.description}</span>
                      {milestone.achieved && milestone.date && (
                        <span className="donor-milestone__date">Achieved {milestone.date}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {nextMilestone && (
              <div className="donor-next-milestone">
                <strong>Next Milestone:</strong> {nextMilestone.title} — {nextMilestone.description}
              </div>
            )}
          </section>

          <div className="portal-actions">
            <Link to="/donate" className="btn btn--primary">
              <HeartHandshake size={16} /> Make a Donation
            </Link>
            <Link to="/donor/donations" className="btn btn--outline">Track My Donations</Link>
            <Link to="/donor/certificates" className="btn btn--outline">
              <FileBadge size={16} /> Certificates
            </Link>
          </div>
        </>
      )}
    </ApiState>
  )
}
