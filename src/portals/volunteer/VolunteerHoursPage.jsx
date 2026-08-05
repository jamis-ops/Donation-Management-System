import { useState } from 'react'
import { Clock, TrendingUp, Download, Calendar } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import { notify } from '../../utils/toast'

const ACTIVITY_TYPE_COLORS = {
  Distribution: 'crimson',
  Inventory: 'blue',
  Programs: 'green',
  Training: 'purple',
  Community: 'orange',
  Admin: 'gray',
  General: 'gray',
  Volunteer: 'crimson',
}

function dateKey(value) {
  if (!value || value === '—') return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDate(value) {
  const key = dateKey(value)
  if (!key) return '—'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function VolunteerHoursPage() {
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const [selectedYear] = useState(new Date().getFullYear())

  const breakdown = data?.hoursBreakdown || []
  const activityLog = data?.activityLog || []
  const paging = usePagination(activityLog, DEFAULT_PAGE_SIZE, String(activityLog.length))
  const totalHours = breakdown.reduce((sum, m) => sum + Number(m.hours || 0), 0)
  const currentMonthIndex = new Date().getMonth()
  const currentMonthHours = Number(breakdown[currentMonthIndex]?.hours || 0)
  const totalActivities = activityLog.length
  const ytdHours = totalHours
  const maxHours = Math.max(...breakdown.map((m) => Number(m.hours || 0)), 1)

  const handleExportCSV = () => {
    if (!activityLog.length) {
      notify.warning('No activity to export yet.')
      return
    }

    const headers = ['Date', 'Activity', 'Type', 'Hours', 'Status']
    const rows = activityLog.map((log) => [
      log.date,
      `"${String(log.activity || '').replace(/"/g, '""')}"`,
      log.type,
      log.hours,
      log.status,
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `volunteer-hours-${selectedYear}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    notify.success('Hours exported to CSV.')
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header">
          <h2>Volunteer Hours</h2>
          <button
            type="button"
            className="btn btn--sm btn--outline"
            onClick={handleExportCSV}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="portal-stats portal-stats--inline">
          <div className="portal-stat-card">
            <div className="portal-stat-card__icon">
              <Clock size={20} />
            </div>
            <span className="portal-stat-card__value">{totalHours}</span>
            <span className="portal-stat-card__label">Total Hours (YTD)</span>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-card__icon">
              <Calendar size={20} />
            </div>
            <span className="portal-stat-card__value">{currentMonthHours}</span>
            <span className="portal-stat-card__label">This Month</span>
          </div>
          <div className="portal-stat-card">
            <div className="portal-stat-card__icon">
              <TrendingUp size={20} />
            </div>
            <span className="portal-stat-card__value">{totalActivities}</span>
            <span className="portal-stat-card__label">Activities Completed</span>
          </div>
        </div>

        <div className="portal-chart-section">
          <h3>Monthly Hours Breakdown - {selectedYear}</h3>
          <div className="portal-bar-chart">
            {breakdown.map((month, idx) => (
              <div key={month.month || idx} className="portal-bar-chart__item">
                <div className="portal-bar-chart__bar-wrapper">
                  <div
                    className="portal-bar-chart__bar"
                    style={{ height: `${(Number(month.hours || 0) / maxHours) * 100}%` }}
                  >
                    <span className="portal-bar-chart__value">{month.hours}h</span>
                  </div>
                </div>
                <div className="portal-bar-chart__label">
                  <span>{String(month.month || '').slice(0, 3)}</span>
                  <span className="portal-bar-chart__sublabel">{month.activities || 0} activities</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="portal-progress-section">
          <div className="portal-progress-header">
            <h3>Year-to-Date Progress</h3>
            <span className="portal-progress-value">{ytdHours} / 200 hours</span>
          </div>
          <div className="portal-progress-bar">
            <div
              className="portal-progress-bar__fill"
              style={{ width: `${Math.min((ytdHours / 200) * 100, 100)}%` }}
            />
          </div>
          <p className="portal-progress-note">
            {ytdHours >= 200
              ? "Congratulations! You've reached your annual goal."
              : `${Math.max(200 - ytdHours, 0)} hours remaining to reach your annual goal`}
          </p>
        </div>

        <div className="portal-activity-log-section">
          <h3>Activity Log</h3>
          <div className="portal-table-wrap">
            <table className="portal-table portal-table--striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activity</th>
                  <th>Type</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activityLog.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>
                      No completed activities yet. Mark tasks done to build your hours log.
                    </td>
                  </tr>
                ) : (
                  paging.pageItems.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span className="portal-table-date">{formatDisplayDate(log.date)}</span>
                      </td>
                      <td>
                        <strong>{log.activity}</strong>
                      </td>
                      <td>
                        <span className={`portal-type-badge portal-type-badge--${ACTIVITY_TYPE_COLORS[log.type] || 'gray'}`}>
                          {log.type}
                        </span>
                      </td>
                      <td>
                        <span className="portal-hours-cell">
                          <Clock size={14} /> {log.hours}h
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={log.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {activityLog.length > 0 && (
            <Pagination
              page={paging.page}
              totalPages={paging.totalPages}
              total={paging.total}
              startIndex={paging.startIndex}
              endIndex={paging.endIndex}
              onPageChange={paging.setPage}
              className="pagination--portal"
              noun="activities"
            />
          )}
        </div>

        <p className="portal-note">
          Hours are credited when you complete assigned tasks that include duty hours.
        </p>
      </section>
    </ApiState>
  )
}
