import { useState } from 'react'
import { FileCheck, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react'
import ModalHeader from '../../admin/components/shared/ModalHeader'
import BarangayNeedsAnalyzer from './BarangayNeedsAnalyzer'
import PackContentBuilder from './PackContentBuilder'
import RepackingSummaryCard from './RepackingSummaryCard'
import StatusBadge from '../../admin/components/shared/StatusBadge'
import { notify } from '../../utils/toast'
import { useLoading } from '../../context/LoadingContext'

const STEPS = ['barangay', 'builder', 'summary', 'confirmation']
const STEP_TITLES = {
  barangay: 'Step 1: Target Barangay',
  builder: 'Step 2: Pack Builder',
  summary: 'Step 3: Review & Confirm',
  confirmation: 'Batch Created',
}

const STEP_SUBTITLES = {
  barangay: 'Select target barangay and analyze relief needs against warehouse inventory',
  builder: 'Configure relief pack details and select items from available stock',
  summary: 'Review inventory deductions, assign team members, and confirm scheduling',
  confirmation: 'Batch successfully scheduled in the repacking system',
}

export default function MultiSourceRepackingModal({
  onClose,
  onSubmit,
  items,
  beneficiaries,
  staff,
  volunteers,
  loadingTeam,
}) {
  const [currentStep, setCurrentStep] = useState('barangay')
  const { showLoading, hideLoading } = useLoading()
  const [loading, setLoading] = useState(false)

  // Barangay analysis data
  const [selectedBarangay, setSelectedBarangay] = useState(null)
  const [analysisData, setAnalysisData] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)

  // Pack builder data
  const [selectedSources, setSelectedSources] = useState([]) // [{itemId, itemName, quantity, unit, available}]
  const [packName, setPackName] = useState('')
  const [packQuantity, setPackQuantity] = useState('')
  const [packUnit, setPackUnit] = useState('packs')

  // Assignment data
  const [assignedType, setAssignedType] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  // Created batch
  const [createdBatch, setCreatedBatch] = useState(null)

  // Validation rules
  const canProceedFromBarangay = Boolean(selectedBarangay) && !loadingAnalysis

  const packQtyNum = parseInt(packQuantity, 10) || 0
  const sourcesValid = selectedSources.length > 0 && selectedSources.every((s) => {
    const q = Number(s.quantity)
    return q > 0 && q <= s.available
  })

  const canProceedFromBuilder = packName.trim() !== '' && packQtyNum > 0 && sourcesValid

  const isAssignmentValid = () => {
    if (!assignedType) return true
    if (assignedType === 'staff' || assignedType === 'volunteer' || assignedType === 'custom') {
      return Boolean(assignedTo && String(assignedTo).trim().length > 0)
    }
    return true
  }

  const canSubmit = canProceedFromBuilder && isAssignmentValid()

  const handleBarangaySelect = (barangay) => {
    setSelectedBarangay(barangay)
    if (barangay) {
      setPackName(`${barangay.name || barangay.barangay} Relief Pack`)
      if (barangay.affectedFamilies) {
        setPackQuantity(String(barangay.affectedFamilies))
      }
    } else {
      setPackName('')
      setPackQuantity('')
    }
  }

  const handleAnalysisData = (data) => {
    setAnalysisData(data)
    if (data?.analysis?.targetFamilies) {
      setPackQuantity(String(data.analysis.targetFamilies))
    }
    if (selectedBarangay && data?.suggestedContents?.length > 0) {
      const topItems = data.suggestedContents
        .slice(0, 3)
        .map((c) => c.item.split(' ')[0])
        .join(' + ')
      setPackName(`${selectedBarangay.name || selectedBarangay.barangay} Relief Pack (${topItems})`)
    }
  }

  const handleStepClick = (step) => {
    if (step === 'confirmation') return
    const targetIndex = STEPS.indexOf(step)
    const currentIndex = STEPS.indexOf(currentStep)
    if (targetIndex === currentIndex) return

    // Allow going backwards anytime
    if (targetIndex < currentIndex) {
      setCurrentStep(step)
      return
    }

    // Validate navigation forward
    if (targetIndex > 0 && !canProceedFromBarangay) {
      notify.error('Please select a target Barangay first.')
      return
    }
    if (targetIndex > 1 && !canProceedFromBuilder) {
      notify.error('Please configure pack details and ensure all item quantities are valid.')
      return
    }

    setCurrentStep(step)
  }

  const handleNextStep = () => {
    const currentIndex = STEPS.indexOf(currentStep)
    if (currentIndex === 0 && !canProceedFromBarangay) {
      notify.warning('Please select a target Barangay before continuing.')
      return
    }
    if (currentIndex === 1 && !canProceedFromBuilder) {
      if (selectedSources.length === 0) {
        notify.warning('Please add at least one inventory item to the pack.')
      } else if (!packName.trim()) {
        notify.warning('Please enter a pack name.')
      } else if (packQtyNum <= 0) {
        notify.warning('Please enter a valid number of packs to create.')
      } else {
        notify.warning('Please check item quantities — none can exceed available stock.')
      }
      return
    }

    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1])
    }
  }

  const handlePrevStep = () => {
    const currentIndex = STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1])
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (!isAssignmentValid()) {
        notify.warning('Please select or specify the assigned person/team.')
      }
      return
    }

    setLoading(true)
    showLoading('Scheduling multi-source repacking batch…')
    try {
      // Prepare sources
      const sources = selectedSources.map((src) => ({
        itemId: src.itemId,
        quantity: parseInt(src.quantity, 10) || 0,
      }))

      const batchData = {
        sources,
        output: packName.trim(),
        outputUnit: packUnit.trim() || 'packs',
        quantity: parseInt(packQuantity, 10),
        targetBarangayId: selectedBarangay?.dbId || (typeof selectedBarangay?.id === 'number' ? selectedBarangay.id : null),
        familiesTargeted: analysisData?.analysis?.targetFamilies || selectedBarangay?.affectedFamilies || null,
        sufficiencyStatus: analysisData?.analysis?.overallSufficiency || null,
        recommendedContents: analysisData?.suggestedContents || null,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
        notes: notes || null,
        status: 'Scheduled',
      }

      const result = await onSubmit(batchData)
      setCreatedBatch(result)
      setCurrentStep('confirmation')
      notify.success('Multi-source repacking batch scheduled successfully!')
    } catch (error) {
      console.error('Failed to create batch:', error)
      notify.error(error.message || 'Failed to create repacking batch')
    } finally {
      hideLoading()
      setLoading(false)
    }
  }

  const renderStepIndicator = () => {
    const visibleSteps = STEPS.slice(0, 3)
    return (
      <div className="repacking-steps-indicator" role="tablist" aria-label="Repacking Creation Progress">
        {visibleSteps.map((step, index) => {
          const isActive = step === currentStep
          const currentIndex = STEPS.indexOf(currentStep)
          const isCompleted = currentIndex > index
          const stepNumber = index + 1
          const isClickable = index <= currentIndex

          return (
            <div
              key={step}
              className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => isClickable && handleStepClick(step)}
              style={{ cursor: isClickable ? 'pointer' : 'not-allowed' }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isClickable ? 0 : -1}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
                  e.preventDefault()
                  handleStepClick(step)
                }
              }}
            >
              <div className="step-number" aria-hidden="true">
                {isCompleted ? <Check size={14} strokeWidth={3} /> : stepNumber}
              </div>
              <div className="step-label">{STEP_TITLES[step]}</div>
              {index < visibleSteps.length - 1 && <div className="step-connector" />}
            </div>
          )
        })}
      </div>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'barangay':
        return (
          <BarangayNeedsAnalyzer
            beneficiaries={beneficiaries}
            selectedBarangay={selectedBarangay}
            onSelectBarangay={handleBarangaySelect}
            analysisData={analysisData}
            onAnalysisData={handleAnalysisData}
            loadingAnalysis={loadingAnalysis}
            setLoadingAnalysis={setLoadingAnalysis}
          />
        )

      case 'builder':
        return (
          <PackContentBuilder
            items={items}
            selectedSources={selectedSources}
            onSourcesChange={setSelectedSources}
            packName={packName}
            onPackNameChange={setPackName}
            packQuantity={packQuantity}
            onPackQuantityChange={setPackQuantity}
            packUnit={packUnit}
            onPackUnitChange={setPackUnit}
            analysisData={analysisData}
            targetFamilies={analysisData?.analysis?.targetFamilies || selectedBarangay?.affectedFamilies || 0}
          />
        )

      case 'summary':
        return (
          <RepackingSummaryCard
            selectedBarangay={selectedBarangay}
            selectedSources={selectedSources}
            packName={packName}
            packQuantity={packQuantity}
            packUnit={packUnit}
            analysisData={analysisData}
            assignedType={assignedType}
            onAssignedTypeChange={setAssignedType}
            assignedTo={assignedTo}
            onAssignedToChange={setAssignedTo}
            dueDate={dueDate}
            onDueDateChange={setDueDate}
            notes={notes}
            onNotesChange={setNotes}
            staff={staff}
            volunteers={volunteers}
            loadingTeam={loadingTeam}
          />
        )

      case 'confirmation':
        return (
          <div className="repacking-confirmation">
            <div className="confirmation-icon">
              <FileCheck size={48} />
            </div>
            <h3>Repacking Batch Created Successfully!</h3>
            <p className="confirmation-message">
              Multi-source repacking batch <strong>{createdBatch?.id || createdBatch?.code || 'BATCH'}</strong> has been scheduled and stock reserved.
            </p>
            {createdBatch && (
              <div className="confirmation-details">
                <div className="detail-row">
                  <span className="detail-label">Batch Code:</span>
                  <span className="detail-value font-semibold">{createdBatch.id || createdBatch.code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Scheduled Output:</span>
                  <span className="detail-value font-semibold">
                    {createdBatch.quantity || packQuantity} {createdBatch.outputUnit || packUnit} of {createdBatch.output || packName}
                  </span>
                </div>
                {selectedBarangay && (
                  <div className="detail-row">
                    <span className="detail-label">Target Barangay:</span>
                    <span className="detail-value">{selectedBarangay.name || selectedBarangay.barangay}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <StatusBadge status={createdBatch.status || 'Scheduled'} />
                </div>
              </div>
            )}
            <button type="button" className="btn btn--primary" onClick={onClose} style={{ marginTop: '1.25rem' }}>
              Done & View Batches
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="admin-modal-overlay repacking-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal repacking-modal-vertical repacking-modal-multi"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <ModalHeader
          title="Create Multi-Source Repacking Batch"
          subtitle={STEP_SUBTITLES[currentStep] || STEP_TITLES[currentStep]}
          onClose={onClose}
        />

        {currentStep !== 'confirmation' && renderStepIndicator()}

        <div className="repacking-modal-body">{renderStepContent()}</div>

        {currentStep !== 'confirmation' && (
          <div className="repacking-modal-actions">
            {/* Left action: Previous or Cancel */}
            {currentStep === 'barangay' ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handlePrevStep}
                disabled={loading}
              >
                <ArrowLeft size={14} style={{ marginRight: '0.35rem' }} />
                Previous
              </button>
            )}

            {/* Right action: Next or Create Batch */}
            {currentStep === 'summary' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
              >
                {loading ? 'Creating Batch…' : 'Create Batch'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleNextStep}
                disabled={
                  (currentStep === 'barangay' && !canProceedFromBarangay) ||
                  (currentStep === 'builder' && !canProceedFromBuilder) ||
                  loading
                }
                title={
                  currentStep === 'barangay' && !canProceedFromBarangay
                    ? 'Select a target barangay to continue'
                    : currentStep === 'builder' && !canProceedFromBuilder
                    ? 'Add items and verify quantities to continue'
                    : ''
                }
              >
                Next
                <ArrowRight size={14} style={{ marginLeft: '0.35rem' }} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
