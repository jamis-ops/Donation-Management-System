import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  Eye,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react'
import { distributionsApi } from '../../api/resources'
import ApiState from '../../admin/components/shared/ApiState'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import { useApiList } from '../../hooks/useApiList'
import { useAuth } from '../../context/AuthContext'

function formatSchedule(row) {
  if (!row?.distributionDate) return row?.date || 'Not scheduled'
  const date = new Date(`${row.distributionDate}T00:00:00`)
  const dateLabel = Number.isNaN(date.getTime())
    ? row.distributionDate
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  if (!row.scheduleTime) return dateLabel
  const time = new Date(`2000-01-01T${row.scheduleTime}`)
  const timeLabel = Number.isNaN(time.getTime())
    ? row.scheduleTime
    : time.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  return `${dateLabel} at ${timeLabel}`
}

function destination(row) {
  const beneficiary = row?.barangay || row?.barangayMunicipality || ''
  const location = row?.location || ''
  if (beneficiary && location && !beneficiary.toLowerCase().includes(location.toLowerCase())) {
    return `${beneficiary} — ${location}`
  }
  return beneficiary || location || 'Not specified'
}

function Detail({ icon: Icon, label, children, wide = false }) {
  return (
    <div className={`volunteer-assignment-detail${wide ? ' volunteer-assignment-detail--wide' : ''}`}>
      <Icon size={17} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{children || 'Not specified'}</strong>
      </div>
    </div>
  )
}

export default function VolunteerDistributionsPage() {
  const { user } = useAuth()
  const isIntern = user?.role === 'Intern'
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const assignments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (Array.isArray(data) ? data : []).filter((row) => {
      if (!row.assignedToMe) return false
      if (!normalizedQuery) return true
      return [row.id, row.program, row.location, row.barangay, row.coordinator, row.volunteerRole, row.status]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
    })
  }, [data, query])

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="volunteer-assignments" aria-labelledby="assigned-distributions-title">
        <div className="volunteer-assignments__intro">
          <div>
            <span className="volunteer-assignments__eyebrow"><ShieldCheck size={15} /> Read-only assignment view</span>
            <h2 id="assigned-distributions-title">Assigned Distributions</h2>
            <p>Deliveries where your volunteer account is part of the approved Delivery Team.</p>
          </div>
          <div className="volunteer-assignments__count">
            <Truck size={18} />
            <strong>{assignments.length}</strong>
            <span>{assignments.length === 1 ? 'assignment' : 'assignments'}</span>
          </div>
        </div>

        <label className="volunteer-assignments__search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by delivery ID, program, destination, or status"
            aria-label="Search assigned distributions"
          />
        </label>

        {assignments.length === 0 ? (
          <div className="volunteer-assignments__empty">
            <Truck size={30} />
            <h3>{query ? 'No matching assignments' : 'No assigned distributions yet'}</h3>
            <p>{query ? 'Try another search term.' : 'A delivery will appear here when an admin assigns your volunteer account to its Delivery Team.'}</p>
          </div>
        ) : (
          <div className="volunteer-assignments__grid">
            {assignments.map((row) => (
              <article className="volunteer-assignment-card" key={row.dbId}>
                <div className="volunteer-assignment-card__head">
                  <div>
                    <span className="volunteer-assignment-card__id">{row.id}</span>
                    <h3>{row.program || row.eventName || 'Community Distribution'}</h3>
                  </div>
                  <span className="volunteer-assignment-card__mine"><ShieldCheck size={14} /> Assigned to Me</span>
                </div>

                <div className="volunteer-assignment-card__body">
                  <Detail icon={MapPin} label="Destination / Beneficiary">{destination(row)}</Detail>
                  <Detail icon={CalendarDays} label="Date and time">{formatSchedule(row)}</Detail>
                  <Detail icon={UserRound} label="Coordinator">{row.coordinator || 'Not assigned'}</Detail>
                  <Detail icon={Package} label="Cargo / Items" wide>{row.itemsSummary || 'No cargo summary available'}</Detail>
                </div>

                <div className="volunteer-assignment-card__footer">
                  <div className="volunteer-assignment-card__role">
                    <span>Your role / task</span>
                    <strong>{row.volunteerRole || (isIntern ? 'Delivery Team Intern' : 'Delivery Team Volunteer')}</strong>
                  </div>
                  <StatusBadge status={row.status || 'Planning'} />
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => setSelected(row)}>
                    <Eye size={15} /> View Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="admin-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="admin-modal admin-modal--wide volunteer-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="volunteer-assignment-modal-title">
            <ModalHeader
              title={selected.id || 'Distribution Details'}
              subtitle="Assigned delivery details (read-only)"
              onClose={() => setSelected(null)}
            />
            <div className="volunteer-assignment-modal__status">
              <span className="volunteer-assignment-card__mine"><ShieldCheck size={14} /> Assigned to Me</span>
              <StatusBadge status={selected.status || 'Planning'} />
            </div>
            <div className="volunteer-assignment-modal__grid">
              <Detail icon={Truck} label="Program">{selected.program || selected.eventName}</Detail>
              <Detail icon={MapPin} label="Destination / Beneficiary">{destination(selected)}</Detail>
              <Detail icon={CalendarDays} label="Date">{selected.date || selected.distributionDate}</Detail>
              <Detail icon={Clock3} label="Time">{selected.scheduleTime || 'Not specified'}</Detail>
              <Detail icon={UserRound} label="Assigned Coordinator">{selected.coordinator || 'Not assigned'}</Detail>
              <Detail icon={ShieldCheck} label={`${isIntern ? 'Intern' : 'Volunteer'} Role / Task`}>
                {selected.volunteerRole || (isIntern ? 'Delivery Team Intern' : 'Delivery Team Volunteer')}
              </Detail>
              <Detail icon={Package} label="Cargo / Items" wide>{selected.itemsSummary || 'No cargo summary available'}</Detail>
            </div>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn--outline" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </ApiState>
  )
}
