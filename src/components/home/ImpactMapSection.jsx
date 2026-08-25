import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, RefreshCw, Filter, Sparkles, Calendar } from 'lucide-react'
import { publicDistributionsApi } from '../../api/resources'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

// Create clean, minimal status-based map markers
function createStatusIcon(status = 'Scheduled') {
  let color = '#af101a'
  let pulseColor = 'rgba(175, 16, 26, 0.4)'
  let isLive = false

  if (status === 'Active Outreach') {
    color = '#af101a'
    pulseColor = 'rgba(175, 16, 26, 0.45)'
    isLive = true
  } else if (status === 'Completed') {
    color = '#10b981'
    pulseColor = 'rgba(16, 185, 129, 0.35)'
  } else {
    color = '#2563eb'
    pulseColor = 'rgba(37, 99, 235, 0.35)'
  }

  return new L.DivIcon({
    html: `
      <div class="live-map-marker ${isLive ? 'live-map-marker--pulse' : ''}" style="--marker-color: ${color}; --marker-pulse: ${pulseColor};">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="${color}"/>
          <circle cx="12" cy="12" r="5" fill="#ffffff" opacity="0.95"/>
        </svg>
        <span class="live-marker-pulse-ring"></span>
      </div>`,
    className: 'live-leaflet-marker-icon',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  })
}

function getStatusBadgeStyle(status) {
  if (status === 'Active Outreach') {
    return { bg: '#fef2f2', text: '#af101a', border: '#fee2e2', label: 'Active Outreach' }
  }
  if (status === 'Completed') {
    return { bg: '#f0fdf4', text: '#15803d', border: '#dcfce7', label: 'Completed' }
  }
  return { bg: '#eff6ff', text: '#1d4ed8', border: '#dbeafe', label: 'Scheduled' }
}

// Controller component to automatically zoom/pan map to fit current locations
function MapController({ locations }) {
  const map = useMap()

  useEffect(() => {
    if (!locations || locations.length === 0) return
    const validCoords = locations.filter((l) => l.lat && l.lng).map((l) => [l.lat, l.lng])
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords)
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 })
    }
  }, [locations, map])

  return null
}

export default function ImpactMapSection() {
  const [distributions, setDistributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState('all')

  const fetchDistributions = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await publicDistributionsApi.list()
      if (res?.ok && Array.isArray(res.data)) {
        setDistributions(res.data)
      }
    } catch (err) {
      console.warn('Failed to load public map locations:', err)
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }

  // Initial fetch and auto-refresh every 20 seconds
  useEffect(() => {
    fetchDistributions()

    const interval = setInterval(() => {
      fetchDistributions()
    }, 20000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDistributions()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Program options derived from live records
  const availablePrograms = useMemo(() => {
    const set = new Set()
    distributions.forEach((d) => {
      if (d.program) set.add(d.program)
    })
    return ['all', ...Array.from(set)]
  }, [distributions])

  // Filtered locations
  const filteredDistributions = useMemo(() => {
    return distributions.filter((d) => {
      if (statusFilter === 'active' && d.status !== 'Active Outreach') return false
      if (statusFilter === 'scheduled' && d.status !== 'Scheduled') return false
      if (statusFilter === 'completed' && d.status !== 'Completed') return false
      if (programFilter !== 'all' && d.program !== programFilter) return false
      return true
    })
  }, [distributions, statusFilter, programFilter])

  return (
    <section id="map" className="section map-section">
      <div className="container">
        <Reveal>
          <div className="map-section-header">
            <SectionHeading
              eyebrow="Community Reach"
              title="Where We Serve Across Cebu"
              description="Explore communities and service locations where Rise Above conducts active outreach and community programs."
            />
            <div className="map-live-status-badge">
              <span className="map-live-status-dot"></span>
              <span>Live Distribution Map</span>
              <button
                type="button"
                className={`map-refresh-btn ${refreshing ? 'map-refresh-btn--spinning' : ''}`}
                onClick={() => fetchDistributions(true)}
                title="Refresh locations"
              >
                <RefreshCw size={12} />
                <span>{refreshing ? 'Updating…' : 'Sync'}</span>
              </button>
            </div>
          </div>
        </Reveal>

        {/* Minimal Clean Filter Controls */}
        <Reveal delay={60}>
          <div className="map-controls-panel map-controls-panel--compact">
            <div className="map-filters-group">
              <span className="map-filters-label"><Filter size={13} /> View:</span>
              <div className="map-filters" role="group" aria-label="Filter by outreach status">
                <button
                  type="button"
                  className={`map-filter ${statusFilter === 'all' ? 'map-filter--active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All Locations ({distributions.length})
                </button>
                <button
                  type="button"
                  className={`map-filter ${statusFilter === 'active' ? 'map-filter--active' : ''}`}
                  onClick={() => setStatusFilter('active')}
                >
                  <span className="filter-dot filter-dot--active"></span>
                  Active Outreach ({distributions.filter((d) => d.status === 'Active Outreach').length})
                </button>
                <button
                  type="button"
                  className={`map-filter ${statusFilter === 'scheduled' ? 'map-filter--active' : ''}`}
                  onClick={() => setStatusFilter('scheduled')}
                >
                  <span className="filter-dot filter-dot--transit"></span>
                  Scheduled ({distributions.filter((d) => d.status === 'Scheduled').length})
                </button>
                <button
                  type="button"
                  className={`map-filter ${statusFilter === 'completed' ? 'map-filter--active' : ''}`}
                  onClick={() => setStatusFilter('completed')}
                >
                  <span className="filter-dot filter-dot--completed"></span>
                  Completed ({distributions.filter((d) => d.status === 'Completed').length})
                </button>
              </div>
            </div>

            {availablePrograms.length > 2 && (
              <div className="map-search-row" style={{ borderTop: 'none', paddingTop: 0 }}>
                <div className="map-program-select-wrap">
                  <label htmlFor="map-program-filter">Filter by Program:</label>
                  <select
                    id="map-program-filter"
                    value={programFilter}
                    onChange={(e) => setProgramFilter(e.target.value)}
                    className="map-program-select"
                  >
                    <option value="all">All Programs & Projects</option>
                    {availablePrograms.filter((p) => p !== 'all').map((prog) => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        {/* Clean, Focused Map Container */}
        <Reveal className="map-wrapper" delay={100}>
          <MapContainer
            center={[10.3157, 123.8854]}
            zoom={10}
            scrollWheelZoom={false}
            className="impact-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController locations={filteredDistributions} />
            {filteredDistributions.map((dist) => {
              const badge = getStatusBadgeStyle(dist.status)
              const icon = createStatusIcon(dist.status)

              return (
                <Marker
                  key={dist.id}
                  position={[dist.lat, dist.lng]}
                  icon={icon}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -36]}
                    opacity={1}
                    sticky={false}
                    className="live-map-tooltip-container"
                  >
                    <div className="dist-hover-card">
                      <div className="dist-hover-header">
                        <span
                          className="dist-hover-badge"
                          style={{ background: badge.bg, color: badge.text, borderColor: badge.border }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="dist-hover-title">
                        <MapPin size={13} className="dist-hover-icon" />
                        <span>{dist.locationName}</span>
                      </div>

                      <div className="dist-hover-row">
                        <Sparkles size={12} className="dist-hover-icon" />
                        <span>{dist.program || 'Community Outreach'}</span>
                      </div>

                      {dist.scheduledDate && (
                        <div className="dist-hover-row dist-hover-row--date">
                          <Calendar size={12} className="dist-hover-icon" />
                          <span>{dist.scheduledDate}</span>
                        </div>
                      )}
                    </div>
                  </Tooltip>
                </Marker>
              )
            })}
          </MapContainer>
        </Reveal>
      </div>
    </section>
  )
}



