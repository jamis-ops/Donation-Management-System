import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Heart, Users, Sparkles } from 'lucide-react'
import { heroBg } from '../../assets'
import { foundation } from '../../data/mockData'

export default function HeroSection() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="hero-section">
      <div
        className="hero-section__media"
        aria-hidden="true"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="hero-section__overlay" />

      <div className="hero-section__decorations" aria-hidden="true">
        <div className="hero-decoration hero-decoration--1">
          <Heart size={20} />
        </div>
        <div className="hero-decoration hero-decoration--2">
          <Users size={24} />
        </div>
        <div className="hero-decoration hero-decoration--3">
          <Sparkles size={18} />
        </div>
        <div className="hero-decoration hero-decoration--4">
          <Heart size={16} />
        </div>
      </div>

      <div className="container hero-section__inner">
        <div className="hero-section__content">
          <div className={`hero-section__badge ${isVisible ? 'hero-section__badge--visible' : ''}`}>
            <span className="hero-section__badge-pulse" />
            {foundation.shortName}
          </div>

          <h1 className={`hero-section__title ${isVisible ? 'hero-section__title--visible' : ''}`}>
            <span className="hero-section__title-line">
              Together we can
            </span>
            <span className="hero-section__title-accent">
              <span className="hero-section__title-accent-word">make</span>{' '}
              <span className="hero-section__title-accent-word hero-section__title-accent-word--delay">a</span>{' '}
              <span className="hero-section__title-accent-word hero-section__title-accent-word--delay-2">difference</span>
            </span>
          </h1>

          <p className={`hero-section__intro ${isVisible ? 'hero-section__intro--visible' : ''}`}>
            Since 2000, helping families in Cebu rise above poverty through education,
            livelihood training, and health &amp; hygiene programs.
          </p>

          <div className={`hero-section__actions ${isVisible ? 'hero-section__actions--visible' : ''}`}>
            <Link to="/donate" className="btn btn--primary btn--lg btn--animated">
              <span className="btn__text">Give Now</span>
              <span className="btn__icon">
                <Heart size={18} />
              </span>
            </Link>
            <Link to="/volunteer" className="btn btn--outline-light btn--lg btn--animated">
              <span className="btn__text">Volunteer</span>
              <span className="btn__icon">
                <Users size={18} />
              </span>
            </Link>
            <Link to="/about" className="btn btn--outline-light btn--lg btn--animated">
              <span className="btn__text">Our Story</span>
              <span className="btn__icon">
                <ArrowRight size={18} />
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className={`hero-section__scroll-indicator ${isVisible ? 'hero-section__scroll-indicator--visible' : ''}`}>
        <span className="hero-section__scroll-text">Scroll to explore</span>
        <span className="hero-section__scroll-arrow" />
      </div>
    </section>
  )
}
