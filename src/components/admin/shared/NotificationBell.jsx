import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../../api/resources'
import { notify, isNotificationToastSuppressed } from '../../../utils/toast'
import { notifyBeneficiariesChanged } from '../../../utils/beneficiariesSync'

const SEEN_KEY = 'raf_notif_seen_ids'
const POLL_MS = 8000

/** Normalize stored links (absolute localhost or relative) into an in-app path. */
function toAppPath(link, linkPrefix = '/admin') {
  if (!link) return null
  const raw = String(link).trim()
  if (!raw) return null
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw)
      return `${u.pathname}${u.search}${u.hash}` || '/'
    }
  } catch {
    /* fall through */
  }
  return raw.startsWith('/') ? raw : `${linkPrefix}${raw.startsWith('/') ? '' : '/'}${raw}`
}

function loadSeenIds() {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.map(Number) : [])
  } catch {
    return new Set()
  }
}

function saveSeenIds(ids) {
  try {
    const list = [...ids].slice(-200)
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(list))
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

function shouldToastNotification(n) {
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
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)
  const primedRef = useRef(false)
  const seenRef = useRef(loadSeenIds())

  useEffect(() => {
    let active = true

    async function refresh() {
      try {
        const res = await getNotifications()
        if (!active) return
        const list = res.data || []
        setItems(list)
        setUnread(res.unreadCount || 0)

        const seen = seenRef.current
        if (!primedRef.current) {
          list.forEach((n) => seen.add(Number(n.id)))
          saveSeenIds(seen)
          primedRef.current = true
          return
        }

        const fresh = list.filter((n) => !seen.has(Number(n.id)))
        if (fresh.length === 0) return

        let refreshBarangays = false
        fresh.forEach((n) => {
          seen.add(Number(n.id))
          if (!shouldToastNotification(n)) return
          refreshBarangays = true
          if (isNotificationToastSuppressed(String(n.type || ''))) return
          const text = n.message || n.title
          if (text) notify[toastTypeForNotification(n)](text, 7000)
        })
        saveSeenIds(seen)
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
  }, [])

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
      setItems(res.data || [])
      setUnread(res.unreadCount || 0)
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
                        <Link to={path} onClick={() => handleRead(n.id)}>
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
