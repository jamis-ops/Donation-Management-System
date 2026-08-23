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

export default confirmAction
