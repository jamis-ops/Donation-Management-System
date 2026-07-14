import { useState } from 'react'
import { programs } from '../data/mockData'

export default function AssistancePage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    assistanceType: '',
    description: '',
    documents: null,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Request Assistance</h1>
          <p>Submit a request for relief, educational, medical, or community support.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          {submitted ? (
            <div className="form-success">
              <h2>Request Submitted</h2>
              <p>
                Your assistance request has been received and is under review. You can track
                progress using your reference code.
              </p>
              <p className="tracking-code">
                Reference: <code>AST-{Date.now().toString(36).toUpperCase()}</code>
              </p>
              <p>Status: <strong>Pending Review</strong></p>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <h2>Assistance Request Form</h2>

              <div className="form-row">
                <label>
                  Full Name *
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
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
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
                <label>
                  Address / Barangay *
                  <input
                    type="text"
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Type of Assistance Needed *
                <select
                  required
                  value={form.assistanceType}
                  onChange={(e) => setForm({ ...form, assistanceType: e.target.value })}
                >
                  <option value="">Select assistance type</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Describe Your Situation *
                <textarea
                  rows={5}
                  required
                  placeholder="Explain your circumstances and what assistance you need..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>

              <label>
                Upload Supporting Documents
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(e) => setForm({ ...form, documents: e.target.files })}
                />
                <span className="field-hint">
                  Valid ID, barangay certificate, medical records, or damage photos
                </span>
              </label>

              <button type="submit" className="btn btn--primary btn--lg">
                Submit Request
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
