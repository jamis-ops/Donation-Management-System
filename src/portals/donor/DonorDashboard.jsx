import { Link } from 'react-router-dom'
import {
  HeartHandshake, FileBadge, ArrowRight, Heart, Users,
  Package, Gift, Clock, CheckSquare, Award, Calendar,
  Trophy, Star, TrendingUp, Inbox, HandHeart, BadgeCheck, Lock, Check,
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
  handHeart: HandHeart,
  users: Users,
  trendingUp: TrendingUp,
  trophy: Trophy,
  star: Star,
  award: Award,
  gift: Gift,
  heartHandshake: HeartHandshake,
  calendar: Calendar,
  package: Package,
  badgeCheck: BadgeCheck,
}

function formatProgress(milestone) {
  if (milestone.unit === 'peso') {
    const cur = Number(milestone.current || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })
    const tgt = Number(milestone.target || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })
    return `₱${cur} / ₱${tgt}`
  }
  return `${milestone.current ?? 0} / ${milestone.target ?? 0}`
}

export default function DonorDashboard() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())

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

          <section className="portal-panel donor-achievements">
            <div className="portal-panel__header">
              <div>
                <h2>Milestone Achievements</h2>
                <p className="donor-achievements__sub">
                  Unlock badges as your contributions grow. Progress updates automatically from your donation record.
                </p>
              </div>
              <span className="portal-panel__count">
                {achievedMilestones.length} / {milestones.length || 0} unlocked
              </span>
            </div>

            {milestones.length === 0 ? (
              <div className="portal-empty">
                <Trophy size={28} />
                <p>Achievements will appear here once your donation history loads.</p>
              </div>
            ) : (
              <>
                <div className="donor-achievements-grid">
                  {milestones.map((milestone) => {
                    const Icon = milestoneIconMap[milestone.icon] || Trophy
                    const unlocked = Boolean(milestone.achieved)
                    const tier = milestone.tier || 'bronze'
                    return (
                      <article
                        key={milestone.id}
                        className={[
                          'donor-achievement',
                          unlocked ? 'donor-achievement--unlocked' : 'donor-achievement--locked',
                          `donor-achievement--${tier}`,
                        ].join(' ')}
                      >
                        <div className="donor-achievement__badge" aria-hidden>
                          <Icon size={22} strokeWidth={2.25} />
                          <span className="donor-achievement__seal">
                            {unlocked ? <Check size={12} strokeWidth={3} /> : <Lock size={11} />}
                          </span>
                        </div>
                        <div className="donor-achievement__body">
                          <div className="donor-achievement__top">
                            <strong>{milestone.title}</strong>
                            <span className={`donor-achievement__tier donor-achievement__tier--${tier}`}>
                              {tier}
                            </span>
                          </div>
                          <p>{milestone.description}</p>
                          {unlocked ? (
                            <span className="donor-achievement__unlocked">
                              Unlocked{milestone.date ? ` · ${milestone.date}` : ''}
                            </span>
                          ) : (
                            <div className="donor-achievement__progress">
                              <div className="donor-achievement__progress-meta">
                                <span>{formatProgress(milestone)}</span>
                                <span>{milestone.progress ?? 0}%</span>
                              </div>
                              <div
                                className="donor-achievement__bar"
                                role="progressbar"
                                aria-valuenow={milestone.progress ?? 0}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <span style={{ width: `${Math.min(100, milestone.progress ?? 0)}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {nextMilestone && (
                  <div className="donor-next-milestone">
                    <strong>Next unlock:</strong> {nextMilestone.title} — {nextMilestone.description}
                    {typeof nextMilestone.progress === 'number' ? ` (${nextMilestone.progress}% there)` : ''}
                  </div>
                )}
              </>
            )}
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
