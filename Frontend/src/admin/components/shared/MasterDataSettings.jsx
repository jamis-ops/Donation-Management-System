import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, ClipboardList, HeartHandshake, ListTodo, Package, Sparkles, Layers, Wallet } from 'lucide-react'
import CatalogManageModal from './CatalogManageModal'
import TaskTitlesManageModal from './TaskTitlesManageModal'
import InventoryCmsModal from './InventoryCmsModal'
import PaymentMethodsManageModal from './PaymentMethodsManageModal'

const SECTIONS = [
  {
    key: 'payment_methods',
    title: 'Payment Methods CMS',
    short: 'Manage GCash, Maya, Bank Transfer, PayPal, QR codes & donation payment instructions.',
    description: 'Configure monetary donation payment methods, QR code images, account details, and public visibility.',
    icon: Wallet,
    isPaymentMethods: true,
  },
  {
    key: 'inventory_cms',
    title: 'Inventory Catalog CMS',
    short: 'Hierarchy categories, item types, brands, variants & measurement units.',
    description: 'Configure standardized disaster relief categories, item types, brand names, variants, and units.',
    icon: Layers,
    isInventoryCms: true,
  },
  {
    key: 'task_titles',
    title: 'Task Titles CMS',
    short: 'Program-linked task titles for Staff, Volunteers, and Interns.',
    description: 'Manage standardized task titles, assign them to specific programs, and activate or deactivate them.',
    icon: ListTodo,
    isTaskTitles: true,
  },
  {
    key: 'volunteer_programs',
    title: 'Volunteer Programs',
    short: 'Disaster Relief, Community Feeding, Education, Medical Missions, and other volunteer programs.',
    description: 'Managed volunteer programs that volunteers can choose during registration and profile updates.',
    icon: HeartHandshake,
  },
  {
    key: 'volunteer_skills',
    title: 'Volunteer Skills',
    short: 'First Aid, Logistics, Packing, Teaching, Cooking, and other volunteer skill tags.',
    description: 'Skill tags used for volunteer profiles, task assignments, and manpower matching.',
    icon: Sparkles,
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [active, setActive] = useState(() => searchParams.get('section') || searchParams.get('catalog') || null)

  useEffect(() => {
    const q = searchParams.get('section') || searchParams.get('catalog')
    if (q) {
      setActive(q)
    }
  }, [searchParams])

  const handleOpen = (key) => {
    setActive(key)
    const next = new URLSearchParams(searchParams)
    next.set('section', key)
    setSearchParams(next, { replace: true })
  }

  const handleClose = () => {
    setActive(null)
    const next = new URLSearchParams(searchParams)
    next.delete('section')
    next.delete('catalog')
    setSearchParams(next, { replace: true })
  }

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
              onClick={() => handleOpen(section.key)}
              aria-label={`Manage ${section.title}`}
            >
              <span className="master-data-card__icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="master-data-card__body">
                <strong>{section.title}</strong>
                <span>{section.short}</span>
              </span>
              <span className="master-data-card__cta">Manage &rarr;</span>
            </button>
          )
        })}
      </div>

      <CatalogManageModal
        open={Boolean(current && !current.isTaskTitles && !current.isInventoryCms && !current.isPaymentMethods)}
        onClose={handleClose}
        catalog={current?.key}
        title={current ? `Manage ${current.title}` : ''}
        description={current?.description}
      />

      <TaskTitlesManageModal
        open={Boolean(current && current.isTaskTitles)}
        onClose={handleClose}
      />

      <InventoryCmsModal
        open={Boolean(current && current.isInventoryCms)}
        onClose={handleClose}
      />

      <PaymentMethodsManageModal
        open={Boolean(current && current.isPaymentMethods)}
        onClose={handleClose}
      />
    </section>
  )
}

