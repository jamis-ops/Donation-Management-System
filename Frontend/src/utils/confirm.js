/**
 * Imperative Confirmation and Success Modal Dialog API.
 * Registered by ConfirmProvider in App.jsx.
 */

let confirmHandler = null

export function registerConfirmHandler(fn) {
  confirmHandler = typeof fn === 'function' ? fn : null
}

/**
 * Trigger a centered confirmation modal.
 * @param {Object} options
 * @param {string} [options.title] - Dialog title
 * @param {string} [options.message] - Dialog message/description
 * @param {string} [options.confirmText] - Confirm button label
 * @param {string} [options.cancelText] - Cancel button label
 * @param {'danger'|'warning'|'primary'|'success'} [options.type] - Dialog style variant
 * @param {boolean} [options.isAlert] - When true, hides cancel button and presents a single dismiss button
 * @param {import('lucide-react').LucideIcon} [options.icon] - Custom icon
 * @returns {Promise<boolean>} Resolves to true if confirmed/dismissed, false if cancelled
 */
export function confirmAction(options = {}) {
  // Always dismiss any active loading spinner overlay so it cannot block the modal dialog
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:hide-loading'))
  }
  if (confirmHandler) {
    return confirmHandler(options)
  }

  // Fallback to browser confirm if provider is not yet mounted
  const msg = typeof options === 'string'
    ? options
    : (options.message || options.title || 'Are you sure you want to proceed?')
  return Promise.resolve(window.confirm(msg))
}

/**
 * Trigger a centered success notification modal.
 * @param {string|Object} messageOrOptions
 * @param {string} [title]
 * @returns {Promise<boolean>}
 */
export function showSuccessModal(messageOrOptions, title = 'Success') {
  const options = typeof messageOrOptions === 'string'
    ? { message: messageOrOptions, title, type: 'success', isAlert: true, confirmText: 'OK' }
    : { type: 'success', isAlert: true, confirmText: 'OK', ...messageOrOptions }
  return confirmAction(options)
}

/**
 * Trigger a centered error notification modal.
 * @param {string|Object} messageOrOptions
 * @param {string} [title]
 * @returns {Promise<boolean>}
 */
export function showErrorModal(messageOrOptions, title = 'Error') {
  const options = typeof messageOrOptions === 'string'
    ? { message: messageOrOptions, title, type: 'error', isAlert: true, confirmText: 'OK' }
    : { type: 'error', isAlert: true, confirmText: 'OK', ...messageOrOptions }
  return confirmAction(options)
}

/**
 * Trigger a centered warning notification modal.
 * @param {string|Object} messageOrOptions
 * @param {string} [title]
 * @returns {Promise<boolean>}
 */
export function showWarningModal(messageOrOptions, title = 'Warning') {
  const options = typeof messageOrOptions === 'string'
    ? { message: messageOrOptions, title, type: 'warning', isAlert: true, confirmText: 'OK' }
    : { type: 'warning', isAlert: true, confirmText: 'OK', ...messageOrOptions }
  return confirmAction(options)
}

/**
 * Trigger a centered info/notice notification modal.
 * @param {string|Object} messageOrOptions
 * @param {string} [title]
 * @returns {Promise<boolean>}
 */
export function showInfoModal(messageOrOptions, title = 'Notice') {
  const options = typeof messageOrOptions === 'string'
    ? { message: messageOrOptions, title, type: 'info', isAlert: true, confirmText: 'OK' }
    : { type: 'info', isAlert: true, confirmText: 'OK', ...messageOrOptions }
  return confirmAction(options)
}

/**
 * Trigger a generic alert modal.
 * @param {string|Object} messageOrOptions
 * @param {'success'|'error'|'warning'|'info'} [type]
 * @param {string} [title]
 * @returns {Promise<boolean>}
 */
export function showAlertModal(messageOrOptions, type = 'info', title) {
  if (type === 'success') return showSuccessModal(messageOrOptions, title || 'Success')
  if (type === 'error') return showErrorModal(messageOrOptions, title || 'Error')
  if (type === 'warning') return showWarningModal(messageOrOptions, title || 'Warning')
  return showInfoModal(messageOrOptions, title || 'Notice')
}

/**
 * Global notification feedback API powered by the Rise Above Modal Dialog System.
 */
export const notify = {
  success: (message, title = 'Success') => showSuccessModal(message, typeof title === 'string' ? title : 'Success'),
  error: (message, title = 'Error') => showErrorModal(message, typeof title === 'string' ? title : 'Error'),
  info: (message, title = 'Notice') => showInfoModal(message, typeof title === 'string' ? title : 'Notice'),
  warning: (message, title = 'Warning') => showWarningModal(message, typeof title === 'string' ? title : 'Warning'),
}

const suppressUntil = new Map()

export function suppressNotificationToast(key, ms = 15000) {
  if (!key) return
  suppressUntil.set(String(key), Date.now() + ms)
}

export function isNotificationToastSuppressed(key) {
  const until = suppressUntil.get(String(key || ''))
  if (!until) return false
  if (Date.now() > until) {
    suppressUntil.delete(String(key))
    return false
  }
  return true
}

export default confirmAction


