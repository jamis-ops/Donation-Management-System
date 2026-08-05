import { useState } from 'react'
import { MUNICIPALITIES } from '../constants/locations'
import PhoneInput from '../components/shared/PhoneInput'
import { phoneError } from '../utils/validation'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  barangayName: '',
  municipality: '',
  description: '',
}

export default function AssistancePage() {
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    const phoneMsg = phoneError(form.phone, { required: true })
    if (phoneMsg) {
      setSubmitError(phoneMsg)
      return
    }
    setSubmitting(true)
    try {
      const data = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        subject: 'Barangay Nomination: ' + form.barangayName,
        message: form.description,
        type: 'barangay_nomination'
      }

      const res = await fetch('/api/contact.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await res.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      const code = result.trackingCode || result.id || Math.random().toString(36).substring(2, 10).toUpperCase()
      
      setReference(code)
      setSubmitted(true)
      setForm(emptyForm)
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit nomination')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Nominate a Barangay for Partnership</h1>
          <p>Know a barangay that needs assistance? Submit a nomination and our team will review it.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          {submitted ? (
            <div className="form-success">
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
              <h2>Nomination Submitted</h2>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Thank you! We'll review your nomination and reach out to the barangay if appropriate.
              </p>
              <p className="tracking-code">
                Reference: <code>{reference}</code>
              </p>
              <button
                type="button"
                className="btn btn--outline"
                style={{ marginTop: '1.5rem' }}
                onClick={() => { setSubmitted(false); setReference('') }}
              >
                Submit Another Nomination
              </button>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <h2>Barangay Nomination Form</h2>
              {submitError ? (
                <p role="alert" style={{ color: '#c0392b', marginBottom: '1rem' }}>{submitError}</p>
              ) : null}

              <div className="form-row">
                <label>
                  Your Name *
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
              </div>

              <div className="form-row">
                <label>
                  Phone Number *
                  <PhoneInput
                    required
                    value={form.phone}
                    onChange={(phone) => setForm({ ...form, phone })}
                    showError={Boolean(submitError)}
                  />
                </label>
                <label>
                  Barangay Name *
                  <input
                    type="text"
                    required
                    value={form.barangayName}
                    onChange={(e) => setForm({ ...form, barangayName: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Municipality / City *
                <select
                  required
                  value={form.municipality}
                  onChange={(e) => setForm({ ...form, municipality: e.target.value })}
                >
                  <option value="">Select municipality/city</option>
                  {MUNICIPALITIES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <label>
                Brief Description of Needs *
                <textarea
                  rows={5}
                  required
                  placeholder="Explain why this barangay needs assistance..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>

              <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Nomination'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
