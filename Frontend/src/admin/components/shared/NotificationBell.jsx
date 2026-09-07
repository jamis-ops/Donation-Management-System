import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../../api/resources'
import { notify, isNotificationToastSuppressed } from '../../../utils/toast'
import { notifyBeneficiariesChanged } from '../../../utils/beneficiariesSync'
import { useAuth } from '../../../context/AuthContext'

const POLL_MS = 8000

/** Normalize stored links (absolute localhost or relative) into an in-app path. */
function toAppPath(link, linkPrefix = '/admin') {
  if (!link) return null
  const raw = String(link).trim()
  if (!raw) return null
  let path = raw
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw)
      path = `${u.pathname}${u.search}${u.hash}` || '/'
    }
  } catch {
    /* fall through */
  }
  if (!path.startsWith('/')) {
    path = `${linkPrefix}${path.startsWith('/') ? '' : '/'}${path}`
  }
  return rewritePathForPortal(path, linkPrefix)
}

/** Keep each portal on its own routes — never send users into another role’s UI. */
function rewritePathForPortal(path, linkPrefix) {
  if (!path) return path

  if (linkPrefix === '/staff' && path.startsWith('/admin/')) {
    const rest = path.slice('/admin'.length) // keeps leading /
    const staffRoots = ['/donations', '/inventory', '/distributions', '/tasks', '/verification', '/settings']
    const base = rest.split(/[?#]/)[0]
    if (staffRoots.some((r) => base === r || base.startsWith(`${r}/`))) {
      return `/staff${rest}`
    }
    return '/staff'
  }

  if (linkPrefix === '/admin') {
    if (path.startsWith('/admin')) return path
    return null
  }
  if (linkPrefix === '/staff') {
    if (path.startsWith('/staff')) return path
    return null
  }
  if (linkPrefix === '/donor') {
    return path.startsWith('/donor') ? path : null
  }
  if (linkPrefix === '/volunteer-portal') {
    return path.startsWith('/volunteer-portal') ? path : null
  }
  if (linkPrefix === '/beneficiary') {
    return path.startsWith('/beneficiary') ? path : null
  }
  return path
}

/** Drop notifications whose links belong to another portal (client safety net). */
function belongsToPortal(n, linkPrefix) {
  const path = toAppPath(n.link, linkPrefix)
  if (!n.link) return true
  return Boolean(path)
}

function seenStorageKey(role) {
  return `raf_notif_seen_ids_${String(role || 'guest').toLowerCase()}`
}

function loadSeenIds(role) {
  try {
    const raw = sessionStorage.getItem(seenStorageKey(role))
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.map(Number) : [])
  } catch {
    return new Set()
  }
}

function saveSeenIds(role, ids) {
  try {
    const list = [...ids].slice(-200)
    sessionStorage.setItem(seenStorageKey(role), JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
}

function toastTypeForNotification(n) {
  const type = String(n.type || '')
  const title = String(n.title || '').toLowerCase()
  if (type === 'beneficiary_credentials' || title.includes('credential')) return 'success'
  if (type === 'beneficiary_registration' || title.includes('registration') || title.includes('awaiting')) return 'info'
  if (title.includes('reject')) return 'warning'
  return 'info'
}

function shouldToastNotification(n, role) {
  // Barangay registration toasts are for Admin/Staff only — never other portals.
  const r = String(role || '')
  if (!['Admin', 'Staff', 'SuperAdmin'].includes(r)) return false
  const type = String(n.type || '')
  if (type.startsWith('beneficiary')) return true
  const title = String(n.title || '').toLowerCase()
  const message = String(n.message || '').toLowerCase()
  return (
    title.includes('barangay')
    || message.includes('barangay')
    || message.includes('invitation')
    || message.includes('credentials')
  )
}

export default function NotificationBell({ linkPrefix = '/admin' }) {
  const { user } = useAuth()
  const role = user?.role || ''
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)
  const primedRef = useRef(false)
  const seenRef = useRef(null)

  useEffect(() => {
    primedRef.current = false
    seenRef.current = loadSeenIds(role)
  }, [role])

  useEffect(() => {
    let active = true

    async function refresh() {
      try {
        const res = await getNotifications()
        if (!active) return
        const list = (res.data || []).filter((n) => belongsToPortal(n, linkPrefix))
        setItems(list)
        setUnread(list.filter((n) => !n.isRead).length)

        if (!seenRef.current) seenRef.current = loadSeenIds(role)
        const seen = seenRef.current
        if (!primedRef.current) {
          list.forEach((n) => seen.add(Number(n.id)))
          saveSeenIds(role, seen)
          primedRef.current = true
          return
        }

        const fresh = list.filter((n) => !seen.has(Number(n.id)))
        if (fresh.length === 0) return

        let refreshBarangays = false
        fresh.forEach((n) => {
          seen.add(Number(n.id))
          if (!shouldToastNotification(n, role)) return
          refreshBarangays = true
          if (isNotificationToastSuppressed(String(n.type || ''))) return
          const text = n.message || n.title
          if (text) notify[toastTypeForNotification(n)](text, 7000)
        })
        saveSeenIds(role, seen)
        if (refreshBarangays) notifyBeneficiariesChanged()
      } catch {
        /* silent */
      }
    }

    refresh()
    const interval = setInterval(refresh, POLL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [role, linkPrefix])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const refresh = async () => {
    try {
      const res = await getNotifications()
      const list = (res.data || []).filter((n) => belongsToPortal(n, linkPrefix))
      setItems(list)
      setUnread(list.filter((n) => !n.isRead).length)
    } catch {
      /* silent */
    }
  }

  const handleRead = async (id) => {
    await markNotificationRead(id)
    refresh()
  }

  const handleReadAll = async () => {
    await markAllNotificationsRead()
    refresh()
  }

  return (
    <div className="notif-bell" ref={ref}>
      <button type="button" className="notif-bell__btn" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="notif-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel__header">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="notif-panel__mark-all" onClick={handleReadAll}>Mark all read</button>
            )}
          </div>
          <ul className="notif-panel__list">
            {items.length === 0 ? (
              <li className="notif-panel__empty">No notifications yet</li>
            ) : (
              items.map((n) => {
                const path = toAppPath(n.link, linkPrefix)
                return (
                  <li key={n.id} className={`notif-panel__item${n.isRead ? '' : ' notif-panel__item--unread'}`}>
                    <div>
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                      <span className="notif-panel__time">{n.timeAgo}</span>
                    </div>
                    <div className="notif-panel__actions">
                      {path && (
                        <Link
                          to={path}
                          onClick={() => {
                            handleRead(n.id)
                            setOpen(false)
                            window.dispatchEvent(new CustomEvent('raf:notification-navigate', {
                              detail: { path, type: n.type, id: n.id },
                            }))
                          }}
                        >
                          View
                        </Link>
                      )}
                      {!n.isRead && (
                        <button type="button" onClick={() => handleRead(n.id)}>Mark read</button>
                      )}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
