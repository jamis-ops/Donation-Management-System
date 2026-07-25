import { useState, useMemo } from 'react'
import { Truck, MapPin, Calendar, Users, Package, Clock, CheckCircle, Search, Filter, Eye, Edit, PlayCircle, CheckSquare } from 'lucide-react'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData, distributionsApi } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'

export default function StaffDistributionsPage() {
  const { data: portalData, loading, error, reload } = useApiObject(() => getPortalData())
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProgram, setFilterProgram] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDistribution, setSelectedDistribution] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'calendar'

  const distributions = portalData?.distributions || []

  const filteredDistributions = useMemo(() => {
    return distributions.filter(dist => {
      if (filterStatus !== 'all' && dist.status !== filterStatus) return false
      if (filterProgram !== 'all' && dist.program !== filterProgram) return false
      if (searchQuery && 
          !dist.location.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !dist.program.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [distributions, filterStatus, filterProgram, searchQuery])

  const programs = [...new Set(distributions.map(d => d.program))]
  const statusCounts = {
    'Scheduled': distributions.filter(d => d.status === 'Scheduled').length,
    'In Progress': distributions.filter(d => d.status === 'In Progress').length,
    'Completed': distributions.filter(d => d.status === 'Completed').length,
    'Pending': distributions.filter(d => d.status === 'Pending').length,
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Scheduled': return '#3b82f6'
      case 'In Progress': return '#f59e0b'
      case 'Completed': return '#16a34a'
      case 'Pending': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getProgramColor = (program) => {
    const colors = {
      'Disaster Relief': '#dc2626',
      'Feeding Programs': '#f59e0b',
      'Medical Mission': '#ec4899',
      'Educational Sponsorship': '#8b5cf6',
      'House Building Project': '#10b981',
      'Community Center': '#0891b2',
    }
    return colors[program] || '#6b7280'
  }

  const handleStartDistribution = async (dist) => {
    if (!dist?.dbId) return
    if (!window.confirm(`Start distribution at ${dist.location}?`)) return
    try {
      await distributionsApi.update(dist.dbId, { status: 'In Progress' })
      setSelectedDistribution(null)
      reload()
    } catch (err) {
      alert(err.message || 'Failed to start distribution')
    }
  }

  const handleCompleteDistribution = async (dist) => {
    if (!dist?.dbId) return
    if (!window.confirm(`Mark distribution at ${dist.location} as completed?`)) return
    try {
      await distributionsApi.update(dist.dbId, { status: 'Completed' })
      setSelectedDistribution(null)
      reload()
    } catch (err) {
      alert(err.message || 'Failed to complete distribution')
    }
  }

  const groupByDate = () => {
    const grouped = {}
    filteredDistributions.forEach(dist => {
      if (!grouped[dist.date]) {
        grouped[dist.date] = []
      }
      grouped[dist.date].push(dist)
    })
    return grouped
  }

  const groupedDistributions = viewMode === 'calendar' ? groupByDate() : {}

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      {portalData && (
        <div className="staff-distributions-page">
          {/* Summary Cards */}
          <div className="staff-distributions-summary">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div 
                key={status}
                className={`staff-distribution-summary-card ${filterStatus === status ? 'staff-distribution-summary-card--active' : ''}`}
                onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              >
                <span className="staff-distribution-summary-card__value">{count}</span>
                <span className="staff-distribution-summary-card__label">{status}</span>
                <div 
                  className="staff-distribution-summary-card__indicator"
                  style={{ backgroundColor: getStatusColor(status) }}
                ></div>
              </div>
            ))}
          </div>

          <section className="portal-panel">
            <div className="portal-panel__header">
              <h2>Distribution Coordination</h2>
              <div className="staff-distributions-view-toggle">
                <button 
                  className={`staff-distributions-view-toggle__btn ${viewMode === 'grid' ? 'staff-distributions-view-toggle__btn--active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Package size={16} />
                  Grid
                </button>
                <button 
                  className={`staff-distributions-view-toggle__btn ${viewMode === 'calendar' ? 'staff-distributions-view-toggle__btn--active' : ''}`}
                  onClick={() => setViewMode('calendar')}
                >
                  <Calendar size={16} />
                  Calendar
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="staff-distributions-filters">
              <div className="staff-distributions-filters__search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search by location or program..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="staff-distributions-filters__input"
                />
              </div>

              <div className="staff-distributions-filters__group">
                <div className="staff-distributions-filters__item">
                  <Filter size={16} />
                  <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
                    <option value="all">All Programs</option>
                    {programs.map(prog => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Distribution List - Grid View */}
            {viewMode === 'grid' && (
              <>
                {filteredDistributions.length === 0 ? (
                  <div className="portal-empty">
                    <Truck size={48} />
                    <p>No distributions match your filters.</p>
                  </div>
                ) : (
                  <div className="staff-distributions-grid">
                    {filteredDistributions.map((dist) => (
                      <div key={dist.id} className="staff-distribution-card">
                        <div className="staff-distribution-card__header">
                          <span 
                            className="staff-distribution-card__program"
                            style={{ 
                              backgroundColor: `${getProgramColor(dist.program)}15`,
                              color: getProgramColor(dist.program)
                            }}
                          >
                            {dist.program}
                          </span>
                          <span 
                            className="staff-distribution-card__status"
                            style={{ 
                              backgroundColor: `${getStatusColor(dist.status)}15`,
                              color: getStatusColor(dist.status)
                            }}
                          >
                            {dist.status}
                          </span>
                        </div>

                        <h3 className="staff-distribution-card__location">
                          <MapPin size={18} />
                          {dist.location}
                        </h3>

                        <div className="staff-distribution-card__details">
                          <div className="staff-distribution-card__detail">
                            <Calendar size={14} />
                            <span>{dist.date} at {dist.time}</span>
                          </div>
                          <div className="staff-distribution-card__detail">
                            <Users size={14} />
                            <span>{dist.beneficiaries} beneficiaries</span>
                          </div>
                          <div className="staff-distribution-card__detail">
                            <Package size={14} />
                            <span>{dist.items}</span>
                          </div>
                        </div>

                        {dist.assignedVolunteers && dist.assignedVolunteers.length > 0 && (
                          <div className="staff-distribution-card__volunteers">
                            <strong>Volunteers:</strong>
                            <span>{dist.assignedVolunteers.length} assigned</span>
                          </div>
                        )}

                        {dist.route && (
                          <div className="staff-distribution-card__route">
                            <strong>Route:</strong> {dist.route}
                          </div>
                        )}

                        {dist.notes && (
                          <div className="staff-distribution-card__notes">
                            <strong>Notes:</strong> {dist.notes}
                          </div>
                        )}

                        {dist.vehicleNeeded && (
                          <div className="staff-distribution-card__vehicle">
                            <Truck size={14} />
                            <span>Vehicle required</span>
                          </div>
                        )}

                        <div className="staff-distribution-card__actions">
                          <button 
                            className="btn btn--sm btn--secondary"
                            onClick={() => setSelectedDistribution(dist)}
                          >
                            <Eye size={14} />
                            Details
                          </button>
                          {dist.status === 'Scheduled' && (
                            <button 
                              className="btn btn--sm btn--warning"
                              onClick={() => handleStartDistribution(dist)}
                            >
                              <PlayCircle size={14} />
                              Start
                            </button>
                          )}
                          {dist.status === 'In Progress' && (
                            <button 
                              className="btn btn--sm btn--success"
                              onClick={() => handleCompleteDistribution(dist)}
                            >
                              <CheckCircle size={14} />
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Distribution List - Calendar View */}
            {viewMode === 'calendar' && (
              <div className="staff-distributions-calendar">
                {Object.keys(groupedDistributions).length === 0 ? (
                  <div className="portal-empty">
                    <Calendar size={48} />
                    <p>No distributions match your filters.</p>
                  </div>
                ) : (
                  Object.entries(groupedDistributions)
                    .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
                    .map(([date, dists]) => (
                      <div key={date} className="staff-distributions-calendar-day">
                        <div className="staff-distributions-calendar-day__header">
                          <Calendar size={20} />
                          <h3>{date}</h3>
                          <span className="staff-distributions-calendar-day__count">
                            {dists.length} {dists.length === 1 ? 'event' : 'events'}
                          </span>
                        </div>
                        <div className="staff-distributions-calendar-day__events">
                          {dists.map((dist) => (
                            <div 
                              key={dist.id} 
                              className="staff-distributions-calendar-event"
                              onClick={() => setSelectedDistribution(dist)}
                            >
                              <div 
                                className="staff-distributions-calendar-event__indicator"
                                style={{ backgroundColor: getStatusColor(dist.status) }}
                              ></div>
                              <div className="staff-distributions-calendar-event__content">
                                <div className="staff-distributions-calendar-event__time">
                                  <Clock size={14} />
                                  {dist.time}
                                </div>
                                <strong>{dist.program}</strong>
                                <span className="staff-distributions-calendar-event__location">
                                  <MapPin size={12} />
                                  {dist.location}
                                </span>
                                <span className="staff-distributions-calendar-event__beneficiaries">
                                  <Users size={12} />
                                  {dist.beneficiaries} beneficiaries
                                </span>
                              </div>
                              <span 
                                className="staff-distributions-calendar-event__status"
                                style={{ 
                                  backgroundColor: `${getStatusColor(dist.status)}15`,
                                  color: getStatusColor(dist.status)
                                }}
                              >
                                {dist.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </section>

          {/* Distribution Schedule Overview */}
          {portalData.distributionSchedule && (
            <section className="portal-panel">
              <div className="portal-panel__header">
                <h2>Upcoming Schedule</h2>
              </div>
              <div className="staff-distribution-schedule-overview">
                {portalData.distributionSchedule.map((schedule) => (
                  <div key={schedule.date} className="staff-distribution-schedule-card">
                    <div className="staff-distribution-schedule-card__date">
                      <Calendar size={20} />
                      <strong>{schedule.date}</strong>
                    </div>
                    <div className="staff-distribution-schedule-card__stats">
                      <div className="staff-distribution-schedule-card__stat">
                        <span className="staff-distribution-schedule-card__stat-value">{schedule.events}</span>
                        <span className="staff-distribution-schedule-card__stat-label">Events</span>
                      </div>
                      <div className="staff-distribution-schedule-card__stat">
                        <span className="staff-distribution-schedule-card__stat-value">{schedule.totalBeneficiaries}</span>
                        <span className="staff-distribution-schedule-card__stat-label">Beneficiaries</span>
                      </div>
                    </div>
                    <div className="staff-distribution-schedule-card__programs">
                      {schedule.programs.map((prog, idx) => (
                        <span 
                          key={idx}
                          className="staff-distribution-schedule-card__program"
                          style={{ 
                            backgroundColor: `${getProgramColor(prog)}15`,
                            color: getProgramColor(prog)
                          }}
                        >
                          {prog}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Distribution Detail Modal */}
          {selectedDistribution && (
            <div className="staff-modal-overlay" onClick={() => setSelectedDistribution(null)}>
              <div className="staff-modal" onClick={(e) => e.stopPropagation()}>
                <div className="staff-modal__header">
                  <h2>Distribution Details - {selectedDistribution.id}</h2>
                  <button 
                    className="staff-modal__close"
                    onClick={() => setSelectedDistribution(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="staff-modal__content">
                  <div className="staff-modal__badges">
                    <span style={{ backgroundColor: `${getProgramColor(selectedDistribution.program)}15`, color: getProgramColor(selectedDistribution.program) }}>
                      {selectedDistribution.program}
                    </span>
                    <span style={{ backgroundColor: `${getStatusColor(selectedDistribution.status)}15`, color: getStatusColor(selectedDistribution.status) }}>
                      {selectedDistribution.status}
                    </span>
                  </div>

                  <div className="staff-modal__section">
                    <h3>Location & Schedule</h3>
                    <div className="staff-modal__grid">
                      <div className="staff-modal__field">
                        <MapPin size={14} />
                        <strong>Location:</strong>
                        <span>{selectedDistribution.location}</span>
                      </div>
                      <div className="staff-modal__field">
                        <Calendar size={14} />
                        <strong>Date:</strong>
                        <span>{selectedDistribution.date}</span>
                      </div>
                      <div className="staff-modal__field">
                        <Clock size={14} />
                        <strong>Time:</strong>
                        <span>{selectedDistribution.time}</span>
                      </div>
                      {selectedDistribution.completedTime && (
                        <div className="staff-modal__field">
                          <CheckCircle size={14} />
                          <strong>Completed:</strong>
                          <span>{selectedDistribution.completedTime}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="staff-modal__section">
                    <h3>Distribution Details</h3>
                    <div className="staff-modal__grid">
                      <div className="staff-modal__field">
                        <Users size={14} />
                        <strong>Beneficiaries:</strong>
                        <span>{selectedDistribution.beneficiaries}</span>
                      </div>
                      <div className="staff-modal__field">
                        <Package size={14} />
                        <strong>Items:</strong>
                        <span>{selectedDistribution.items}</span>
                      </div>
                      {selectedDistribution.route && (
                        <div className="staff-modal__field">
                          <MapPin size={14} />
                          <strong>Route:</strong>
                          <span>{selectedDistribution.route}</span>
                        </div>
                      )}
                      {selectedDistribution.vehicleNeeded && (
                        <div className="staff-modal__field">
                          <Truck size={14} />
                          <strong>Vehicle:</strong>
                          <span>Required</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="staff-modal__section">
                    <h3>Team Assignment</h3>
                    <div className="staff-modal__grid">
                      <div className="staff-modal__field">
                        <strong>Assigned Staff:</strong>
                        <span>{selectedDistribution.assignedStaff}</span>
                      </div>
                      <div className="staff-modal__field">
                        <strong>Volunteers:</strong>
                        <span>{selectedDistribution.assignedVolunteers?.length || 0} assigned</span>
                      </div>
                    </div>
                    {selectedDistribution.assignedVolunteers && selectedDistribution.assignedVolunteers.length > 0 && (
                      <div className="staff-modal__volunteers">
                        {selectedDistribution.assignedVolunteers.map((vol, idx) => (
                          <span key={idx} className="staff-modal__volunteer-badge">{vol}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedDistribution.notes && (
                    <div className="staff-modal__section">
                      <h3>Notes</h3>
                      <p className="staff-modal__notes">{selectedDistribution.notes}</p>
                    </div>
                  )}

                  <div className="staff-modal__actions">
                    {selectedDistribution.status === 'Scheduled' && (
                      <button 
                        className="btn btn--warning"
                        onClick={() => handleStartDistribution(selectedDistribution)}
                      >
                        <PlayCircle size={16} />
                        Start Distribution
                      </button>
                    )}
                    {selectedDistribution.status === 'In Progress' && (
                      <button 
                        className="btn btn--success"
                        onClick={() => handleCompleteDistribution(selectedDistribution)}
                      >
                        <CheckCircle size={16} />
                        Mark as Completed
                      </button>
                    )}
                    <button className="btn btn--secondary">
                      <Edit size={16} />
                      Edit Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ApiState>
  )
}
