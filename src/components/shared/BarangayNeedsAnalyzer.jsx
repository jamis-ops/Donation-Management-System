import { useState, useEffect } from 'react'
import { MapPin, Users, AlertTriangle, CheckCircle, Info, TrendingUp, Package, RefreshCw, AlertCircle } from 'lucide-react'
import { needsStockApi } from '../../api/resources'

export default function BarangayNeedsAnalyzer({
  beneficiaries,
  selectedBarangay,
  onSelectBarangay,
  analysisData,
  onAnalysisData,
  loadingAnalysis,
  setLoadingAnalysis,
}) {
  const [analysisError, setAnalysisError] = useState(null)

  // Filter available Barangays from beneficiaries (excluding Suspended/Rejected status)
  const activeBarangays = (beneficiaries || []).filter((b) => {
    return !['Suspended', 'Rejected'].includes(b.status)
  })

  // Sort Barangays alphabetically by municipality and name
  const sortedBarangays = [...activeBarangays].sort((a, b) => {
    const mCompare = (a.municipality || '').localeCompare(b.municipality || '')
    if (mCompare !== 0) return mCompare
    return (a.name || '').localeCompare(b.name || '')
  })

  // Fetch analysis when barangay is selected
  const fetchAnalysis = async () => {
    if (!selectedBarangay?.dbId) {
      onAnalysisData(null)
      setAnalysisError(null)
      return
    }

    setLoadingAnalysis(true)
    setAnalysisError(null)
    try {
      const result = await needsStockApi.barangayAnalysis(selectedBarangay.dbId)

      if (result.ok && result.data) {
        onAnalysisData(result.data)
      } else {
        const errorMsg = result?.error || 'Failed to analyze barangay needs'
        setAnalysisError(errorMsg)
        onAnalysisData(null)
      }
    } catch (error) {
      console.error('Error fetching barangay analysis:', error)
      setAnalysisError(error.message || 'Network error fetching barangay analysis')
      onAnalysisData(null)
    } finally {
      setLoadingAnalysis(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [selectedBarangay?.dbId])

  const getSufficiencyColor = (status) => {
    switch (status) {
      case 'Sufficient':
        return 'success'
      case 'Partial':
        return 'warning'
      case 'Insufficient':
        return 'danger'
      default:
        return 'neutral'
    }
  }

  const getSufficiencyIcon = (status) => {
    switch (status) {
      case 'Sufficient':
        return <CheckCircle size={20} />
      case 'Partial':
        return <Info size={20} />
      case 'Insufficient':
        return <AlertTriangle size={20} />
      default:
        return <Package size={20} />
    }
  }

  return (
    <div className="barangay-analyzer">
      {/* Barangay Selection Card */}
      <div className="repacking-section">
        <div className="repacking-section__header">
          <MapPin size={16} />
          <h4>Target Barangay</h4>
        </div>

        <div className="form-row">
          <label className="form-label-enhanced">
            Select Target Barangay <span className="required">*</span>
            <select
              required
              value={selectedBarangay?.dbId || ''}
              onChange={(e) => {
                const dbId = parseInt(e.target.value, 10)
                const found = sortedBarangays.find((b) => b.dbId === dbId)
                onSelectBarangay(found || null)
              }}
              className="form-select-enhanced"
            >
              <option value="">Select target barangay...</option>
              {sortedBarangays.map((b) => (
                <option key={b.dbId} value={b.dbId}>
                  {b.name} {b.municipality && `(${b.municipality})`} — {b.affectedFamilies || 0} families
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedBarangay && (
          <div className="source-info-card" style={{ marginTop: '1.25rem' }}>
            <div className="source-info-row">
              <span className="source-info-label">Affected Families:</span>
              <span className="source-info-value">{selectedBarangay.affectedFamilies || 0} families</span>
            </div>
            {selectedBarangay.representativeName && (
              <div className="source-info-row">
                <span className="source-info-label">Representative:</span>
                <span className="source-info-value">
                  {selectedBarangay.representativeName}
                  {selectedBarangay.representativePosition && ` (${selectedBarangay.representativePosition})`}
                </span>
              </div>
            )}
            {selectedBarangay.representativePhone && (
              <div className="source-info-row">
                <span className="source-info-label">Contact Phone:</span>
                <span className="source-info-value">{selectedBarangay.representativePhone}</span>
              </div>
            )}
            {selectedBarangay.representativeEmail && (
              <div className="source-info-row">
                <span className="source-info-label">Contact Email:</span>
                <span className="source-info-value">{selectedBarangay.representativeEmail}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Analysis Results Card */}
      {selectedBarangay && (
        <div className="repacking-section">
          <div className="repacking-section__header">
            <TrendingUp size={16} />
            <h4>Needs Analysis</h4>
          </div>

          {loadingAnalysis ? (
            <div className="analysis-loading">
              <div className="spinner" />
              <p>Analyzing barangay needs and available stock...</p>
            </div>
          ) : analysisError ? (
            <div className="analysis-loading" style={{ color: '#ef4444' }}>
              <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 600, color: '#b91c1c' }}>{analysisError}</p>
              <button
                type="button"
                className="btn btn--sm btn--outline"
                onClick={fetchAnalysis}
                style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <RefreshCw size={14} /> Retry Analysis
              </button>
            </div>
          ) : analysisData ? (
            <div className="analysis-results">
              {/* Summary Cards */}
              <div className="analysis-summary-grid">
                <div className="summary-card">
                  <div className="summary-icon families">
                    <Users size={24} />
                  </div>
                  <div className="summary-content">
                    <div className="summary-value">{analysisData.analysis.targetFamilies}</div>
                    <div className="summary-label">Target Families</div>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon needs">
                    <Package size={24} />
                  </div>
                  <div className="summary-content">
                    <div className="summary-value">{analysisData.analysis.totalNeedTypes}</div>
                    <div className="summary-label">Need Types</div>
                  </div>
                </div>

                <div className="summary-card">
                  <div
                    className={`summary-icon sufficiency-${getSufficiencyColor(
                      analysisData.analysis.overallSufficiency
                    )}`}
                  >
                    {getSufficiencyIcon(analysisData.analysis.overallSufficiency)}
                  </div>
                  <div className="summary-content">
                    <div className="summary-value">{analysisData.analysis.overallSufficiency}</div>
                    <div className="summary-label">Stock Sufficiency</div>
                  </div>
                </div>
              </div>

              {/* Open Requests */}
              {analysisData.requests && analysisData.requests.length > 0 && (
                <div className="analysis-block">
                  <h4 className="block-title">Open Assistance Requests ({analysisData.requests.length})</h4>
                  <div className="requests-list">
                    {analysisData.requests.slice(0, 3).map((req) => (
                      <div key={req.id} className="request-item">
                        <div className="request-code">{req.code}</div>
                        <div className="request-type">{req.type}</div>
                        <div className={`request-priority priority-${req.priority.toLowerCase()}`}>
                          {req.priority}
                        </div>
                      </div>
                    ))}
                    {analysisData.requests.length > 3 && (
                      <div className="request-item more">
                        +{analysisData.requests.length - 3} more requests
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Identified Needs */}
              {analysisData.needs && analysisData.needs.length > 0 && (
                <div className="analysis-block">
                  <h4 className="block-title">Identified Needs</h4>
                  <div className="needs-tags">
                    {analysisData.needs.map((need, idx) => (
                      <div key={idx} className="need-tag">
                        <span className="need-label">{need.label}</span>
                        {need.count > 1 && <span className="need-count">×{need.count}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sufficiency Breakdown */}
              <div className="analysis-block">
                <h4 className="block-title">Stock Availability</h4>
                <div className="sufficiency-breakdown">
                  <div className="sufficiency-row sufficient">
                    <div className="sufficiency-label">
                      <CheckCircle size={16} />
                      Sufficient
                    </div>
                    <div className="sufficiency-value">{analysisData.analysis.sufficientItems}</div>
                  </div>
                  <div className="sufficiency-row partial">
                    <div className="sufficiency-label">
                      <Info size={16} />
                      Partial
                    </div>
                    <div className="sufficiency-value">{analysisData.analysis.partialItems}</div>
                  </div>
                  <div className="sufficiency-row insufficient">
                    <div className="sufficiency-label">
                      <AlertTriangle size={16} />
                      Insufficient
                    </div>
                    <div className="sufficiency-value">
                      {analysisData.analysis.insufficientItems}
                    </div>
                  </div>
                </div>
              </div>

              {/* Insufficient Items Warning */}
              {analysisData.insufficientItems && analysisData.insufficientItems.length > 0 && (
                <div className="analysis-block warning-block">
                  <h4 className="block-title">
                    <AlertTriangle size={16} />
                    Items with Insufficient Stock
                  </h4>
                  <div className="insufficient-items-list">
                    {analysisData.insufficientItems.map((item, idx) => (
                      <div key={idx} className="insufficient-item">
                        <div className="insufficient-item-name">{item.need}</div>
                        {item.shortage ? (
                          <div className="insufficient-item-details">
                            Need {item.required} {item.unit}, have {item.available} {item.unit} (
                            <strong className="shortage">
                              short {item.shortage} {item.unit}
                            </strong>
                            )
                          </div>
                        ) : (
                          <div className="insufficient-item-details">{item.reason}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Can Create Packs Indicator */}
              <div
                className={`can-create-indicator ${
                  analysisData.analysis.canCreatePacks ? 'success' : 'warning'
                }`}
              >
                {analysisData.analysis.canCreatePacks ? (
                  <>
                    <CheckCircle size={20} />
                    <div>
                      <strong>Ready to create packs</strong>
                      <p>
                        Estimated {analysisData.analysis.estimatedPacksFromStock} packs can be created
                        from available stock
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={20} />
                    <div>
                      <strong>Insufficient stock</strong>
                      <p>
                        Current inventory may not be sufficient to meet all needs. Consider partial
                        allocation or sourcing additional items.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="analysis-empty">
              <p>Unable to load analysis data. Please try selecting another barangay.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
