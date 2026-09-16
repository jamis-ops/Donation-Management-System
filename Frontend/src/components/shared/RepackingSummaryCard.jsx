import { MapPin, Package, Users, Calendar, FileText, CheckCircle, AlertCircle, Info, UserCheck } from 'lucide-react'

export default function RepackingSummaryCard({
  selectedBarangay,
  selectedSources,
  packName,
  packQuantity,
  packUnit,
  analysisData,
  assignedType,
  onAssignedTypeChange,
  assignedTo,
  onAssignedToChange,
  dueDate,
  onDueDateChange,
  notes,
  onNotesChange,
  staff,
  volunteers,
  loadingTeam,
}) {
  const totalSourceUnits = selectedSources.reduce((sum, src) => sum + (Number(src.quantity) || 0), 0)
  const sufficiency = analysisData?.analysis?.overallSufficiency || 'Sufficient'

  const getSufficiencyClass = () => {
    switch (sufficiency) {
      case 'Sufficient':
        return 'sufficient'
      case 'Partial':
        return 'partial'
      case 'Insufficient':
        return 'insufficient'
      default:
        return 'unknown'
    }
  }

  const getSufficiencyIcon = () => {
    switch (sufficiency) {
      case 'Sufficient':
        return <CheckCircle size={15} />
      case 'Partial':
        return <Info size={15} />
      case 'Insufficient':
        return <AlertCircle size={15} />
      default:
        return <Package size={15} />
    }
  }

  return (
    <div className="repacking-summary-compact">
      {/* 2-Column Review Grid */}
      <div className="review-grid">
        {/* LEFT COLUMN: Target, Output & Assignment */}
        <div className="review-col">
          {/* Target & Output Combined Card */}
          <div className="review-card">
            <div className="review-card__header">
              <MapPin size={15} />
              <h4>Target & Output Package</h4>
            </div>

            <div className="review-detail-rows">
              {selectedBarangay && (
                <>
                  <div className="review-row">
                    <span className="review-row-label">Target Barangay:</span>
                    <strong className="review-row-value">
                      {selectedBarangay.name || selectedBarangay.barangay}
                      {selectedBarangay.municipality ? ` (${selectedBarangay.municipality})` : ''}
                    </strong>
                  </div>
                  <div className="review-row">
                    <span className="review-row-label">Affected Families:</span>
                    <span className="review-row-value">
                      {selectedBarangay.affectedFamilies || analysisData?.analysis?.targetFamilies || 0} families
                    </span>
                  </div>
                </>
              )}

              <div className="review-row">
                <span className="review-row-label">Output Pack:</span>
                <strong className="review-row-value text-brand">{packName}</strong>
              </div>

              <div className="review-row">
                <span className="review-row-label">Output Quantity:</span>
                <span className="review-row-value font-semibold">
                  {packQuantity} {packUnit || 'packs'}
                </span>
              </div>

              <div className="review-row">
                <span className="review-row-label">Stock Status:</span>
                <span className={`status-pill status-pill--${getSufficiencyClass()}`}>
                  {getSufficiencyIcon()}
                  <span>{sufficiency} Stock</span>
                </span>
              </div>
            </div>
          </div>

          {/* Assignment & Scheduling Card */}
          <div className="review-card">
            <div className="review-card__header">
              <UserCheck size={15} />
              <h4>Assignment & Schedule</h4>
            </div>

            <div className="review-form-compact">
              <div className="form-row" style={{ marginBottom: '0.65rem' }}>
                <label className="form-label-enhanced">
                  Assign To
                  <select
                    value={assignedType}
                    onChange={(e) => {
                      onAssignedTypeChange(e.target.value)
                      onAssignedToChange('')
                    }}
                    className="form-select-enhanced"
                  >
                    <option value="">Not assigned</option>
                    <option value="staff">Staff Member</option>
                    <option value="volunteer">Volunteer</option>
                    <option value="custom">Custom Team / Group</option>
                  </select>
                </label>
              </div>

              {assignedType === 'staff' && (
                <div className="form-row" style={{ marginBottom: '0.65rem' }}>
                  <label className="form-label-enhanced">
                    Staff Member <span className="required">*</span>
                    <select
                      value={assignedTo}
                      onChange={(e) => onAssignedToChange(e.target.value)}
                      className="form-select-enhanced"
                      disabled={loadingTeam}
                      required
                    >
                      <option value="">Select staff member...</option>
                      {(staff || []).map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.department && `(${s.department})`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {assignedType === 'volunteer' && (
                <div className="form-row" style={{ marginBottom: '0.65rem' }}>
                  <label className="form-label-enhanced">
                    Volunteer <span className="required">*</span>
                    <select
                      value={assignedTo}
                      onChange={(e) => onAssignedToChange(e.target.value)}
                      className="form-select-enhanced"
                      disabled={loadingTeam}
                      required
                    >
                      <option value="">Select volunteer...</option>
                      {(volunteers || []).map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.name} {v.skills && `— ${v.skills.slice(0, 2).join(', ')}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {assignedType === 'custom' && (
                <div className="form-row" style={{ marginBottom: '0.65rem' }}>
                  <label className="form-label-enhanced">
                    Team Name <span className="required">*</span>
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => onAssignedToChange(e.target.value)}
                      placeholder="e.g., Logistics Crew, Relief Team Alpha"
                      className="form-input-enhanced"
                      required
                    />
                  </label>
                </div>
              )}

              <div className="form-row" style={{ marginBottom: '0.65rem' }}>
                <label className="form-label-enhanced">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={13} /> Target Completion Date
                  </span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => onDueDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="form-input-enhanced"
                  />
                </label>
              </div>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <label className="form-label-enhanced">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileText size={13} /> Notes & Special Packing Instructions
                  </span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Add any handling instructions or packing reminders..."
                    className="form-input-enhanced"
                    style={{ resize: 'vertical' }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Inventory Deductions Table & Confirmation */}
        <div className="review-col">
          <div className="review-card">
            <div className="review-card__header">
              <Package size={15} />
              <h4>Inventory Source Deductions ({selectedSources.length} items)</h4>
            </div>

            <div className="review-table-wrap">
              <table className="review-table">
                <thead>
                  <tr>
                    <th>Source Item</th>
                    <th>Category</th>
                    <th className="text-right">Deducted</th>
                    <th className="text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSources.map((source) => {
                    const deductQty = Number(source.quantity) || 0
                    const remaining = Math.max(0, (source.available || 0) - deductQty)
                    return (
                      <tr key={source.itemId}>
                        <td className="item-name-cell">
                          <strong>{source.itemName}</strong>
                        </td>
                        <td className="item-cat-cell">{source.category || '—'}</td>
                        <td className="text-right deduct-cell">
                          −{deductQty} {source.unit}
                        </td>
                        <td className="text-right remaining-cell">
                          {remaining} {source.unit}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="review-table-total">
                    <td colSpan="2">
                      <strong>Total Inventory Deducted</strong>
                    </td>
                    <td colSpan="2" className="text-right">
                      <strong>{totalSourceUnits} total units</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Batch Readiness Confirmation Box */}
          <div className="readiness-confirm-card">
            <div className="confirm-icon-box">
              <CheckCircle size={20} />
            </div>
            <div className="confirm-copy">
              <strong>Batch Scheduled Immediately</strong>
              <p>
                Creating this batch will reserve {totalSourceUnits} source items from warehouse inventory and schedule {packQuantity} {packUnit || 'packs'} of &quot;{packName}&quot; for assembly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
