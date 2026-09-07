import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { isAdminPortalRole } from '../../../utils/roleRoutes'
import CatalogManageModal from './CatalogManageModal'

const CATALOG_META = {
  barangay_types: {
    title: 'Manage Type of Barangay',
    description: 'Add or edit barangay classifications. New items appear in Barangay forms immediately.',
  },
  needs: {
    title: 'Manage Type of Needs',
    description: 'Add or edit need categories. New items appear in barangay forms and Beneficiary requests immediately.',
  },
  task_types: {
    title: 'Manage Task Types',
    description: 'Add or edit task types. New items appear when assigning staff or volunteer tasks immediately.',
  },
}

/**
 * Admin-only "+" control that opens the Settings catalog modal in-place.
 */
export default function CatalogQuickAdd({
  catalog,
  onUpdated,
  title,
  description,
  className = '',
  stopPropagation = true,
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const meta = CATALOG_META[catalog] || { title: 'Manage list', description: '' }

  if (!isAdminPortalRole(user?.role) && !user?.isSuperAdmin) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className={`catalog-quick-add ${className}`.trim()}
        title={title || meta.title}
        aria-label={title || meta.title}
        onClick={(e) => {
          if (stopPropagation) {
            e.preventDefault()
            e.stopPropagation()
          }
          setOpen(true)
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>

      <CatalogManageModal
        open={open}
        onClose={() => setOpen(false)}
        catalog={catalog}
        title={title || meta.title}
        description={description || meta.description}
        onChanged={(list) => {
          onUpdated?.(list)
        }}
      />
    </>
  )
}

/** Label row with optional Quick Add for catalog-backed fields. */
export function CatalogFieldLabel({ children, catalog, onUpdated, required = false }) {
  return (
    <span className="catalog-field-label">
      <span>
        {children}
        {required && <span className="needs-picker__required" aria-hidden="true"> *</span>}
      </span>
      {catalog && <CatalogQuickAdd catalog={catalog} onUpdated={onUpdated} />}
    </span>
  )
}
