import { MapPin, Package, Users, Calendar, FileText, CheckCircle, AlertCircle, Info } from 'lucide-react'

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
  const totalSourceItems = selectedSources.reduce((sum, src) => sum + src.quantity, 0)
  const sufficiency = analysisData?.analysis?.overallSufficiency || 'Unknown'

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
        return <CheckCircle size={20} />
      case 'Partial':
        return <Info size={20} />
      case 'Insufficient':
        return <AlertCircle size={20} />
      default:
        return <Package size={20} />
    }
  }

  return (
    <div className="repacking-summary">
      {/* Summary Header */}
      <div className="summary-header">
        <h3>Review Repacking Batch</h3>
        <p>Please review all details before creating the batch</p>
      </div>

      <div className="summary-layout-grid">
        <div className="summary-layout-col">
          {/* Target Barangay Section */}
          {selectedBarangay && (
            <div className="summary-section">
              <div className="section-title">
                <MapPin size={18} />
                <h4>Target Barangay</h4>
              </div>
              <div className="summary-card barangay-summary">
                <div className="summary-row">
                  <span className="summary-label">Barangay:</span>
                  <span className="summary-value strong">{selectedBarangay.name || selectedBarangay.barangay}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Location:</span>
                  <span className="summary-value">
                    {selectedBarangay.barangay || selectedBarangay.name}
                    {selectedBarangay.municipality && `, ${selectedBarangay.municipality}`}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Affected Families:</span>
                  <span className="summary-value">
                    {selectedBarangay.affectedFamilies || analysisData?.analysis?.targetFamilies || 0}
                  </span>
                </div>
                {(selectedBarangay.representativeName || selectedBarangay.representative) && (
                  <div className="summary-row">
                    <span className="summary-label">Representative:</span>
                    <span className="summary-value">{selectedBarangay.representativeName || selectedBarangay.representative}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Output Section */}
          <div className="summary-section">
            <div className="section-title">
              <Package size={18} />
              <h4>Output Packs</h4>
            </div>
            <div className="summary-card output-summary">
              <div className="output-main">
                <div className="output-quantity">{packQuantity}</div>
                <div className="output-unit">{packUnit}</div>
              </div>
              <div className="output-name">{packName}</div>
              <div className={`output-sufficiency ${getSufficiencyClass()}`}>
                {getSufficiencyIcon()}
                <span>Stock Sufficiency: {sufficiency}</span>
              </div>
            </div>
          </div>

          {/* Analysis Summary (if available) */}
          {analysisData && (
            <div className="summary-section analysis-summary-section">
              <div className="section-title">
                <Info size={18} />
                <h4>Needs Analysis Summary</h4>
              </div>
              <div className="summary-card analysis-overview">
                <div className="analysis-stat-grid">
                  <div className="analysis-stat">
                    <div className="stat-value">{analysisData.analysis.totalNeedTypes}</div>
                    <div className="stat-label">Need Types Identified</div>
                  </div>
                  <div className="analysis-stat">
                    <div className="stat-value">{analysisData.analysis.sufficientItems}</div>
                    <div className="stat-label">Items Sufficient</div>
                  </div>
                  <div className="analysis-stat">
                    <div className="stat-value">{analysisData.analysis.partialItems}</div>
                    <div className="stat-label">Items Partial</div>
                  </div>
                  <div className="analysis-stat">
                    <div className="stat-value">{analysisData.analysis.insufficientItems}</div>
                    <div className="stat-label">Items Insufficient</div>
                  </div>
                </div>

                {analysisData.analysis.highestPriority && (
                  <div className="priority-badge">
                    Priority Level: <strong>{analysisData.analysis.highestPriority}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="summary-layout-col">
          {/* Source Items Section */}
          <div className="summary-section">
            <div className="section-title">
              <Package size={18} />
              <h4>Source Inventory ({selectedSources.length} items)</h4>
            </div>
            <div className="summary-card sources-summary">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th className="text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSources.map((source) => (
                    <tr key={source.itemId}>
                      <td className="item-name">{source.itemName}</td>
                      <td className="item-category">{source.category || '—'}</td>
                      <td className="item-quantity text-right">
                        {source.quantity} {source.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan="2">
                      <strong>Total Source Items</strong>
                    </td>
                    <td className="text-right">
                      <strong>{totalSourceItems} units</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="summary-section">
            <div className="section-title">
              <Users size={18} />
              <h4>Assignment & Schedule</h4>
            </div>
            <div className="summary-card assignment-summary">
              <div className="assignment-form-grid">
                <div className="form-row">
                  <label className="form-label-enhanced">Assign To</label>
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
                    <option value="custom">Enter Custom Name</option>
                  </select>
                </div>

                {assignedType === 'staff' && (
                  <div className="form-row">
                    <label className="form-label-enhanced">Staff Member</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => onAssignedToChange(e.target.value)}
                      className="form-select-enhanced"
                      disabled={loadingTeam}
                    >
                      <option value="">Select staff member...</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.department && `(${s.department})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {assignedType === 'volunteer' && (
                  <div className="form-row">
                    <label className="form-label-enhanced">Volunteer</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => onAssignedToChange(e.target.value)}
                      className="form-select-enhanced"
                      disabled={loadingTeam}
                    >
                      <option value="">Select volunteer...</option>
                      {volunteers.map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.name} {v.skills && `— ${v.skills.slice(0, 2).join(', ')}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {assignedType === 'custom' && (
                  <div className="form-row assignment-form-full">
                    <label className="form-label-enhanced">Team Name</label>
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => onAssignedToChange(e.target.value)}
                      placeholder="e.g., Volunteer Team A, Logistics Crew"
                      className="form-input-enhanced"
                    />
                  </div>
                )}

                <div className="form-row">
                  <label className="form-label-enhanced">
                    <Calendar size={16} />
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => onDueDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="form-input-enhanced"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="summary-section">
            <div className="section-title">
              <FileText size={18} />
              <h4>Additional Notes</h4>
            </div>
            <div className="summary-card notes-summary">
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add any special instructions, packing requirements, or other notes..."
                className="form-input-enhanced"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Final Confirmation Message */}
      <div className="summary-confirmation">
        <div className="confirmation-icon">
          <CheckCircle size={24} />
        </div>
        <div className="confirmation-text">
          <strong>Ready to Create Batch</strong>
          <p>
            This will deduct {totalSourceItems} items from inventory and create {packQuantity}{' '}
            {packUnit} of {packName}
            {selectedBarangay && ` for ${selectedBarangay.name}`}.
          </p>
        </div>
      </div>
    </div>
  )
}
