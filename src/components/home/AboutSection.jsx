import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { foundation } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

export default function AboutSection() {
  return (
    <section id="about" className="section about-section">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="About Us"
            title="Action speaks louder than words"
            description={foundation.aboutIntro}
          />
        </Reveal>

        <div className="about-section__grid">
          <Reveal className="about-section__card" delay={60}>
            <h3>Our Mission</h3>
            <p>{foundation.mission}</p>
          </Reveal>
          <Reveal className="about-section__card" delay={120}>
            <h3>Our Vision</h3>
            <p>{foundation.vision}</p>
          </Reveal>
          <Reveal className="about-section__card about-section__card--wide" delay={180}>
            <h3>Our Goal</h3>
            <p>{foundation.goal}</p>
          </Reveal>
        </div>

        <Reveal className="about-section__cta" delay={220}>
          <Link to="/about" className="btn btn--primary">
            Read More <ArrowRight size={16} />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
