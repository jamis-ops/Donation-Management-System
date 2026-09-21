import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  QrCode,
  Building2,
  Globe,
  Upload,
  Search,
  AlertTriangle,
  Info,
  Check,
  Eye,
  FileText,
  ShieldCheck,
  Power
} from 'lucide-react'
import { paymentMethodsApi } from '../../../api/resources'
import ModalHeader from './ModalHeader'
import StatusBadge from './StatusBadge'
import Req from '../../../components/shared/Req'
import { notify, confirmAction } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

const METHOD_TYPES = [
  { value: 'gcash', label: 'GCash (E-Wallet / QR)' },
  { value: 'maya', label: 'Maya (E-Wallet / QR)' },
  { value: 'bank_transfer', label: 'Bank Transfer (Local / Wire)' },
  { value: 'paypal', label: 'PayPal (International)' },
  { value: 'check', label: 'Check Donation' },
  { value: 'custom', label: 'Custom / Other Method' },
]

const emptyForm = {
  id: null,
  name: '',
  code: '',
  type: 'custom',
  description: '',
  accountName: '',
  accountNumber: '',
  bankName: '',
  instructions: '',
  notes: '',
  sortOrder: 0,
  isActive: true,
  swiftCode: '',
  bankAddress: '',
  branch: '',
}

export default function PaymentMethodsManageModal({ open, onClose }) {
  const { showLoading, hideLoading } = useLoading()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all | active | inactive

  // Add / Edit form modal
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [qrFile, setQrFile] = useState(null)
  const [qrPreview, setQrPreview] = useState(null)
  const [removeQr, setRemoveQr] = useState(false)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await paymentMethodsApi.listAll()
      const list = Array.isArray(res?.data) ? res.data : []
      setItems(list)
      return list
    } catch (err) {
      notify.error(err.message || 'Could not load payment methods.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    load()
  }, [open, load])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterStatus === 'active' && !item.isActive) return false
      if (filterStatus === 'inactive' && item.isActive) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchName = (item.name || '').toLowerCase().includes(q)
        const matchCode = (item.code || '').toLowerCase().includes(q)
        const matchDesc = (item.description || '').toLowerCase().includes(q)
        const matchAcc = (item.accountNumber || '').toLowerCase().includes(q)
        const matchBank = (item.bankName || '').toLowerCase().includes(q)
        if (!matchName && !matchCode && !matchDesc && !matchAcc && !matchBank) return false
      }
      return true
    })
  }, [items, filterStatus, search])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormData({
      ...emptyForm,
      sortOrder: items.length + 1,
    })
    setQrFile(null)
    setQrPreview(null)
    setRemoveQr(false)
    setShowFormModal(true)
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    const extra = item.extraDetails || {}
    setFormData({
      id: item.id,
      name: item.name || '',
      code: item.code || '',
      type: item.type || 'custom',
      description: item.description || '',
      accountName: item.accountName || '',
      accountNumber: item.accountNumber || '',
      bankName: item.bankName || '',
      instructions: item.instructions || '',
      notes: item.notes || '',
      sortOrder: item.sortOrder ?? 0,
      isActive: Boolean(item.isActive),
      swiftCode: extra['SWIFT Code'] || extra.swiftCode || '',
      bankAddress: extra['Bank Address'] || extra.bankAddress || '',
      branch: extra.Branch || extra.branch || '',
    })
    setQrFile(null)
    setQrPreview(item.qrUrl || null)
    setRemoveQr(false)
    setShowFormModal(true)
  }

  const handleToggleActive = async (item) => {
    showLoading(item.isActive ? 'Deactivating…' : 'Activating…')
    try {
      await paymentMethodsApi.toggleActive(item.id)
      notify.success(`'${item.name}' is now ${item.isActive ? 'inactive (hidden from public)' : 'active'}.`)
      await load()
    } catch (err) {
      notify.error(err.message || 'Failed to update status.')
    } finally {
      hideLoading()
    }
  }

  const handleDelete = async (item) => {
    if (item.donationsCount > 0) {
      notify.error(
        `Cannot delete '${item.name}' because ${item.donationsCount} existing donation(s) use this payment method. You can deactivate it instead to hide it from new donations while keeping history intact.`
      )
      return
    }

    const confirmed = await confirmAction({
      title: `Delete Payment Method?`,
      message: `Are you sure you want to permanently delete '${item.name}'? This action cannot be undone.`,
      confirmText: 'Delete Method',
      danger: true,
    })
    if (!confirmed) return

    showLoading('Deleting…')
    try {
      await paymentMethodsApi.remove(item.id)
      notify.success(`Payment method '${item.name}' deleted successfully.`)
      await load()
    } catch (err) {
      notify.error(err.message || 'Failed to delete payment method.')
    } finally {
      hideLoading()
    }
  }

  const handleQrChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setQrFile(file)
    setRemoveQr(false)
    const reader = new FileReader()
    reader.onload = () => setQrPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      notify.error('Display Name is required.')
      return
    }

    showLoading(editingItem ? 'Saving changes…' : 'Creating payment method…')

    try {
      const fd = new FormData()
      fd.append('name', formData.name.trim())
      fd.append('code', formData.code.trim())
      fd.append('type', formData.type)
      fd.append('description', formData.description.trim())
      fd.append('accountName', formData.accountName.trim())
      fd.append('accountNumber', formData.accountNumber.trim())
      fd.append('bankName', formData.bankName.trim())
      fd.append('instructions', formData.instructions.trim())
      fd.append('notes', formData.notes.trim())
      fd.append('sortOrder', String(formData.sortOrder))
      fd.append('isActive', formData.isActive ? '1' : '0')

      const extra = {}
      if (formData.swiftCode.trim()) extra['SWIFT Code'] = formData.swiftCode.trim()
      if (formData.branch.trim()) extra['Branch'] = formData.branch.trim()
      if (formData.bankAddress.trim()) extra['Bank Address'] = formData.bankAddress.trim()
      if (Object.keys(extra).length > 0) {
        fd.append('extraDetails', JSON.stringify(extra))
      }

      if (qrFile) {
        fd.append('qr_image', qrFile)
      } else if (removeQr) {
        fd.append('removeQr', '1')
      }

      await paymentMethodsApi.saveMultipart(fd, editingItem?.id)
      notify.success(editingItem ? 'Payment method updated successfully!' : 'Payment method created successfully!')
      setShowFormModal(false)
      await load()
    } catch (err) {
      notify.error(err.message || 'Failed to save payment method.')
    } finally {
      hideLoading()
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="admin-modal-overlay catalog-manage-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 1100 }}
    >
      <div
        className="admin-modal admin-modal--extra-wide master-catalog-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1020px', width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <ModalHeader
          title="Payment Methods CMS"
          subtitle="Configure donation payment channels, account details, instructions, and QR codes displayed on the public site."
          onClose={onClose}
        />

        <div className="master-catalog-modal__body" style={{ padding: '1.25rem 1.5rem' }}>
          {/* Top Bar: Search, Filter, Add */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <div className="search-bar" style={{ minWidth: '220px', flex: 1, maxWidth: '340px' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search methods, banks, accounts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleOpenAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={15} /> Add Payment Method
            </button>
          </div>

          {/* Payment Methods Table */}
          {loading ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 0.75rem' }} />
              <span>Loading payment methods…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
              }}
            >
              <CreditCard size={36} style={{ color: '#94a3b8', margin: '0 auto 0.75rem', display: 'block' }} />
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#334155' }}>
                {search ? 'No payment methods match your filter.' : 'No payment methods configured yet.'}
              </p>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
                Click "+ Add Payment Method" above to add GCash, Maya, Bank Transfer, or custom accounts.
              </p>
              <button type="button" className="btn btn--primary btn--sm" onClick={handleOpenAdd}>
                <Plus size={14} /> Add First Payment Method
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '60px', color: '#64748b', fontWeight: 700 }}>Order</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 700 }}>Payment Method</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 700 }}>Account Details</th>
                    <th style={{ padding: '0.75rem 1rem', width: '100px', color: '#64748b', fontWeight: 700 }}>QR Code</th>
                    <th style={{ padding: '0.75rem 1rem', width: '110px', color: '#64748b', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', width: '100px', color: '#64748b', fontWeight: 700 }}>Donations</th>
                    <th style={{ padding: '0.75rem 1rem', width: '140px', textAlign: 'right', color: '#64748b', fontWeight: 700 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: item.isActive ? '#ffffff' : '#fafafa',
                        opacity: item.isActive ? 1 : 0.75,
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#64748b' }}>
                        #{item.sortOrder}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '8px',
                              background: item.isActive ? 'rgba(175, 16, 26, 0.08)' : '#f1f5f9',
                              color: item.isActive ? 'var(--color-brand, #AF101A)' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {item.type === 'gcash' || item.type === 'maya' ? (
                              <QrCode size={16} />
                            ) : item.type === 'paypal' ? (
                              <Globe size={16} />
                            ) : (
                              <CreditCard size={16} />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.name}</div>
                            {item.description && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.3 }}>
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        {item.accountName && (
                          <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
                            {item.accountName}
                          </div>
                        )}
                        {item.accountNumber && (
                          <div style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 700, fontSize: '0.82rem' }}>
                            {item.accountNumber}
                          </div>
                        )}
                        {item.bankName && item.bankName !== item.name && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Bank: {item.bankName}
                          </div>
                        )}
                        {!item.accountName && !item.accountNumber && (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        {item.qrUrl ? (
                          <a
                            href={item.qrUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="View QR Code"
                            style={{ display: 'inline-block' }}
                          >
                            <img
                              src={item.qrUrl}
                              alt={item.name}
                              style={{
                                width: 36,
                                height: 36,
                                objectFit: 'contain',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                background: '#fff',
                              }}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            background: item.isActive ? 'rgba(22, 163, 74, 0.1)' : '#f1f5f9',
                            color: item.isActive ? '#15803d' : '#64748b',
                          }}
                        >
                          {item.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: item.donationsCount > 0 ? '#1e293b' : '#94a3b8',
                          }}
                        >
                          {item.donationsCount} donation{item.donationsCount === 1 ? '' : 's'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => handleToggleActive(item)}
                            title={item.isActive ? 'Deactivate (hide from public)' : 'Activate (display on public)'}
                            style={{
                              padding: '0.3rem 0.5rem',
                              color: item.isActive ? '#d97706' : '#16a34a',
                            }}
                          >
                            <Power size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => handleOpenEdit(item)}
                            title="Edit details"
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => handleDelete(item)}
                            title={item.donationsCount > 0 ? 'Cannot delete: used in donations (deactivate instead)' : 'Delete method'}
                            style={{
                              padding: '0.3rem 0.5rem',
                              color: item.donationsCount > 0 ? '#cbd5e1' : '#dc2626',
                              cursor: item.donationsCount > 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem 1rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
              color: '#64748b',
            }}
          >
            <ShieldCheck size={16} style={{ color: 'var(--color-brand, #AF101A)', flexShrink: 0 }} />
            <span>
              <strong>Safe Record Retention:</strong> Deactivating a payment method hides it from the Public Donation form immediately while keeping all past donation receipts intact.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Sub-Modal: Add / Edit Form */}
      {showFormModal && (
        <div
          className="admin-modal-overlay"
          onClick={() => setShowFormModal(false)}
          style={{ zIndex: 1250 }}
        >
          <div
            className="admin-modal admin-modal--wide"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px', width: '92vw', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <ModalHeader
              title={editingItem ? `Edit Payment Method: ${editingItem.name}` : 'Add New Payment Method'}
              subtitle="Configure display labels, account numbers, instructions, and QR codes for donors."
              onClose={() => setShowFormModal(false)}
            />

            <form onSubmit={handleFormSubmit} style={{ padding: '1.25rem 1.5rem' }}>
              <div className="form-row">
                <label>
                  <Req required>Display Name</Req>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GCash, Maya, Bank Transfer (BPI)"
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({
                        ...formData,
                        name: val,
                        code: !editingItem && !formData.code ? val.toLowerCase().replace(/[^a-z0-9]/g, '_') : formData.code,
                      })
                    }}
                  />
                </label>

                <label>
                  Channel Type
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    {METHOD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  System Code / Slug
                  <input
                    type="text"
                    placeholder="e.g. gcash, maya, bank_transfer"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </label>

                <label>
                  Display Order
                  <input
                    type="number"
                    min="0"
                    placeholder="1, 2, 3…"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value, 10) || 0 })}
                  />
                </label>
              </div>

              <label>
                Subtitle / Description
                <input
                  type="text"
                  placeholder="e.g. GCash Philippines (Scan to Pay / Mobile)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </label>

              <div className="form-row">
                <label>
                  Account Name
                  <input
                    type="text"
                    placeholder="e.g. Rise Above Foundation Cebu Inc"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  />
                </label>

                <label>
                  Account / Mobile / Reference Number
                  <input
                    type="text"
                    placeholder="e.g. 9131005064 or 0917-XXX-XXXX"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Bank / Provider Name (Optional)
                <input
                  type="text"
                  placeholder="e.g. Bank of The Philippine Islands"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </label>

              {/* Extra Bank Details (for Bank Transfer) */}
              {(formData.type === 'bank_transfer' || formData.name.toLowerCase().includes('bank')) && (
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    Wire / Bank Transfer Additional Details
                  </span>
                  <div className="form-row">
                    <label>
                      SWIFT Code
                      <input
                        type="text"
                        placeholder="e.g. BOPIPHMM"
                        value={formData.swiftCode}
                        onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                      />
                    </label>
                    <label>
                      Branch Name
                      <input
                        type="text"
                        placeholder="e.g. Cebu North Reclamation Area"
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      />
                    </label>
                  </div>
                  <label style={{ marginBottom: 0 }}>
                    Branch Address
                    <input
                      type="text"
                      placeholder="e.g. BPI Building, Juan Luna Ave., Cebu City 6000"
                      value={formData.bankAddress}
                      onChange={(e) => setFormData({ ...formData, bankAddress: e.target.value })}
                    />
                  </label>
                </div>
              )}

              <label>
                Payment Instructions (Step-by-step for donor)
                <textarea
                  rows={4}
                  placeholder="1. Open your banking/wallet app&#10;2. Send to the account above&#10;3. Take a screenshot confirmation receipt"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                />
                <span className="field-hint">Enter instructions. Each line will be displayed cleanly on the donation page.</span>
              </label>

              {/* QR Code Upload */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.4rem' }}>
                  QR Code Image (Optional)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {qrPreview && !removeQr ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={qrPreview}
                        alt="QR Preview"
                        style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveQr(true)
                          setQrFile(null)
                          setQrPreview(null)
                        }}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: 20,
                          height: 20,
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Remove QR Image"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}

                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleQrChange}
                    />
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Upload size={13} /> {qrPreview && !removeQr ? 'Change QR Image' : 'Upload QR Image'}
                    </button>
                    <span className="field-hint" style={{ marginTop: '0.25rem' }}>
                      JPG, PNG, or WEBP. Upload your official QR code for instant mobile scan-to-pay.
                    </span>
                  </div>
                </div>
              </div>

              <label>
                Notice / Banner Text (Optional)
                <input
                  type="text"
                  placeholder="e.g. Upload your GCash screenshot receipt below as proof."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span style={{ fontWeight: 600 }}>Active (Visible to donors on the public donation page)</span>
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setShowFormModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  {editingItem ? 'Save Changes' : 'Create Payment Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
