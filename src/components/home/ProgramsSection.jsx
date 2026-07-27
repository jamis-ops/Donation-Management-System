import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { programs as mockPrograms } from '../../data/mockData'
import { fetchPublishedContent } from '../../api/resources'
import { findMockMatch, resolveCmsImage } from '../../utils/cmsMedia'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

const FALLBACK_COLORS = [
  '#2563eb', '#7c3aed', '#0891b2', '#65a30d', '#16a34a',
  '#ea580c', '#db2777', '#e11d48', '#4f46e5', '#ca8a04',
]

function mapCmsProgram(item, index) {
  const meta = item.meta || {}
  const mock = findMockMatch(item, mockPrograms) || mockPrograms[index] || null
  return {
    id: meta.slug || mock?.id || `cms-${item.id}`,
    name: item.title || mock?.name || 'Program',
    short: item.summary || mock?.short || '',
    description: item.body || item.summary || mock?.description || '',
    image: resolveCmsImage(item, mock, ['image', 'logo']),
    color: meta.color || mock?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    active: meta.active !== false && mock?.active !== false,
  }
}

function ProgramCard({ program, index }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e) => {
    if (!isHovered) return
    
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const tiltX = ((y - centerY) / centerY) * -10 // Negative for natural tilt
    const tiltY = ((x - centerX) / centerX) * 10
    
    setTilt({ x: tiltX, y: tiltY })
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })
  }

  return (
    <Reveal
      as="article"
      className={`project-card ${isHovered ? 'project-card--hovered' : ''}`}
      delay={Math.min(index * 40, 280)}
    >
      <div
        className="project-card__tilt"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isHovered ? '10px' : '0px'})`,
          transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.3s ease-out',
        }}
      >
        <div
          className="project-card__media"
          style={{ '--project-accent': program.color }}
        >
          {program.image ? (
            <img
              src={program.image}
              alt=""
              loading="lazy"
              className="project-card__image"
              style={{
                transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.6s ease-out',
              }}
            />
          ) : (
            <div className="project-card__fallback" style={{ background: program.color }} />
          )}
          <span className="project-card__tint" />
          <span
            className="project-card__shine"
            style={{
              opacity: isHovered ? 1 : 0,
              background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              transform: `translateX(${isHovered ? '100%' : '-100%'})`,
            }}
          />
        </div>

        <div className="project-card__body">
          <h3>{program.name}</h3>
          <p>{program.short}</p>
          <Link to={`/projects/${program.id}`} className="project-card__link">
            Read more
            <span className="project-card__link-icon">
              <ArrowRight size={14} />
            </span>
          </Link>
        </div>

        <div
          className="project-card__shadow"
          style={{
            opacity: isHovered ? 0.5 : 0.2,
            transform: `translateX(${tilt.y * 0.5}px) translateY(${tilt.x * 0.5}px)`,
          }}
        />
      </div>
    </Reveal>
  )
}

export default function ProgramsSection() {
  const [list, setList] = useState(() => mockPrograms.filter((p) => p.active))

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('programs', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        setList(items.map(mapCmsProgram).filter((p) => p.active !== false))
      }
    })
    return () => { cancelled = true }
  }, [])

  const featuredList = list.slice(0, 6)

  return (
    <section id="programs" className="section projects-section">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Our Projects"
            title="Together we can help"
            description="Community-based programs in education, livelihood, health & hygiene, and hope across Cebu."
          />
        </Reveal>

        <div className="projects-grid">
          {featuredList.map((program, i) => (
            <ProgramCard key={program.id} program={program} index={i} />
          ))}
        </div>

        {list.length > 6 && (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link
              to="/donate"
              className="btn btn--outline btn--lg"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                borderRadius: '50px',
                fontWeight: 600,
              }}
            >
              See All Projects &amp; Support
              <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
