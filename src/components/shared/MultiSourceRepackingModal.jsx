import { useState } from 'react'
import { FileCheck } from 'lucide-react'
import ModalHeader from '../admin/shared/ModalHeader'
import BarangayNeedsAnalyzer from './BarangayNeedsAnalyzer'
import PackContentBuilder from './PackContentBuilder'
import RepackingSummaryCard from './RepackingSummaryCard'
import { notify } from '../../utils/toast'

const STEPS = ['barangay', 'builder', 'summary', 'confirmation']
const STEP_TITLES = {
  barangay: 'Step 1: Target Barangay',
  builder: 'Step 2: Pack Builder',
  summary: 'Step 3: Review & Confirm',
  confirmation: 'Batch Created',
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

  const canProceedFromBarangay = Boolean(selectedBarangay)
  const canProceedFromBuilder = selectedSources.length > 0 && packName.trim() !== '' && parseInt(packQuantity, 10) > 0
  const canSubmit = canProceedFromBuilder

  const handleBarangaySelect = (barangay) => {
    setSelectedBarangay(barangay)
    setPackName(`${barangay.name || barangay.barangay} Relief Pack`)
    if (barangay.affectedFamilies) {
      setPackQuantity(String(barangay.affectedFamilies))
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

    // Validate navigation forward
    if (targetIndex > 0 && !canProceedFromBarangay) {
      notify.error('Please select a target Barangay first.')
      return
    }
    if (targetIndex > 1 && !canProceedFromBuilder) {
      notify.error('Please configure the pack and select at least one source item.')
      return
    }

    setCurrentStep(step)
  }

  const handleNextStep = () => {
    const currentIndex = STEPS.indexOf(currentStep)
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
    if (!canSubmit) return

    setLoading(true)
    try {
      // Prepare submission data
      const sources = selectedSources.map((src) => ({
        itemId: src.itemId,
        quantity: parseInt(src.quantity, 10) || 0,
      }))

      // Validate quantities
      const invalidSource = selectedSources.find((s) => !s.quantity || s.quantity <= 0)
      if (invalidSource) {
        notify.error(`Please enter a valid quantity for ${invalidSource.itemName}`)
        setLoading(false)
        return
      }

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
      notify.success('Multi-source repacking batch created successfully!')
    } catch (error) {
      console.error('Failed to create batch:', error)
      notify.error(error.message || 'Failed to create repacking batch')
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => {
    const visibleSteps = STEPS.slice(0, 3) // Don't show confirmation in indicator
    return (
      <div className="repacking-steps-indicator">
        {visibleSteps.map((step, index) => {
          const isActive = step === currentStep
          const isCompleted = STEPS.indexOf(currentStep) > index
          const stepNumber = index + 1
          const isClickable =
            (index === 0) ||
            (index === 1 && canProceedFromBarangay) ||
            (index === 2 && canProceedFromBarangay && canProceedFromBuilder)

          return (
            <div
              key={step}
              className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => isClickable && handleStepClick(step)}
              style={{ cursor: isClickable ? 'pointer' : 'not-allowed' }}
              title={!isClickable ? 'Complete previous steps first' : ''}
            >
              <div className="step-number">{isCompleted ? '✓' : stepNumber}</div>
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
            targetFamilies={analysisData?.analysis?.targetFamilies || 0}
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
              <FileCheck size={64} />
            </div>
            <h3>Repacking Batch Created Successfully!</h3>
            <p className="confirmation-message">
              Your multi-source repacking batch <strong>{createdBatch?.id}</strong> has been created and
              scheduled.
            </p>
            {createdBatch && (
              <div className="confirmation-details">
                <div className="detail-row">
                  <span className="detail-label">Batch Code:</span>
                  <span className="detail-value">{createdBatch.id}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Output:</span>
                  <span className="detail-value">
                    {createdBatch.quantity} {createdBatch.outputUnit} of {createdBatch.output}
                  </span>
                </div>
                {selectedBarangay && (
                  <div className="detail-row">
                    <span className="detail-label">Target:</span>
                    <span className="detail-value">{selectedBarangay.name}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value status-badge">{createdBatch.status}</span>
                </div>
              </div>
            )}
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Close
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
          subtitle={STEP_TITLES[currentStep]}
          onClose={onClose}
        />

        {currentStep !== 'confirmation' && renderStepIndicator()}

        <div className="repacking-modal-body">{renderStepContent()}</div>

        {currentStep !== 'confirmation' && (
          <div className="admin-modal__actions repacking-modal-actions">
            {currentStep !== 'barangay' ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handlePrevStep}
                disabled={loading}
              >
                ← Previous
              </button>
            ) : (
              <span />
            )}

            {currentStep === 'summary' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
              >
                {loading ? 'Creating Batch...' : 'Create Batch'}
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
              >
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
