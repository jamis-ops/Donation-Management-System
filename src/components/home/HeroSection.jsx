import { Link } from 'react-router-dom'
import { heroBg } from '../../assets'

export default function HeroSection() {
  return (
    <section className="hero-section" style={{ backgroundImage: `url(${heroBg})` }}>
      <div className="hero-section__overlay" />
      <div className="container hero-section__content">
        <h1 className="hero-section__title">Together we can make a difference</h1>
        <p className="hero-section__intro">
          Rise Above Foundation Cebu brings hope through disaster relief, education, feeding programs,
          medical missions, and community outreach.
        </p>
        <div className="hero-section__actions">
          <Link to="/donate" className="btn btn--accent btn--lg">Give Now</Link>
          <Link to="/volunteer" className="btn btn--outline-light btn--lg">Volunteer</Link>
          <Link to="/assistance" className="btn btn--outline-light btn--lg">Request Assistance</Link>
        </div>
      </div>
    </section>
  )
}
