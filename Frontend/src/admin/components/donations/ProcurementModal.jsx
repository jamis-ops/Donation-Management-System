import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Package, ShoppingBag, Plus, Trash2, CheckCircle2, 
  DollarSign, Users, MapPin, FileText, Send, AlertCircle, 
  Sparkles, Coins, Store, ArrowRight, Bot, Wand2, RefreshCw, Check, Lightbulb,
  Info, ShieldAlert
} from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import { donationsApi, assistanceRequestsApi } from '../../../api/resources'
import { notify, confirmAction } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

export default function ProcurementModal({ 
  donation, 
  initialBeneficiaryId = '',
  initialRequestId = '',
  onClose, 
  onSuccess 
}) {
  const navigate = useNavigate()
  const { showLoading, hideLoading } = useLoading()

  const [loadingEligible, setLoadingEligible] = useState(true)
  const [eligibleBarangays, setEligibleBarangays] = useState([])
  const [eligibleRequests, setEligibleRequests] = useState([])

  const [selectedBarangayId, setSelectedBarangayId] = useState(initialBeneficiaryId ? String(initialBeneficiaryId) : '')
  const [selectedRequestId, setSelectedRequestId] = useState(initialRequestId ? String(initialRequestId) : '')
  const [customAllocationAmount, setCustomAllocationAmount] = useState(null)
  const [items, setItems] = useState([])
  const [showItemization, setShowItemization] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch verified, eligible Barangays and Relief Requests dynamically from backend
  useEffect(() => {
    let isMounted = true
    setLoadingEligible(true)
    assistanceRequestsApi.listFundingEligible()
      .then(res => {
        if (!isMounted) return
        const barangays = res?.data?.eligibleBarangays || []
        const requests = res?.data?.eligibleRequests || []
        setEligibleBarangays(barangays)
        setEligibleRequests(requests)

        // Pre-select barangay if specified or if only one exists
        if (initialBeneficiaryId && barangays.some(b => String(b.id || b.dbId) === String(initialBeneficiaryId))) {
          setSelectedBarangayId(String(initialBeneficiaryId))
        } else if (!selectedBarangayId && barangays.length === 1) {
          setSelectedBarangayId(String(barangays[0].id || barangays[0].dbId))
        }

        // Pre-select request if specified
        if (initialRequestId && requests.some(r => String(r.dbId || r.id) === String(initialRequestId))) {
          setSelectedRequestId(String(initialRequestId))
        }
      })
      .catch(err => {
        console.error('Failed to load eligible requests:', err)
        notify.error('Could not load eligible relief requests.')
      })
      .finally(() => {
        if (isMounted) setLoadingEligible(false)
      })

    return () => { isMounted = false }
  }, [initialBeneficiaryId, initialRequestId])

  // Available monetary balance from donor
  const availableDonation = useMemo(() => {
    return Math.max(0, Number(donation?.remainingBalance ?? donation?.amountRaw ?? donation?.amount ?? 0))
  }, [donation])

  // Eligible relief requests for selected barangay only
  const availableRequestsForBarangay = useMemo(() => {
    if (!selectedBarangayId) return []
    return eligibleRequests.filter(r => String(r.beneficiaryId) === String(selectedBarangayId))
  }, [eligibleRequests, selectedBarangayId])

  // Auto-select first eligible request when barangay changes
  useEffect(() => {
    if (availableRequestsForBarangay.length > 0) {
      const stillValid = availableRequestsForBarangay.some(r => String(r.dbId || r.id) === String(selectedRequestId))
      if (!stillValid) {
        setSelectedRequestId(String(availableRequestsForBarangay[0].dbId || availableRequestsForBarangay[0].id))
      }
    } else {
      setSelectedRequestId('')
    }
  }, [availableRequestsForBarangay, selectedRequestId])

  // Selected request object
  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null
    return availableRequestsForBarangay.find(r => 
      String(r.dbId) === String(selectedRequestId) || 
      String(r.id) === String(selectedRequestId)
    ) || null
  }, [availableRequestsForBarangay, selectedRequestId])

  // Populate items when selected request changes
  useEffect(() => {
    if (selectedRequest?.items && selectedRequest.items.length > 0) {
      setItems(selectedRequest.items.map((it, idx) => ({
        id: idx + 1,
        item: it.item || 'Relief Package Item',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'units',
        unitCost: Number(it.unitCost) || 0,
        totalCost: Number(it.totalCost) || ((Number(it.quantity) || 1) * (Number(it.unitCost) || 0)),
      })))
    } else {
      setItems([])
    }
    setCustomAllocationAmount(null)
  }, [selectedRequest])

  // Selected Barangay object
  const selectedBarangay = useMemo(() => {
    if (!selectedBarangayId) return null
    return eligibleBarangays.find(b => String(b.id || b.dbId) === String(selectedBarangayId)) || null
  }, [eligibleBarangays, selectedBarangayId])

  // Allocation plan calculations
  const costPerFamily = selectedRequest?.costPerFamily || 0
  const remainingRequestCost = selectedRequest?.remainingCost || 0
  const remainingFamilies = selectedRequest?.remainingFamilies || 0

  // The maximum affordable allocation cannot exceed donor balance or remaining request cost
  const maxAffordableAllocation = useMemo(() => {
    if (!selectedRequest) return availableDonation
    return Math.min(availableDonation, remainingRequestCost)
  }, [availableDonation, remainingRequestCost, selectedRequest])

  const allocationAmount = useMemo(() => {
    if (customAllocationAmount !== null) {
      return Math.min(customAllocationAmount, maxAffordableAllocation)
    }
    return maxAffordableAllocation
  }, [customAllocationAmount, maxAffordableAllocation])

  // Fully supported families: floor(allocationAmount / costPerFamily)
  // For small donations < costPerFamily, this correctly calculates 0 (not rounded up to 1)
  const supportedFamilies = useMemo(() => {
    if (!selectedRequest || costPerFamily <= 0 || allocationAmount <= 0) return 0
    const affordable = Math.floor(allocationAmount / costPerFamily)
    return Math.min(remainingFamilies, affordable)
  }, [allocationAmount, costPerFamily, remainingFamilies, selectedRequest])

  const isSmallDonation = Boolean(
    selectedRequest &&
    costPerFamily > 0 &&
    allocationAmount > 0 &&
    allocationAmount < costPerFamily
  )

  const remainingDonationBalance = Math.max(0, availableDonation - allocationAmount)
  const remainingFamiliesAfter = Math.max(0, remainingFamilies - supportedFamilies)
  const remainingCostAfter = Math.max(0, remainingRequestCost - allocationAmount)

  // Item adjustments
  const handleItemChange = (id, field, val) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [field]: val }
      if (field === 'quantity' || field === 'unitCost') {
        updated.totalCost = (Number(updated.quantity) || 0) * (Number(updated.unitCost) || 0)
      }
      return updated
    }))
  }

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now(), item: '', quantity: 1, unit: 'packs', unitCost: 0, totalCost: 0 }
    ])
  }

  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedBarangayId) {
      notify.error('Please select a Target Barangay.')
      return
    }
    if (!selectedRequestId) {
      notify.error('Please select an eligible Relief Request.')
      return
    }
    if (allocationAmount <= 0) {
      notify.error('Allocation amount must be greater than ₱0.')
      return
    }
    if (allocationAmount > availableDonation) {
      notify.error(`Allocation amount exceeds available donor balance of ₱${availableDonation.toLocaleString()}.`)
      return
    }

    const payload = {
      action: 'procure',
      donationId: donation.dbId || donation.id,
      mode: 'Relief Allocation',
      totalAmount: allocationAmount,
      beneficiaryId: Number(selectedBarangayId),
      assistanceRequestId: Number(selectedRequestId),
      items: items.map(it => ({
        item: it.item.trim() || 'Procured Relief Supply',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'packs',
        unitCost: Number(it.unitCost) || 0,
        totalCost: (Number(it.quantity) || 1) * (Number(it.unitCost) || 0),
      })),
      receiptNumber: '',
      supplierName: '',
      familiesSupported: supportedFamilies,
      notes: notes.trim(),
    }

    setSaving(true)
    showLoading('Allocating funds and updating relief progress…')
    try {
      const res = await donationsApi.procure(payload)
      hideLoading()
      setSaving(false)
      notify.success(res.message || 'Donation successfully allocated!')

      const createdAllocId = res?.allocationId
      const targetBenName = selectedBarangay?.barangay || selectedBarangay?.name || 'Barangay'

      if (onSuccess) onSuccess(res?.data || res)
      onClose()

      // Prompt admin to schedule distribution if families or goods were allocated
      if (supportedFamilies > 0 || (payload.items && payload.items.length > 0)) {
        const scheduleNow = await confirmAction({
          title: 'Monetary Allocation Complete',
          message: `Successfully allocated ₱${allocationAmount.toLocaleString()} for ${targetBenName} (${supportedFamilies > 0 ? `${supportedFamilies} families supported` : 'Partial Funding'}). Would you like to schedule logistics delivery now?`,
          confirmText: 'Schedule Distribution →',
          cancelText: 'View in Allocations',
          type: 'primary',
        })

        if (scheduleNow) {
          navigate('/admin/distributions', {
            state: {
              prefillAllocation: {
                allocationId: createdAllocId,
                beneficiaryId: selectedBarangayId,
                beneficiaryName: targetBenName,
                resourceName: payload.items.map(p => `${p.item} (${p.quantity} ${p.unit})`).join(', ') || 'Relief Assistance',
                quantity: payload.items.reduce((s, p) => s + (Number(p.quantity) || 1), 0),
                program: donation.category || 'Disaster Relief',
                notes: `Funded from Monetary Donation ${donation.trackingCode || donation.code || ''}`,
              },
            },
          })
        } else {
          navigate('/admin/allocation')
        }
      }
    } catch (err) {
      hideLoading()
      setSaving(false)
      notify.error(err?.message || 'Failed to allocate donation')
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div 
        className="admin-modal admin-modal--wide" 
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '95vw',
          maxHeight: '92vh',
          borderRadius: '16px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Modal Header */}
        <div style={{ flexShrink: 0 }}>
          <ModalHeader 
            title="Monetary Fund Allocation & Procurement" 
            onClose={onClose} 
            style={{
              margin: 0,
              top: 0,
              position: 'static',
              borderRadius: '16px 16px 0 0',
              background: '#AF101A',
              color: '#ffffff'
            }}
          />

          {/* 1. DONATION INFORMATION BANNER */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '1rem 1.4rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.85rem'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Monetary Donor
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span>{donation?.donor || donation?.donor_name || 'Anonymous Donor'}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', background: '#e2e8f0', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  {donation?.trackingCode || donation?.code || 'DON-ID'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Donated
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>
                  ₱{Number(donation?.amountRaw ?? donation?.amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ 
                background: '#f0fdf4', 
                border: '1px solid #86efac', 
                borderRadius: '10px', 
                padding: '0.45rem 0.9rem',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Available to Allocate
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                  ₱{availableDonation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

            {/* 2. TARGET SELECTION (BARANGAY & RELIEF REQUEST) */}
            <div style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: '12px', 
              padding: '1.1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <MapPin size={17} style={{ color: '#AF101A' }} />
                <span>Target Beneficiary & Relief Request</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Dropdown 1: Target Barangay (Only eligible barangays, NO general affected families) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Target Barangay <span style={{ color: '#AF101A' }}>*</span>
                  </label>
                  <select
                    value={selectedBarangayId}
                    onChange={e => {
                      setSelectedBarangayId(e.target.value)
                      setCustomAllocationAmount(null)
                    }}
                    disabled={loadingEligible}
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.8rem', 
                      borderRadius: '8px', 
                      border: '1px solid #cbd5e1', 
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      background: loadingEligible ? '#f1f5f9' : '#ffffff'
                    }}
                    required
                  >
                    <option value="">-- Select Target Barangay --</option>
                    {eligibleBarangays.map(b => {
                      const name = b.barangay || b.name
                      const muni = b.municipality || 'Cebu'
                      return (
                        <option key={b.id || b.dbId} value={b.id || b.dbId}>
                          {name} ({muni}) — {b.eligibleRequestsCount} eligible request{b.eligibleRequestsCount > 1 ? 's' : ''}
                        </option>
                      )
                    })}
                  </select>
                  {eligibleBarangays.length === 0 && !loadingEligible && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>
                      No partner barangays currently have active unallocated relief requests.
                    </div>
                  )}
                </div>

                {/* Dropdown 2: Relief Request (Only requests belonging to selected barangay) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Eligible Relief Request <span style={{ color: '#AF101A' }}>*</span>
                  </label>
                  <select
                    value={selectedRequestId}
                    onChange={e => {
                      setSelectedRequestId(e.target.value)
                      setCustomAllocationAmount(null)
                    }}
                    disabled={!selectedBarangayId || availableRequestsForBarangay.length === 0}
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.8rem', 
                      borderRadius: '8px', 
                      border: '1px solid #cbd5e1', 
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      background: (!selectedBarangayId || availableRequestsForBarangay.length === 0) ? '#f1f5f9' : '#ffffff'
                    }}
                    required
                  >
                    <option value="">
                      {!selectedBarangayId 
                        ? '-- Select Barangay first --' 
                        : (availableRequestsForBarangay.length === 0 ? '-- No eligible requests for this Barangay --' : '-- Select Relief Request --')
                      }
                    </option>
                    {availableRequestsForBarangay.map(r => (
                      <option key={r.dbId || r.id} value={r.dbId || r.id}>
                        ✓ {r.calamity || r.assistanceType} ({r.referenceCode}) — {r.remainingFamilies} families — ₱{Number(r.remainingCost).toLocaleString()} remaining
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stated Request Details Preview */}
              {selectedRequest && (
                <div style={{ 
                  marginTop: '0.9rem', 
                  padding: '0.75rem 0.9rem', 
                  background: '#f8fafc', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {selectedRequest.calamity} • {selectedRequest.assistanceType}
                    </div>
                    <div style={{ color: '#64748b', marginTop: '0.15rem' }}>
                      Target Requirement: <strong style={{ color: '#0f172a' }}>{selectedRequest.requestedFamilies} families</strong>
                      {selectedRequest.alreadySupportedFamilies > 0 && (
                        <span> ({selectedRequest.alreadySupportedFamilies} already funded, <strong style={{ color: '#b91c1c' }}>{selectedRequest.remainingFamilies} remaining</strong>)</span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b' }}>
                      Calculated Package Cost: <strong style={{ color: '#0f172a' }}>₱{selectedRequest.costPerFamily.toLocaleString()} / family</strong>
                    </div>
                    <div style={{ color: '#64748b', marginTop: '0.15rem' }}>
                      Remaining Request Cost: <strong style={{ color: '#b91c1c' }}>₱{selectedRequest.remainingCost.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. ALLOCATION & FUNDING PLAN */}
            {selectedRequest && (
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px', 
                padding: '1.1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Coins size={17} style={{ color: '#AF101A' }} />
                  <span>Allocation & Dynamic Coverage Plan</span>
                </div>

                {/* Metrics 4-Box Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  {/* Card 1: Available Donation */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Available Donation
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                      ₱{availableDonation.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                      From {donation?.donor || 'Donor'}
                    </div>
                  </div>

                  {/* Card 2: Cost Per Family */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Cost Per Family
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                      ₱{costPerFamily.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                      Dynamic relief package
                    </div>
                  </div>

                  {/* Card 3: Families Supported */}
                  <div style={{ 
                    background: isSmallDonation ? '#fefce8' : '#eff6ff', 
                    border: isSmallDonation ? '1px solid #fef08a' : '1px solid #bfdbfe', 
                    borderRadius: '10px', 
                    padding: '0.75rem' 
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isSmallDonation ? '#854d0e' : '#1e40af', textTransform: 'uppercase' }}>
                      Families Supported
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: isSmallDonation ? '#a16207' : '#1d4ed8', marginTop: '0.2rem' }}>
                      {supportedFamilies} / {remainingFamilies}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isSmallDonation ? '#854d0e' : '#2563eb', marginTop: '0.15rem' }}>
                      {isSmallDonation ? 'Partial funding' : 'Fully funded packages'}
                    </div>
                  </div>

                  {/* Card 4: Total Allocation */}
                  <div style={{ background: '#fdf2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                      Total Allocation
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#AF101A', marginTop: '0.2rem' }}>
                      ₱{allocationAmount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#991b1b', marginTop: '0.15rem' }}>
                      ₱{remainingCostAfter.toLocaleString()} remaining req
                    </div>
                  </div>
                </div>

                {/* Small Donation Notice (< 1 full family cost) */}
                {isSmallDonation && (
                  <div style={{ 
                    background: '#fefce8', 
                    border: '1px solid #fde047', 
                    borderRadius: '8px', 
                    padding: '0.75rem 0.9rem', 
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem'
                  }}>
                    <Info size={18} style={{ color: '#ca8a04', flexShrink: 0, marginTop: '0.1rem' }} />
                    <div style={{ fontSize: '0.8rem', color: '#713f12', lineHeight: 1.45 }}>
                      <strong>Partial Funding Notice:</strong> Available donation of <strong>₱{allocationAmount.toLocaleString()}</strong> is less than one complete family package (₱{costPerFamily.toLocaleString()}).
                      <div style={{ marginTop: '0.2rem' }}>
                        <strong>0 / {remainingFamilies} families</strong> are fully supported right now. The ₱{allocationAmount.toLocaleString()} will be recorded as partial funding toward this request (₱{allocationAmount.toLocaleString()} / ₱{remainingRequestCost.toLocaleString()} funded). Additional funds can be allocated later until the full requirement is reached.
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount allocation controller */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                      Allocation Amount:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>₱</span>
                      <input
                        type="number"
                        min="1"
                        max={maxAffordableAllocation}
                        step="1"
                        value={allocationAmount}
                        onChange={e => setCustomAllocationAmount(Number(e.target.value) || 0)}
                        style={{
                          width: '130px',
                          padding: '0.45rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: '#0f172a'
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => setCustomAllocationAmount(maxAffordableAllocation)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      Max Affordable (₱{maxAffordableAllocation.toLocaleString()})
                    </button>
                    {costPerFamily > 0 && availableDonation >= costPerFamily && (
                      <button
                        type="button"
                        onClick={() => setCustomAllocationAmount(costPerFamily)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        1 Family (₱{costPerFamily.toLocaleString()})
                      </button>
                    )}
                  </div>
                </div>

                {/* Remaining Summary After Allocation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#64748b', marginTop: '0.65rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                  <span>Remaining Donor Balance: <strong style={{ color: '#0f172a' }}>₱{remainingDonationBalance.toLocaleString()}</strong></span>
                  <span>Remaining Request Need: <strong style={{ color: '#0f172a' }}>₱{remainingCostAfter.toLocaleString()} ({remainingFamiliesAfter} families)</strong></span>
                </div>
              </div>
            )}

            {/* 4. COMPACT PROCURED ITEMS ITEMIZATION */}
            {selectedRequest && (
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px', 
                padding: '1.1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Package size={17} style={{ color: '#AF101A' }} />
                    <span>Procurement & Relief Items Plan ({items.length} items)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowItemization(!showItemization)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#AF101A',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showItemization ? 'Hide Item Details ▲' : 'View / Edit Items ▼'}
                  </button>
                </div>

                {/* Quick Summary Pill when collapsed */}
                {!showItemization && (
                  <div style={{ fontSize: '0.8rem', color: '#475569', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {items.map(it => `${it.quantity} ${it.unit} ${it.item}`).join(' • ') || 'Standard Relief Supplies'}
                  </div>
                )}

                {/* Expanded Itemization Table */}
                {showItemization && (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.6rem' }}>
                      {items.map((it) => (
                        <div 
                          key={it.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 80px 80px 100px 32px',
                            gap: '0.5rem',
                            alignItems: 'center',
                            background: '#f8fafc',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}
                        >
                          <input
                            type="text"
                            value={it.item}
                            onChange={e => handleItemChange(it.id, 'item', e.target.value)}
                            placeholder="Item name"
                            style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          />
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={e => handleItemChange(it.id, 'quantity', Number(e.target.value) || 1)}
                            placeholder="Qty"
                            style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          />
                          <input
                            type="text"
                            value={it.unit}
                            onChange={e => handleItemChange(it.id, 'unit', e.target.value)}
                            placeholder="Unit"
                            style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          />
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>
                            ₱{((Number(it.quantity) || 1) * (Number(it.unitCost) || 0)).toLocaleString()}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#AF101A',
                        background: '#fff1f2',
                        border: '1px solid #fecdd3',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Notes Section */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                Allocation Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add any internal allocation notes, donor restrictions, or supplier details…"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Modal Sticky Footer */}
          <div style={{
            padding: '1rem 1.4rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.65rem 1.15rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !selectedRequest || allocationAmount <= 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                border: 'none',
                background: (saving || !selectedRequest || allocationAmount <= 0) ? '#94a3b8' : '#AF101A',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: (saving || !selectedRequest || allocationAmount <= 0) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(175, 16, 26, 0.25)',
                transition: 'background 0.15s ease'
              }}
            >
              <CheckCircle2 size={18} />
              <span>
                {saving 
                  ? 'Processing…' 
                  : `Confirm & Allocate ₱${allocationAmount.toLocaleString()}`
                }
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
