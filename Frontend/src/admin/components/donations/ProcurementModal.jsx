import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Package, Users, MapPin, Send, AlertCircle, 
  Sparkles, Coins, ShoppingCart, CheckCircle2, ChevronRight,
  Info, AlertTriangle, ArrowRight, ShieldCheck, Filter
} from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import { donationsApi, beneficiariesApi, assistanceRequestsApi } from '../../../api/resources'
import { notify, confirmAction } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

const SUPPORT_PRESETS = [
  { amount: 200, label: '₱200 (Emergency Relief Pack)', desc: 'Standard emergency food & water rations per family' },
  { amount: 300, label: '₱300 (Hygiene & Sanitation)', desc: 'Full family hygiene, soap, disinfectant, toiletries' },
  { amount: 500, label: '₱500 (Comprehensive Food Pack)', desc: '5kg rice, 10 canned goods, noodles, drinking water' },
  { amount: 1000, label: '₱1,000 (Full Calamity Support)', desc: 'Substantial multi-week family food & emergency survival pack' },
]

export default function ProcurementModal({ 
  donation: initialDonation, 
  availableDonations = [], 
  beneficiaries = [], 
  assistanceRequests = [], 
  initialBeneficiaryId = '',
  initialRequestId = '',
  onClose, 
  onSuccess 
}) {
  const navigate = useNavigate()
  const { showLoading, hideLoading } = useLoading()
  const [saving, setSaving] = useState(false)

  // Donation selection (if multiple available)
  const [selectedDonationId, setSelectedDonationId] = useState(
    initialDonation?.dbId || initialDonation?.id || (availableDonations[0]?.dbId || availableDonations[0]?.id || '')
  )

  const [internalBeneficiaries, setInternalBeneficiaries] = useState(beneficiaries || [])
  const [internalRequests, setInternalRequests] = useState(assistanceRequests || [])

  // Auto-fetch fresh barangays and requests if empty or on mount
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

  // Active monetary donation
  const currentDonation = useMemo(() => {
    if (availableDonations && availableDonations.length > 0 && selectedDonationId) {
      const found = availableDonations.find(d => String(d.dbId || d.id) === String(selectedDonationId))
      if (found) return found
    }
    return initialDonation || availableDonations[0] || null
  }, [availableDonations, selectedDonationId, initialDonation])

  // Available unallocated cash balance
  const remainingBalance = useMemo(() => {
    if (!currentDonation) return 0
    if (typeof currentDonation.remainingBalance === 'number') {
      return Math.max(0, currentDonation.remainingBalance)
    }
    const rawTotal = typeof currentDonation.amountRaw === 'number' 
      ? currentDonation.amountRaw 
      : (parseFloat(String(currentDonation.amount || '0').replace(/[^0-9.]/g, '')) || 0)
    const totalUtilized = Number(currentDonation.totalUtilized || 0)
    return Math.max(0, rawTotal - totalUtilized)
  }, [currentDonation])

  // Allocation Configuration State
  const [targetBeneficiaryId, setTargetBeneficiaryId] = useState(initialBeneficiaryId ? String(initialBeneficiaryId) : '')
  const [targetRequestId, setTargetRequestId] = useState(initialRequestId ? String(initialRequestId) : '')
  const [supportAmountPerFamily, setSupportAmountPerFamily] = useState(200)
  const [notes, setNotes] = useState('')

  // -------------------------------------------------------------------------
  // 1. DYNAMIC BARANGAY FILTERING
  // - Hides barangays already allocated from the current donation
  // - Hides barangays that already have 100% fulfilled need
  // - Keeps only active/approved partner barangays with unfulfilled needs
  // -------------------------------------------------------------------------
  const { eligibleBeneficiaries, alreadyAllocatedCount, fullyFulfilledCount } = useMemo(() => {
    const list = internalBeneficiaries || []
    const allocatedBenIdsForThisDonation = new Set(
      (currentDonation?.procurements || [])
        .map(p => String(p.beneficiary_id || p.beneficiaryId))
        .filter(Boolean)
    )

    let allocCount = 0
    let fullCount = 0

    const filtered = list.filter(b => {
      const bId = String(b.dbId || b.id)

      // Always keep currently selected beneficiary in list so UI doesn't break
      if (targetBeneficiaryId && bId === String(targetBeneficiaryId)) {
        return true
      }

      // Check if already received an allocation from this specific donation
      if (allocatedBenIdsForThisDonation.has(bId)) {
        allocCount++
        return false
      }

      // Check if barangay has already received full allocation for its affected families
      const affFam = Number(b.affectedFamilies || b.affected_families || 0)
      const unfam = b.unfulfilledFamilies !== undefined && b.unfulfilledFamilies !== null
        ? Number(b.unfulfilledFamilies)
        : affFam
      const isFulfilled = b.isFullyFulfilled === true || (affFam > 0 && unfam <= 0)

      if (isFulfilled) {
        fullCount++
        return false
      }

      // Must be Active or Approved
      if (b.status && !['Active', 'Approved'].includes(b.status)) {
        return false
      }

      return true
    })

    return {
      eligibleBeneficiaries: filtered,
      alreadyAllocatedCount: allocCount,
      fullyFulfilledCount: fullCount
    }
  }, [internalBeneficiaries, currentDonation, targetBeneficiaryId])

  // Selected beneficiary object
  const selectedBeneficiary = useMemo(() => {
    if (!targetBeneficiaryId) return null
    return (internalBeneficiaries || []).find(b => 
      String(b.dbId) === String(targetBeneficiaryId) || 
      String(b.id) === String(targetBeneficiaryId) ||
      Number(b.dbId) === Number(targetBeneficiaryId)
    )
  }, [internalBeneficiaries, targetBeneficiaryId])

  // Filter requests for selected beneficiary
  const availableRequests = useMemo(() => {
    if (!targetBeneficiaryId) return []
    return (internalRequests || []).filter(r => 
      (String(r.beneficiaryId) === String(targetBeneficiaryId) || String(r.beneficiary_id) === String(targetBeneficiaryId)) && 
      r.status !== 'Completed' && r.status !== 'Rejected'
    )
  }, [internalRequests, targetBeneficiaryId])

  // Total affected & unfulfilled families for selected barangay
  const totalAffectedFamilies = useMemo(() => {
    if (!selectedBeneficiary) return 0
    return Number(selectedBeneficiary.affectedFamilies || selectedBeneficiary.affected_families || selectedBeneficiary.families || 0)
  }, [selectedBeneficiary])

  const targetUnfulfilledFamilies = useMemo(() => {
    if (!selectedBeneficiary) return 0
    if (selectedBeneficiary.unfulfilledFamilies !== undefined && selectedBeneficiary.unfulfilledFamilies !== null) {
      return Number(selectedBeneficiary.unfulfilledFamilies)
    }
    return totalAffectedFamilies
  }, [selectedBeneficiary, totalAffectedFamilies])

  // -------------------------------------------------------------------------
  // 2. BUDGET-AWARE FAMILY ALLOCATION CALCULATION
  // Formula:
  // Supported Families = floor(Available Funds ÷ Support Amount Per Family)
  // Suggested Allocation = min(Supported Families, Target Unfulfilled Families)
  // -------------------------------------------------------------------------
  const costPerFamily = Math.max(1, Number(supportAmountPerFamily) || 200)
  const maxAffordableFamilies = Math.max(0, Math.floor(remainingBalance / costPerFamily))

  const suggestedFamilies = useMemo(() => {
    if (!targetBeneficiaryId || targetUnfulfilledFamilies <= 0) {
      return maxAffordableFamilies
    }
    return Math.min(maxAffordableFamilies, targetUnfulfilledFamilies)
  }, [targetBeneficiaryId, maxAffordableFamilies, targetUnfulfilledFamilies])

  const plannedTotalCost = suggestedFamilies * costPerFamily
  const remainingFundsAfterAllocation = Math.max(0, remainingBalance - plannedTotalCost)
  const remainingUnassistedFamilies = Math.max(0, targetUnfulfilledFamilies - suggestedFamilies)
  const isInsufficient = targetUnfulfilledFamilies > 0 && suggestedFamilies < targetUnfulfilledFamilies
  const isFullCoverage = targetUnfulfilledFamilies > 0 && suggestedFamilies >= targetUnfulfilledFamilies

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!targetBeneficiaryId) {
      notify.error('Please select a target partner barangay.')
      return
    }

    if (suggestedFamilies <= 0) {
      notify.error(`Available balance (₱${remainingBalance.toLocaleString()}) is insufficient to support any families at ₱${costPerFamily.toLocaleString()} per family.`)
      return
    }

    if (plannedTotalCost > remainingBalance) {
      notify.error(`Planned allocation (₱${plannedTotalCost.toLocaleString()}) exceeds the available donation balance (₱${remainingBalance.toLocaleString()}).`)
      return
    }

    const targetBenName = selectedBeneficiary?.full_name || selectedBeneficiary?.name || selectedBeneficiary?.barangay || 'Barangay'

    const payload = {
      action: 'procure',
      donationId: currentDonation.dbId || currentDonation.id,
      mode: 'Budget-Based Family Assistance',
      totalAmount: plannedTotalCost,
      beneficiaryId: Number(targetBeneficiaryId),
      assistanceRequestId: targetRequestId ? Number(targetRequestId) : null,
      familiesSupported: suggestedFamilies,
      items: [
        {
          item: `Direct Family Relief Assistance (${suggestedFamilies} families @ ₱${costPerFamily}/family)`,
          quantity: suggestedFamilies,
          unit: 'families',
          unitCost: costPerFamily,
          totalCost: plannedTotalCost,
        }
      ],
      notes: notes.trim(),
    }

    setSaving(true)
    showLoading(`Allocating ₱${plannedTotalCost.toLocaleString()} for ${targetBenName}…`)
    try {
      const res = await donationsApi.procure(payload)
      hideLoading()
      setSaving(false)
      notify.success(res.message || `Successfully allocated ₱${plannedTotalCost.toLocaleString()} for ${targetBenName}!`)

      if (onSuccess) onSuccess(res?.data || res)
      onClose()

      const scheduleNow = await confirmAction({
        title: 'Allocation Confirmed',
        message: `Successfully allocated ₱${plannedTotalCost.toLocaleString()} to assist ${suggestedFamilies} / ${targetUnfulfilledFamilies} families in ${targetBenName}. Would you like to view scheduled deliveries in Logistics & Distribution now?`,
        confirmText: 'Go to Distributions →',
        cancelText: 'Done',
        type: 'primary',
      })

      if (scheduleNow) {
        navigate('/admin/distributions', {
          state: {
            prefillAllocation: {
              allocationId: res?.allocationId,
              beneficiaryId: targetBeneficiaryId,
              beneficiaryName: targetBenName,
              resourceName: `Family Assistance (${suggestedFamilies} families)`,
              quantity: suggestedFamilies,
              program: currentDonation.category || 'Monetary Relief',
              notes: `Funded from Donation ${currentDonation.trackingCode || ''}`,
            }
          }
        })
      }
    } catch (err) {
      hideLoading()
      setSaving(false)
      notify.error(err?.message || 'Failed to complete monetary allocation')
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
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Modal Header */}
        <div style={{ flexShrink: 0 }}>
          <ModalHeader 
            title="Monetary Fund Allocation & Family Distribution" 
            onClose={onClose} 
            style={{ margin: 0, position: 'static', borderRadius: '14px 14px 0 0' }}
          />

          {/* Top Fund Status Strip */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '1rem 1.4rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Monetary Donation Source
              </div>
              {availableDonations && availableDonations.length > 1 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <select
                    value={selectedDonationId}
                    onChange={e => setSelectedDonationId(e.target.value)}
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: '#0f172a'
                    }}
                  >
                    {availableDonations.map(d => (
                      <option key={d.dbId || d.id} value={d.dbId || d.id}>
                        {d.trackingCode} — {d.donor} (₱{Number(d.remainingBalance ?? d.amountRaw ?? 0).toLocaleString()} available)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                  {currentDonation?.donor} 
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#AF101A', marginLeft: '0.5rem' }}>
                    ({currentDonation?.trackingCode})
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Donated
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  ₱{Number(currentDonation?.amountRaw ?? currentDonation?.amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ 
                background: '#f0fdf4', 
                border: '1px solid #bbf7d0', 
                borderRadius: '8px', 
                padding: '0.45rem 0.85rem',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Available to Allocate
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>
                  ₱{remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>

            {/* Target Barangay Selector with Dynamic Filtering */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={16} style={{ color: '#AF101A' }} />
                  Target Partner Barangay (Beneficiary)
                  <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Showing {eligibleBeneficiaries.length} eligible barangays with unfulfilled needs
                </span>
              </div>

              <select
                value={targetBeneficiaryId}
                onChange={e => {
                  setTargetBeneficiaryId(e.target.value)
                  setTargetRequestId('')
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: '#0f172a',
                  background: '#fff'
                }}
                required
              >
                <option value="">-- Select Eligible Barangay --</option>
                {eligibleBeneficiaries.map(b => {
                  const totalAff = Number(b.affectedFamilies || b.affected_families || 0)
                  const unfulfilled = b.unfulfilledFamilies !== undefined && b.unfulfilledFamilies !== null
                    ? Number(b.unfulfilledFamilies)
                    : totalAff
                  const displayName = b.full_name || b.name || b.barangay || 'Barangay'
                  const muni = b.municipality || 'Cebu'

                  return (
                    <option key={b.dbId || b.id} value={b.dbId || b.id}>
                      {displayName} ({muni}) — {unfulfilled} families needing support ({totalAff} total affected)
                    </option>
                  )
                })}
              </select>

              {eligibleBeneficiaries.length === 0 && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  background: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#854d0e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Info size={16} style={{ color: '#ca8a04', flexShrink: 0 }} />
                  <span>
                    All registered partner barangays have either already received an allocation from this donation ({alreadyAllocatedCount}) or have already achieved 100% fulfilled family assistance ({fullyFulfilledCount}).
                  </span>
                </div>
              )}
            </div>

            {/* Assistance Cost Per Family Input & Quick Presets */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Coins size={16} style={{ color: '#AF101A' }} />
                  Assistance Support Amount Per Family (₱)
                  <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Configures the relief value or emergency cash support allocated per household
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748b', fontSize: '0.95rem' }}>
                      ₱
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={supportAmountPerFamily}
                      onChange={e => setSupportAmountPerFamily(Math.max(1, Number(e.target.value) || 1))}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem 0.6rem 1.65rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#0f172a'
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Preset Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {SUPPORT_PRESETS.map(preset => (
                    <button
                      key={preset.amount}
                      type="button"
                      onClick={() => setSupportAmountPerFamily(preset.amount)}
                      style={{
                        padding: '0.4rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: Number(supportAmountPerFamily) === preset.amount ? '1px solid #AF101A' : '1px solid #cbd5e1',
                        background: Number(supportAmountPerFamily) === preset.amount ? '#fee2e2' : '#ffffff',
                        color: Number(supportAmountPerFamily) === preset.amount ? '#991b1b' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title={preset.desc}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Link to Relief Request (Optional) */}
            {availableRequests.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Link to Open Relief Request (Optional)
                </label>
                <select
                  value={targetRequestId}
                  onChange={e => setTargetRequestId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                >
                  <option value="">-- General Barangay Allocation --</option>
                  {availableRequests.map(r => (
                    <option key={r.dbId || r.id} value={r.dbId || r.id}>
                      {r.id || r.reference_code} — {r.type || 'Relief'} ({r.priority || 'Medium'} priority)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* 3. CLEAN ALLOCATION SUMMARY CARD                                */}
            {/* --------------------------------------------------------------- */}
            <div style={{
              background: '#ffffff',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.15rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
                Allocation Plan & Impact Summary
              </div>

              {/* 4 Metrics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Available Funds
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
                    ₱{remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Support Per Family
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#AF101A', marginTop: '0.15rem' }}>
                    ₱{costPerFamily.toLocaleString('en-PH')}
                  </div>
                </div>

                <div style={{ 
                  background: isFullCoverage ? '#f0fdf4' : (isInsufficient ? '#fffbeb' : '#f8fafc'), 
                  border: `1px solid ${isFullCoverage ? '#86efac' : (isInsufficient ? '#fde68a' : '#e2e8f0')}`, 
                  borderRadius: '8px', 
                  padding: '0.75rem 0.85rem' 
                }}>
                  <div style={{ fontSize: '0.72rem', color: isFullCoverage ? '#166534' : (isInsufficient ? '#92400e' : '#64748b'), fontWeight: 600, textTransform: 'uppercase' }}>
                    Suggested Families
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isFullCoverage ? '#15803d' : (isInsufficient ? '#b45309' : '#0f172a'), marginTop: '0.15rem' }}>
                    {selectedBeneficiary ? (
                      `${suggestedFamilies} / ${targetUnfulfilledFamilies}`
                    ) : (
                      `${maxAffordableFamilies} max`
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    {selectedBeneficiary ? 'families supported' : 'affordable with budget'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Remaining Funds
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: remainingFundsAfterAllocation === 0 ? '#059669' : '#0f172a', marginTop: '0.15rem' }}>
                    ₱{remainingFundsAfterAllocation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Status Notice Callout */}
              {selectedBeneficiary && (
                isInsufficient ? (
                  <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: '8px',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem'
                  }}>
                    <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                    <div style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.4 }}>
                      <strong>Donation insufficient to cover all families:</strong>{' '}
                      {suggestedFamilies} of {targetUnfulfilledFamilies} families will be supported.{' '}
                      <strong>{remainingUnassistedFamilies} families remaining</strong> without assistance.{' '}
                      <span style={{ color: '#b45309' }}>
                        (An additional ₱{(remainingUnassistedFamilies * costPerFamily).toLocaleString('en-PH')} is required to cover all {targetUnfulfilledFamilies} families).
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem'
                  }}>
                    <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <div style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.4 }}>
                      <strong>Full Need Covered:</strong> 100% of affected families ({suggestedFamilies} / {targetUnfulfilledFamilies}) in {selectedBeneficiary?.full_name || selectedBeneficiary?.barangay} will receive relief assistance!
                    </div>
                  </div>
                )
              )}

              {/* Guard: If balance is zero or less than 1 family cost */}
              {remainingBalance < costPerFamily && (
                <div style={{
                  marginTop: '0.75rem',
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  padding: '0.75rem 0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem'
                }}>
                  <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.82rem', color: '#991b1b' }}>
                    <strong>Insufficient balance:</strong> The available donation balance (₱{remainingBalance.toLocaleString('en-PH')}) is less than the assistance cost per family (₱{costPerFamily.toLocaleString('en-PH')}). Please adjust the support amount or select another donation.
                  </div>
                </div>
              )}
            </div>

            {/* Optional Allocation Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Allocation & Delivery Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Prioritizing low-lying coastal zone households in evacuation center..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
              />
            </div>

          </div>

          {/* Modal Footer */}
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
              disabled={
                saving || 
                !targetBeneficiaryId || 
                suggestedFamilies <= 0 || 
                plannedTotalCost <= 0 || 
                plannedTotalCost > remainingBalance
              }
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
              <span>
                {suggestedFamilies > 0 
                  ? `Confirm Allocation: ₱${plannedTotalCost.toLocaleString('en-PH')} (${suggestedFamilies} Families)`
                  : 'Select Target Barangay'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
