import { useState } from 'react'
import { HeartHandshake, UploadCloud, FileText, X, CheckCircle2, AlertCircle, GraduationCap, Users, Sparkles } from 'lucide-react'
import { VOLUNTEER_PROGRAMS } from '../../constants/options'
import { submitPublicVolunteer } from '../../api/resources'
import Req from '../../components/shared/Req'
import NameFields from '../../components/shared/NameFields'
import SkillTagPicker from '../../components/shared/SkillTagPicker'
import PolicyConsentBox from '../../components/shared/PolicyConsentBox'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { emailError, phoneError } from '../../utils/validation'
import PhoneInput from '../../components/shared/PhoneInput'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useLoading } from '../../context/LoadingContext'

const statusExamples = [
  'Pending Review',
  'Approved',
  'Assigned',
  'Active',
  'Completed',
]

const emptyForm = {
  applicantType: 'Volunteer', // 'Volunteer' | 'Intern'
  institution: '',
  nameParts: emptyNameParts(),
  email: '',
  phone: '',
  program: '',
  programs: [],
  skills: [],
  skillsOther: '',
  availability: '',
  experience: '',
  resume: null,
  acceptedTerms: false,
  acceptedPrivacy: false,
  acceptedPolicies: false,
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFileTypeLabel(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'PDF Document'
  if (ext === 'doc' || ext === 'docx') return 'Word Document'
  return 'Document'
}

export default function VolunteerPage() {
  const [applicantType, setApplicantType] = useState('Volunteer')
  const { showLoading, hideLoading } = useLoading()
  const [submitted, setSubmitted] = useState(false)
  const [trackingRef, setTrackingRef] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [fileError, setFileError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const handleTypeSwitch = (type) => {
    setApplicantType(type)
    setSubmitError('')
    setFileError('')
    setForm((prev) => ({
      ...prev,
      applicantType: type,
      // Clear CV file if switching to volunteer
      resume: type === 'Volunteer' ? null : prev.resume,
      // Reset institution if volunteer
      institution: type === 'Volunteer' ? '' : prev.institution,
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    setFileError('')
    if (!file) return

    const allowedExtensions = ['pdf', 'doc', 'docx']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      setFileError('Invalid file format. Please upload a PDF, DOC, or DOCX document.')
      e.target.value = ''
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      setFileError('File size exceeds the 10 MB limit. Please upload a smaller file.')
      e.target.value = ''
      return
    }

    setForm((prev) => ({ ...prev, resume: file }))
  }

  const handleRemoveFile = () => {
    setForm((prev) => ({ ...prev, resume: null }))
    setFileError('')
    const input = document.getElementById('volunteer-cv-file')
    if (input) input.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (!form.acceptedTerms || !form.acceptedPrivacy) {
      setSubmitError('Please accept both the Terms & Conditions and Data Privacy Policy.')
      return
    }
    const emailMsg = emailError(form.email)
    if (emailMsg) {
      setSubmitError(emailMsg)
      return
    }
    const phoneMsg = phoneError(form.phone, { required: true, allowInternational: true })
    if (phoneMsg) {
      setSubmitError(phoneMsg)
      return
    }

    if (applicantType === 'Intern') {
      if (!form.institution.trim()) {
        setSubmitError('Please enter your School / University / Institution.')
        return
      }
      if (!form.resume) {
        setSubmitError('CV / Resume upload is required for internship applicants.')
        return
      }
    } else {
      // Volunteer validations
      if (!form.program) {
        setSubmitError('Please select your preferred volunteer program.')
        return
      }
      if (!form.skills.length && !form.skillsOther.trim()) {
        setSubmitError('Please select at least one skill tag (or describe Other skills).')
        return
      }
    }

    setSubmitting(true)
    showLoading('Submitting…')
    try {
      const programNames = applicantType === 'Volunteer' && form.program ? [form.program] : []

      const fd = new FormData()
      fd.append('public', '1')
      fd.append('applicantType', applicantType)
      if (applicantType === 'Intern' && form.institution.trim()) {
        fd.append('institution', form.institution.trim())
      }
      fd.append('lastName', form.nameParts.lastName || '')
      fd.append('firstName', form.nameParts.firstName || '')
      fd.append('middleInitial', form.nameParts.middleInitial || '')
      fd.append('name', formatFullName(form.nameParts))
      fd.append('email', form.email.trim())
      fd.append('phone', form.phone.trim())
      fd.append('programs', JSON.stringify(programNames))
      fd.append('skills', JSON.stringify(applicantType === 'Volunteer' ? form.skills : []))
      
      const extraSkills = applicantType === 'Volunteer'
        ? [form.skillsOther, form.experience].filter(Boolean).join(' · ').trim()
        : ''
      if (extraSkills) {
        fd.append('skillsOther', extraSkills)
      }
      if (form.availability) {
        fd.append('availability', form.availability.trim())
      }
      fd.append('acceptedPolicies', '1')
      fd.append('acceptedTerms', '1')
      fd.append('acceptedPrivacy', '1')

      if (applicantType === 'Intern' && form.resume) {
        fd.append('resume', form.resume)
      }

      const res = await submitPublicVolunteer(fd)
      const code = res.trackingCode || res.data?.id
      if (!code) {
        throw new Error('Application saved but no tracking code was returned')
      }
      setTrackingRef(code)
      setSubmitted(true)
      setForm(emptyForm)
      notifyBadgesChanged()
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit application')
    } finally {
      hideLoading()
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Volunteer & Internship Application</h1>
          <p>Join Rise Above Foundation Cebu and make a meaningful impact in the community.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <div className="info-panel">
            <h2>What members get access to</h2>
            <p>Once your application is approved, you can log in to your portal to:</p>
            <ul>
              <li>View assigned activities, outreach missions, and schedules</li>
              {applicantType === 'Intern' ? (
                <li>Track and verify required curriculum internship duty hours</li>
              ) : (
                <li>Participate in community programs freely</li>
              )}
              <li>Monitor task status and collaboration updates</li>
              <li>Download certificates of service upon activity completion</li>
            </ul>
            <p className="info-panel__note">
              Application status flow: {statusExamples.join(' → ')}
            </p>
          </div>

          {submitted ? (
            <div className="form-success">
              <h2>{applicantType === 'Intern' ? 'Internship Application Submitted' : 'Volunteer Application Submitted'}</h2>
              <p>
                Thank you for applying with Rise Above Foundation Cebu. Your application is now{' '}
                <strong>Pending Review</strong>. You will receive an email confirmation once it has been processed by our team.
              </p>
              <p className="tracking-code">
                Tracking reference: <code>{trackingRef}</code>
              </p>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              {/* Type Switcher Tabs */}
              <div className="applicant-type-switch" role="tablist" aria-label="Application Type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={applicantType === 'Volunteer'}
                  className={`applicant-type-tab ${applicantType === 'Volunteer' ? 'applicant-type-tab--active' : ''}`}
                  onClick={() => handleTypeSwitch('Volunteer')}
                >
                  <Users size={18} aria-hidden />
                  <div>
                    <strong>Volunteer Application</strong>
                    <span>Community volunteers · Free program choice · No CV needed</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={applicantType === 'Intern'}
                  className={`applicant-type-tab ${applicantType === 'Intern' ? 'applicant-type-tab--active' : ''}`}
                  onClick={() => handleTypeSwitch('Intern')}
                >
                  <GraduationCap size={18} aria-hidden />
                  <div>
                    <strong>Internship Application</strong>
                    <span>College & university students · CV required · Duty hours tracked</span>
                  </div>
                </button>
              </div>

              <h2>{applicantType === 'Intern' ? 'University / College Student Internship Application' : 'Community Volunteer Registration'}</h2>
              <p style={{ fontSize: '0.86rem', color: '#64748b', marginTop: '-0.35rem', marginBottom: '1.25rem' }}>
                {applicantType === 'Intern'
                  ? 'Apply for student internship placement with Rise Above Foundation Cebu. Upload your CV/Resume and provide your school details — our AI CV Matching will evaluate your background to recommend the best foundation program placement.'
                  : 'Register as a community volunteer. Choose your preferred program and share your skills to support our community outreach initiatives.'}
              </p>

              {submitError ? (
                <p role="alert" style={{ color: '#c0392b', marginBottom: '1rem', background: '#fee2e2', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.88rem' }}>
                  {submitError}
                </p>
              ) : null}

              {/* School / Institution field (Intern only) */}
              {applicantType === 'Intern' && (
                <label>
                  <Req required>School / University / Institution</Req>
                  <input
                    type="text"
                    required
                    placeholder="e.g. University of San Carlos, Cebu Doctors' University, Southwestern University…"
                    value={form.institution}
                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  />
                </label>
              )}

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
                  allowInternational
                  required
                  value={form.phone}
                  onChange={(phone) => setForm({ ...form, phone })}
                  showError={Boolean(submitError)}
                />
              </label>

              {/* CV / Resume Upload Field — INTERN ONLY (REQUIRED) */}
              {applicantType === 'Intern' && (
                <div className="cv-upload-wrapper">
                  <div className="cv-upload-header">
                    <label className="cv-upload-title" htmlFor="volunteer-cv-file">
                      <Req required>Upload CV / Resume</Req>
                    </label>
                    {form.resume && (
                      <span className="cv-upload-status cv-upload-status--ready">
                        <CheckCircle2 size={13} aria-hidden /> Ready to upload
                      </span>
                    )}
                  </div>

                  {!form.resume ? (
                    <div className="cv-upload-dropzone">
                      <input
                        type="file"
                        id="volunteer-cv-file"
                        className="cv-upload-input"
                        required
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="volunteer-cv-file" className="cv-upload-dropzone__label">
                        <div className="cv-upload-icon-circle">
                          <UploadCloud size={24} aria-hidden />
                        </div>
                        <div className="cv-upload-dropzone__text">
                          <span className="cv-upload-dropzone__main">
                            <strong>Click to upload your CV / Resume</strong> or drag & drop here
                          </span>
                          <span className="cv-upload-dropzone__hint">
                            Required for Interns · PDF, DOC, DOCX (Max: 10 MB)
                          </span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="cv-file-card">
                      <div className="cv-file-card__icon-box">
                        <FileText size={24} aria-hidden />
                      </div>
                      <div className="cv-file-card__info">
                        <strong className="cv-file-card__name" title={form.resume.name}>
                          {form.resume.name}
                        </strong>
                        <span className="cv-file-card__meta">
                          {getFileTypeLabel(form.resume.name)} · {formatFileSize(form.resume.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="cv-file-card__remove-btn"
                        onClick={handleRemoveFile}
                        title="Remove selected file"
                        aria-label="Remove selected CV"
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                  )}

                  {fileError && (
                    <p role="alert" className="cv-upload-error">
                      <AlertCircle size={14} aria-hidden /> {fileError}
                    </p>
                  )}

                  <div style={{ marginTop: '0.65rem', padding: '0.6rem 0.85rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.4 }}>
                      Our AI CV Matching system will analyze your education, experience, skills, and certifications from your uploaded document to recommend the best program.
                    </span>
                  </div>
                </div>
              )}

              {/* VOLUNTEER ONLY FIELDS: Preferred Program, Skills & Expertise, Experience */}
              {applicantType === 'Volunteer' && (
                <>
                  {/* Preferred Program (1 Program only) */}
                  <label>
                    <Req required>Preferred Volunteer Program</Req>
                    <select
                      required
                      value={form.program || ''}
                      onChange={(e) => setForm({ ...form, program: e.target.value, programs: e.target.value ? [e.target.value] : [] })}
                    >
                      <option value="">Select a program to join…</option>
                      {VOLUNTEER_PROGRAMS.map((prog) => (
                        <option key={prog} value={prog}>{prog}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                      Choose the foundation program you wish to join (1 program per volunteer).
                    </span>
                  </label>

                  <SkillTagPicker
                    required
                    label="Skills & Expertise"
                    value={form.skills}
                    other={form.skillsOther}
                    onChange={(skills) => setForm({ ...form, skills })}
                    onOtherChange={(skillsOther) => setForm({ ...form, skillsOther })}
                  />

                  <label>
                    Experience & Background
                    <textarea
                      rows={3}
                      placeholder="Previous volunteer or relevant work experience…"
                      value={form.experience}
                      onChange={(e) => setForm({ ...form, experience: e.target.value })}
                    />
                  </label>
                </>
              )}

              {/* Availability & Schedule (Both Intern and Volunteer) */}
              <label>
                Availability & Schedule
                <input
                  type="text"
                  placeholder="e.g. Weekdays, 20 hrs/week, Mon-Fri 8am-12pm…"
                  value={form.availability}
                  onChange={(e) => setForm({ ...form, availability: e.target.value })}
                />
              </label>

              <PolicyConsentBox
                acceptedTerms={form.acceptedTerms}
                onTermsChange={(acceptedTerms) => setForm({ ...form, acceptedTerms, acceptedPolicies: acceptedTerms && form.acceptedPrivacy })}
                acceptedPrivacy={form.acceptedPrivacy}
                onPrivacyChange={(acceptedPrivacy) => setForm({ ...form, acceptedPrivacy, acceptedPolicies: form.acceptedTerms && acceptedPrivacy })}
                entityLabel={applicantType === 'Intern' ? 'Intern' : 'Volunteer'}
              />

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={submitting || !form.acceptedTerms || !form.acceptedPrivacy}
                title={!form.acceptedTerms || !form.acceptedPrivacy ? 'Please accept both agreements above to submit application' : ''}
              >
                {submitting ? 'Submitting Application…' : (applicantType === 'Intern' ? 'Submit Internship Application' : 'Submit Volunteer Application')}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
