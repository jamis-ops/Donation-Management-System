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

        <Reveal className="partners-logo-grid">
          {list.map((partner) => (
            <article key={partner.id} className="partner-logo-card" title={partner.name}>
              <div className="partner-logo-card__frame">
                {partner.logo ? (
                  <img src={partner.logo} alt={partner.name} loading="lazy" />
                ) : (
                  <span className="partner-logo-card__fallback">{partner.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <p className="partner-logo-card__name">{partner.name}</p>
              {partner.location && <span className="partner-logo-card__loc">{partner.location}</span>}
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
