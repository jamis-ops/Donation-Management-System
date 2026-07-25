import { Link } from 'react-router-dom'
import { ArrowRight, Target, Eye, TrendingUp } from 'lucide-react'
import { foundation } from '../../data/mockData'
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

export default function AboutSection() {
  const [ref, isIntersecting, hasIntersected] = useIntersectionObserver({
    threshold: 0.2,
  })

  return (
    <section id="about" className="section about-section" ref={ref}>
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="About Us"
            title="Action speaks louder than words"
            description={foundation.aboutIntro}
          />
        </Reveal>

        <div className="about-section__grid">
          <Reveal 
            className={`about-section__card ${hasIntersected ? 'about-section__card--visible' : ''}`}
            delay={60}
          >
            <div className="about-section__card-icon">
              <Target size={28} />
            </div>
            <h3>Our Mission</h3>
            <p>{foundation.mission}</p>
          </Reveal>
          
          <Reveal 
            className={`about-section__card ${hasIntersected ? 'about-section__card--visible' : ''}`}
            delay={120}
          >
            <div className="about-section__card-icon">
              <Eye size={28} />
            </div>
            <h3>Our Vision</h3>
            <p>{foundation.vision}</p>
          </Reveal>
          
          <Reveal 
            className={`about-section__card about-section__card--wide ${hasIntersected ? 'about-section__card--visible' : ''}`}
            delay={180}
          >
            <div className="about-section__card-icon">
              <TrendingUp size={28} />
            </div>
            <h3>Our Goal</h3>
            <p>{foundation.goal}</p>
          </Reveal>
        </div>

        <Reveal className="about-section__cta" delay={220}>
          <Link to="/about" className="btn btn--primary btn--animated">
            <span className="btn__text">Read More</span>
            <span className="btn__icon">
              <ArrowRight size={16} />
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
