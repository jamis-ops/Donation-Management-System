import { useState, useMemo, useEffect } from 'react'
import { 
  Package, ShoppingBag, Plus, Trash2, CheckCircle2, 
  DollarSign, Users, MapPin, FileText, Send, AlertCircle, 
  Sparkles, Coins, Store, Receipt, ArrowRight
} from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import { donationsApi, beneficiariesApi, assistanceRequestsApi } from '../../../api/resources'
import { notify } from '../../../utils/toast'
import { showSuccessModal } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

const PACK_PRESETS = [
  { name: 'Emergency Relief Food Pack', defaultCost: 500, icon: '🍲', desc: 'Rice (5kg), 6 canned goods, noodles, clean drinking water' },
  { name: 'Family Hygiene & Sanitation Kit', defaultCost: 300, icon: '🧼', desc: 'Bath soap, detergent, toothbrushes, toothpaste, sanitary pads' },
  { name: 'Back-to-School Student Kit', defaultCost: 400, icon: '🎒', desc: 'Notebooks, pens, pencils, bag, crayons, ruler' },
  { name: 'Medical / First Aid Emergency Kit', defaultCost: 450, icon: '💊', desc: 'Paracetamol, multivitamins, antiseptic, bandages, gauze' },
  { name: 'Custom Relief Package', defaultCost: 500, icon: '📦', desc: 'Custom package configured by admin' },
]

export default function ProcurementModal({ donation, beneficiaries = [], assistanceRequests = [], onClose, onSuccess }) {
  const { showLoading, hideLoading } = useLoading()
  const [activeTab, setActiveTab] = useState('pack_sponsorship') // 'pack_sponsorship' | 'itemized_purchase'
  const [saving, setSaving] = useState(false)

  const [internalBeneficiaries, setInternalBeneficiaries] = useState(beneficiaries || [])
  const [internalRequests, setInternalRequests] = useState(assistanceRequests || [])

  // Auto-fetch fresh list if empty or on mount to ensure accurate affected family counts
  useEffect(() => {
    if (beneficiaries && beneficiaries.length > 0) {
      setInternalBeneficiaries(beneficiaries)
    } else {
      beneficiariesApi.list().then(res => {
        if (res?.data) setInternalBeneficiaries(res.data)
      }).catch(console.error)
    }
  }, [beneficiaries])

  useEffect(() => {
    if (assistanceRequests && assistanceRequests.length > 0) {
      setInternalRequests(assistanceRequests)
    } else {
      assistanceRequestsApi.list().then(res => {
        if (res?.data) setInternalRequests(res.data)
      }).catch(console.error)
    }
  }, [assistanceRequests])

  const remainingBalance = useMemo(() => {
    return Math.max(0, (Number(donation?.remainingBalance ?? donation?.amountRaw ?? 0)))
  }, [donation])

  // --- Pack Sponsorship State ---
  const [packPresetIndex, setPackPresetIndex] = useState(0)
  const [packUnitCost, setPackUnitCost] = useState(PACK_PRESETS[0].defaultCost)
  const [packAmountToAllocate, setPackAmountToAllocate] = useState(remainingBalance || 500)
  const [packBeneficiaryId, setPackBeneficiaryId] = useState('')
  const [packRequestId, setPackRequestId] = useState('')

  // --- Itemized Purchase State ---
  const [storeName, setStoreName] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [itemBeneficiaryId, setItemBeneficiaryId] = useState('')
  const [itemRequestId, setItemRequestId] = useState('')
  const [addToInventory, setAddToInventory] = useState(false)
  const [familiesSupportedInput, setFamiliesSupportedInput] = useState('')
  const [items, setItems] = useState([
    { id: 1, item: '25kg Rice Sack', quantity: 10, unit: 'sacks', unitCost: 1250 },
    { id: 2, item: 'Canned Goods (100s box)', quantity: 2, unit: 'boxes', unitCost: 2500 },
  ])

  const [notes, setNotes] = useState('')

  // Filter requests for selected beneficiary
  const currentBeneficiaryId = activeTab === 'pack_sponsorship' ? packBeneficiaryId : itemBeneficiaryId
  const availableRequests = useMemo(() => {
    if (!currentBeneficiaryId) return internalRequests || []
    return (internalRequests || []).filter(r => (String(r.beneficiaryId) === String(currentBeneficiaryId) || String(r.beneficiary_id) === String(currentBeneficiaryId)) && r.status !== 'Completed')
  }, [internalRequests, currentBeneficiaryId])

  const selectedBeneficiary = useMemo(() => {
    if (!currentBeneficiaryId) return null
    return (internalBeneficiaries || []).find(b => 
      String(b.dbId) === String(currentBeneficiaryId) || 
      String(b.id) === String(currentBeneficiaryId) ||
      Number(b.dbId) === Number(currentBeneficiaryId)
    )
  }, [internalBeneficiaries, currentBeneficiaryId])

  const selectedRequest = useMemo(() => {
    const rId = activeTab === 'pack_sponsorship' ? packRequestId : itemRequestId
    if (!rId) return null
    return (internalRequests || []).find(r => 
      String(r.dbId) === String(rId) || 
      String(r.id) === String(rId) ||
      Number(r.dbId) === Number(rId)
    )
  }, [internalRequests, activeTab, packRequestId, itemRequestId])

  const currentAffectedFamilies = useMemo(() => {
    if (selectedRequest?.affectedFamilies && Number(selectedRequest.affectedFamilies) > 0) {
      return Number(selectedRequest.affectedFamilies)
    }
    if (selectedBeneficiary) {
      return Number(selectedBeneficiary.affectedFamilies || selectedBeneficiary.affected_families || selectedBeneficiary.families || 0)
    }
    return 0
  }, [selectedBeneficiary, selectedRequest])

  // Computed Pack Sponsorship numbers
  const currentPackPreset = PACK_PRESETS[packPresetIndex] || PACK_PRESETS[0]
  const computedPackCount = useMemo(() => {
    const cost = Number(packUnitCost) || 1
    const total = Number(packAmountToAllocate) || 0
    return Math.max(1, Math.floor(total / cost))
  }, [packAmountToAllocate, packUnitCost])

  // Computed Itemized numbers
  const computedItemizedTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.unitCost) || 0)), 0)
  }, [items])

  const effectiveTotalAmount = activeTab === 'pack_sponsorship' ? Number(packAmountToAllocate) : computedItemizedTotal

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now(), item: '', quantity: 1, unit: 'pcs', unitCost: 0 }
    ])
  }

  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      notify.warning('Must keep at least 1 item line.')
      return
    }
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const handleItemChange = (id, field, val) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      return { ...it, [field]: val }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (effectiveTotalAmount <= 0) {
      notify.error('Total amount must be greater than ₱0.')
      return
    }
    if (effectiveTotalAmount > remainingBalance) {
      notify.error(`Total amount (₱${effectiveTotalAmount.toLocaleString()}) exceeds the remaining unallocated balance (₱${remainingBalance.toLocaleString()}).`)
      return
    }

    let payloadItems = []
    let familiesCount = 0

    if (activeTab === 'pack_sponsorship') {
      payloadItems = [
        {
          item: currentPackPreset.name,
          quantity: computedPackCount,
          unit: 'packs',
          unitCost: Number(packUnitCost),
          totalCost: Number(packAmountToAllocate),
        }
      ]
      familiesCount = currentAffectedFamilies > 0 ? currentAffectedFamilies : computedPackCount
    } else {
      payloadItems = items.map(it => ({
        item: it.item.trim() || 'Procured Relief Supply',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'pcs',
        unitCost: Number(it.unitCost) || 0,
        totalCost: (Number(it.quantity) || 1) * (Number(it.unitCost) || 0),
      }))
      familiesCount = Number(familiesSupportedInput) || currentAffectedFamilies || 1
    }

    const payload = {
      action: 'procure',
      donationId: donation.dbId || donation.id,
      mode: activeTab === 'pack_sponsorship' ? 'Pack Sponsorship' : 'Itemized Purchase',
      totalAmount: effectiveTotalAmount,
      beneficiaryId: currentBeneficiaryId ? Number(currentBeneficiaryId) : null,
      assistanceRequestId: (activeTab === 'pack_sponsorship' ? packRequestId : itemRequestId) ? Number(activeTab === 'pack_sponsorship' ? packRequestId : itemRequestId) : null,
      items: payloadItems,
      receiptNumber: receiptNumber.trim(),
      supplierName: storeName.trim(),
      familiesSupported: familiesCount,
      notes: notes.trim(),
      addToInventory: Boolean(addToInventory),
    }

    setSaving(true)
    showLoading('Allocating funds and notifying donor…')
    try {
      const res = await donationsApi.procure(payload)
      notify.success(res.message || 'Donation successfully allocated and converted to relief goods!')
      showSuccessModal('Funds Allocated & Donor Notified')
      if (onSuccess) onSuccess(res.data)
      onClose()
    } catch (err) {
      notify.error(err?.message || 'Failed to allocate donation')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div 
        className="admin-modal admin-modal--wide" 
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          width: '95vw',
          maxHeight: '92vh',
          borderRadius: '14px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff'
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <ModalHeader 
            title="Monetary Fund Allocation & Procurement" 
            onClose={onClose} 
            style={{
              margin: 0,
              top: 0,
              position: 'static',
              borderRadius: '14px 14px 0 0'
            }}
          />

          {/* Top Fund Overview Bar */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Donor Contribution
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                {donation.donor} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>({donation.trackingCode})</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Donated
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  ₱{Number(donation.amountRaw || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ 
                background: '#f0fdf4', 
                border: '1px solid #bbf7d0', 
                borderRadius: '8px', 
                padding: '0.4rem 0.8rem',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Available to Allocate
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d' }}>
                  ₱{remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Switcher: Pack Sponsorship vs Itemized Purchase */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            padding: '0 1.25rem'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('pack_sponsorship')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.85rem 1.1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: activeTab === 'pack_sponsorship' ? '3px solid #AF101A' : '3px solid transparent',
                color: activeTab === 'pack_sponsorship' ? '#AF101A' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <Package size={17} />
              <span>Quick Pack Sponsorship (Auto-Convert)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('itemized_purchase')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.85rem 1.1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: activeTab === 'itemized_purchase' ? '3px solid #AF101A' : '3px solid transparent',
                color: activeTab === 'itemized_purchase' ? '#AF101A' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <ShoppingBag size={17} />
              <span>Itemized Store Purchase (Wholesale Receipt)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.4rem' }}>
          {activeTab === 'pack_sponsorship' ? (
            /* ========================================================= */
            /* TAB 1: QUICK PACK SPONSORSHIP                             */
            /* ========================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ background: '#fff9f9', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={20} style={{ color: '#AF101A', flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                  <strong>Pack Sponsorship:</strong> Automatically calculates how many standardized relief kits the donor's cash can fund and assigns them directly to families in need.
                </div>
              </div>

              {/* Pack Preset Picker */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Select Package Type to Sponsor
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
                  {PACK_PRESETS.map((preset, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setPackPresetIndex(idx)
                        setPackUnitCost(preset.defaultCost)
                      }}
                      style={{
                        border: packPresetIndex === idx ? '2px solid #AF101A' : '1px solid #e2e8f0',
                        background: packPresetIndex === idx ? '#fff5f5' : '#ffffff',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', lineHeight: 1.3 }}>
                        {preset.desc}
                      </div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#AF101A', marginTop: '0.4rem' }}>
                        ₱{preset.defaultCost.toLocaleString()} / kit
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost & Amount Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Unit Cost per Package (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={packUnitCost}
                    onChange={e => setPackUnitCost(Number(e.target.value) || 1)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Cash Amount to Allocate (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={remainingBalance}
                    step="1"
                    value={packAmountToAllocate}
                    onChange={e => setPackAmountToAllocate(Number(e.target.value) || 0)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    required
                  />
                </div>
              </div>

              {/* Target Beneficiary Barangay */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Target Partner Barangay / Beneficiary
                  </label>
                  <select
                    value={packBeneficiaryId}
                    onChange={e => {
                      setPackBeneficiaryId(e.target.value)
                      setPackRequestId('')
                    }}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    required
                  >
                    <option value="">-- Select Barangay --</option>
                    {internalBeneficiaries.map(b => {
                      const famCount = Number(b.affectedFamilies || b.affected_families || b.families || 0)
                      const displayName = b.full_name || b.name || b.barangay || 'Barangay'
                      const muni = b.municipality || 'Cebu'
                      return (
                        <option key={b.dbId || b.id} value={b.dbId || b.id}>
                          {displayName} ({muni}) — {famCount} affected families
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Link to Relief Request (Optional)
                  </label>
                  <select
                    value={packRequestId}
                    onChange={e => setPackRequestId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    <option value="">-- General Allocation --</option>
                    {availableRequests.map(r => (
                      <option key={r.dbId || r.id} value={r.dbId || r.id}>
                        {r.id || r.trackingCode} — {r.type || 'Relief'} ({r.priority})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Impact Calculation Preview */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #86efac',
                borderRadius: '10px',
                padding: '0.9rem 1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Calculated Community Impact
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14532d', marginTop: '0.15rem' }}>
                    {computedPackCount} {currentPackPreset.name}s
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '0.1rem' }}>
                    Provides direct relief for <strong>{selectedBeneficiary?.full_name || selectedBeneficiary?.name || selectedBeneficiary?.barangay || 'partner community'}</strong>
                    {currentAffectedFamilies > 0 && (
                      <span style={{ marginLeft: '0.4rem', color: '#15803d', fontWeight: 600 }}>
                        ({currentAffectedFamilies.toLocaleString()} affected families recorded)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>
                    Total Allocation
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                    ₱{Number(packAmountToAllocate).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* TAB 2: ITEMIZED STORE PURCHASE                            */
            /* ========================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Store size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.4 }}>
                  <strong>Store & Market Procurement:</strong> Itemize goods purchased from wholesalers (e.g. Carbon Market, Gaisano) with receipt numbers for full auditing and donor accountability.
                </div>
              </div>

              {/* Store & Receipt Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Wholesaler / Store / Supplier Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gaisano Grand / Carbon Market Wholesale"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Official Receipt / Invoice Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OR-2026-88910"
                    value={receiptNumber}
                    onChange={e => setReceiptNumber(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    required
                  />
                </div>
              </div>

              {/* Target Barangay & Request */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Target Partner Barangay / Beneficiary
                  </label>
                  <select
                    value={itemBeneficiaryId}
                    onChange={e => {
                      const val = e.target.value
                      setItemBeneficiaryId(val)
                      setItemRequestId('')
                      const matched = (internalBeneficiaries || []).find(b => String(b.dbId || b.id) === String(val))
                      const fams = Number(matched?.affectedFamilies || matched?.affected_families || 0)
                      if (fams > 0 && !familiesSupportedInput) {
                        setFamiliesSupportedInput(String(fams))
                      }
                    }}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    required
                  >
                    <option value="">-- Select Barangay --</option>
                    {internalBeneficiaries.map(b => {
                      const famCount = Number(b.affectedFamilies || b.affected_families || b.families || 0)
                      const displayName = b.full_name || b.name || b.barangay || 'Barangay'
                      const muni = b.municipality || 'Cebu'
                      return (
                        <option key={b.dbId || b.id} value={b.dbId || b.id}>
                          {displayName} ({muni}) — {famCount} affected families
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Link to Relief Request
                  </label>
                  <select
                    value={itemRequestId}
                    onChange={e => setItemRequestId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    <option value="">-- General Allocation --</option>
                    {availableRequests.map(r => (
                      <option key={r.dbId || r.id} value={r.dbId || r.id}>
                        {r.id || r.trackingCode} — {r.type || 'Relief'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Line Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Purchased Goods Itemization
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={13} /> Add Line Item
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((it, idx) => {
                    const subtotal = (Number(it.quantity) || 0) * (Number(it.unitCost) || 0)
                    return (
                      <div key={it.id || idx} style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                        gap: '0.5rem',
                        alignItems: 'center',
                        background: '#f8fafc',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div>
                          <input
                            type="text"
                            placeholder="Item Name (e.g. 25kg Rice)"
                            value={it.item}
                            onChange={e => handleItemChange(it.id, 'item', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            required
                          />
                        </div>

                        <div>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={it.quantity}
                            onChange={e => handleItemChange(it.id, 'quantity', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            required
                          />
                        </div>

                        <div>
                          <select
                            value={it.unit}
                            onChange={e => handleItemChange(it.id, 'unit', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          >
                            <option value="sacks">sacks</option>
                            <option value="boxes">boxes</option>
                            <option value="cases">cases</option>
                            <option value="packs">packs</option>
                            <option value="pcs">pcs</option>
                            <option value="kg">kg</option>
                            <option value="cans">cans</option>
                          </select>
                        </div>

                        <div>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="Unit ₱"
                            value={it.unitCost}
                            onChange={e => handleItemChange(it.id, 'unitCost', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            required
                          />
                        </div>

                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', textAlign: 'right', paddingRight: '0.5rem' }}>
                          ₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Total Purchase & Inventory Intake Checkbox */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={addToInventory}
                    onChange={e => setAddToInventory(e.target.checked)}
                  />
                  <span>Automatically intake purchased goods into Warehouse Inventory</span>
                </label>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginRight: '0.5rem' }}>
                    Total Purchase:
                  </span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: computedItemizedTotal > remainingBalance ? '#dc2626' : '#15803d' }}>
                    ₱{computedItemizedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Procurement Notes & Delivery Instructions (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Delivered directly to Barangay Banilad gym evacuation center..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
          </div>
          </div>

          {/* Modal Actions (Always Visible Pinned Footer) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.4rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            flexShrink: 0,
            gap: '1rem'
          }}>
            <button
              type="button"
              className="btn btn--outline"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.55rem 1.25rem', fontWeight: 600 }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || effectiveTotalAmount <= 0 || effectiveTotalAmount > remainingBalance}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.5rem',
                fontSize: '0.88rem',
                fontWeight: 700
              }}
            >
              <Send size={15} />
              <span>Confirm Allocation & Notify Donor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
