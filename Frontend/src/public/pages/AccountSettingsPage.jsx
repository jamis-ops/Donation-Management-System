import { useEffect, useState, useRef } from 'react'
import { Award, Clock, HeartHandshake, Sparkles, Eye, EyeOff, Camera, Upload, Building2, User, MapPin, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch, uploadProfilePhoto, volunteersApi, apiUrl, getDonorProfile, updateDonorProfile } from '../../api/resources'
import PageHeader from '../../admin/components/shared/PageHeader'
import MasterDataSettings from '../../admin/components/shared/MasterDataSettings'
import MultiSelectBox from '../../components/shared/MultiSelectBox'
import Req from '../../components/shared/Req'
import PasswordRequirements from '../../components/shared/PasswordRequirements'
import { notify } from '../../utils/confirm'
import { isSuperAdminRole } from '../../utils/roleRoutes'
import PhoneInput from '../../components/shared/PhoneInput'
import { phoneError, passwordError } from '../../utils/validation'
import { VOLUNTEER_PROGRAMS, VOLUNTEER_SKILLS, DONOR_TYPES } from '../../constants/options'
import { COUNTRIES } from '../../constants/locations'
import { useLoading } from '../../context/LoadingContext'

function getPhotoUrl(photo) {
  if (!photo) return ''
  if (typeof photo !== 'string') return ''
  if (photo.startsWith('blob:') || photo.startsWith('data:') || /^https?:\/\//i.test(photo)) {
    return photo
  }
  return apiUrl(photo)
}

export default function AccountSettingsPage() {
  const { user, updateAccount, changePassword, refreshUser } = useAuth()
  const canManageLists = user?.role === 'Admin' || isSuperAdminRole(user?.role, user)
  const isVolunteer = user?.role === 'Volunteer'
  const isDonor = user?.role === 'Donor'

  const fileInputRef = useRef(null)
  const [name, setName] = useState('')
  const { showLoading, hideLoading } = useLoading()
  const [phone, setPhone] = useState('')
  const [recoveryPhone, setRecoveryPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhoto || null)
  const [imgError, setImgError] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (user?.profilePhoto) {
      setPhotoPreview(user.profilePhoto)
      setImgError(false)
    }
  }, [user?.profilePhoto])

  // Donor-specific state
  const [donorType, setDonorType] = useState('Individual')
  const [organization, setOrganization] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [donorPhone, setDonorPhone] = useState('')
  const [donorCountry, setDonorCountry] = useState('Philippines')
  const [donorAddress, setDonorAddress] = useState('')
  const [savingDonorDetails, setSavingDonorDetails] = useState(false)

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
        if (d.profilePhoto) {
          setPhotoPreview(d.profilePhoto)
          setImgError(false)
        }
      })
      .catch(() => {
        if (cancelled || !user) return
        setName(user.name || '')
        setEmail(user.email || '')
        setPhone(user.phone || '')
        setRecoveryPhone(user.recoveryPhone || '')
        if (user.profilePhoto) {
          setPhotoPreview(user.profilePhoto)
          setImgError(false)
        }
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

    if (isDonor) {
      getDonorProfile()
        .then((res) => {
          if (cancelled || !res?.data) return
          const d = res.data
          setDonorType(d.donorType || 'Individual')
          setOrganization(d.organization || '')
          setFirstName(d.firstName || '')
          setLastName(d.lastName || '')
          setMiddleInitial(d.middleInitial || '')
          setDonorPhone(d.phone || '')
          setDonorCountry(d.country || 'Philippines')
          setDonorAddress(d.address || '')
        })
        .catch(() => {})
    }

    return () => { cancelled = true }
  }, [user?.id, user?.email, isVolunteer, isDonor])

  const handleSaveDonorDetails = async (e) => {
    e.preventDefault()
    if (donorType === 'Company' && !organization.trim()) {
      notify.warning('Company / Organization Name is required.')
      return
    }
    const phoneMsg = phoneError(donorPhone, { required: false, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    setSavingDonorDetails(true)
    showLoading('Saving donor profile…')
    try {
      const fullName = donorType === 'Company' && organization.trim()
        ? organization.trim()
        : [firstName.trim(), middleInitial.trim(), lastName.trim()].filter(Boolean).join(' ')
      const contactPerson = [firstName.trim(), middleInitial.trim(), lastName.trim()].filter(Boolean).join(' ')
      await updateDonorProfile({
        donorType,
        organization: organization.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleInitial: middleInitial.trim(),
        fullName: fullName || name,
        contactPerson,
        phone: donorPhone.trim(),
        country: donorCountry,
        address: donorAddress.trim(),
      })
      notify.success('Donor profile updated successfully.')
      await refreshUser()
    } catch (err) {
      notify.error(err.message || 'Failed to update donor profile')
    } finally {
      hideLoading()
      setSavingDonorDetails(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    const phoneMsg = phoneError(phone, { required: false, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    const recoveryMsg = phoneError(recoveryPhone, { required: false, allowInternational: true })
    if (recoveryMsg) {
      notify.warning(recoveryMsg.replace('Phone number', 'Recovery phone'))
      return
    }
    setSavingProfile(true)
    showLoading('Saving changes…')
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
    showLoading('Saving changes…')
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
    showLoading('Saving changes…')
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

  const compressImage = (file, maxDim = 400, quality = 0.85) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img
          if (width > maxDim || height > maxDim) {
            const scale = Math.min(maxDim / width, maxDim / height)
            width = Math.round(width * scale)
            height = Math.round(height * scale)
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' }))
              } else {
                resolve(file)
              }
            },
            'image/jpeg',
            quality
          )
        }
        img.onerror = () => resolve(file)
        img.src = e.target.result
      }
      reader.onerror = () => resolve(file)
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      notify.warning('Photo must be under 8MB.')
      return
    }
    setPhotoFile(file)
    setImgError(false)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleUploadPhoto = async (e) => {
    e.preventDefault()
    if (!photoFile) {
      notify.warning('Choose a photo to upload.')
      return
    }
    setUploadingPhoto(true)
    showLoading('Saving changes…')
    try {
      const processedFile = await compressImage(photoFile, 400, 0.85)
      const fd = new FormData()
      fd.append('photo', processedFile)
      const res = await uploadProfilePhoto(fd)
      const saved = res?.data?.profilePhoto || res?.user?.profilePhoto || res?.profilePhoto
      if (saved) {
        setPhotoPreview(saved)
        setImgError(false)
      }
      setPhotoFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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
            ? 'Update your profile and manage shared system lists (Volunteer Programs, Skills, Needs, Tasks).'
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

      {isDonor && (
        <section className="portal-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="portal-panel__header">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HeartHandshake size={20} color="var(--color-brand)" /> Donor Profile Information
              </h2>
              <p className="portal-panel__subtitle">
                Your saved donor details are automatically used when you donate and for issuing donation certificates and receipts.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveDonorDetails} className="settings-form" style={{ maxWidth: '100%' }}>
            <div className="form-row">
              <label>
                <Req required>Donor Type</Req>
                <select
                  value={donorType}
                  onChange={(e) => setDonorType(e.target.value)}
                >
                  {DONOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              {donorType === 'Company' ? (
                <label>
                  <Req required>Company / Organization Name</Req>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Foundation Inc."
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </label>
              ) : (
                <div />
              )}
            </div>

            <div className="form-row form-row--3">
              <label>
                <Req required>First Name</Req>
                <input
                  type="text"
                  required
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label>
                Middle Initial
                <input
                  type="text"
                  maxLength={5}
                  placeholder="M.I."
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value)}
                />
              </label>
              <label>
                <Req required>Last Name</Req>
                <input
                  type="text"
                  required
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Phone Number
                <PhoneInput
                  allowInternational
                  value={donorPhone}
                  onChange={setDonorPhone}
                />
              </label>
              <label>
                Country
                <select
                  value={donorCountry}
                  onChange={(e) => setDonorCountry(e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Address
              <input
                type="text"
                placeholder="Street, Barangay, City / Province, Postal Code"
                value={donorAddress}
                onChange={(e) => setDonorAddress(e.target.value)}
              />
            </label>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={savingDonorDetails}
              >
                {savingDonorDetails ? 'Saving…' : 'Save Donor Profile'}
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
                allowInternational
                value={phone} 
                onChange={setPhone} 
              />
            </label>
            <label>
              Recovery phone (optional)
              <PhoneInput
                allowInternational
                value={recoveryPhone}
                onChange={setRecoveryPhone}
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
              {photoPreview && !imgError ? (
                <img
                  src={getPhotoUrl(photoPreview)}
                  alt=""
                  onError={() => setImgError(true)}
                />
              ) : (
                <span>{(name || email || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <label>
              Upload image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
              />
            </label>
            <p className="portal-hint">JPG, PNG, or WebP under 3MB.</p>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={uploadingPhoto || !photoFile}
            >
              {uploadingPhoto ? 'Uploading…' : 'Upload photo'}
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
              <div className="password-input-wrap">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  maxLength={64}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="password-toggle-btn"
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label>
              <Req required>New password</Req>
              <div className="password-input-wrap">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={64}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                  placeholder="Min. 8 chars (upper, lower, digit, symbol)"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="password-toggle-btn"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label>
              <Req required>Confirm new password</Req>
              <div className="password-input-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={64}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="password-toggle-btn"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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
