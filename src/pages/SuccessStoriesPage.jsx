import { useEffect, useState } from 'react'
import { successStories as mockStories } from '../data/mockData'
import { fetchPublishedContent } from '../api/resources'
import { findMockMatch, resolveCmsImage } from '../utils/cmsMedia'
import SectionHeading from '../components/shared/SectionHeading'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function mapCmsStory(item, index) {
  const meta = item.meta || {}
  const mock = findMockMatch(item, mockStories, { slugKey: 'id', nameKey: 'title' }) || mockStories[index] || null
  return {
    id: item.id,
    title: item.title || mock?.title || 'Story',
    date: meta.date || (item.publishedAt ? String(item.publishedAt).slice(0, 10) : '') || mock?.date || '',
    category: meta.category || mock?.category || 'Story',
    excerpt: item.summary || mock?.excerpt || '',
    content: item.body || item.summary || mock?.content || '',
    testimonial: meta.testimonial || mock?.testimonial || '',
    image: resolveCmsImage(item, mock, ['image', 'logo']),
  }
}

export default function SuccessStoriesPage() {
  const [stories, setStories] = useState(mockStories)

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('stories', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        setStories(items.map(mapCmsStory))
      }
    })
    return () => { cancelled = true }
  }, [])

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
            {stories.map((story) => (
              <article key={story.id} className="story-card">
                {story.image && (
                  <div className="story-card__media">
                    <img src={story.image} alt="" loading="lazy" />
                  </div>
                )}
                <div className="story-card__meta">
                  <span className="story-card__category">{story.category}</span>
                  {story.date && <time dateTime={story.date}>{formatDate(story.date)}</time>}
                </div>
                <h2>{story.title}</h2>
                <p className="story-card__excerpt">{story.excerpt}</p>
                <div className="story-card__content">
                  <p>{story.content}</p>
                  {story.testimonial && <blockquote>{story.testimonial}</blockquote>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
