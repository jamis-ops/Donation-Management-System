/**
 * Toast API — deprecated and fully replaced by the unified Rise Above Modal System.
 * Re-exports modal dialog functions so any legacy references automatically invoke
 * the Rise Above modal dialogs.
 */
export * from './confirm'
import { notify } from './confirm'
export default notify
