import { useEffect, useState } from 'react'
import { Award, Clock, HeartHandshake, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiFetch, uploadProfilePhoto, volunteersApi } from '../api/resources'
import PageHeader from '../components/admin/shared/PageHeader'
import MasterDataSettings from '../components/admin/shared/MasterDataSettings'
import MultiSelectBox from '../components/shared/MultiSelectBox'
import Req from '../components/shared/Req'
import PasswordRequirements from '../components/shared/PasswordRequirements'
import { notify } from '../utils/toast'
import { isSuperAdminRole } from '../utils/roleRoutes'
import PhoneInput from '../components/shared/PhoneInput'
import { phoneError, passwordError } from '../utils/validation'
import { VOLUNTEER_PROGRAMS, VOLUNTEER_SKILLS } from '../constants/options'
import { useLoading } from '../context/LoadingContext'

export default function AccountSettingsPage() {
  const { user, updateAccount, changePassword, refreshUser } = useAuth()
  const canManageLists = user?.role === 'Admin' || isSuperAdminRole(user?.role, user)
  const isVolunteer = user?.role === 'Volunteer'

  const [name, setName] = useState('')
  const { showLoading, hideLoading } = useLoading()
  const [phone, setPhone] = useState('')
  const [recoveryPhone, setRecoveryPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Volunteer-specific state
  const [volunteerDbId, setVolunteerDbId] = useState(null)
  const [volPrograms, setVolPrograms] = useState([])
  const [volSkills, setVolSkills] = useState([])
  const [volSkillsOther, setVolSkillsOther] = useState('')
  const [volAvailability, setVolAvailability] = useState('')
  const [volHours, setVolHours] = useState(0)
  const [volRequiredHours, setVolRequiredHours] = useState(0)
  const [volStatus, setVolStatus] = useState('')
  const [savingVolDetails, setSavingVolDetails] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/account.php')
      .then((res) => {
        if (cancelled || !res?.data) return
        const d = res.data
        setName(d.name || '')
        setEmail(d.email || '')
        setPhone(d.phone || '')
        setRecoveryPhone(d.recoveryPhone || '')
        setPhotoPreview(d.profilePhoto || null)
      })
      .catch(() => {
        if (cancelled || !user) return
        setName(user.name || '')
        setEmail(user.email || '')
        setPhone(user.phone || '')
        setRecoveryPhone(user.recoveryPhone || '')
        setPhotoPreview(user.profilePhoto || null)
      })

    if (isVolunteer) {
      volunteersApi.list()
        .then((res) => {
          if (cancelled || !res?.data) return
          const volData = Array.isArray(res.data) ? res.data[0] : res.data
          if (volData) {
            setVolunteerDbId(volData.dbId)
            setVolPrograms(volData.programs || [])
            setVolSkills(volData.skills || [])
            setVolSkillsOther(volData.skillsOther || '')
            setVolAvailability(volData.availability || '')
            setVolHours(volData.hours || 0)
            setVolRequiredHours(volData.requiredHours || 0)
            setVolStatus(volData.status || 'Active')
          }
        })
        .catch(() => {})
    }

    return () => { cancelled = true }
  }, [user, isVolunteer])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    const phoneMsg = phoneError(phone, { required: false })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    const recoveryMsg = phoneError(recoveryPhone, { required: false })
    if (recoveryMsg) {
      notify.warning(recoveryMsg.replace('Phone number', 'Recovery phone'))
      return
    }
    setSavingProfile(true)
    showLoading('Saving profile…')
    try {
      await updateAccount({ name, phone, recoveryPhone })
      notify.success('Profile updated.')
      await refreshUser()
    } catch (err) {
      notify.error(err.message || 'Failed to update profile')
    } finally {
      hideLoading()
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    const pwValidationErr = passwordError(newPassword, { fieldLabel: 'New password' })
    if (pwValidationErr) {
      notify.warning(pwValidationErr)
      return
    }
    if (newPassword !== confirmPassword) {
      notify.warning('New password and confirmation do not match.')
      return
    }
    setSavingPassword(true)
    showLoading('Updating password…')
    try {
      await changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      notify.success('Password changed successfully.')
    } catch (err) {
      notify.error(err.message || 'Failed to change password')
    } finally {
      hideLoading()
      setSavingPassword(false)
    }
  }

  const handleSaveVolunteerDetails = async (e) => {
    e.preventDefault()
    if (!volunteerDbId) {
      notify.error('Volunteer profile not found.')
      return
    }
    setSavingVolDetails(true)
    showLoading('Saving volunteer details…')
    try {
      await volunteersApi.update(volunteerDbId, {
        programs: volPrograms,
        skills: volSkills,
        skillsOther: volSkillsOther,
        availability: volAvailability,
      })
      notify.success('Volunteer programs & skills updated successfully.')
    } catch (err) {
      notify.error(err.message || 'Failed to update volunteer details')
    } finally {
      hideLoading()
      setSavingVolDetails(false)
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleUploadPhoto = async (e) => {
    e.preventDefault()
    if (!photoFile) {
      notify.warning('Choose a photo to upload.')
      return
    }
    setUploadingPhoto(true)
    showLoading('Uploading photo…')
    try {
      const fd = new FormData()
      fd.append('photo', photoFile)
      const res = await uploadProfilePhoto(fd)
      if (res?.data) {
        setPhotoPreview(res.data.profilePhoto || photoPreview)
      }
      setPhotoFile(null)
      notify.success('Profile photo updated.')
      await refreshUser()
    } catch (err) {
      notify.error(err.message || 'Failed to upload photo')
    } finally {
      hideLoading()
      setUploadingPhoto(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Account Settings"
        description={
          canManageLists
            ? 'Update your profile and manage shared system lists (Volunteer Programs, Skills, Barangay types, Needs, Tasks).'
            : isVolunteer
            ? 'Update your personal profile, preferred programs, skills, availability, and password.'
            : 'Update your profile details, recovery phone, password, and photo.'
        }
      />

      {canManageLists && <MasterDataSettings />}

      {isVolunteer && (
        <section className="portal-panel settings-panel settings-panel--wide volunteer-settings-panel">
          <div className="portal-panel__header">
            <div className="volunteer-settings-panel__header-group">
              <span className="volunteer-settings-panel__icon" aria-hidden="true">
                <HeartHandshake size={22} />
              </span>
              <div>
                <h2>Volunteer Profile & Skills</h2>
                <p className="portal-panel__sub">
                  Select your preferred foundation programs and skills. These are synchronized with the admin catalog and help coordinators match you with relevant activities and relief tasks.
                </p>
              </div>
            </div>
            {volHours > 0 && (
              <div className="volunteer-hours-badge">
                <Clock size={15} />
                <span>{volHours} verified hrs {volRequiredHours > 0 ? `/ ${volRequiredHours} target` : ''}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveVolunteerDetails} className="volunteer-settings-form">
            <div className="volunteer-settings-grid">
              <MultiSelectBox
                catalog="volunteer_programs"
                fallback={VOLUNTEER_PROGRAMS}
                value={volPrograms}
                onChange={setVolPrograms}
                label="Preferred Programs"
                placeholder="Select a volunteer program to add…"
                icon={HeartHandshake}
                hint="Choose the foundation outreach programs you are passionate about."
              />

              <MultiSelectBox
                catalog="volunteer_skills"
                fallback={VOLUNTEER_SKILLS}
                value={volSkills}
                onChange={setVolSkills}
                other={volSkillsOther}
                onOtherChange={setVolSkillsOther}
                label="Skills & Expertise"
                placeholder="Select a volunteer skill to add…"
                showOther={true}
                otherLabel="Other skills (optional)"
                otherPlaceholder="e.g. Scuba diving, Licensed electrician, Language translation…"
                icon={Sparkles}
                hint="Select skills and certifications you can contribute to volunteer activities."
              />
            </div>

            <div className="volunteer-settings-row">
              <label>
                Availability
                <input
                  type="text"
                  value={volAvailability}
                  onChange={(e) => setVolAvailability(e.target.value)}
                  placeholder="e.g. Weekends, Weekday afternoons, Flexible on-call…"
                />
              </label>
            </div>

            <div className="volunteer-settings-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={savingVolDetails}
              >
                Save volunteer profile
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="settings-grid">
        <section className="portal-panel settings-panel">
          <div className="portal-panel__header">
            <h2>Profile</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="settings-form">
            <label>
              Email
              <input type="email" value={email} disabled readOnly />
            </label>
            <label>
              <Req required>Full name</Req>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Phone number
              <PhoneInput 
                value={phone} 
                onChange={setPhone} 
                placeholder="09XXXXXXXXX"
              />
            </label>
            <label>
              Recovery phone (optional)
              <PhoneInput
                value={recoveryPhone}
                onChange={setRecoveryPhone}
                placeholder="09XXXXXXXXX"
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={savingProfile}>
              Save profile
            </button>
          </form>
        </section>

        <section className="portal-panel settings-panel">
          <div className="portal-panel__header">
            <h2>Profile photo</h2>
          </div>
          <form onSubmit={handleUploadPhoto} className="settings-form settings-photo-form">
            <div className="settings-photo-preview">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" />
              ) : (
                <span>{(name || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <label>
              Upload image
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
            <p className="portal-hint">JPG, PNG, or WebP under 3MB.</p>
            <button type="submit" className="btn btn--outline" disabled={uploadingPhoto || !photoFile}>
              Upload photo
            </button>
          </form>
        </section>

        <section className="portal-panel settings-panel settings-panel--wide">
          <div className="portal-panel__header">
            <h2>Change password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="settings-form settings-form--password">
            <label>
              <Req required>Current password</Req>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label>
              <Req required>New password</Req>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 chars (upper, lower, digit, symbol)"
                autoComplete="new-password"
              />
            </label>
            <label>
              <Req required>Confirm new password</Req>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </label>
            <PasswordRequirements password={newPassword} />
            <button type="submit" className="btn btn--primary" disabled={savingPassword}>
              Update password
            </button>
          </form>
        </section>
      </div>
    </>
  )
}
