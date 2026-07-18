import { useState } from 'react'
import { volunteerPrograms } from '../data/mockData'

const statusExamples = [
  'Pending Review',
  'Approved',
  'Assigned',
  'Active',
  'Completed',
]

export default function VolunteerPage() {
  const [submitted, setSubmitted] = useState(false)
  const [trackingRef, setTrackingRef] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    programs: [],
    skills: '',
    experience: '',
    cv: null,
  })

  const toggleProgram = (id) => {
    setForm((prev) => ({
      ...prev,
      programs: prev.programs.includes(id)
        ? prev.programs.filter((p) => p !== id)
        : [...prev.programs, id],
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setTrackingRef(`VOL-${Date.now().toString(36).toUpperCase()}`)
    setSubmitted(true)
  }

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Volunteer Portal</h1>
          <p>Join our team and make a difference in your community.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <div className="info-panel">
            <h2>What volunteers get access to</h2>
            <p>Once your application is approved, you can log in to your volunteer portal to:</p>
            <ul>
              <li>View assigned activities and upcoming schedules</li>
              <li>Track volunteer hours and attendance</li>
              <li>Monitor application and task status</li>
              <li>Download certificates upon activity completion</li>
            </ul>
            <p className="info-panel__note">
              Application status flow: {statusExamples.join(' → ')}
            </p>
          </div>

          {submitted ? (
            <div className="form-success">
              <h2>Application Submitted</h2>
              <p>
                Thank you for applying to volunteer. Your application is now{' '}
                <strong>Pending Review</strong>. You will receive an email once it has been
                processed.
              </p>
              <p className="tracking-code">
                Tracking reference: <code>{trackingRef}</code>
              </p>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <h2>Volunteer Registration</h2>
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
              <label>
                Phone Number *
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <fieldset>
                <legend>Preferred Programs *</legend>
                <div className="checkbox-grid">
                  {volunteerPrograms.map((prog) => (
                    <label key={prog.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.programs.includes(prog.id)}
                        onChange={() => toggleProgram(prog.id)}
                      />
                      {prog.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label>
                Skills
                <textarea
                  rows={3}
                  placeholder="e.g. First aid, logistics, teaching, cooking..."
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                />
              </label>

              <label>
                Experience
                <textarea
                  rows={3}
                  placeholder="Previous volunteer or relevant work experience..."
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                />
              </label>

              <label>
                Upload CV (optional)
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setForm({ ...form, cv: e.target.files?.[0] ?? null })}
                />
              </label>

              <button type="submit" className="btn btn--primary btn--lg">
                Submit Application
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
