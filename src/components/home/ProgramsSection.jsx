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
          {list.map((program, i) => (
            <Reveal key={program.id} as="article" className="project-card" delay={Math.min(i * 40, 280)}>
              <div className="project-card__media" style={{ '--project-accent': program.color }}>
                {program.image ? (
                  <img src={program.image} alt="" loading="lazy" />
                ) : (
                  <div className="project-card__fallback" style={{ background: program.color }} />
                )}
                <span className="project-card__tint" />
              </div>
              <div className="project-card__body">
                <h3>{program.name}</h3>
                <p>{program.short}</p>
                <Link to={`/projects/${program.id}`} className="project-card__link">
                  Read more <ArrowRight size={14} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
