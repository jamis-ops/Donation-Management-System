import { useState } from 'react'
import { foundation } from '../data/mockData'
import { MapPin, Phone, Mail, Clock, Share2 } from 'lucide-react'
import { submitContactMessage } from '../api/resources'

const emptyForm = { name: '', email: '', subject: '', message: '' }

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    try {
      const res = await submitContactMessage(form)
      const code = res.trackingCode || res.data?.code
      if (!code) {
        throw new Error('Message saved but no reference code was returned')
      }
      setTrackingCode(code)
      setSubmitted(true)
      setForm(emptyForm)
    } catch (err) {
      setSubmitError(err.message || 'Failed to send message')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p>We&apos;d love to hear from you. Reach out anytime.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <h2>Get in Touch</h2>
              <p className="contact-info__org">{foundation.name}</p>

              <div className="contact-info__item">
                <strong><MapPin size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Address</strong>
                <p>{foundation.address}</p>
              </div>

              <div className="contact-info__item">
                <strong><Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Office Hours</strong>
                <p>{foundation.officeHours}</p>
              </div>

              <div className="contact-info__item">
                <strong><Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Landline</strong>
                <p>
                  <a href={`tel:${foundation.phone.replace(/\s/g, '')}`}>{foundation.phone}</a>
                  {' / '}
                  <a href={`tel:${foundation.phoneAlt.replace(/\s/g, '')}`}>{foundation.phoneAlt}</a>
                </p>
              </div>

              <div className="contact-info__item">
                <strong><Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Mobile</strong>
                <p>
                  <a href={`tel:${foundation.mobile.replace(/\s/g, '')}`}>{foundation.mobile}</a>
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
                </div>
              </div>
            </div>

            {submitted ? (
              <div className="form-success">
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✉️</div>
                <h2>Message Sent!</h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Thank you for reaching out. We&apos;ll respond within 2–3 business days.
                </p>
                <p className="tracking-code" style={{ marginTop: '1rem' }}>
                  Reference: <code>{trackingCode}</code>
                </p>
                <button
                  type="button"
                  className="btn btn--outline"
                  style={{ marginTop: '1.5rem' }}
                  onClick={() => { setSubmitted(false); setTrackingCode(''); setForm(emptyForm) }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form className="form-card" onSubmit={handleSubmit}>
                <h2>Send a Message</h2>
                {submitError ? (
                  <p role="alert" style={{ color: '#c0392b', marginBottom: '1rem' }}>{submitError}</p>
                ) : null}

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

                <button
                  type="submit"
                  className="btn btn--primary btn--lg"
                  style={{ width: '100%' }}
                  disabled={submitting}
                >
                  {submitting ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
