import { partners } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'

const categories = [
  'Corporate Partners',
  'Educational Partners',
  'NGO Partners',
  'Government Partners',
  'Community Partners',
]

export default function PartnersSection() {
  return (
    <section id="partners" className="section partners-section">
      <div className="container">
        <SectionHeading
          eyebrow="Partners & Sponsors"
          title="Organizations standing with us"
          description="Our work is made possible through the generosity and collaboration of these partners."
        />

        {categories.map((category) => {
          const categoryPartners = partners.filter((p) => p.category === category)
          if (categoryPartners.length === 0) return null

          return (
            <div key={category} className="partner-category">
              <h3 className="partner-category__title">{category}</h3>
              <div className="partners-grid">
                {categoryPartners.map((partner) => (
                  <article key={partner.id} className="partner-card">
                    <div className="partner-card__logo">{partner.initials}</div>
                    <h4>{partner.name}</h4>
                    <p>{partner.description}</p>
                    <a href={partner.website} target="_blank" rel="noreferrer">
                      Visit website →
                    </a>
                  </article>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
