import { useState } from 'react'
import { volunteerPrograms } from '../data/mockData'
import { submitPublicVolunteer } from '../api/resources'
import Req from '../components/shared/Req'
import NameFields from '../components/shared/NameFields'
import SkillTagPicker from '../components/shared/SkillTagPicker'
import PolicyLinks from '../components/shared/PolicyLinks'
import { emptyNameParts, formatFullName } from '../utils/personName'
import { emailError, phoneError } from '../utils/validation'
import PhoneInput from '../components/shared/PhoneInput'

const statusExamples = [
  'Pending Review',
  'Approved',
  'Assigned',
  'Active',
  'Completed',
]

const emptyForm = {
  nameParts: emptyNameParts(),
  email: '',
  phone: '',
  programs: [],
  skills: [],
  skillsOther: '',
  availability: '',
  experience: '',
  acceptedPolicies: false,
}

export default function VolunteerPage() {
  const [submitted, setSubmitted] = useState(false)
  const [trackingRef, setTrackingRef] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const toggleProgram = (id) => {
    setForm((prev) => ({
      ...prev,
      programs: prev.programs.includes(id)
        ? prev.programs.filter((p) => p !== id)
        : [...prev.programs, id],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (!form.acceptedPolicies) {
      setSubmitError('Please accept the Data Privacy Policy and Terms & Conditions.')
      return
    }
    const emailMsg = emailError(form.email)
    if (emailMsg) {
      setSubmitError(emailMsg)
      return
    }
    const phoneMsg = phoneError(form.phone, { required: true })
    if (phoneMsg) {
      setSubmitError(phoneMsg)
      return
    }
    if (!form.skills.length && !form.skillsOther.trim()) {
      setSubmitError('Please select at least one skill tag (or describe Other skills).')
      return
    }

    setSubmitting(true)
    try {
      const programNames = form.programs.map(
        (id) => volunteerPrograms.find((p) => p.id === id)?.name || id,
      )
      const res = await submitPublicVolunteer({
        lastName: form.nameParts.lastName,
        firstName: form.nameParts.firstName,
        middleInitial: form.nameParts.middleInitial,
        name: formatFullName(form.nameParts),
        email: form.email,
        phone: form.phone,
        programs: programNames,
        skills: form.skills,
        skillsOther: [form.skillsOther, form.experience].filter(Boolean).join(' · ').trim() || undefined,
        availability: form.availability,
        acceptedPolicies: true,
      })
      const code = res.trackingCode || res.data?.id
      if (!code) {
        throw new Error('Application saved but no tracking code was returned')
      }
      setTrackingRef(code)
      setSubmitted(true)
      setForm(emptyForm)
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
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
              {submitError ? (
                <p role="alert" style={{ color: '#c0392b', marginBottom: '1rem' }}>{submitError}</p>
              ) : null}
              <NameFields
                value={form.nameParts}
                onChange={(nameParts) => setForm({ ...form, nameParts })}
              />
              <label>
                <Req required>Email</Req>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                <Req required>Phone Number</Req>
                <PhoneInput
                  required
                  value={form.phone}
                  onChange={(phone) => setForm({ ...form, phone })}
                  showError={Boolean(submitError)}
                />
              </label>

              <fieldset>
                <legend>Preferred Programs</legend>
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

              <SkillTagPicker
                required
                label="Skills"
                value={form.skills}
                other={form.skillsOther}
                onChange={(skills) => setForm({ ...form, skills })}
                onOtherChange={(skillsOther) => setForm({ ...form, skillsOther })}
              />

              <label>
                Availability
                <input
                  type="text"
                  placeholder="e.g. Weekends, weekday evenings, Sat–Sun…"
                  value={form.availability}
                  onChange={(e) => setForm({ ...form, availability: e.target.value })}
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

              <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  required
                  checked={form.acceptedPolicies}
                  onChange={(e) => setForm({ ...form, acceptedPolicies: e.target.checked })}
                />
                <span>
                  I accept the{' '}
                  <PolicyLinks />
                  <Req required />
                </span>
              </label>

              <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
