import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Settings, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiUrl } from '../../api/resources'

function getInitials(name, email) {
  if (!name && !email) return 'U'
  const text = (name || email).trim()
  const parts = text.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return text.slice(0, 2).toUpperCase()
}

export default function UserProfileMenu({ settingsPath = '/admin/settings', roleLabel }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [avatarErr, setAvatarErr] = useState(false)
  const [dropdownAvatarErr, setDropdownAvatarErr] = useState(false)
  const menuRef = useRef(null)

  const isSuperAdmin = user?.role === 'SuperAdmin' || !!user?.isSuperAdmin
  const displayName = user?.name || (isSuperAdmin ? 'Super Admin' : 'Administrator')
  const displayEmail = user?.email || 'admin@riseabove-cebu.org'
  const displayRole = roleLabel || (isSuperAdmin ? 'Super Admin' : (user?.role || 'System Admin'))
  const initials = getInitials(user?.name, user?.email)

  useEffect(() => {
    setAvatarErr(false)
    setDropdownAvatarErr(false)
  }, [user?.profilePhoto])

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleLogout = async () => {
    setOpen(false)
    try {
      await logout()
    } finally {
      window.location.href = '/'
    }
  }

  const profilePhotoUrl = user?.profilePhoto ? apiUrl(user.profilePhoto) : null

  return (
    <div className="user-profile-menu" ref={menuRef}>
      <button
        type="button"
        className="user-profile-menu__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User account menu"
      >
        <div className="user-profile-menu__avatar">
          {profilePhotoUrl && !avatarErr ? (
            <img
              src={profilePhotoUrl}
              alt=""
              onError={() => setAvatarErr(true)}
            />
          ) : (
            initials
          )}
        </div>
        <div className="user-profile-menu__info">
          <span className="user-profile-menu__name">{displayName}</span>
          <span className="user-profile-menu__role">{displayRole}</span>
        </div>
        <ChevronDown
          size={14}
          className={`user-profile-menu__chevron${open ? ' user-profile-menu__chevron--open' : ''}`}
        />
      </button>

      {open && (
        <div className="user-profile-menu__dropdown" role="menu">
          <div className="user-profile-menu__header">
            <div className="user-profile-menu__dropdown-avatar">
              {profilePhotoUrl && !dropdownAvatarErr ? (
                <img
                  src={profilePhotoUrl}
                  alt=""
                  onError={() => setDropdownAvatarErr(true)}
                />
              ) : (
                initials
              )}
            </div>
            <div className="user-profile-menu__dropdown-details">
              <strong className="user-profile-menu__dropdown-name">{displayName}</strong>
              <span className="user-profile-menu__dropdown-email">{displayEmail}</span>
              <span className="user-profile-menu__role-badge">{displayRole.toUpperCase()}</span>
            </div>
          </div>

          <div className="user-profile-menu__divider" />

          <div className="user-profile-menu__items">
            <Link
              to={settingsPath}
              className="user-profile-menu__item"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Settings size={16} />
              <span>Profile &amp; Settings</span>
            </Link>
          </div>

          <div className="user-profile-menu__footer">
            <button
              type="button"
              className="user-profile-menu__logout-btn"
              onClick={handleLogout}
              role="menuitem"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
