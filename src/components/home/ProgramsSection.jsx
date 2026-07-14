import {
  Waves,
  GraduationCap,
  Utensils,
  Handshake,
  Stethoscope,
} from 'lucide-react'
import { programs } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'

const programIcons = {
  'disaster-relief': Waves,
  'educational-sponsorship': GraduationCap,
  'feeding-programs': Utensils,
  'community-outreach': Handshake,
  'medical-missions': Stethoscope,
}

export default function ProgramsSection() {
  return (
    <section id="programs" className="section programs-section">
      <div className="container">
        <SectionHeading
          eyebrow="Current Programs"
          title="Core programs and services"
          description="Active initiatives delivering real impact to communities across the region."
        />
        <div className="programs-grid">
          {programs
            .filter((p) => p.active)
            .map((program) => {
              const Icon = programIcons[program.id]
              return (
                <article key={program.id} className="program-card">
                  <span className="program-card__icon" aria-hidden="true">
                    {Icon && <Icon size={28} strokeWidth={2} />}
                  </span>
                  <h3>{program.name}</h3>
                  <p>{program.description}</p>
                  <span className="program-card__badge">Active</span>
                </article>
              )
            })}
        </div>
      </div>
    </section>
  )
}
