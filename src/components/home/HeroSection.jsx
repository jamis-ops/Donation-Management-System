import { Link } from 'react-router-dom'
import { heroBg } from '../../assets'
import { foundation } from '../../data/mockData'

export default function HeroSection() {
  return (
    <section className="hero-section" style={{ backgroundImage: `url(${heroBg})` }}>
      <div className="hero-section__overlay" />
      <div className="container hero-section__content">
        <div className="hero-section__badge">
          {foundation.shortName}
        </div>
        <h1 className="hero-section__title">
          Together we can<br />make a difference
        </h1>
        <p className="hero-section__intro">
          Since 2000, helping families in Cebu rise above poverty through education,
          livelihood training, and health &amp; hygiene programs.
        </p>
        <div className="hero-section__actions">
          <Link to="/donate" className="btn btn--primary btn--lg">
            Give Now
          </Link>
          <Link to="/volunteer" className="btn btn--outline-light btn--lg">
            Volunteer
          </Link>
          <Link to="/about" className="btn btn--outline-light btn--lg">
            Our Story
          </Link>
        </div>
      </div>
    </section>
  )
}
