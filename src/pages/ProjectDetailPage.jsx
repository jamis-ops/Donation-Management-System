import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { programs as mockPrograms } from '../data/mockData'
import { fetchPublishedContent } from '../api/resources'
import { findMockMatch, resolveCmsImage } from '../utils/cmsMedia'
import Reveal from '../components/shared/Reveal'

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
    active: meta.active !== false,
  }
}

export default function ProjectDetailPage() {
  const { projectId } = useParams()
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

  const project = list.find((p) => p.id === projectId)
    || mockPrograms.find((p) => p.id === projectId)

  if (!project && list.length > 0) {
    return <Navigate to="/#programs" replace />
  }
  if (!project) {
    // Still loading CMS; show mock while waiting
    const fallback = mockPrograms.find((p) => p.id === projectId)
    if (!fallback) return <Navigate to="/#programs" replace />
    return <ProjectDetailView project={fallback} list={mockPrograms} />
  }

  return <ProjectDetailView project={project} list={list.length ? list : mockPrograms} />
}

function ProjectDetailView({ project, list }) {
  const idx = Math.max(0, list.findIndex((p) => p.id === project.id))
  const prev = list[(idx - 1 + list.length) % list.length]
  const next = list[(idx + 1) % list.length]

  return (
    <div className="page project-detail-page">
      <section
        className="project-detail__hero"
        style={{ '--project-accent': project.color }}
      >
        {project.image && (
          <img src={project.image} alt="" className="project-detail__hero-img" />
        )}
        <div className="project-detail__hero-overlay" />
        <div className="container project-detail__hero-content">
          <Link to="/#programs" className="project-detail__back">
            <ArrowLeft size={16} /> All projects
          </Link>
          <h1>{project.name}</h1>
          <p>{project.short}</p>
        </div>
      </section>

      <section className="section">
        <div className="container project-detail__body">
          <Reveal as="p" className="project-detail__text">
            {project.description}
          </Reveal>
          <Reveal className="project-detail__actions" delay={80}>
            <Link to="/donate" className="btn btn--primary">Donate</Link>
            <Link to="/volunteer" className="btn btn--outline">Volunteer</Link>
          </Reveal>
          <div className="project-detail__nav">
            <Link to={`/projects/${prev.id}`} className="project-detail__nav-link">
              <ArrowLeft size={14} /> {prev.name}
            </Link>
            <Link to={`/projects/${next.id}`} className="project-detail__nav-link">
              {next.name} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
