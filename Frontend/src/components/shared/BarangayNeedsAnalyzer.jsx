import { useState, useEffect } from 'react'
import {
  MapPin, Users, AlertTriangle, CheckCircle, Info, TrendingUp,
  Package, RefreshCw, AlertCircle, Phone, Mail, UserCheck, FileText
} from 'lucide-react'
import { needsStockApi } from '../../api/resources'
import LoadingSpinner from './LoadingSpinner'

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
        return <CheckCircle size={15} />
      case 'Partial':
        return <Info size={15} />
      case 'Insufficient':
        return <AlertTriangle size={15} />
      default:
        return <Package size={15} />
    }
  }

  return (
    <div className="barangay-analyzer">
      {/* 1. Barangay Selection Card */}
      <div className="repacking-section repacking-section--compact">
        <div className="repacking-section__header">
          <MapPin size={16} />
          <h4>Target Barangay</h4>
        </div>

        <div className="form-row" style={{ marginBottom: 0 }}>
          <label className="form-label-enhanced" style={{ margin: 0, width: '100%' }}>
            Select Barangay for Distribution <span className="required">*</span>
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
              <option value="">Choose a target barangay...</option>
              {sortedBarangays.map((b) => (
                <option key={b.dbId} value={b.dbId}>
                  {b.name} {b.municipality && `(${b.municipality})`} — {b.affectedFamilies || 0} families
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedBarangay && (
          <div className="barangay-quick-strip">
            <div className="quick-strip-item">
              <Users size={14} className="quick-strip-icon" />
              <div className="quick-strip-content">
                <span className="quick-strip-label">Affected Families</span>
                <span className="quick-strip-value font-semibold">
                  {Number(selectedBarangay.affectedFamilies || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="quick-strip-item">
              <UserCheck size={14} className="quick-strip-icon" />
              <div className="quick-strip-content">
                <span className="quick-strip-label">Representative</span>
                <span className="quick-strip-value" title={selectedBarangay.representativeName || '—'}>
                  {selectedBarangay.representativeName || '—'}
                  {selectedBarangay.representativePosition ? ` (${selectedBarangay.representativePosition})` : ''}
                </span>
              </div>
            </div>

            <div className="quick-strip-item">
              <Phone size={14} className="quick-strip-icon" />
              <div className="quick-strip-content">
                <span className="quick-strip-label">Phone</span>
                <span className="quick-strip-value">
                  {selectedBarangay.representativePhone ? (
                    <a href={`tel:${selectedBarangay.representativePhone}`}>{selectedBarangay.representativePhone}</a>
                  ) : '—'}
                </span>
              </div>
            </div>

            <div className="quick-strip-item">
              <Mail size={14} className="quick-strip-icon" />
              <div className="quick-strip-content">
                <span className="quick-strip-label">Email</span>
                <span className="quick-strip-value">
                  {selectedBarangay.representativeEmail ? (
                    <a href={`mailto:${selectedBarangay.representativeEmail}`}>{selectedBarangay.representativeEmail}</a>
                  ) : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Needs Analysis Card */}
      {selectedBarangay && (
        <div className="repacking-section repacking-section--compact">
          <div className="repacking-section__header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} />
              <h4>Barangay Needs & Stock Readiness</h4>
            </div>
            {analysisData?.analysis?.overallSufficiency && (
              <span className={`status-pill status-pill--${getSufficiencyColor(analysisData.analysis.overallSufficiency)}`}>
                {getSufficiencyIcon(analysisData.analysis.overallSufficiency)}
                <span>{analysisData.analysis.overallSufficiency} Stock</span>
              </span>
            )}
          </div>

          {loadingAnalysis ? (
            <LoadingSpinner message="Analyzing barangay relief requests and available warehouse inventory…" />
          ) : analysisError ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#ef4444' }}>
              <AlertCircle size={28} style={{ marginBottom: '0.25rem', display: 'inline-block' }} />
              <p style={{ fontWeight: 600, color: '#b91c1c', margin: '0.25rem 0' }}>{analysisError}</p>
              <button
                type="button"
                className="btn btn--sm btn--outline"
                onClick={fetchAnalysis}
                style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <RefreshCw size={13} /> Retry Analysis
              </button>
            </div>
          ) : analysisData ? (
            <div className="analysis-dashboard-grid">
              {/* Left Column: Requests & Identified Needs */}
              <div className="analysis-col">
                {/* Identified Needs Pills */}
                <div className="analysis-subcard">
                  <span className="analysis-subcard-title">
                    Identified Needs ({analysisData.needs?.length || 0})
                  </span>
                  {analysisData.needs && analysisData.needs.length > 0 ? (
                    <div className="needs-tags-wrap">
                      {analysisData.needs.map((need, idx) => (
                        <span key={idx} className="need-chip">
                          {need.label}
                          {need.count > 1 && <strong className="need-chip-count">×{need.count}</strong>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted text-sm">No specific needs listed in profile</span>
                  )}
                </div>

                {/* Open Requests */}
                <div className="analysis-subcard">
                  <span className="analysis-subcard-title">
                    Linked Assistance Requests ({analysisData.requests?.length || 0})
                  </span>
                  {analysisData.requests && analysisData.requests.length > 0 ? (
                    <div className="mini-requests-list">
                      {analysisData.requests.map((req) => (
                        <div key={req.id} className="mini-request-row">
                          <div className="mini-request-info">
                            <span className="mini-request-code">{req.code || req.reference_code || `REQ-${req.id}`}</span>
                            <span className="mini-request-type">{req.type || req.assistance_type || 'Relief'}</span>
                          </div>
                          <span className={`priority-pill priority-pill--${(req.priority || 'Medium').toLowerCase()}`}>
                            {req.priority || 'Medium'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted text-sm">No active pending requests for this barangay</span>
                  )}
                </div>
              </div>

              {/* Right Column: Inventory Sufficiency & Shortages */}
              <div className="analysis-col">
                {/* Sufficiency 3-stat bar */}
                <div className="analysis-stats-bar">
                  <div className="stat-pill-box">
                    <span className="stat-pill-num">{analysisData.analysis.targetFamilies}</span>
                    <span className="stat-pill-lbl">Families</span>
                  </div>
                  <div className="stat-pill-box">
                    <span className="stat-pill-num">{analysisData.analysis.totalNeedTypes}</span>
                    <span className="stat-pill-lbl">Need Types</span>
                  </div>
                  <div className="stat-pill-box stat-pill-box--green">
                    <span className="stat-pill-num">{analysisData.analysis.sufficientItems}</span>
                    <span className="stat-pill-lbl">Sufficient</span>
                  </div>
                  <div className="stat-pill-box stat-pill-box--amber">
                    <span className="stat-pill-num">{analysisData.analysis.partialItems}</span>
                    <span className="stat-pill-lbl">Partial</span>
                  </div>
                  <div className="stat-pill-box stat-pill-box--red">
                    <span className="stat-pill-num">{analysisData.analysis.insufficientItems}</span>
                    <span className="stat-pill-lbl">Shortage</span>
                  </div>
                </div>

                {/* Shortage warning if any */}
                {analysisData.insufficientItems && analysisData.insufficientItems.length > 0 && (
                  <div className="shortage-alert-box">
                    <div className="shortage-alert-header">
                      <AlertTriangle size={14} />
                      <strong>Items Requiring Attention ({analysisData.insufficientItems.length})</strong>
                    </div>
                    <div className="shortage-items-list">
                      {analysisData.insufficientItems.map((item, idx) => (
                        <div key={idx} className="shortage-item-row">
                          <span className="shortage-item-name">{item.need}</span>
                          {item.shortage ? (
                            <span className="shortage-item-qty">
                              Have {item.available} / Need {item.required} <strong className="text-danger">(short {item.shortage})</strong>
                            </span>
                          ) : (
                            <span className="shortage-item-qty text-muted">{item.reason || 'Not in stock'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Readiness status banner */}
                <div className={`readiness-banner ${analysisData.analysis.canCreatePacks ? 'readiness-banner--ready' : 'readiness-banner--partial'}`}>
                  {analysisData.analysis.canCreatePacks ? (
                    <>
                      <CheckCircle size={16} className="text-success" />
                      <div>
                        <strong>Ready to assemble packs</strong>
                        <p>Estimated {analysisData.analysis.estimatedPacksFromStock} full packs can be assembled from current inventory.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="text-warning" />
                      <div>
                        <strong>Partial stock capacity</strong>
                        <p>Some items are in low supply. You can still select available items in Step 2 to create custom packs.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="analysis-empty">
              <p>Select a barangay above to view relief needs and available inventory analysis.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
