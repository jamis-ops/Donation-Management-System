import { useEffect, useState } from 'react'
import { partners as mockPartners } from '../../data/mockData'
import { fetchPublishedContent } from '../../api/resources'
import { findMockMatch, resolveCmsImage } from '../../utils/cmsMedia'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

function mapCmsPartner(item, index) {
  const meta = item.meta || {}
  const mock = findMockMatch(item, mockPartners) || mockPartners[index] || null
  return {
    id: item.id,
    name: item.title || mock?.name || 'Partner',
    location: meta.location || mock?.location || '',
    logo: resolveCmsImage(item, mock, ['logo', 'image']),
    description: item.summary || item.body || mock?.description || '',
  }
}

function PartnerCard({ partner, index }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Reveal
      as="article"
      className={`partner-logo-card ${isHovered ? 'partner-logo-card--hovered' : ''}`}
      delay={Math.min(index * 45, 270)}
      title={partner.name}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="partner-logo-card__frame">
        {partner.logo ? (
          <img 
            src={partner.logo} 
            alt={partner.name} 
            loading="lazy"
            style={{
              filter: isHovered ? 'grayscale(0)' : 'grayscale(100%)',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.4s ease',
            }}
          />
        ) : (
          <span className="partner-logo-card__fallback">{partner.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <p className="partner-logo-card__name">{partner.name}</p>
      {partner.location && <span className="partner-logo-card__loc">{partner.location}</span>}
    </Reveal>
  )
}

export default function PartnersSection() {
  const [list, setList] = useState(mockPartners)

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('partners', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        setList(items.map(mapCmsPartner))
      }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <section id="partners" className="section partners-section">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Our Partners"
            title="Standing with us in Cebu"
            description="Through their Corporate Social Responsibility (CSR), our partners are making a difference with us in Cebu."
          />
        </Reveal>

        <div className="partners-logo-grid">
          {list.map((partner, i) => (
            <PartnerCard key={partner.id} partner={partner} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
