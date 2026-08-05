import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch, uploadProfilePhoto } from '../api/resources'
import PageHeader from '../components/admin/shared/PageHeader'
import MasterDataSettings from '../components/admin/shared/MasterDataSettings'
import Req from '../components/shared/Req'
import { notify } from '../utils/toast'
import { isSuperAdminRole } from '../utils/roleRoutes'
import PhoneInput from '../components/shared/PhoneInput'
import { phoneError } from '../utils/validation'

export default function AccountSettingsPage() {
  const { user, updateAccount, changePassword, refreshUser } = useAuth()
  const canManageLists = user?.role === 'Admin' || isSuperAdminRole(user?.role, user)
  const [name, setName] = useState('')
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
    return () => { cancelled = true }
  }, [user])

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
    try {
      await updateAccount({ name, phone, recoveryPhone })
      notify.success('Profile updated.')
      await refreshUser()
    } catch (err) {
      notify.error(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      notify.warning('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      notify.warning('New password and confirmation do not match.')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      notify.success('Password changed successfully.')
    } catch (err) {
      notify.error(err.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
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
      notify.error(err.message || 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Account Settings"
        description={
          canManageLists
            ? 'Update your profile and manage shared system lists (Barangay types, Needs, Tasks).'
            : 'Update your profile details, recovery phone, password, and photo.'
        }
      />

      {canManageLists && <MasterDataSettings />}

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
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </label>
            <label>
              Phone
              <PhoneInput value={phone} onChange={setPhone} />
            </label>
            <label>
              Recovery phone
              <PhoneInput
                value={recoveryPhone}
                onChange={setRecoveryPhone}
                placeholder="09XXXXXXXXX"
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
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
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              <Req required>Confirm new password</Req>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>
      </div>
    </>
  )
}
