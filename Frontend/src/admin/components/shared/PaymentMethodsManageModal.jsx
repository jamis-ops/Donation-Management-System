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
          <div className="pm-cms-toolbar">
            <div className="pm-cms-toolbar__left">
              <div className="pm-cms-search-wrap">
                <Search size={16} className="pm-cms-search-icon" />
                <input
                  type="text"
                  className="pm-cms-search-input"
                  placeholder="Search payment methods, banks, accounts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="pm-cms-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <button
              type="button"
              className="pm-cms-add-btn"
              onClick={handleOpenAdd}
              aria-label="Add Payment Method"
            >
              <Plus size={16} strokeWidth={2.2} />
              <span>Add Payment Method</span>
            </button>
          </div>

          {/* Payment Methods Table */}
          {loading ? (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 0.85rem' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Loading payment methods…</span>
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
              <CreditCard size={40} style={{ color: '#94a3b8', margin: '0 auto 0.75rem', display: 'block' }} />
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#334155', fontSize: '1rem' }}>
                {search || filterStatus !== 'all' ? 'No payment methods match your filters.' : 'No payment methods configured yet.'}
              </p>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem' }}>
                {search || filterStatus !== 'all'
                  ? 'Try clearing the search or status filter to see all records.'
                  : 'Add your first payment channel (GCash, Maya, Bank Transfer, PayPal, or Check) below.'}
              </p>
              {search || filterStatus !== 'all' ? (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    setSearch('')
                    setFilterStatus('all')
                  }}
                >
                  Clear Filters
                </button>
              ) : (
                <button type="button" className="btn btn--primary btn--sm" onClick={handleOpenAdd}>
                  <Plus size={15} /> Add First Payment Method
                </button>
              )}
            </div>
          ) : (
            <div className="pm-cms-table-wrap">
              <table className="pm-cms-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px', textAlign: 'center' }}>Order</th>
                    <th style={{ minWidth: '220px' }}>Payment Method</th>
                    <th style={{ minWidth: '240px' }}>Account Details</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>QR Code</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Donations</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        background: item.isActive ? '#ffffff' : '#fafafa',
                        opacity: item.isActive ? 1 : 0.8,
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <span className="pm-cms-order-badge">#{item.sortOrder}</span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '9px',
                              background: item.isActive ? 'rgba(175, 16, 26, 0.08)' : '#f1f5f9',
                              color: item.isActive ? 'var(--color-brand, #AF101A)' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {item.type === 'gcash' || item.type === 'maya' ? (
                              <QrCode size={18} />
                            ) : item.type === 'paypal' ? (
                              <Globe size={18} />
                            ) : item.type === 'check' ? (
                              <FileText size={18} />
                            ) : (
                              <CreditCard size={18} />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.92rem' }}>{item.name}</div>
                            {item.description ? (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35, marginTop: '2px' }}>
                                {item.description}
                              </div>
                            ) : item.code ? (
                              <code style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.code}</code>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td>
                        {item.accountName && (
                          <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
                            {item.accountName}
                          </div>
                        )}
                        {item.accountNumber && (
                          <div style={{ marginTop: '2px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                color: '#0f172a',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                background: '#f1f5f9',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {item.accountNumber}
                            </span>
                          </div>
                        )}
                        {item.bankName && item.bankName !== item.name && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                            Bank: {item.bankName}
                          </div>
                        )}
                        {!item.accountName && !item.accountNumber && (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>None specified</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {item.qrUrl ? (
                          <a
                            href={item.qrUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="View full QR code"
                            style={{ display: 'inline-block' }}
                          >
                            <img
                              src={item.qrUrl}
                              alt={`${item.name} QR Code`}
                              style={{
                                width: 38,
                                height: 38,
                                objectFit: 'contain',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: '#fff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              }}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic' }}>No QR</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`pm-cms-status ${
                            item.isActive ? 'pm-cms-status--active' : 'pm-cms-status--inactive'
                          }`}
                        >
                          {item.isActive ? <CheckCircle2 size={12} strokeWidth={2.5} /> : <XCircle size={12} strokeWidth={2.5} />}
                          <span>{item.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            background: item.donationsCount > 0 ? '#eff6ff' : '#f8fafc',
                            color: item.donationsCount > 0 ? '#1d4ed8' : '#94a3b8',
                            border: `1px solid ${item.donationsCount > 0 ? '#dbeafe' : '#f1f5f9'}`,
                          }}
                        >
                          {item.donationsCount} record{item.donationsCount === 1 ? '' : 's'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className={`pm-cms-action-btn ${
                              item.isActive ? 'pm-cms-action-btn--toggle-off' : 'pm-cms-action-btn--toggle-on'
                            }`}
                            onClick={() => handleToggleActive(item)}
                            title={item.isActive ? 'Deactivate (hide from public donate page)' : 'Activate (display on public donate page)'}
                            aria-label={item.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Power size={14} />
                          </button>

                          <button
                            type="button"
                            className="pm-cms-action-btn"
                            onClick={() => handleOpenEdit(item)}
                            title="Edit details"
                            aria-label="Edit details"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            type="button"
                            className="pm-cms-action-btn pm-cms-action-btn--delete"
                            onClick={() => handleDelete(item)}
                            disabled={item.donationsCount > 0}
                            title={
                              item.donationsCount > 0
                                ? `Cannot delete: used in ${item.donationsCount} donation(s). Deactivate instead.`
                                : 'Delete payment method'
                            }
                            aria-label="Delete"
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
