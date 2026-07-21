import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { programs } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

export default function ProgramsSection() {
  const active = programs.filter((p) => p.active)

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
          {active.map((program, i) => (
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
