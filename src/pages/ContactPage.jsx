import { useState } from 'react'
import { foundation } from '../data/mockData'
import { MapPin, Phone, Mail, Share2 } from 'lucide-react'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p>We'd love to hear from you. Reach out anytime.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-grid">
            {/* Contact info */}
            <div className="contact-info">
              <h2>Get in Touch</h2>

              <div className="contact-info__item">
                <strong><MapPin size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Address</strong>
                <p>{foundation.address}</p>
              </div>

              <div className="contact-info__item">
                <strong><Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Phone</strong>
                <p>
                  <a href={`tel:${foundation.phone}`}>{foundation.phone}</a>
                </p>
              </div>

              <div className="contact-info__item">
                <strong><Mail size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Email</strong>
                <p>
                  <a href={`mailto:${foundation.email}`}>{foundation.email}</a>
                </p>
              </div>

              <div className="contact-info__item">
                <strong><Share2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Social Media</strong>
                <div className="contact-info__social">
                  <a href={foundation.social.facebook} target="_blank" rel="noreferrer">
                    Facebook
                  </a>
                  <a href={foundation.social.instagram} target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                  <a href={foundation.social.twitter} target="_blank" rel="noreferrer">
                    Twitter
                  </a>
                </div>
              </div>
            </div>

            {/* Contact form */}
            {submitted ? (
              <div className="form-success">
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✉️</div>
                <h2>Message Sent!</h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Thank you for reaching out. We'll respond within 2–3 business days.
                </p>
                <button
                  type="button"
                  className="btn btn--outline"
                  style={{ marginTop: '1.5rem' }}
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form className="form-card" onSubmit={handleSubmit}>
                <h2>Send a Message</h2>

                <div className="form-row">
                  <label>
                    Your Name *
                    <input
                      type="text"
                      required
                      placeholder="Juan dela Cruz"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </label>
                  <label>
                    Email Address *
                    <input
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                </div>

                <label>
                  Subject *
                  <input
                    type="text"
                    required
                    placeholder="How can we help?"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                </label>

                <label>
                  Message *
                  <textarea
                    rows={5}
                    required
                    placeholder="Write your message here..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </label>

                <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
