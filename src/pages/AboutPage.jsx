import { Link } from 'react-router-dom'
import { ArrowRight, HeartHandshake, Target, Eye } from 'lucide-react'
import { foundation, teamMembers } from '../data/mockData'
import Reveal from '../components/shared/Reveal'

export default function AboutPage() {
  return (
    <div className="page about-page">
      <section className="page-hero about-page__hero">
        <div className="container">
          <p className="page-hero__eyebrow">About Us</p>
          <h1>Action speaks louder than words</h1>
          <p>{foundation.aboutIntro}</p>
        </div>
      </section>

      <section className="section">
        <div className="container about-page__story">
          {foundation.aboutBody.map((para) => (
            <Reveal key={para.slice(0, 40)} as="p">
              {para}
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section about-page__pillars">
        <div className="container about-page__pillars-grid">
          <Reveal className="about-pillar">
            <Target size={22} />
            <h3>Our Mission</h3>
            <p>{foundation.mission}</p>
          </Reveal>
          <Reveal className="about-pillar" delay={80}>
            <Eye size={22} />
            <h3>Our Vision</h3>
            <p>{foundation.vision}</p>
          </Reveal>
          <Reveal className="about-pillar" delay={160}>
            <HeartHandshake size={22} />
            <h3>Our Goal</h3>
            <p>{foundation.goal}</p>
          </Reveal>
        </div>
      </section>

      <section className="section about-page__team">
        <div className="container">
          <Reveal>
            <div className="section-heading section-heading--center">
              <span className="section-heading__eyebrow">The Cebu Team</span>
              <h2 className="section-heading__title">People behind the work</h2>
              <p className="section-heading__description">
                Meet the dedicated team striving to improve the quality of life for underprivileged families in Cebu.
              </p>
            </div>
          </Reveal>

          <div className="team-grid">
            {teamMembers.map((member, i) => (
              <Reveal key={member.id} as="article" className="team-card" delay={Math.min(i * 50, 300)}>
                <div className="team-card__photo">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      loading="lazy"
                      style={member.focus ? { objectPosition: member.focus } : undefined}
                    />
                  ) : (
                    <div className="team-card__initials" aria-hidden="true">
                      {member.initials || member.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="team-card__body">
                  <h3>{member.name}</h3>
                  <span className="team-card__role">{member.role}</span>
                  <p>{member.bio}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="about-page__footer-cta">
            <Link to="/volunteer" className="btn btn--primary">
              Join as a Volunteer <ArrowRight size={16} />
            </Link>
            <Link to="/donate" className="btn btn--outline">
              Support Our Work
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
