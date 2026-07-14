import { Link } from 'react-router-dom'
import { announcements } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'

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
        <SectionHeading
          eyebrow="Latest Announcements"
          title="News, activities & opportunities"
          description="Stay informed about disaster response operations, volunteer opportunities, and foundation updates."
        />
        <div className="announcements-grid">
          {announcements.map((item) => (
            <article key={item.id} className="announcement-card">
              <span className="announcement-card__category">{item.category}</span>
              <time dateTime={item.date}>{formatDate(item.date)}</time>
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
            </article>
          ))}
        </div>
        <div className="section-cta">
          <Link to="/stories" className="btn btn--outline">
            Read Success Stories
          </Link>
        </div>
      </div>
    </section>
  )
}
