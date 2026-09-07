import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Trash2, X, Send, ShieldAlert } from 'lucide-react'
import { registerConfirmHandler } from '../utils/confirm'

const ConfirmContext = createContext(null)

const DEFAULT_ICONS = {
  danger: Trash2,
  warning: AlertTriangle,
  primary: HelpCircle,
  success: CheckCircle2,
}

function ConfirmDialog({ dialog, onResolve }) {
  const cancelBtnRef = useRef(null)
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    // Focus the confirm button (or cancel for danger) on mount
    if (dialog.type === 'danger') {
      cancelBtnRef.current?.focus()
    } else {
      confirmBtnRef.current?.focus()
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onResolve(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialog.type, onResolve])

  const type = ['danger', 'warning', 'primary', 'success'].includes(dialog.type) ? dialog.type : 'primary'
  const Icon = dialog.icon || DEFAULT_ICONS[type] || HelpCircle

  const title = dialog.title || (
    type === 'danger' ? 'Confirm Deletion' :
    type === 'warning' ? 'Confirm Warning' :
    type === 'success' ? (dialog.isAlert ? 'Success' : 'Confirm Action') :
    'Confirm Action'
  )

  const confirmText = dialog.confirmText || (
    dialog.isAlert ? 'OK' :
    type === 'danger' ? 'Delete' :
    type === 'warning' ? 'Proceed' :
    'Confirm'
  )

  const cancelText = dialog.cancelText || 'Cancel'

  const getConfirmBtnClass = () => {
    if (type === 'danger') return 'btn btn--danger'
    if (type === 'success' && dialog.isAlert) return 'btn btn--primary'
    return 'btn btn--primary'
  }

  return (
    <div
      className="confirm-modal-overlay"
      onClick={() => onResolve(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className={`confirm-dialog-card confirm-dialog-card--${type}${dialog.isAlert ? ' confirm-dialog-card--alert' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="confirm-dialog__close"
          onClick={() => onResolve(false)}
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>

        <div className="confirm-dialog__header">
          <div className={`confirm-dialog__icon-wrap confirm-dialog__icon-wrap--${type}`}>
            <Icon size={24} strokeWidth={2.2} />
          </div>
          <h3 id="confirm-dialog-title" className="confirm-dialog__title">
            {title}
          </h3>
        </div>

        <div className="confirm-dialog__body">
          <p id="confirm-dialog-desc" className="confirm-dialog__message">
            {typeof dialog.message === 'string' ? dialog.message : dialog.message}
          </p>
        </div>

        <div className={`confirm-dialog__actions${dialog.isAlert ? ' confirm-dialog__actions--alert' : ''}`}>
          {!dialog.isAlert && (
            <button
              ref={cancelBtnRef}
              type="button"
              className="btn btn--outline confirm-dialog__btn-cancel"
              onClick={() => onResolve(false)}
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            className={`${getConfirmBtnClass()} confirm-dialog__btn-confirm`}
            onClick={() => onResolve(true)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmProvider({ children }) {
  const [currentDialog, setCurrentDialog] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      if (typeof options === 'string') {
        setCurrentDialog({ message: options })
      } else {
        setCurrentDialog({ ...options })
      }
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
