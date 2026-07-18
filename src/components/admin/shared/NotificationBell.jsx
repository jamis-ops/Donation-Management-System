import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../../api/resources'

export default function NotificationBell({ linkPrefix = '/admin' }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    let active = true

    async function refresh() {
      try {
        const res = await getNotifications()
        if (!active) return
        setItems(res.data || [])
        setUnread(res.unreadCount || 0)
      } catch {
        /* silent */
      }
    }

    refresh()
    const interval = setInterval(refresh, 30000)
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
              items.map((n) => (
                <li key={n.id} className={`notif-panel__item${n.isRead ? '' : ' notif-panel__item--unread'}`}>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <span className="notif-panel__time">{n.timeAgo}</span>
                  </div>
                  <div className="notif-panel__actions">
                    {n.link && (
                      <Link to={n.link.startsWith('/') ? n.link : `${linkPrefix}${n.link}`} onClick={() => handleRead(n.id)}>
                        View
                      </Link>
                    )}
                    {!n.isRead && (
                      <button type="button" onClick={() => handleRead(n.id)}>Mark read</button>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
