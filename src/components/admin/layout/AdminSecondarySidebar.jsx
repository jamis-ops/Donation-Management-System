import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutList,
  Users,
} from 'lucide-react'
import { beneficiariesApi } from '../../../api/resources'
import { useApiList } from '../../../hooks/useApiList'
import { BENEFICIARIES_CHANGED } from '../../../utils/beneficiariesSync'

export default function AdminSecondarySidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: barangays = [], loading, reload, setData } = useApiList(() => beneficiariesApi.list())
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    const onChanged = (event) => {
      const removedId = event.detail?.removedId
      if (removedId != null) {
        setData((prev) => (prev || []).filter((b) => Number(b.dbId) !== Number(removedId)))
      }
      void reload()
    }
    window.addEventListener(BENEFICIARIES_CHANGED, onChanged)
    return () => window.removeEventListener(BENEFICIARIES_CHANGED, onChanged)
  }, [reload, setData])

  const activeId = useMemo(() => {
    const match = pathname.match(/^\/admin\/(?:beneficiaries|barangays)\/([^/]+)/)
    return match ? match[1] : null
  }, [pathname])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...barangays]
      .sort((a, b) => String(a.barangay || a.name || '').localeCompare(String(b.barangay || b.name || '')))
      .filter((b) => {
        if (statusFilter !== 'All' && b.status !== statusFilter) return false
        if (!q) return true
        const name = String(b.barangay || b.name || '').toLowerCase()
        const city = String(b.municipality || '').toLowerCase()
        const rep = String(b.representativeName || '').toLowerCase()
        return name.includes(q) || city.includes(q) || rep.includes(q)
      })
  }, [barangays, query, statusFilter])

  const openBarangay = (id) => {
    navigate(`/admin/beneficiaries/${id}`)
    onMobileClose?.()
  }

  const openOverview = () => {
    navigate('/admin/beneficiaries')
    onMobileClose?.()
  }

  // On mobile drawer, always show the full list even if desktop collapse is on.
  const showFullPanel = !collapsed || mobileOpen
  const showRail = collapsed && !mobileOpen

  return (
    <>
      {mobileOpen && (
        <div
          className="admin-secondary-overlay"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'admin-secondary',
          collapsed && !mobileOpen ? 'admin-secondary--collapsed' : '',
          mobileOpen ? 'admin-secondary--mobile-open' : '',
        ].filter(Boolean).join(' ')}
        aria-label="Barangay list"
      >
        <div className="admin-secondary__header">
          {showFullPanel && (
            <div className="admin-secondary__title-wrap">
              <BuildingIcon />
              <div>
                <strong>Barangays</strong>
                <span>{barangays.length} partners</span>
              </div>
            </div>
          )}
          <button
            type="button"
            className="admin-secondary__collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand barangay sidebar' : 'Collapse barangay sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {showFullPanel && (
          <>
            <div className="admin-secondary__tools">
              <div className="admin-secondary__search">
                <Search size={14} aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search barangays…"
                  aria-label="Search barangays"
                />
              </div>
              <select
                className="admin-secondary__filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Approved">Approved</option>
                <option value="Pending Approval">Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            <button
              type="button"
              className={`admin-secondary__overview${activeId ? '' : ' is-active'}`}
              onClick={openOverview}
            >
              <LayoutList size={16} />
              <span>All barangays overview</span>
            </button>

            <div className="admin-secondary__list-wrap">
              {loading ? (
                <p className="admin-secondary__empty">Loading barangays…</p>
              ) : filtered.length === 0 ? (
                <p className="admin-secondary__empty">No barangays match your search.</p>
              ) : (
                <ul className="admin-secondary__list">
                  {filtered.map((b) => {
                    const id = String(b.dbId)
                    const active = activeId === id
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={`admin-secondary__item${active ? ' is-active' : ''}`}
                          onClick={() => openBarangay(id)}
                        >
                          <span className="admin-secondary__item-icon">
                            <MapPin size={15} />
                          </span>
                          <span className="admin-secondary__item-body">
                            <strong>{b.barangay || b.name || 'Barangay'}</strong>
                            <small>
                              {b.municipality || 'Cebu'}
                              {b.affectedFamilies != null ? ` · ${Number(b.affectedFamilies).toLocaleString()} families` : ''}
                            </small>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {showRail && (
          <div className="admin-secondary__rail">
            <button
              type="button"
              className={`admin-secondary__rail-btn${!activeId ? ' is-active' : ''}`}
              onClick={openOverview}
              title="All barangays"
            >
              <LayoutList size={18} />
            </button>
            {filtered.slice(0, 12).map((b) => {
              const id = String(b.dbId)
              const active = activeId === id
              const label = (b.barangay || b.name || '?').slice(0, 1).toUpperCase()
              return (
                <button
                  key={id}
                  type="button"
                  className={`admin-secondary__rail-btn${active ? ' is-active' : ''}`}
                  onClick={() => openBarangay(id)}
                  title={b.barangay || b.name}
                >
                  <span className="admin-secondary__rail-initial">{label}</span>
                </button>
              )
            })}
            {filtered.length > 12 && (
              <button
                type="button"
                className="admin-secondary__rail-btn"
                onClick={onToggleCollapse}
                title="Show all"
              >
                <Users size={16} />
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

function BuildingIcon() {
  return (
    <span className="admin-secondary__title-icon" aria-hidden>
      <MapPin size={18} />
    </span>
  )
}
