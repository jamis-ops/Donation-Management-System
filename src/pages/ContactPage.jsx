import { useState } from 'react'
import { foundation } from '../data/mockData'

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
          <p>We&apos;d love to hear from you.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <h2>Get in Touch</h2>
              <address>
                <div className="contact-info__item">
                  <strong>Address</strong>
                  <p>{foundation.address}</p>
                </div>
                <div className="contact-info__item">
                  <strong>Phone</strong>
                  <p>
                    <a href={`tel:${foundation.phone}`}>{foundation.phone}</a>
                  </p>
                </div>
                <div className="contact-info__item">
                  <strong>Email</strong>
                  <p>
                    <a href={`mailto:${foundation.email}`}>{foundation.email}</a>
                  </p>
                </div>
                <div className="contact-info__item">
                  <strong>Social Media</strong>
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
              </address>
            </div>

            {submitted ? (
              <div className="form-success">
                <h2>Message Sent</h2>
                <p>Thank you for reaching out. We will respond within 2–3 business days.</p>
              </div>
            ) : (
              <form className="form-card" onSubmit={handleSubmit}>
                <h2>Send a Message</h2>
                <label>
                  Name *
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Email *
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label>
                  Subject *
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                </label>
                <label>
                  Message *
                  <textarea
                    rows={5}
                    required
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </label>
                <button type="submit" className="btn btn--primary">
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
