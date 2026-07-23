import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { announcements as mockAnnouncements } from '../../data/mockData'
import { fetchPublishedContent } from '../../api/resources'
import { findMockMatch, resolveCmsImage } from '../../utils/cmsMedia'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

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

function mapCmsAnnouncement(item, index) {
  const meta = item.meta || {}
  const mock = findMockMatch(item, mockAnnouncements, { slugKey: 'id', nameKey: 'title' }) || mockAnnouncements[index] || null
  return {
    id: item.id,
    title: item.title || mock?.title || 'News',
    date: meta.date || (item.publishedAt ? String(item.publishedAt).slice(0, 10) : '') || mock?.date || '',
    category: meta.category || mock?.category || 'News',
    excerpt: item.summary || mock?.excerpt || '',
    image: resolveCmsImage(item, mock, ['image', 'logo']),
  }
}

export default function AnnouncementsSection() {
  const [list, setList] = useState(mockAnnouncements)

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('announcements', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        setList(items.map(mapCmsAnnouncement))
      }
    })
    return () => { cancelled = true }
  }, [])

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
          {list.map((item, i) => (
            <Reveal key={item.id} as="article" className="announcement-card announcement-card--media" delay={i * 60}>
              {item.image && (
                <div className="announcement-card__media">
                  <img src={item.image} alt="" loading="lazy" />
                </div>
              )}
              <div className="announcement-card__content">
                <span className="announcement-card__category">{item.category}</span>
                {item.date && <time dateTime={item.date}>{formatDate(item.date)}</time>}
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
