import { useState, useMemo } from 'react'
import {
  Clock,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Filter,
  RotateCcw,
} from 'lucide-react'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import ApiState from '../../admin/components/shared/ApiState'
import { getPortalData } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../admin/components/shared/Pagination'
import ExportMenu from '../../admin/components/shared/ExportMenu'
import ChartTooltip from '../../components/shared/ChartTooltip'
import { useChartTooltip } from '../../hooks/useChartTooltip'
import { useAuth } from '../../context/AuthContext'

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

const MONTHS = [
  { value: 'all', label: 'All Months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

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
  const { user } = useAuth()
  const memberLabel = user?.role === 'Intern' ? 'Intern' : 'Volunteer'
  const chartTooltip = useChartTooltip()
  const { data, loading, error, reload } = useApiObject(() => getPortalData())
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState('all')

  const activityLog = useMemo(() => data?.activityLog || [], [data?.activityLog])
  const hoursBreakdown = data?.hoursBreakdown

  // Dynamic available years list
  const availableYears = useMemo(() => {
    const years = new Set([currentYear])
    activityLog.forEach((log) => {
      if (log.year) years.add(Number(log.year))
      const k = dateKey(log.rawDate || log.date)
      if (k) {
        const y = Number(k.split('-')[0])
        if (!Number.isNaN(y)) years.add(y)
      }
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [activityLog, currentYear])

  // Computed 12-month breakdown for selectedYear
  const computedBreakdown = useMemo(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const buckets = monthNames.map((name) => ({ month: name, hours: 0, activities: 0 }))

    activityLog.forEach((log) => {
      const k = dateKey(log.rawDate || log.date)
      if (!k) return
      const [y, m] = k.split('-').map(Number)
      if (y === Number(selectedYear) && m >= 1 && m <= 12) {
        buckets[m - 1].hours += Number(log.hours || 0)
        buckets[m - 1].activities += 1
      }
    })

    const hasData = buckets.some((b) => b.hours > 0 || b.activities > 0)
    if (!hasData && selectedYear === currentYear && (hoursBreakdown || []).length === 12) {
      return hoursBreakdown
    }
    return buckets
  }, [activityLog, selectedYear, currentYear, hoursBreakdown])

  // Filtered activity log based on Year + Month dropdowns
  const filteredActivityLog = useMemo(() => {
    return activityLog.filter((log) => {
      const k = dateKey(log.rawDate || log.date)
      if (!k) return true
      const [y, m] = k.split('-').map(Number)
      if (Number(selectedYear) && y !== Number(selectedYear)) return false
      if (selectedMonth !== 'all' && m !== Number(selectedMonth)) return false
      return true
    })
  }, [activityLog, selectedYear, selectedMonth])

  const paging = usePagination(
    filteredActivityLog,
    DEFAULT_PAGE_SIZE,
    `${selectedYear}-${selectedMonth}-${filteredActivityLog.length}`
  )

  const totalYearHours = computedBreakdown.reduce((sum, m) => sum + Number(m.hours || 0), 0)
  const maxHours = Math.max(...computedBreakdown.map((m) => Number(m.hours || 0)), 1)

  // Period specific statistics
  const periodHours = filteredActivityLog.reduce((sum, log) => sum + Number(log.hours || 0), 0)
  const periodActivities = filteredActivityLog.length
  const periodAvgHours = periodActivities > 0 ? (periodHours / periodActivities).toFixed(1) : '0'

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'Full Year'
    const found = MONTHS.find((m) => m.value === String(selectedMonth))
    return found ? found.label : `Month ${selectedMonth}`
  }, [selectedMonth])

  const exportColumns = useMemo(() => [
    { key: 'date', label: 'Date' },
    { key: 'id', label: 'Task Code' },
    { key: 'activity', label: 'Activity' },
    { key: 'type', label: 'Program', exportValue: (r) => r.type || 'General' },
    { key: 'hours', label: 'Duty Hours', exportValue: (r) => `${r.hours || 0} hrs` },
    { key: 'dutyLabel', label: 'Duty Schedule', exportValue: (r) => r.dutyLabel || '—' },
    { key: 'attendance', label: 'Attendance', exportValue: (r) => r.attendance || 'Present / Completed' },
    { key: 'status', label: 'Status', exportValue: (r) => r.status || 'Verified' },
  ], [])

  const handleBarClick = (monthIndex) => {
    const monthNum = String(monthIndex + 1)
    if (selectedMonth === monthNum) {
      setSelectedMonth('all')
    } else {
      setSelectedMonth(monthNum)
    }
  }

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        {/* Panel Header & Controls */}
        <div className="portal-panel__header">
          <div>
            <h2>{memberLabel} Hours & Duty Breakdown</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Track rendered hours, review monthly breakdowns, and view verified duty attendance records.
            </p>
          </div>
          <div className="vhours-header-controls">
            {/* Year Filter Dropdown */}
            <div className="vhours-filter-group">
              <label htmlFor="vhours-year-select">
                <Calendar size={13} /> Year
              </label>
              <select
                id="vhours-year-select"
                className="vhours-select"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value))
                }}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter Dropdown */}
            <div className="vhours-filter-group">
              <label htmlFor="vhours-month-select">
                <Filter size={13} /> Month
              </label>
              <select
                id="vhours-month-select"
                className="vhours-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedMonth !== 'all' && (
              <button
                type="button"
                className="btn btn--sm btn--outline"
                onClick={() => setSelectedMonth('all')}
                title="Reset month filter"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
              >
                <RotateCcw size={12} /> All Months
              </button>
            )}

            <ExportMenu
              columns={exportColumns}
              rows={filteredActivityLog}
              filename={`volunteer-hours-${selectedYear}-${selectedMonth === 'all' ? 'all-months' : selectedMonthLabel.toLowerCase()}`}
              title={`${memberLabel} Hours Report (${selectedYear})`}
            />
          </div>
        </div>

        {/* Monthly Hours Breakdown Chart */}
        <div className="portal-chart-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>
              Monthly Hours Breakdown — {selectedYear}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              💡 Click any month bar to filter specific activities
            </span>
          </div>

          <div className="portal-bar-chart">
            {computedBreakdown.map((month, idx) => {
              const isSelected = selectedMonth === String(idx + 1)
              const hasHours = Number(month.hours || 0) > 0
              return (
                <div key={month.month || idx} className="portal-bar-chart__item">
                  <div className="portal-bar-chart__bar-wrapper">
                    <div
                      className={`portal-bar-chart__bar vhours-bar--clickable ${
                        isSelected ? 'vhours-bar--active' : ''
                      }`}
                      style={{
                        height: `${Math.max((Number(month.hours || 0) / maxHours) * 100, 8)}%`,
                        opacity: selectedMonth === 'all' || isSelected ? 1 : 0.45,
                      }}
                      onClick={() => handleBarClick(idx)}
                      {...chartTooltip.bindTooltip({ label: `${month.month} ${selectedYear}`, value: `${Number(month.hours || 0).toLocaleString()} hours`, sub: `${Number(month.activities || 0).toLocaleString()} activities · Click to filter` })}
                    >
                      <span className="portal-bar-chart__value">
                        {hasHours ? `${month.hours}h` : '0h'}
                      </span>
                    </div>
                  </div>
                  <div className="portal-bar-chart__label">
                    <span style={{ color: isSelected ? '#0d9488' : '#374151', fontWeight: isSelected ? 800 : 600 }}>
                      {String(month.month || '').slice(0, 3)}
                    </span>
                    <span className="portal-bar-chart__sublabel">
                      {month.activities || 0} act.
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Period Highlights Banner */}
        <div className="vhours-period-banner">
          <div className="vhours-period-info">
            <span className="vhours-period-title">
              <CalendarDays size={16} />
              {selectedMonthLabel} {selectedYear} · Specific Details
            </span>
            <span className="vhours-period-subtitle">
              Showing detailed task breakdown and attendance records for the selected time frame.
            </span>
          </div>
          <div className="vhours-period-metrics">
            <div className="vhours-period-stat">
              <span className="vhours-period-stat__val">{periodHours} hrs</span>
              <span className="vhours-period-stat__label">Rendered Hours</span>
            </div>
            <div className="vhours-period-stat">
              <span className="vhours-period-stat__val">{periodActivities}</span>
              <span className="vhours-period-stat__label">Completed Tasks</span>
            </div>
            <div className="vhours-period-stat">
              <span className="vhours-period-stat__val">{periodAvgHours} hrs</span>
              <span className="vhours-period-stat__label">Avg. / Activity</span>
            </div>
          </div>
        </div>

        {/* Year-to-Date Annual Target Progress */}
        <div className="portal-progress-section">
          <div className="portal-progress-header">
            <h3>Annual {memberLabel} Target ({selectedYear})</h3>
            <span className="portal-progress-value">{totalYearHours} / 200 hours</span>
          </div>
          <div className="portal-progress-bar">
            <div
              className="portal-progress-bar__fill"
              style={{ width: `${Math.min((totalYearHours / 200) * 100, 100)}%` }}
            />
          </div>
          <p className="portal-progress-note">
            {totalYearHours >= 200
              ? `🎉 Congratulations! You have achieved your annual target for ${selectedYear}.`
              : `${Math.max(200 - totalYearHours, 0)} hours remaining to reach the 200-hour goal for ${selectedYear}.`}
          </p>
        </div>

        {/* Detailed Activity & Tasks Log */}
        <div className="portal-activity-log-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>
              Specific Duty & Task Records ({filteredActivityLog.length})
            </h3>
            {selectedMonth !== 'all' && (
              <span style={{ fontSize: '0.8rem', color: '#0d9488', fontWeight: 600 }}>
                Filtered by {selectedMonthLabel} {selectedYear}
              </span>
            )}
          </div>

          <div className="portal-table-wrap">
            <table className="portal-table portal-table--striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Task & Activity</th>
                  <th>Program</th>
                  <th>Duty Hours</th>
                  <th>Attendance & Completion</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivityLog.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem 1rem' }}>
                      <CalendarDays size={28} style={{ display: 'block', margin: '0 auto 0.5rem', color: '#94a3b8' }} />
                      <strong>No volunteer activities recorded for {selectedMonthLabel} {selectedYear}.</strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem' }}>
                        Try selecting another month or year, or view <button type="button" onClick={() => setSelectedMonth('all')} style={{ background: 'none', border: 'none', color: '#0d9488', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>All Months</button>.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paging.pageItems.map((log) => (
                    <tr key={log.id || `${log.date}-${log.activity}`}>
                      <td>
                        <span className="portal-table-date">{formatDisplayDate(log.date)}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <strong>{log.activity}</strong>
                          {log.id && (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#64748b' }}>
                              ID: {log.id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`portal-type-badge portal-type-badge--${ACTIVITY_TYPE_COLORS[log.type] || 'gray'}`}>
                          {log.type || 'General'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <span className="portal-hours-cell" style={{ fontWeight: 700 }}>
                            <Clock size={13} /> {log.hours || 0}h
                          </span>
                          {log.dutyLabel && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {log.dutyLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="vhours-attendance-pill">
                          <CheckCircle2 size={12} />
                          {log.attendance || 'Present / Completed'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={log.status || 'Verified'} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredActivityLog.length > 0 && (
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
          Duty hours and attendance are verified and officially credited to your profile upon task completion by the Administrator.
        </p>
        <ChartTooltip tip={chartTooltip.tip} />
      </section>
    </ApiState>
  )
}

