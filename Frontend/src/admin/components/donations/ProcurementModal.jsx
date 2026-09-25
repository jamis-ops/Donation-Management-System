import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MapPin, Coins, Package } from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import { donationsApi, assistanceRequestsApi } from '../../../api/resources'
import { notify, confirmAction } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

function suggestBudgetAwarePlan(remainingItems, availableBalance) {
  const items = (Array.isArray(remainingItems) ? remainingItems : [])
    .map(item => ({
      ...item,
      quantity: Math.max(0, Math.trunc(Number(item.remainingQuantity ?? item.quantity) || 0)),
      unitCents: Math.max(0, Math.round((Number(item.unitCost) || 0) * 100)),
    }))
    .filter(item => item.item && item.quantity > 0 && item.unitCents > 0)
  let budgetCents = Math.max(0, Math.floor((Number(availableBalance) + 0.000001) * 100))
  const totalCostAtRatio = ratio => items.reduce((total, item) => {
    return total + Math.floor((item.quantity * ratio) / 1000000) * item.unitCents
  }, 0)

  let low = 0
  let high = 1000000
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (totalCostAtRatio(middle) <= budgetCents) low = middle
    else high = middle - 1
  }

  const plan = items.map(item => ({
    ...item,
    quantity: Math.floor((item.quantity * low) / 1000000),
  }))
  budgetCents -= plan.reduce((total, item) => total + item.quantity * item.unitCents, 0)

  // Spend any leftover budget on additional requested units, cheapest first.
  const originalByKey = new Map(items.map(item => [`${item.item.toLowerCase()}\u0000${String(item.unit).toLowerCase()}`, item]))
  for (const item of [...plan].sort((a, b) => a.unitCents - b.unitCents)) {
    const key = `${item.item.toLowerCase()}\u0000${String(item.unit).toLowerCase()}`
    const original = originalByKey.get(key)
    if (!original || budgetCents < item.unitCents) continue
    const extra = Math.min(original.quantity - item.quantity, Math.floor(budgetCents / item.unitCents))
    item.quantity += extra
    budgetCents -= extra * item.unitCents
  }

  return plan
    .filter(item => item.quantity > 0)
    .map(item => ({
      item: item.item,
      quantity: item.quantity,
      unit: item.unit || 'units',
      unitCost: item.unitCents / 100,
      totalCost: item.quantity * item.unitCents / 100,
    }))
}

const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ProcurementModal({
  donation,
  initialBeneficiaryId = '',
  initialRequestId = '',
  onClose,
  onSuccess,
}) {
  const navigate = useNavigate()
  const { showLoading, hideLoading } = useLoading()

  const [loadingEligible, setLoadingEligible] = useState(true)
  const [loadingDonation, setLoadingDonation] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [eligibleBarangays, setEligibleBarangays] = useState([])
  const [eligibleRequests, setEligibleRequests] = useState([])
  const [currentDonation, setCurrentDonation] = useState(donation)
  const [selectedBarangayId, setSelectedBarangayId] = useState(initialBeneficiaryId ? String(initialBeneficiaryId) : '')
  const [selectedRequestId, setSelectedRequestId] = useState(initialRequestId ? String(initialRequestId) : '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const loadFundingData = useCallback(async () => {
    const donationId = donation?.dbId || donation?.id
    const [requestsResult, donationResult] = await Promise.allSettled([
      assistanceRequestsApi.listFundingEligible(),
      donationId ? donationsApi.get(donationId) : Promise.reject(new Error('Donation record is unavailable.')),
    ])

    if (requestsResult.status === 'fulfilled') {
      setLoadError('')
      const barangays = requestsResult.value?.data?.eligibleBarangays || []
      const requests = requestsResult.value?.data?.eligibleRequests || []
      setEligibleBarangays(barangays)
      setEligibleRequests(requests)
      setSelectedBarangayId(current => {
        if (initialBeneficiaryId && barangays.some(b => String(b.id || b.dbId) === String(initialBeneficiaryId))) {
          return String(initialBeneficiaryId)
        }
        if (current && barangays.some(b => String(b.id || b.dbId) === String(current))) return current
        return !current && barangays.length === 1 ? String(barangays[0].id || barangays[0].dbId) : ''
      })
      setSelectedRequestId(current => {
        if (initialRequestId && requests.some(r => String(r.dbId || r.id) === String(initialRequestId))) {
          return String(initialRequestId)
        }
        return requests.some(r => String(r.dbId || r.id) === String(current)) ? current : ''
      })
    } else {
      setEligibleBarangays([])
      setEligibleRequests([])
      setLoadError('Could not load eligible relief requests. Refresh and try again.')
    }

    if (donationResult.status === 'fulfilled') {
      setCurrentDonation(donationResult.value?.data || donation)
    } else {
      setCurrentDonation(donation)
      setLoadError(current => current || 'Could not refresh this donation balance. Refresh and try again.')
    }

    setLoadingEligible(false)
    setLoadingDonation(false)
  }, [donation, initialBeneficiaryId, initialRequestId])

  useEffect(() => {
    Promise.resolve().then(loadFundingData)
  }, [loadFundingData])

  const availableDonation = useMemo(() => {
    const amount = Number(currentDonation?.remainingBalance ?? currentDonation?.amountRaw ?? currentDonation?.amount ?? 0)
    return Number.isFinite(amount) ? Math.max(0, amount) : 0
  }, [currentDonation])

  const availableRequestsForBarangay = useMemo(() => {
    if (!selectedBarangayId) return []
    return eligibleRequests.filter(request => String(request.beneficiaryId) === String(selectedBarangayId))
  }, [eligibleRequests, selectedBarangayId])

  const selectedRequest = useMemo(() => {
    const selected = selectedRequestId && availableRequestsForBarangay.find(request => (
      String(request.dbId) === String(selectedRequestId) || String(request.id) === String(selectedRequestId)
    ))
    return selected || availableRequestsForBarangay[0] || null
  }, [availableRequestsForBarangay, selectedRequestId])

  const selectedBarangay = useMemo(() => {
    if (!selectedBarangayId) return null
    return eligibleBarangays.find(barangay => String(barangay.id || barangay.dbId) === String(selectedBarangayId)) || null
  }, [eligibleBarangays, selectedBarangayId])

  const plannedItems = useMemo(
    () => suggestBudgetAwarePlan(selectedRequest?.remainingItems, availableDonation),
    [selectedRequest, availableDonation]
  )
  const allocationAmount = useMemo(
    () => Math.round(plannedItems.reduce((total, item) => total + Math.round(item.quantity * item.unitCost * 100), 0)) / 100,
    [plannedItems]
  )
  const remainingDonationBalance = Math.max(0, availableDonation - allocationAmount)
  const canAllocate = Boolean(
    !saving && !loadingEligible && !loadingDonation && !loadError &&
    selectedBarangayId && selectedRequest && plannedItems.length > 0 &&
    Number.isFinite(allocationAmount) && allocationAmount > 0 && allocationAmount <= availableDonation
  )

  const handleSubmit = async event => {
    event.preventDefault()
    if (!canAllocate) {
      notify.error(loadError || 'No eligible requested items fit within this donation balance.')
      return
    }

    const payload = {
      action: 'procure',
      donationId: currentDonation.dbId || currentDonation.id,
      mode: 'Relief Allocation',
      totalAmount: allocationAmount,
      beneficiaryId: Number(selectedBarangayId),
      assistanceRequestId: Number(selectedRequest.dbId || selectedRequest.id),
      affectedFamilies: Number(selectedRequest.affectedFamilies || 0),
      items: plannedItems,
      receiptNumber: '',
      supplierName: '',
      notes: notes.trim(),
    }

    setSaving(true)
    showLoading('Allocating requested relief items…')
    try {
      const response = await donationsApi.procure(payload)
      hideLoading()
      setSaving(false)
      notify.success(response.message || 'Donation successfully allocated!')

      const allocationId = response?.allocationId
      const beneficiaryName = selectedBarangay?.barangay || selectedBarangay?.name || 'Barangay'
      const fundedItems = response?.allocationItems || plannedItems
      const familiesFunded = Number(response?.familiesSupported || 0)

      if (onSuccess) onSuccess(response?.data || response)
      onClose()

      if (response?.requestStatus === 'Allocated' && allocationId) {
        const scheduleNow = await confirmAction({
          title: 'Funding Complete',
          message: `${response.message} Schedule logistics delivery for ${beneficiaryName} now?`,
          confirmText: 'Schedule Distribution →',
          cancelText: 'View in Allocations',
          type: 'primary',
        })

        if (scheduleNow) {
          navigate('/admin/distributions', {
            state: {
              prefillAllocation: {
                allocationId,
                beneficiaryId: selectedBarangayId,
                beneficiaryName,
                resourceName: fundedItems.map(item => `${item.item} (${item.quantity} ${item.unit})`).join(', '),
                quantity: fundedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
                affectedFamilies: familiesFunded,
                program: currentDonation.category || 'Disaster Relief',
                notes: `Funded from Monetary Donation ${currentDonation.trackingCode || currentDonation.code || ''}`,
              },
            },
          })
        } else {
          navigate('/admin/allocation')
        }
      }
    } catch (error) {
      hideLoading()
      setSaving(false)
      notify.error(error?.message || 'Failed to allocate donation')
      await loadFundingData()
    }
  }

  const formatMoney = value => money(value)

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal admin-modal--wide fund-allocation-modal"
        onClick={event => event.stopPropagation()}
        style={{
          maxWidth: '980px',
          width: '95vw',
          maxHeight: '92vh',
          borderRadius: '16px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
              borderRadius: '16px 16px 0 0',
              background: '#AF101A',
              color: '#ffffff',
            }}
          />

          <div className="fund-allocation-donor-summary">
            <div className="fund-allocation-donor">
              <span>Monetary donor</span>
              <strong>{currentDonation?.donor || currentDonation?.donor_name || 'Anonymous Donor'}</strong>
              <small>{currentDonation?.trackingCode || currentDonation?.code || 'DON-ID'}</small>
            </div>
            <div className="fund-allocation-totals">
              <div><span>Total donated</span><strong>{formatMoney(currentDonation?.amountRaw ?? currentDonation?.amount)}</strong></div>
              <div className="fund-allocation-available"><span>Available to allocate</span><strong>{formatMoney(availableDonation)}</strong></div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="fund-allocation-form">
          <div className="fund-allocation-body">
            <section className="fund-allocation-section">
              <h3><MapPin size={17} /> Target barangay and eligible relief request</h3>
              <div className="fund-allocation-selection-grid">
                <label>
                  Target Barangay <span aria-hidden="true">*</span>
                  <select
                    value={selectedBarangayId}
                    onChange={event => setSelectedBarangayId(event.target.value)}
                    disabled={loadingEligible || eligibleBarangays.length === 0}
                    required
                  >
                    <option value="">-- Select Target Barangay --</option>
                    {eligibleBarangays.map(barangay => (
                      <option key={barangay.id || barangay.dbId} value={barangay.id || barangay.dbId}>
                        {barangay.barangay || barangay.name} ({barangay.municipality || 'Cebu'})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Eligible Relief Request <span aria-hidden="true">*</span>
                  <select
                    value={selectedRequest ? String(selectedRequest.dbId || selectedRequest.id) : ''}
                    onChange={event => setSelectedRequestId(event.target.value)}
                    disabled={loadingEligible || !selectedBarangayId || availableRequestsForBarangay.length === 0}
                    required
                  >
                    {!availableRequestsForBarangay.length && <option value="">No eligible requests for this barangay</option>}
                    {availableRequestsForBarangay.map(request => (
                      <option key={request.dbId || request.id} value={request.dbId || request.id}>
                        {request.calamity || request.assistanceType} — {request.referenceCode}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {loadingEligible && <p className="fund-allocation-inline-message">Loading eligible requests…</p>}
              {!loadingEligible && !eligibleRequests.length && !loadError && (
                <p className="fund-allocation-inline-message">No eligible, unfulfilled relief requests are available for funding.</p>
              )}
              {loadError && <p className="fund-allocation-error" role="alert">{loadError}</p>}
            </section>

            {selectedRequest && (
              <>
                <section className="fund-allocation-section fund-allocation-request-details">
                  <div className="fund-allocation-section-title">
                    <div>
                      <h3><Package size={17} /> Selected request details</h3>
                      <p>{selectedRequest.calamity || selectedRequest.assistanceType} · {selectedRequest.assistanceType}</p>
                    </div>
                    <span className="fund-allocation-request-id">Request ID: {selectedRequest.referenceCode}</span>
                  </div>

                  <div className="fund-allocation-family-summary">
                    <div><span>Affected families</span><strong>{Number(selectedRequest.affectedFamilies || 0).toLocaleString()}</strong></div>
                    <div><span>Already covered</span><strong>{Number(selectedRequest.familiesAlreadyCovered || 0).toLocaleString()}</strong></div>
                    <div><span>Still needing support</span><strong>{Number(selectedRequest.familiesStillNeedingSupport ?? selectedRequest.remainingFamilies ?? 0).toLocaleString()}</strong></div>
                  </div>

                  <div className="fund-allocation-needs-wrap">
                    <h4>Requested relief needs and remaining quantities</h4>
                    {selectedRequest.requestedItems?.length ? (
                      <div className="fund-allocation-needs-table" role="table" aria-label="Requested relief needs">
                        <div className="fund-allocation-needs-row fund-allocation-needs-row--head" role="row">
                          <span role="columnheader">Requested item</span>
                          <span role="columnheader">Requested</span>
                          <span role="columnheader">Allocated</span>
                          <span role="columnheader">Remaining</span>
                          <span role="columnheader">Unit price</span>
                        </div>
                        {selectedRequest.requestedItems.map((item, index) => (
                          <div className="fund-allocation-needs-row" role="row" key={`${item.item}-${item.unit}-${index}`}>
                            <span role="cell">{item.item}</span>
                            <span role="cell">{Number(item.requestedQuantity ?? item.quantity).toLocaleString()} {item.unit}</span>
                            <span role="cell">{Number(item.allocatedQuantity || 0).toLocaleString()} {item.unit}</span>
                            <span role="cell">{Number(item.remainingQuantity || 0).toLocaleString()} {item.unit}</span>
                            <span role="cell">{formatMoney(item.unitCost)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="fund-allocation-inline-message">This request has no priced relief-item details and cannot be funded yet.</p>
                    )}
                  </div>
                </section>

                <section className="fund-allocation-section">
                  <h3><Coins size={17} /> Suggested allocation and procurement plan</h3>
                  {plannedItems.length ? (
                    <>
                      <div className="fund-allocation-plan-table" role="table" aria-label="Suggested procurement plan">
                        <div className="fund-allocation-plan-row fund-allocation-plan-row--head" role="row">
                          <span role="columnheader">Requested item</span>
                          <span role="columnheader">Suggested quantity</span>
                          <span role="columnheader">Unit price</span>
                          <span role="columnheader">Item total</span>
                        </div>
                        {plannedItems.map((item, index) => (
                          <div className="fund-allocation-plan-row" role="row" key={`${item.item}-${item.unit}-${index}`}>
                            <span role="cell">{item.item}</span>
                            <span role="cell">{item.quantity.toLocaleString()} {item.unit}</span>
                            <span role="cell">{formatMoney(item.unitCost)}</span>
                            <strong role="cell">{formatMoney(item.totalCost)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="fund-allocation-plan-summary">
                        <div><span>Allocation amount</span><strong>{formatMoney(allocationAmount)}</strong></div>
                        <div><span>Remaining donor balance</span><strong>{formatMoney(remainingDonationBalance)}</strong></div>
                      </div>
                      {allocationAmount < Number(selectedRequest.remainingCost || 0) && (
                        <p className="fund-allocation-inline-message">The suggested quantities use the available budget without exceeding remaining requested needs.</p>
                      )}
                    </>
                  ) : (
                    <p className="fund-allocation-inline-message">
                      {availableDonation <= 0
                        ? 'This donation has no available balance.'
                        : 'No remaining requested item quantity fits within the available donation balance.'}
                    </p>
                  )}
                </section>
              </>
            )}

            <label className="fund-allocation-notes">
              Allocation Notes (Optional)
              <textarea
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Add internal allocation notes or supplier details…"
                rows={2}
              />
            </label>
          </div>

          <div className="fund-allocation-footer">
            <button type="button" onClick={onClose} className="fund-allocation-cancel">Cancel</button>
            <button type="submit" disabled={!canAllocate} className="fund-allocation-confirm">
              <CheckCircle2 size={18} />
              {saving ? 'Processing…' : `Confirm & Allocate ${formatMoney(allocationAmount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
