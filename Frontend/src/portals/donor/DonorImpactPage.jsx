import { useMemo, useState } from 'react'
import {
  BarChart3, CalendarDays, CheckCircle2, Gift, MapPin, Package,
  RefreshCcw, TrendingUp, Users,
} from 'lucide-react'
import ApiState from '../../admin/components/shared/ApiState'
import ExportMenu from '../../admin/components/shared/ExportMenu'
import { donorImpactApi } from '../../api/resources'
import { useApiObject } from '../../hooks/useApiList'
import '../../styles/donor-impact.css'

const COLORS = ['#AF101A', '#d33a43', '#e66b72', '#7f0b13', '#f0a0a5', '#4b5563', '#94a3b8']
const IMPACT_QUERY_OPTIONS = { bypassCache: true, tags: ['donations', 'allocations', 'distributions'] }

const initialFilters = {
  from: '',
  to: '',
  type: 'All',
  barangay: 'All',
  category: 'All',
  status: 'All',
}

function peso(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value) || 0)
}

function number(value) {
  return new Intl.NumberFormat('en-PH').format(Number(value) || 0)
}

function monthLabel(value) {
  if (!value) return ''
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

function EmptyChart({ children }) {
  return <div className="donor-impact-empty"><BarChart3 size={25} /><span>{children}</span></div>
}

function BarangayChart({ rows }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.itemsDistributed, row.familiesHelped)))
  if (!rows.length) return <EmptyChart>No linked allocation or distribution data matches these filters.</EmptyChart>
  return (
    <div className="impact-horizontal-chart" role="img" aria-label="Items distributed and families helped by barangay">
      {rows.slice(0, 8).map((row) => (
        <div className="impact-horizontal-chart__row" key={row.barangayId}>
          <div className="impact-horizontal-chart__label">
            <strong>{row.barangay}</strong>
            <span>{row.municipality || 'Municipality not specified'}</span>
          </div>
          <div className="impact-horizontal-chart__tracks">
            <div className="impact-horizontal-chart__track" tabIndex="0" data-tooltip={`${number(row.itemsDistributed)} items distributed in ${row.barangay}`}>
              <span className="impact-horizontal-chart__fill impact-horizontal-chart__fill--items" style={{ width: `${Math.max(3, (row.itemsDistributed / max) * 100)}%` }} />
              <em>{number(row.itemsDistributed)} items</em>
            </div>
            <div className="impact-horizontal-chart__track" tabIndex="0" data-tooltip={`${number(row.familiesHelped)} families or recipients helped in ${row.barangay}`}>
              <span className="impact-horizontal-chart__fill impact-horizontal-chart__fill--families" style={{ width: `${Math.max(3, (row.familiesHelped / max) * 100)}%` }} />
              <em>{number(row.familiesHelped)} families</em>
            </div>
          </div>
        </div>
      ))}
      <div className="impact-chart-legend"><span><i className="is-items" /> Items distributed</span><span><i className="is-families" /> Families/recipients</span></div>
    </div>
  )
}

function CategoryChart({ rows }) {
  const [activeIndex, setActiveIndex] = useState(null)
  if (!rows.length) return <EmptyChart>No category distribution data matches these filters.</EmptyChart>
  const values = rows.map((row) => row.itemsDistributed > 0 ? row.itemsDistributed : row.allocations)
  const total = values.reduce((sum, value) => sum + value, 0) || 1
  const segments = rows.map((row, index) => ({
    ...row,
    value: values[index],
    percentage: (values[index] / total) * 100,
    offset: values.slice(0, index).reduce((sum, value) => sum + value, 0) / total * 100,
  }))
  const active = activeIndex === null ? null : segments[activeIndex]
  return (
    <div className="impact-donut-wrap">
      <div className="impact-donut" role="group" aria-label="Distribution by category">
        <svg viewBox="0 0 42 42">
          <circle className="impact-donut__base" cx="21" cy="21" r="15.9155" />
          {segments.map((row, index) => (
            <circle
              key={row.category}
              className={`impact-donut__segment${activeIndex === index ? ' is-active' : ''}`}
              cx="21" cy="21" r="15.9155"
              stroke={COLORS[index % COLORS.length]}
              strokeDasharray={`${row.percentage} ${100 - row.percentage}`}
              strokeDashoffset={-row.offset}
              tabIndex="0"
              aria-label={`${row.category}: ${number(row.itemsDistributed)} items, ${number(row.allocations)} allocations, ${row.percentage.toFixed(1)} percent`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            >
              <title>{`${row.category}: ${number(row.itemsDistributed)} items, ${number(row.allocations)} allocations (${row.percentage.toFixed(1)}%)`}</title>
            </circle>
          ))}
        </svg>
        <div>
          <strong>{active ? number(active.value) : number(total)}</strong>
          <span>{active ? active.category : (rows.some((r) => r.itemsDistributed > 0) ? 'total items' : 'allocations')}</span>
          {active && <small>{active.percentage.toFixed(1)}% of total</small>}
        </div>
      </div>
      <ul className="impact-donut-legend">
        {rows.map((row, index) => (
          <li key={row.category} tabIndex="0" className={activeIndex === index ? 'is-active' : ''} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
            <i style={{ background: COLORS[index % COLORS.length] }} />
            <span>{row.category}</span>
            <strong>{number(row.itemsDistributed)} items</strong>
            <small>{row.allocations} allocation{row.allocations === 1 ? '' : 's'}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivityChart({ rows }) {
  if (!rows.length) return <EmptyChart>No donation activity matches these filters.</EmptyChart>
  const max = Math.max(1, ...rows.map((row) => row.donations))
  return (
    <div className="impact-activity-chart" role="img" aria-label="Donation activity over time">
      {rows.map((row) => (
        <div className="impact-activity-chart__column" key={row.month} tabIndex="0" data-tooltip={`${number(row.donations)} donations · ${peso(row.monetaryAmount)} · ${number(row.inKindDonations)} in-kind`}>
          <span className="impact-activity-chart__value">{row.donations}</span>
          <div className="impact-activity-chart__bar-wrap">
            <span className="impact-activity-chart__bar" style={{ height: `${Math.max(8, (row.donations / max) * 100)}%` }} />
          </div>
          <strong>{monthLabel(row.month)}</strong>
          <small>{peso(row.monetaryAmount)}</small>
        </div>
      ))}
    </div>
  )
}

export default function DonorImpactPage() {
  const [filters, setFilters] = useState(initialFilters)
  const filterKey = useMemo(() => JSON.stringify(filters), [filters])
  const { data, loading, error, reload, isRevalidating } = useApiObject(
    () => donorImpactApi.get(filters),
    filterKey,
    IMPACT_QUERY_OPTIONS,
  )

  const summary = data?.summary || {}
  const whereRows = data?.whereDonationsWent || []
  const categoryRows = data?.categoryDistribution || []
  const familyRows = data?.familiesByBarangay || []
  const activityRows = data?.activityOverTime || []
  const options = data?.filters || { barangays: [], categories: [], statuses: [] }
  const hasFilters = Object.entries(filters).some(([key, value]) => value && value !== 'All' && !(key === 'from' || key === 'to' ? value === '' : false))

  const reportMeta = [
    { label: 'Date Range', value: filters.from || filters.to ? `${filters.from || 'Beginning'} to ${filters.to || 'Present'}` : 'All dates' },
    { label: 'Donation Type', value: filters.type },
    { label: 'Barangay', value: options.barangays.find((item) => item.value === filters.barangay)?.label || filters.barangay },
    { label: 'Category', value: filters.category },
    { label: 'Status', value: filters.status },
    { label: 'Total Donated', value: peso(summary.totalDonated) },
    { label: 'Families/Recipients Helped', value: number(summary.familiesHelped) },
    { label: 'Items Distributed', value: number(summary.itemsDistributed) },
  ]
  const exportColumns = [
    { key: 'barangay', label: 'Barangay' },
    { key: 'municipality', label: 'Municipality / City' },
    { key: 'donations', label: 'Donations' },
    { key: 'allocations', label: 'Allocations' },
    { key: 'itemsDistributed', label: 'Items Distributed' },
    { key: 'familiesHelped', label: 'Families / Recipients Helped' },
  ]

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

  return (
    <ApiState loading={loading && !data} error={error} onRetry={reload}>
      <div className="donor-impact-page">
        <section className="donor-impact-hero">
          <div>
            <span className="donor-impact-eyebrow"><TrendingUp size={15} /> Your giving in action</span>
            <h2>Donation Impact</h2>
            <p>See how your verified gifts moved through allocations and distributions to support partner barangays.</p>
          </div>
          <ExportMenu
            filename="my-donation-impact"
            title="Donation Impact Report"
            columns={exportColumns}
            rows={whereRows}
            meta={reportMeta}
          />
        </section>

        <section className="donor-impact-filters" aria-label="Donation impact filters">
          <label><span>From Date</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => updateFilter('from', e.target.value)} /></label>
          <label><span>To Date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter('to', e.target.value)} /></label>
          <label><span>Donation Type</span><select value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}><option>All</option><option>Monetary</option><option>In-Kind</option></select></label>
          <label><span>Barangay</span><select value={filters.barangay} onChange={(e) => updateFilter('barangay', e.target.value)}><option value="All">All Barangays</option>{options.barangays.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>Category</span><select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}><option value="All">All Categories</option>{options.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Status</span><select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}><option value="All">All Statuses</option>{options.statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button type="button" className="btn btn--outline donor-impact-reset" disabled={!hasFilters || isRevalidating} onClick={() => setFilters(initialFilters)}><RefreshCcw size={14} /> Reset</button>
        </section>

        <section className="donor-impact-summary" aria-label="Impact summary">
          {[
            { label: 'Total Donated', value: peso(summary.totalDonated), icon: Gift },
            { label: 'Barangays Reached', value: number(summary.barangaysReached), icon: MapPin },
            { label: 'Families / Recipients Helped', value: number(summary.familiesHelped), icon: Users },
            { label: 'Items Distributed', value: number(summary.itemsDistributed), icon: Package },
            { label: 'Completed Donations', value: number(summary.completedDonations), icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon
            return <article key={item.label}><div><Icon size={20} /></div><strong>{item.value}</strong><span>{item.label}</span></article>
          })}
        </section>

        <div className={`donor-impact-updating${isRevalidating ? ' is-visible' : ''}`} aria-live="polite"><RefreshCcw size={13} /> Updating report…</div>

        <div className="donor-impact-chart-grid">
          <section className="donor-impact-card donor-impact-card--wide">
            <header><div><h3>Where Donations Went</h3><p>Linked allocations, delivered items, and recipients by barangay.</p></div><MapPin size={19} /></header>
            <BarangayChart rows={whereRows} />
            {whereRows.length > 0 && (
              <div className="donor-impact-table-wrap donor-impact-destination-table">
                <table className="donor-impact-table">
                  <thead><tr><th>Barangay</th><th>Donations</th><th>Allocations</th><th>Items Distributed</th><th>Families / Recipients</th></tr></thead>
                  <tbody>{whereRows.map((row) => (
                    <tr key={row.barangayId}>
                      <td><MapPin size={14} /> <span><strong>{row.barangay}</strong><small>{row.municipality || '—'}</small></span></td>
                      <td>{number(row.donations)}</td><td>{number(row.allocations)}</td><td>{number(row.itemsDistributed)}</td><td>{number(row.familiesHelped)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <section className="donor-impact-card">
            <header><div><h3>Distribution by Category</h3><p>Delivered goods grouped by their recorded category.</p></div><Package size={19} /></header>
            <CategoryChart rows={categoryRows} />
          </section>
          <section className="donor-impact-card">
            <header><div><h3>Donation Activity Over Time</h3><p>Donation count and monetary value by month.</p></div><CalendarDays size={19} /></header>
            <ActivityChart rows={activityRows} />
          </section>
        </div>

        <section className="donor-impact-card donor-impact-table-card">
          <header><div><h3>Families / Recipients Reached</h3><p>Aggregated barangay totals only. No recipient personal information is displayed.</p></div><Users size={19} /></header>
          {familyRows.length ? (
            <div className="donor-impact-table-wrap">
              <table className="donor-impact-table">
                <thead><tr><th>Barangay</th><th>Municipality / City</th><th>Families / Recipients Helped</th></tr></thead>
                <tbody>{familyRows.map((row) => <tr key={row.barangayId}><td><MapPin size={14} /> <strong>{row.barangay}</strong></td><td>{row.municipality || '—'}</td><td><span className="donor-impact-count">{number(row.familiesHelped)}</span></td></tr>)}</tbody>
              </table>
            </div>
          ) : <EmptyChart>No completed distributions match these filters yet.</EmptyChart>}
        </section>
      </div>
    </ApiState>
  )
}
