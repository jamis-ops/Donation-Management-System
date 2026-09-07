import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import { notify, registerToastPusher } from '../utils/toast'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const DEFAULT_DURATION = {
  success: 3200,
  info: 3500,
  warning: 4200,
  error: 5200,
}

let toastSeq = 0

function ToastViewport({ items, onDismiss }) {
  return (
    <div className="app-toast-viewport" aria-live="polite" aria-relevant="additions text">
      {items.map((t) => {
        const Icon = ICONS[t.type] || Info
        return (
          <div
            key={t.id}
            className={`app-toast app-toast--${t.type}${t.leaving ? ' app-toast--out' : ''}`}
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <span className="app-toast__icon" aria-hidden="true">
              <Icon size={18} strokeWidth={2.25} />
            </span>
            <p className="app-toast__msg">{t.message}</p>
            <button
              type="button"
              className="app-toast__close"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(t.id)}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  const remove = useCallback((id) => {
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, leaving: true } : x)))
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id))
    }, 220)
  }, [])

  const push = useCallback((payload) => {
    const type = ['success', 'error', 'warning', 'info'].includes(payload?.type) ? payload.type : 'info'
    const message = String(payload?.message ?? '').trim()
    if (!message) return
    const id = ++toastSeq
    const duration = Number(payload?.duration) > 0
      ? Number(payload.duration)
      : DEFAULT_DURATION[type]

    setItems((prev) => {
      const next = [...prev, { id, message, type, leaving: false }]
      return next.length > 5 ? next.slice(next.length - 5) : next
    })

    const handle = window.setTimeout(() => remove(id), duration)
    timers.current.set(id, handle)
  }, [remove])

  useEffect(() => {
    registerToastPusher(push)
    return () => {
      registerToastPusher(null)
      timers.current.forEach((t) => clearTimeout(t))
      timers.current.clear()
    }
  }, [push])

  const api = useMemo(() => ({
    push,
    success: (message, duration) => push({ message, type: 'success', duration }),
    error: (message, duration) => push({ message, type: 'error', duration }),
    info: (message, duration) => push({ message, type: 'info', duration }),
    warning: (message, duration) => push({ message, type: 'warning', duration }),
    dismiss: remove,
  }), [push, remove])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={remove} />
    </ToastContext.Provider>
  )
}

/** Prefer this in components; `notify` from utils/toast also works after provider mounts. */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      push: ({ message, type = 'info', duration } = {}) => (
        notify[type]?.(message, duration) ?? notify.info(message, duration)
      ),
      success: notify.success,
      error: notify.error,
      info: notify.info,
      warning: notify.warning,
      dismiss: () => {},
    }
  }
  return ctx
}
