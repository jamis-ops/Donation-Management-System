import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { programs } from '../data/mockData'
import Reveal from '../components/shared/Reveal'

export default function ProjectDetailPage() {
  const { projectId } = useParams()
  const project = programs.find((p) => p.id === projectId)

  if (!project) return <Navigate to="/#programs" replace />

  const idx = programs.findIndex((p) => p.id === project.id)
  const prev = programs[(idx - 1 + programs.length) % programs.length]
  const next = programs[(idx + 1) % programs.length]

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
