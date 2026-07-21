import { partners } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

export default function PartnersSection() {
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
          {partners.map((partner) => (
            <article key={partner.id} className="partner-logo-card" title={partner.name}>
              <div className="partner-logo-card__frame">
                <img src={partner.logo} alt={partner.name} loading="lazy" />
              </div>
              <p className="partner-logo-card__name">{partner.name}</p>
              <span className="partner-logo-card__loc">{partner.location}</span>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
