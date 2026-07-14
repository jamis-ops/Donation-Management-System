import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapLocations, programs } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'

const pinIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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

  const programFilters = [
    { id: 'all', label: 'All Programs' },
    ...programs.map((p) => ({ id: p.name, label: p.name })),
  ]

  const filteredLocations = useMemo(() => {
    if (filter === 'all') return mapLocations
    return mapLocations.filter((loc) => loc.programs.includes(filter))
  }, [filter])

  return (
    <section id="map" className="section map-section">
      <div className="container">
        <SectionHeading
          eyebrow="Impact Map"
          title="Where we serve"
          description="Click a location to view program details and distribution statistics."
        />

        <div className="map-filters" role="group" aria-label="Filter by program type">
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

        <div className="map-wrapper">
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
        </div>

        <div className="map-location-list">
          {filteredLocations.map((loc) => (
            <div key={loc.id} className="map-location-card">
              <h4>{loc.name}</h4>
              <p>{loc.programs.join(' · ')}</p>
              <span>
                {loc.stats.beneficiaries.toLocaleString()} beneficiaries ·{' '}
                {loc.stats.reliefPacks.toLocaleString()} packs
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
