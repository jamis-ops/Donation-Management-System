import { createContext, useContext } from 'react'
import { notify } from '../utils/confirm'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  return children
}

export function useToast() {
  return {
    push: ({ message, type = 'info', title } = {}) => (
      notify[type]?.(message, title) ?? notify.info(message, title)
    ),
    success: notify.success,
    error: notify.error,
    info: notify.info,
    warning: notify.warning,
    dismiss: () => {},
  }
}

export default ToastProvider
