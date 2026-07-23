import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch, uploadProfilePhoto } from '../api/resources'
import PageHeader from '../components/admin/shared/PageHeader'
import Req from '../components/shared/Req'

export default function AccountSettingsPage() {
  const { user, updateAccount, changePassword, refreshUser } = useAuth()
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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  const clearAlerts = () => {
    setMessage('')
    setError('')
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    clearAlerts()
    setSavingProfile(true)
    try {
      await updateAccount({ name, phone, recoveryPhone })
      setMessage('Profile updated.')
      await refreshUser()
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    clearAlerts()
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password changed successfully.')
    } catch (err) {
      setError(err.message || 'Failed to change password')
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
    clearAlerts()
    if (!photoFile) {
      setError('Choose a photo to upload.')
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
      setMessage('Profile photo updated.')
      await refreshUser()
    } catch (err) {
      setError(err.message || 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Account Settings"
        description="Update your profile details, recovery phone, password, and photo."
      />

      {message && <div className="portal-notice settings-notice">{message}</div>}
      {error && (
        <div className="portal-notice settings-notice settings-notice--error" role="alert">
          {error}
        </div>
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
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </label>
            <label>
              Phone
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 …"
              />
            </label>
            <label>
              Recovery phone
              <input
                value={recoveryPhone}
                onChange={(e) => setRecoveryPhone(e.target.value)}
                placeholder="Alternate number for account recovery"
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
