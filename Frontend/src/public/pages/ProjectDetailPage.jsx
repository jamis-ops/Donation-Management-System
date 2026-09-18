import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Users, Sparkles, HeartHandshake } from 'lucide-react'
import { programs as mockPrograms } from '../../data/mockData'
import { fetchPublishedContent } from '../../api/resources'
import { findMockMatch, resolveCmsImage } from '../../utils/cmsMedia'
import Reveal from '../../components/shared/Reveal'

const FALLBACK_COLORS = [
  '#2563eb', '#7c3aed', '#0891b2', '#65a30d', '#16a34a',
  '#ea580c', '#db2777', '#e11d48', '#4f46e5', '#ca8a04',
]

function normSlug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function findProjectInList(items, targetId) {
  if (!items || !items.length || !targetId) return null
  const targetNorm = normSlug(targetId)

  // 1. Exact ID or slug match
  let match = items.find((p) => p.id === targetId || p.slug === targetId)
  if (match) return match

  // 2. Normalized ID or slug match
  match = items.find((p) => normSlug(p.id) === targetNorm || normSlug(p.slug) === targetNorm)
  if (match) return match

  // 3. Known aliases
  const aliases = {
    'medical-mission': 'medical-missions',
    'medical-missions': 'medical-mission',
    'disaster-relief': 'disaster-relief-and-house-building',
    'disaster-relief-and-house-building': 'disaster-relief',
    'disaster-relief-and-house-building-project': 'disaster-relief',
    'children-s-library': 'childrens-library',
    'childrens-library': 'children-s-library',
  }
  const aliasTarget = aliases[targetNorm]
  if (aliasTarget) {
    match = items.find((p) => normSlug(p.id) === aliasTarget || normSlug(p.slug) === aliasTarget)
    if (match) return match
  }

  // 4. Normalized name match
  match = items.find((p) => normSlug(p.name) === targetNorm)
  if (match) return match

  return null
}

function mapCmsProgram(item, index) {
  const meta = item.meta || {}
  const mock = findMockMatch(item, mockPrograms) || null
  return {
    id: meta.slug || mock?.id || `cms-${item.id}`,
    slug: meta.slug || mock?.id || `cms-${item.id}`,
    name: item.title || mock?.name || 'Program',
    short: item.summary || mock?.short || '',
    description: item.body || item.summary || mock?.description || '',
    image: resolveCmsImage(item, mock, ['image', 'logo']),
    color: meta.color || mock?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    category: meta.category || mock?.category || 'Community Development',
    location: meta.location || mock?.location || 'Cebu, Philippines',
    targetBeneficiaries: meta.targetBeneficiaries || mock?.targetBeneficiaries || 'Underprivileged communities and families in Cebu',
    impact: meta.impact || mock?.impact || '',
    objectives: Array.isArray(meta.objectives) && meta.objectives.length ? meta.objectives : (mock?.objectives || []),
    activities: Array.isArray(meta.activities) && meta.activities.length ? meta.activities : (mock?.activities || []),
    active: meta.active !== false && mock?.active !== false,
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

  const project = findProjectInList(list, projectId)
    || findProjectInList(mockPrograms, projectId)

  if (!project && list.length > 0) {
    return <Navigate to="/#programs" replace />
  }
  if (!project) {
    // Still loading CMS; try mock directly
    const fallback = findProjectInList(mockPrograms, projectId)
    if (!fallback) return <Navigate to="/#programs" replace />
    return <ProjectDetailView project={fallback} list={mockPrograms} />
  }

  return <ProjectDetailView project={project} list={list.length ? list : mockPrograms} />
}

function ProjectDetailView({ project, list }) {
  const currentIdx = Math.max(0, list.findIndex((p) => p.id === project.id || p.slug === project.id))
  const prev = list[(currentIdx - 1 + list.length) % list.length]
  const next = list[(currentIdx + 1) % list.length]

  return (
    <div className="page project-detail-page">
      {/* Hero Banner */}
      <section
        className="project-detail__hero"
        style={{ '--project-accent': project.color }}
      >
        {project.image && (
          <img src={project.image} alt={project.name} className="project-detail__hero-img" />
        )}
        <div className="project-detail__hero-overlay" />
        <div className="container project-detail__hero-content">
          <Link to="/#programs" className="project-detail__back">
            <ArrowLeft size={16} /> Back to Projects
          </Link>
          {project.category && (
            <span className="project-detail__badge">{project.category}</span>
          )}
          <h1>{project.name}</h1>
          <p className="project-detail__hero-summary">{project.short}</p>

          <div className="project-detail__meta-strip">
            {project.location && (
              <span className="project-detail__meta-item">
                <MapPin size={14} /> {project.location}
              </span>
            )}
            {project.targetBeneficiaries && (
              <span className="project-detail__meta-item">
                <Users size={14} /> {project.targetBeneficiaries}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Main Content & Sidebar */}
      <section className="section project-detail__section">
        <div className="container">
          <div className="project-detail__grid-layout">
            {/* Main Content Area */}
            <div className="project-detail__main">
              {/* Overview */}
              <Reveal className="project-detail__card">
                <h2 className="project-detail__section-title">About the Project</h2>
                <p className="project-detail__text">{project.description}</p>
              </Reveal>

              {/* Objectives */}
              {Array.isArray(project.objectives) && project.objectives.length > 0 && (
                <Reveal className="project-detail__card" delay={60}>
                  <h2 className="project-detail__section-title">Key Objectives</h2>
                  <div className="project-detail__objectives-grid">
                    {project.objectives.map((obj, i) => (
                      <div key={i} className="project-detail__objective-item">
                        <CheckCircle2 size={18} className="project-detail__objective-icon" />
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </Reveal>
              )}

              {/* Core Activities */}
              {Array.isArray(project.activities) && project.activities.length > 0 && (
                <Reveal className="project-detail__card" delay={100}>
                  <h2 className="project-detail__section-title">Core Activities &amp; Programs</h2>
                  <div className="project-detail__activities-grid">
                    {project.activities.map((act, i) => (
                      <div key={i} className="project-detail__activity-card">
                        <span className="project-detail__activity-step">0{i + 1}</span>
                        <p>{act}</p>
                      </div>
                    ))}
                  </div>
                </Reveal>
              )}

              {/* Impact / Milestone */}
              {project.impact && (
                <Reveal className="project-detail__card project-detail__card--impact" delay={140}>
                  <div className="project-detail__impact-header">
                    <Sparkles size={20} className="project-detail__impact-icon" />
                    <h3>Impact &amp; Community Reach</h3>
                  </div>
                  <p>{project.impact}</p>
                </Reveal>
              )}

              {/* Mobile CTA */}
              <div className="project-detail__mobile-actions">
                <Link to={`/donate?program=${encodeURIComponent(project.name)}`} className="btn btn--primary btn--lg">
                  Donate to this Project
                </Link>
                <Link to={`/volunteer?program=${encodeURIComponent(project.name)}`} className="btn btn--outline btn--lg">
                  Volunteer with Us
                </Link>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="project-detail__sidebar">
              {/* Action Box */}
              <div className="project-detail__sidebar-card project-detail__sidebar-card--cta">
                <HeartHandshake size={28} className="project-detail__cta-icon" />
                <h3>Get Involved</h3>
                <p>
                  Your support directly helps Rise Above Foundation Cebu deliver education, nutrition, and healthcare to families in need.
                </p>
                <div className="project-detail__sidebar-buttons">
                  <Link
                    to={`/donate?program=${encodeURIComponent(project.name)}`}
                    className="btn btn--primary btn--block"
                  >
                    Donate to this Project
                  </Link>
                  <Link
                    to={`/volunteer?program=${encodeURIComponent(project.name)}`}
                    className="btn btn--outline btn--block"
                  >
                    Volunteer with Us
                  </Link>
                </div>
              </div>

              {/* Snapshot / Details Card */}
              <div className="project-detail__sidebar-card">
                <h4>Project Snapshot</h4>
                <dl className="project-detail__dl">
                  <div>
                    <dt>Category</dt>
                    <dd>{project.category || 'Community Outreach'}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{project.location || 'Cebu, Philippines'}</dd>
                  </div>
                  <div>
                    <dt>Target Beneficiaries</dt>
                    <dd>{project.targetBeneficiaries || 'Underserved families and children'}</dd>
                  </div>
                  <div>
                    <dt>Organizer</dt>
                    <dd>Rise Above Foundation Cebu</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>

          {/* Bottom Navigation */}
          <div className="project-detail__nav">
            <Link to={`/projects/${prev.id}`} className="project-detail__nav-link project-detail__nav-link--prev">
              <ArrowLeft size={16} />
              <div className="project-detail__nav-meta">
                <span className="project-detail__nav-sub">Previous Project</span>
                <span className="project-detail__nav-title">{prev.name}</span>
              </div>
            </Link>

            <Link to={`/projects/${next.id}`} className="project-detail__nav-link project-detail__nav-link--next">
              <div className="project-detail__nav-meta" style={{ textAlign: 'right' }}>
                <span className="project-detail__nav-sub">Next Project</span>
                <span className="project-detail__nav-title">{next.name}</span>
              </div>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

