import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Trash2, X, XCircle, Info, ShieldAlert } from 'lucide-react'
import { registerConfirmHandler } from '../utils/confirm'

const ConfirmContext = createContext(null)

const SEMANTIC_ICONS = {
  danger: Trash2,
  warning: AlertTriangle,
  primary: HelpCircle,
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

function cleanMessage(msg) {
  if (!msg) return ''
  if (typeof msg === 'string') {
    const trimmed = msg.trim()
    // If it's a JSON string with an error or message property, extract it
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed?.error) return String(parsed.error)
        if (parsed?.message) return String(parsed.message)
      } catch (_) {}
    }
    // Strip common raw error prefixes if present
    return trimmed.replace(/^Error:\s*/i, '')
  }
  if (typeof msg === 'object') {
    if (msg.message) return cleanMessage(msg.message)
    if (msg.error) return cleanMessage(msg.error)
    try {
      return JSON.stringify(msg)
    } catch (_) {
      return String(msg)
    }
  }
  return String(msg)
}

function ConfirmDialog({ dialog, onResolve }) {
  const cancelBtnRef = useRef(null)
  const confirmBtnRef = useRef(null)
  const [processing, setProcessing] = useState(false)

  const isAlert = Boolean(dialog.isAlert)
  const rawType = dialog.type || (isAlert ? 'info' : 'primary')
  const type = ['danger', 'warning', 'primary', 'success', 'error', 'info'].includes(rawType) ? rawType : 'primary'

  const Icon = dialog.icon || SEMANTIC_ICONS[type] || (isAlert ? Info : HelpCircle)
  const displayMsg = cleanMessage(dialog.message || '')

  // Header Title (displayed in the red banner)
  const headerTitle = dialog.title || (
    type === 'danger' ? (isAlert ? 'Action Error' : 'Confirm Deletion') :
    type === 'error' ? 'Error' :
    type === 'warning' ? (isAlert ? 'Warning' : 'Confirm Action') :
    type === 'success' ? 'Success' :
    isAlert ? 'Notice' : 'Confirm Action'
  )

  const confirmText = dialog.confirmText || (
    isAlert ? 'OK' :
    type === 'danger' ? 'Delete' :
    type === 'warning' ? 'Proceed' :
    'Confirm'
  )
  const cancelText = dialog.cancelText || 'Cancel'

  useEffect(() => {
    // Auto-focus primary/confirm button or cancel for danger
    if (!isAlert && type === 'danger') {
      cancelBtnRef.current?.focus()
    } else {
      confirmBtnRef.current?.focus()
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!processing) {
          onResolve(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [type, isAlert, processing, onResolve])

  const handleConfirmClick = () => {
    if (processing) return
    setProcessing(true)
    onResolve(true)
  }

  const handleDismiss = () => {
    if (processing) return
    onResolve(isAlert ? true : false)
  }

  const getConfirmBtnClass = () => {
    if (type === 'danger' && !isAlert) return 'btn btn--danger confirm-dialog__btn-confirm'
    if (type === 'warning' && !isAlert) return 'btn btn--warning confirm-dialog__btn-confirm'
    if (type === 'success' && !isAlert) return 'btn btn--success confirm-dialog__btn-confirm'
    return 'btn btn--primary confirm-dialog__btn-confirm'
  }

  return (
    <div
      className="confirm-modal-overlay"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        className={`confirm-dialog-card confirm-dialog-card--${type}${isAlert ? ' confirm-dialog-card--alert' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rise Above Foundation Cebu Red Header Banner */}
        <div className="confirm-dialog__header-bar">
          <h3 id="confirm-dialog-title" className="confirm-dialog__header-title">
            {headerTitle}
          </h3>
          <button
            type="button"
            className="confirm-dialog__header-close"
            onClick={handleDismiss}
            aria-label="Close dialog"
            title="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Modal Body with Semantic Result Icon */}
        <div className="confirm-dialog__body-content">
          <div className={`confirm-dialog__icon-badge confirm-dialog__icon-badge--${type}`}>
            <Icon size={28} strokeWidth={2.4} />
          </div>

          <div className="confirm-dialog__text-wrap">
            <p id="confirm-dialog-desc" className="confirm-dialog__message">
              {displayMsg}
            </p>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className={`confirm-dialog__actions${isAlert ? ' confirm-dialog__actions--alert' : ''}`}>
          {!isAlert && (
            <button
              ref={cancelBtnRef}
              type="button"
              className="btn btn--danger confirm-dialog__btn-cancel"
              disabled={processing}
              onClick={() => onResolve(false)}
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            className={getConfirmBtnClass()}
            disabled={processing}
            onClick={handleConfirmClick}
          >
            {processing ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmProvider({ children }) {
  const [currentDialog, setCurrentDialog] = useState(null)
  const resolverRef = useRef(null)
  const recentSignaturesRef = useRef(new Map())

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : { ...options }
      const type = opts.type || (opts.isAlert ? 'info' : 'primary')
      const msg = cleanMessage(opts.message || opts.title || '')
      const signature = `${type}:${msg}`

      const now = Date.now()
      const lastSeen = recentSignaturesRef.current.get(signature)

      // Deduplication: suppress duplicate modal if identical message triggered within 1500ms
      if (lastSeen && (now - lastSeen) < 1500) {
        resolve(true)
        return
      }

      recentSignaturesRef.current.set(signature, now)

      // Clean old signatures periodically
      if (recentSignaturesRef.current.size > 20) {
        recentSignaturesRef.current.forEach((time, sig) => {
          if (now - time > 10000) {
            recentSignaturesRef.current.delete(sig)
          }
        })
      }

      resolverRef.current = resolve
      setCurrentDialog(opts)
    })
  }, [])

  const handleResolve = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
    }
    setCurrentDialog(null)
  }, [])

  useEffect(() => {
    registerConfirmHandler(confirm)
    return () => {
      registerConfirmHandler(null)
    }
  }, [confirm])

  const contextValue = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {currentDialog && (
        <ConfirmDialog dialog={currentDialog} onResolve={handleResolve} />
      )}
    </ConfirmContext.Provider>
  )
}

/** Hook to trigger centered confirmation modal in React components */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    return (options) => {
      const msg = typeof options === 'string'
        ? options
        : (options?.message || options?.title || 'Are you sure you want to proceed?')
      return Promise.resolve(window.confirm(msg))
    }
  }
  return ctx
}

export default useConfirm
