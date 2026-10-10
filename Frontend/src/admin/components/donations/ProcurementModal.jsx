import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MapPin, Coins, Package } from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import { donationsApi, assistanceRequestsApi } from '../../../api/resources'
import { notify, confirmAction } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

function buildCompletePlan(remainingItems) {
  return (Array.isArray(remainingItems) ? remainingItems : [])
    .map((item, index) => {
      const remainingQuantity = Math.max(0, Math.trunc(Number(item.remainingQuantity ?? item.quantity) || 0))
      const unitCost = Math.max(0, Math.round((Number(item.unitCost) || 0) * 100) / 100)
      return {
        id: `${String(item.item || 'item').toLowerCase()}-${String(item.unit || 'units').toLowerCase()}-${index}`,
        item: item.item,
        quantity: remainingQuantity,
        remainingQuantity,
        unit: item.unit || 'units',
        unitCost,
        totalCost: Math.round(remainingQuantity * unitCost * 100) / 100,
      }
    })
    .filter(item => item.item && item.remainingQuantity > 0)
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
  const [plansByRequest, setPlansByRequest] = useState({})
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

  const selectedRequestKey = String(selectedRequest?.dbId || selectedRequest?.id || '')
  const defaultPlan = useMemo(() => buildCompletePlan(selectedRequest?.remainingItems), [selectedRequest])
  const plannedItems = plansByRequest[selectedRequestKey] || defaultPlan
  const allocationAmount = useMemo(
    () => Math.round(plannedItems.reduce((total, item) => total + Math.round(item.quantity * item.unitCost * 100), 0)) / 100,
    [plannedItems]
  )
  const remainingDonationBalance = Math.max(0, availableDonation - allocationAmount)
  const remainingFamilies = Number(selectedRequest?.familiesStillNeedingSupport ?? selectedRequest?.remainingFamilies ?? 0)
  const isFullyCovered = Boolean(
    plannedItems.length > 0 &&
    defaultPlan.length > 0 &&
    defaultPlan.every(requiredItem => {
      const planned = plannedItems.find(item => item.id === requiredItem.id)
      return planned && Number(planned.quantity) >= Number(requiredItem.remainingQuantity)
    })
  )
  const hasValidPrices = plannedItems.every(item => Number(item.unitCost) > 0)
  const coverageRatio = defaultPlan.length
    ? Math.min(...defaultPlan.map(requiredItem => {
        const planned = plannedItems.find(item => item.id === requiredItem.id)
        return Math.min(1, Math.max(0, Number(planned?.quantity || 0)) / requiredItem.remainingQuantity)
      }))
    : 0
  const familiesCoveredByAllocation = Math.min(remainingFamilies, Math.floor((remainingFamilies * coverageRatio) + 0.00001))
  const hasEnoughBalance = allocationAmount > 0 && allocationAmount <= availableDonation + 0.009
  const canAllocate = Boolean(
    !saving && !loadingEligible && !loadingDonation && !loadError &&
    selectedBarangayId && selectedRequest && plannedItems.length > 0 &&
    Number.isFinite(allocationAmount) && hasValidPrices && hasEnoughBalance && isFullyCovered &&
    remainingFamilies > 0 && familiesCoveredByAllocation >= remainingFamilies
  )

  const handlePlanChange = (itemId, field, rawValue) => {
    setPlansByRequest(previous => {
      const currentPlan = previous[selectedRequestKey] || defaultPlan
      const nextPlan = currentPlan.map(item => {
        if (item.id !== itemId) return item
        const numericValue = Number(rawValue)
        const value = field === 'quantity'
          ? Math.min(item.remainingQuantity, Math.max(0, Math.trunc(Number.isFinite(numericValue) ? numericValue : 0)))
          : Math.max(0, Number.isFinite(numericValue) ? numericValue : 0)
        const updated = { ...item, [field]: value }
        updated.totalCost = Math.round(updated.quantity * updated.unitCost * 100) / 100
        return updated
      })
      return { ...previous, [selectedRequestKey]: nextPlan }
    })
  }

  const resetCompletePlan = () => {
    setPlansByRequest(previous => ({ ...previous, [selectedRequestKey]: defaultPlan }))
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (!canAllocate) {
      const message = loadError || (!isFullyCovered
        ? 'This relief request still has families that are not fully covered. Complete every remaining item quantity before proceeding to distribution.'
        : !hasEnoughBalance
          ? `The complete allocation requires ${money(allocationAmount)}, but only ${money(availableDonation)} is available.`
          : 'Complete the allocation details before confirming.')
      await notify.error({
        title: !isFullyCovered ? 'Funding Requirement Not Met' : 'Allocation Incomplete',
        message,
        confirmText: 'OK',
      })
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
      await notify.success({
        title: 'Allocation Successful',
        message: 'All remaining families are fully covered and the request is ready for the next workflow stage.',
        confirmText: 'Continue',
      })

      const allocationId = response?.allocationId
      const beneficiaryName = selectedBarangay?.barangay || selectedBarangay?.name || 'Barangay'
      const fundedItems = response?.allocationItems || plannedItems
      const familiesFunded = Number(response?.familiesSupported || 0)

      if (onSuccess) onSuccess(response?.data || response)
      onClose()

      if (response?.requestStatus === 'Allocated' && allocationId) {
        const scheduleNow = await confirmAction({
          title: 'Distribution Ready',
          message: `${response.message} Schedule logistics delivery for ${beneficiaryName} now?`,
          confirmText: 'Schedule Distribution →',
          cancelText: 'View in Allocations',
          type: 'success',
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
      const rawMessage = error?.message || 'The allocation could not be completed.'
      const fundingBlocked = /not fully covered|funding requirement|remaining families|remaining item|complete the allocation/i.test(rawMessage)
      const balanceBlocked = /balance|exceed|amount/i.test(rawMessage)
      await notify.error({
        title: fundingBlocked ? 'Funding Requirement Not Met' : (balanceBlocked ? 'Allocation Incomplete' : 'Allocation Could Not Be Completed'),
        message: fundingBlocked
          ? 'This relief request still has families that are not fully covered. Complete the allocation before proceeding to distribution.'
          : rawMessage,
        confirmText: 'OK',
      })
      setPlansByRequest({})
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
          maxWidth: '900px',
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
                    <div className={isFullyCovered ? 'fund-allocation-family-covered' : 'fund-allocation-family-pending'}>
                      <span>Families covered by this allocation</span>
                      <strong>{familiesCoveredByAllocation.toLocaleString()}</strong>
                    </div>
                  </div>
                </section>

                <section className="fund-allocation-section">
                  <div className="fund-allocation-section-title">
                    <div>
                      <h3><Coins size={17} /> Allocation plan</h3>
                      <p>Adjust quantities and unit prices. Every remaining item must be covered.</p>
                    </div>
                    <button type="button" className="fund-allocation-reset" onClick={resetCompletePlan}>Reset full plan</button>
                  </div>
                  {plannedItems.length ? (
                    <>
                      <div className="fund-allocation-plan-table" role="table" aria-label="Allocation plan">
                        <div className="fund-allocation-plan-row fund-allocation-plan-row--head" role="row">
                          <span role="columnheader">Requested item</span>
                          <span role="columnheader">Remaining need</span>
                          <span role="columnheader">Allocate quantity</span>
                          <span role="columnheader">Unit price</span>
                          <span role="columnheader">Item total</span>
                        </div>
                        {plannedItems.map(item => (
                          <div className="fund-allocation-plan-row" role="row" key={item.id}>
                            <span role="cell"><strong>{item.item}</strong><small>{item.unit}</small></span>
                            <span role="cell">{item.remainingQuantity.toLocaleString()} {item.unit}</span>
                            <span role="cell">
                              <input
                                type="number"
                                min="0"
                                max={item.remainingQuantity}
                                step="1"
                                value={item.quantity}
                                onChange={event => handlePlanChange(item.id, 'quantity', event.target.value)}
                                aria-label={`Quantity to allocate for ${item.item}`}
                              />
                            </span>
                            <span role="cell" className="fund-allocation-price-input">
                              <span aria-hidden="true">₱</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.unitCost}
                                onChange={event => handlePlanChange(item.id, 'unitCost', event.target.value)}
                                aria-label={`Unit price for ${item.item}`}
                              />
                            </span>
                            <strong role="cell">{formatMoney(item.totalCost)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="fund-allocation-plan-summary">
                        <div title="Automatically updated from the quantities and unit prices above"><span>Total amount to allocate</span><strong>{formatMoney(allocationAmount)}</strong></div>
                        <div><span>Remaining donor balance</span><strong>{formatMoney(remainingDonationBalance)}</strong></div>
                      </div>
                      <div className={`fund-allocation-coverage-note ${canAllocate ? 'fund-allocation-coverage-note--ready' : 'fund-allocation-coverage-note--blocked'}`} role="status">
                        {canAllocate
                          ? 'All remaining families are fully covered. This allocation is ready to confirm.'
                          : !isFullyCovered
                            ? `${Math.max(0, remainingFamilies - familiesCoveredByAllocation).toLocaleString()} families still need complete item coverage.`
                            : `Available balance is short by ${formatMoney(Math.max(0, allocationAmount - availableDonation))}.`}
                      </div>
                    </>
                  ) : (
                    <p className="fund-allocation-inline-message">
                      {availableDonation <= 0
                        ? 'This donation has no available balance.'
                        : 'This request has no priced remaining items to allocate.'}
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
            <button
              type="submit"
              disabled={!canAllocate}
              className="fund-allocation-confirm"
              title={!canAllocate ? 'All remaining families must be fully covered within the available balance.' : 'Confirm the complete allocation'}
            >
              <CheckCircle2 size={18} />
              {saving ? 'Processing…' : `Confirm & Allocate ${formatMoney(allocationAmount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
