import { useState } from 'react'
import { Building2, ClipboardList, Package } from 'lucide-react'
import CatalogManageModal from './CatalogManageModal'

const SECTIONS = [
  {
    key: 'barangay_types',
    title: 'Type of Barangay',
    short: 'Urban, Rural, Coastal, and other barangay classifications.',
    description: 'These options appear in Add/Edit Barangay forms across the Barangay module.',
    icon: Building2,
  },
  {
    key: 'needs',
    title: 'Type of Needs',
    short: 'Food, Water, Medicine, and other assistance categories.',
    description: 'Shared with barangay profiles and Beneficiary assistance requests. Changes apply immediately.',
    icon: Package,
  },
  {
    key: 'task_types',
    title: 'Task Management',
    short: 'Task types used when creating or assigning staff and volunteer work.',
    description: 'These options appear when assigning tasks (module / task type selectors).',
    icon: ClipboardList,
  },
]

/**
 * Admin Settings: centralized master-data catalogs.
 * Each card opens a CRUD modal.
 */
export default function MasterDataSettings() {
  const [active, setActive] = useState(null)

  const current = SECTIONS.find((s) => s.key === active) || null

  return (
    <section className="portal-panel settings-panel settings-panel--wide master-data-settings">
      <div className="portal-panel__header">
        <h2>System Lists</h2>
      </div>
      <p className="master-data-settings__intro">
        Manage shared dropdown lists used across the system. Open a section to add, edit, delete, or view items.
      </p>

      <div className="master-data-settings__grid">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <button
              key={section.key}
              type="button"
              className="master-data-card"
              onClick={() => setActive(section.key)}
            >
              <span className="master-data-card__icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="master-data-card__body">
                <strong>{section.title}</strong>
                <span>{section.short}</span>
              </span>
              <span className="master-data-card__cta">Manage</span>
            </button>
          )
        })}
      </div>

      <CatalogManageModal
        open={Boolean(current)}
        onClose={() => setActive(null)}
        catalog={current?.key}
        title={current ? `Manage ${current.title}` : ''}
        description={current?.description}
      />
    </section>
  )
}
