import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapLocations } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

// Animated crimson marker with pulse effect
const pinIcon = new L.DivIcon({
  html: `
    <div class="map-marker-animated">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
          fill="#AF101A"/>
        <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/>
      </svg>
      <span class="map-marker-pulse"></span>
    </div>`,
  className: '',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

function MapBounds({ locations }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [locations, map])
  return null
}

export default function ImpactMapSection() {
  const [filter, setFilter] = useState('all')
  const [hoveredLocation, setHoveredLocation] = useState(null)

  const featuredFilters = [
    'Community Center',
    'Educational Sponsorship',
    'Dental Mission',
    'Disaster Relief and House Building',
  ]

  const programFilters = [
    { id: 'all', label: 'All Programs' },
    ...featuredFilters.map((name) => ({ id: name, label: name })),
  ]

  const filteredLocations = useMemo(() => {
    if (filter === 'all') return mapLocations
    return mapLocations.filter((loc) => loc.programs.includes(filter))
  }, [filter])

  return (
    <section id="map" className="section map-section">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Impact Map"
            title="Where we serve"
            description="Click a location pin to see program details and distribution statistics."
          />
        </Reveal>

        <Reveal delay={80}>
          <div className="map-filters" role="group" aria-label="Filter by program">
            {programFilters.map((pf) => (
              <button
                key={pf.id}
                type="button"
                className={`map-filter${filter === pf.id ? ' map-filter--active' : ''}`}
                onClick={() => setFilter(pf.id)}
              >
                {pf.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal className="map-wrapper" delay={140}>
          <MapContainer
            center={[10.3, 123.8]}
            zoom={9}
            scrollWheelZoom={false}
            className="impact-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds locations={filteredLocations} />
            {filteredLocations.map((loc) => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={pinIcon}>
                <Popup>
                  <div className="map-popup">
                    <strong>{loc.name}</strong>
                    <p>
                      <strong>Programs:</strong> {loc.programs.join(', ')}
                    </p>
                    <p>
                      <strong>Beneficiaries:</strong>{' '}
                      {loc.stats.beneficiaries.toLocaleString()}
                    </p>
                    <p>
                      <strong>Relief packs:</strong>{' '}
                      {loc.stats.reliefPacks.toLocaleString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Reveal>

        <div className="map-location-list">
          {filteredLocations.map((loc, index) => (
            <div 
              key={loc.id} 
              className={`map-location-card ${hoveredLocation === loc.id ? 'map-location-card--hovered' : ''}`}
              onMouseEnter={() => setHoveredLocation(loc.id)}
              onMouseLeave={() => setHoveredLocation(null)}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              <div className="map-location-card__icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="20" height="30">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#AF101A"/>
                  <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/>
                </svg>
              </div>
              <div className="map-location-card__content">
                <h4>{loc.name}</h4>
                <p>{loc.programs.join(' · ')}</p>
                <span>
                  {loc.stats.beneficiaries.toLocaleString()} beneficiaries ·{' '}
                  {loc.stats.reliefPacks.toLocaleString()} packs
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
