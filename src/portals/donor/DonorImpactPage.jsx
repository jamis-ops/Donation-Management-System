import { Link } from 'react-router-dom'
import { Users, Heart, GraduationCap, Stethoscope, Home, Package, TrendingUp, MapPin, Calendar, ExternalLink } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

const emptyImpact = {
  familiesHelped: 0,
  mealsProvided: 0,
  childrenEducated: 0,
  medicalConsultations: 0,
  housesBuilt: 0,
  disasterReliefPackages: 0,
}

export default function DonorImpactPage() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const selectedYear = new Date().getFullYear()
  const impact = data?.impactStats || emptyImpact
  const donations = data?.donations || []
  const byMonth = data?.donationsByMonth || []
  const maxMonthlyAmount = Math.max(...byMonth.map((m) => Number(m.total || 0)), 1)
  const totalLabel = (data?.stats?.[0]?.value || '₱0').replace(/^₱/, '')

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <section className="donor-impact-hero">
            <div className="donor-impact-hero__content">
              <h1>Your Impact Story</h1>
              <p>Together, we're making a difference in the lives of families and communities across Cebu. Thank you for your generous support!</p>
            </div>
            <div className="donor-impact-hero__stats">
              <div className="donor-impact-hero__stat">
                <span className="donor-impact-hero__value">{impact.familiesHelped}</span>
                <span className="donor-impact-hero__label">Families Helped</span>
              </div>
              <div className="donor-impact-hero__stat">
                <span className="donor-impact-hero__value">₱{totalLabel}</span>
                <span className="donor-impact-hero__label">Total Donated</span>
              </div>
            </div>
          </section>

          {/* Impact Categories Grid */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Impact by Category</h2>
            </div>
            <div className="donor-impact-categories">
              <div className="donor-impact-category">
                <div className="donor-impact-category__icon donor-impact-category__icon--crimson">
                  <Users size={28} />
                </div>
                <div className="donor-impact-category__content">
                  <span className="donor-impact-category__value">{impact.familiesHelped}</span>
                  <span className="donor-impact-category__label">Families Helped</span>
                  <p className="donor-impact-category__desc">Provided essential support to families in need across Cebu</p>
                </div>
              </div>

              <div className="donor-impact-category">
                <div className="donor-impact-category__icon donor-impact-category__icon--green">
                  <Heart size={28} />
                </div>
                <div className="donor-impact-category__content">
                  <span className="donor-impact-category__value">{Number(impact.mealsProvided || 0).toLocaleString()}</span>
                  <span className="donor-impact-category__label">Meals Provided</span>
                  <p className="donor-impact-category__desc">Hot meals served through feeding programs and community kitchens</p>
                </div>
              </div>

              <div className="donor-impact-category">
                <div className="donor-impact-category__icon donor-impact-category__icon--blue">
                  <GraduationCap size={28} />
                </div>
                <div className="donor-impact-category__content">
                  <span className="donor-impact-category__value">{impact.childrenEducated}</span>
                  <span className="donor-impact-category__label">Children Educated</span>
                  <p className="donor-impact-category__desc">Students supported through educational sponsorship and school supplies</p>
                </div>
              </div>

              <div className="donor-impact-category">
                <div className="donor-impact-category__icon donor-impact-category__icon--purple">
                  <Stethoscope size={28} />
                </div>
                <div className="donor-impact-category__content">
                  <span className="donor-impact-category__value">{impact.medicalConsultations}</span>
                  <span className="donor-impact-category__label">Medical Consultations</span>
                  <p className="donor-impact-category__desc">Free medical services provided through health missions</p>
                </div>
              </div>

              <div className="donor-impact-category">
                <div className="donor-impact-category__icon donor-impact-category__icon--orange">
                  <Home size={28} />
                </div>
                <div className="donor-impact-category__content">
                  <span className="donor-impact-category__value">{impact.housesBuilt}</span>
                  <span className="donor-impact-category__label">Houses Built</span>
                  <p className="donor-impact-category__desc">Safe and sturdy homes constructed for families in need</p>
                </div>
              </div>

              <div className="donor-impact-category">
                <div className="donor-impact-category__icon donor-impact-category__icon--red">
                  <Package size={28} />
                </div>
                <div className="donor-impact-category__content">
                  <span className="donor-impact-category__value">{impact.disasterReliefPackages}</span>
                  <span className="donor-impact-category__label">Relief Packages</span>
                  <p className="donor-impact-category__desc">Emergency relief distributed to disaster-affected communities</p>
                </div>
              </div>
            </div>
          </section>

          {/* Donation Trends Chart */}
          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Donation Trends - {selectedYear}</h2>
            </div>
            <div className="donor-trends-chart">
              {byMonth.map((month, idx) => (
                <div key={month.month || idx} className="donor-trends-bar">
                  <div className="donor-trends-bar__wrapper">
                    <div
                      className="donor-trends-bar__fill"
                      style={{ height: `${(Number(month.total || 0) / maxMonthlyAmount) * 100}%` }}
                    >
                      <span className="donor-trends-bar__value">
                        ₱{(Number(month.total || 0) / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>
                  <div className="donor-trends-bar__label">
                    <span>{String(month.month || '').slice(0, 3)}</span>
                    <span className="donor-trends-bar__sublabel">{month.count || 0} donations</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="donor-trends-legend">
              <div className="donor-trends-legend__item">
                <span className="donor-trends-legend__dot donor-trends-legend__dot--monetary"></span>
                <span>Monetary</span>
              </div>
              <div className="donor-trends-legend__item">
                <span className="donor-trends-legend__dot donor-trends-legend__dot--inkind"></span>
                <span>In-Kind</span>
              </div>
            </div>
          </section>

          <div className="portal-dashboard-grid">
            {/* Recent Impact Stories */}
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Recent Impact Stories</h2>
              </div>
              {(data.donationImpact || []).length === 0 ? (
                <div className="portal-empty">
                  <Heart size={32} />
                  <p>Impact stories will appear here once your donations are distributed</p>
                </div>
              ) : (
                <div className="donor-impact-stories">
                  {data.donationImpact.map((impact) => (
                    <div key={impact.donationId} className="donor-impact-story">
                      <div className="donor-impact-story__header">
                        <span className="donor-impact-story__program">{impact.program}</span>
                        <span className="donor-impact-story__donation">{impact.donationId}</span>
                      </div>
                      <p className="donor-impact-story__description">{impact.description}</p>
                      <div className="donor-impact-story__meta">
                        <span>
                          <MapPin size={14} /> {impact.location}
                        </span>
                        <span>
                          <Users size={14} /> {impact.beneficiaries} beneficiaries
                        </span>
                        <span>
                          <Calendar size={14} /> {impact.date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Program Distribution */}
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Donations by Program</h2>
              </div>
              <div className="donor-program-distribution">
                {(() => {
                  if (!donations.length) {
                    return (
                      <div className="portal-empty">
                        <Package size={28} />
                        <p>Program breakdown will appear after your first donation.</p>
                      </div>
                    )
                  }
                  const programCounts = {}
                  donations.forEach((d) => {
                    const key = d.program || 'General Donation'
                    programCounts[key] = (programCounts[key] || 0) + 1
                  })
                  const programs = Object.entries(programCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)

                  return programs.map(([program, count]) => (
                    <div key={program} className="donor-program-item">
                      <div className="donor-program-item__info">
                        <strong>{program}</strong>
                        <span>{count} donations</span>
                      </div>
                      <div className="donor-program-item__bar">
                        <div
                          className="donor-program-item__fill"
                          style={{ width: `${(count / donations.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </section>
          </div>

          <section className="donor-impact-cta">
            <div className="donor-impact-cta__content">
              <TrendingUp size={32} />
              <h3>Continue Making a Difference</h3>
              <p>
                Your generosity has already touched {impact.familiesHelped} families.
                Help us reach even more communities in need.
              </p>
            </div>
            <div className="donor-impact-cta__actions">
              <Link to="/donate" className="btn btn--primary">Make Another Donation</Link>
              <Link to="/programs" className="btn btn--outline">
                Learn About Programs <ExternalLink size={14} />
              </Link>
            </div>
          </section>
        </>
      )}
    </ApiState>
  )
}
