import { successStories } from '../data/mockData'
import SectionHeading from '../components/shared/SectionHeading'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function SuccessStoriesPage() {
  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Success Stories</h1>
          <p>Real-life impact from the communities we serve.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            align="left"
            title="Impact stories"
            description="Every story represents a life changed through the generosity of donors and the dedication of volunteers."
          />
          <div className="stories-list">
            {successStories.map((story) => (
              <article key={story.id} className="story-card">
                <div className="story-card__meta">
                  <span className="story-card__category">{story.category}</span>
                  <time dateTime={story.date}>{formatDate(story.date)}</time>
                </div>
                <h2>{story.title}</h2>
                <p className="story-card__excerpt">{story.excerpt}</p>
                <div className="story-card__content">
                  <p>{story.content}</p>
                  <blockquote>{story.testimonial}</blockquote>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
