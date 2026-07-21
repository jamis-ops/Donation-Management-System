import { Link } from 'react-router-dom'
import { announcements } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function AnnouncementsSection() {
  return (
    <section id="news" className="section announcements-section">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Latest News"
            title="Stories of purpose and impact"
            description="Updates from our education programs, dental missions, and community partners."
          />
        </Reveal>
        <div className="announcements-grid announcements-grid--media">
          {announcements.map((item, i) => (
            <Reveal key={item.id} as="article" className="announcement-card announcement-card--media" delay={i * 60}>
              {item.image && (
                <div className="announcement-card__media">
                  <img src={item.image} alt="" loading="lazy" />
                </div>
              )}
              <div className="announcement-card__content">
                <span className="announcement-card__category">{item.category}</span>
                <time dateTime={item.date}>{formatDate(item.date)}</time>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="section-cta">
          <Link to="/stories" className="btn btn--outline">
            Read Success Stories
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
