import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Tag } from 'lucide-react'
import { announcements as mockAnnouncements } from '../../data/mockData'
import { fetchPublishedContent } from '../../api/resources'
import { findMockMatch, resolveCmsImage } from '../../utils/cmsMedia'
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver'
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

function AnnouncementCard({ item, index, isVisible }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Reveal 
      as="article" 
      className={`announcement-card announcement-card--media ${isVisible ? 'announcement-card--slide-in' : ''}`}
      delay={index * 60}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        animationDelay: `${index * 0.1}s`,
      }}
    >
      {item.image && (
        <div className="announcement-card__media">
          <img 
            src={item.image} 
            alt="" 
            loading="lazy"
            style={{
              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.5s ease-out',
            }}
          />
          <div className="announcement-card__overlay" />
        </div>
      )}
      <div className="announcement-card__content">
        <div className="announcement-card__meta">
          <span className="announcement-card__category">
            <Tag size={14} />
            {item.category}
          </span>
          {item.date && (
            <time dateTime={item.date} className="announcement-card__date">
              <Calendar size={14} />
              {formatDate(item.date)}
            </time>
          )}
        </div>
        <h3>{item.title}</h3>
        <p>{item.excerpt}</p>
      </div>
    </Reveal>
  )
}

export default function AnnouncementsSection() {
  const [list, setList] = useState(mockAnnouncements)
  const [ref, isIntersecting, hasIntersected] = useIntersectionObserver({
    threshold: 0.1,
  })

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
    <section id="news" className="section announcements-section" ref={ref}>
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
            <AnnouncementCard 
              key={item.id} 
              item={item} 
              index={i}
              isVisible={hasIntersected}
            />
          ))}
        </div>
        <Reveal className="section-cta">
          <Link to="/stories" className="btn btn--outline btn--animated">
            <span className="btn__text">Read Success Stories</span>
            <span className="btn__icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 8h14M8 1l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
