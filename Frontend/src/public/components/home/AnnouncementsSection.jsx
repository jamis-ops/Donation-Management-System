import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Tag, ArrowRight, X } from 'lucide-react'
import { announcements as mockAnnouncements } from '../../../data/mockData'
import { fetchPublishedContent } from '../../../api/resources'
import { findMockMatch, resolveCmsImage } from '../../../utils/cmsMedia'
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver'
import SectionHeading from '../../../components/shared/SectionHeading'
import Reveal from '../../../components/shared/Reveal'

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
    content: item.body || meta.content || mock?.content || item.summary || mock?.excerpt || '',
    image: resolveCmsImage(item, mock, ['image', 'logo']),
  }
}

function AnnouncementCard({ item, index, isVisible, onSelect }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Reveal 
      as="article" 
      className={`announcement-card announcement-card--media announcement-card--clickable ${isVisible ? 'announcement-card--slide-in' : ''}`}
      delay={index * 60}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(item)
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Read story: ${item.title}`}
      style={{
        animationDelay: `${index * 0.1}s`,
      }}
    >
      {item.image && (
        <div className="announcement-card__media">
          <img 
            src={item.image} 
            alt={item.title} 
            loading="lazy"
            style={{
              transform: isHovered ? 'scale(1.06)' : 'scale(1)',
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
        <div className="announcement-card__action">
          <span className="announcement-card__read-link">
            Read story <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Reveal>
  )
}

export default function AnnouncementsSection() {
  const [list, setList] = useState(mockAnnouncements)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [ref, isIntersecting, hasIntersected] = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedAnnouncement(null)
    }
    if (selectedAnnouncement) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [selectedAnnouncement])

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('announcements', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        const mapped = items.map(mapCmsAnnouncement)
        const seen = new Set()
        const unique = mapped.filter((a) => {
          const key = (a.title || a.id || '').toString().trim().toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setList(unique)
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
              onSelect={setSelectedAnnouncement}
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

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div 
          className="announcement-modal-overlay" 
          onClick={() => setSelectedAnnouncement(null)}
          role="presentation"
        >
          <div 
            className="announcement-modal" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-modal-title"
          >
            <button 
              type="button"
              className="announcement-modal__close" 
              onClick={() => setSelectedAnnouncement(null)}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {selectedAnnouncement.image && (
              <div className="announcement-modal__media">
                <img src={selectedAnnouncement.image} alt={selectedAnnouncement.title} />
              </div>
            )}

            <div className="announcement-modal__body">
              <div className="announcement-card__meta" style={{ marginBottom: '0.85rem' }}>
                <span className="announcement-card__category">
                  <Tag size={14} />
                  {selectedAnnouncement.category}
                </span>
                {selectedAnnouncement.date && (
                  <time className="announcement-card__date">
                    <Calendar size={14} />
                    {formatDate(selectedAnnouncement.date)}
                  </time>
                )}
              </div>

              <h2 id="announcement-modal-title" className="announcement-modal__title">
                {selectedAnnouncement.title}
              </h2>

              <p className="announcement-modal__excerpt">
                {selectedAnnouncement.excerpt}
              </p>

              {selectedAnnouncement.content && selectedAnnouncement.content !== selectedAnnouncement.excerpt && (
                <div className="announcement-modal__content">
                  <p>{selectedAnnouncement.content}</p>
                </div>
              )}

              <div className="announcement-modal__footer">
                <Link 
                  to="/stories" 
                  className="btn btn--primary"
                  onClick={() => setSelectedAnnouncement(null)}
                >
                  View All Success Stories <ArrowRight size={16} />
                </Link>
                <button 
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setSelectedAnnouncement(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
