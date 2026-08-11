import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { assistanceRequestsApi, beneficiariesApi } from '../../api/resources';
import { useApiList } from '../../hooks/useApiList';
import { useFilters } from '../../hooks/useFilters';
import { 
  AlertTriangle, AlertCircle, Clock, CheckCircle, 
  Users, Search, Pin, FileText, 
  Check, X, MapPin, Loader2, Info
} from 'lucide-react';
import PageHeader from '../../components/admin/shared/PageHeader';
import StatusBadge from '../../components/admin/shared/StatusBadge';
import FilterBar from '../../components/admin/shared/FilterBar';
import ApiState from '../../components/admin/shared/ApiState';
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import { notify } from '../../utils/toast';

const styles = `
.requests-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-family: var(--font-sans);
}
.requests-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}
.requests-page .stat-card {
  background: var(--admin-surface);
  border-radius: var(--admin-radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--admin-border);
  box-shadow: var(--admin-shadow);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.requests-page .stat-card h3 {
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: var(--admin-text-muted);
  margin: 0;
}
.requests-page .stat-card .value {
  font-family: var(--font-sans);
  font-size: 2rem;
  font-weight: 700;
  color: var(--admin-text);
  margin: 0;
  line-height: 1.2;
}
.requests-page .stat-card.critical {
  border-color: #fecaca;
  background: #fef2f2;
}
.requests-page .stat-card.critical .value {
  color: var(--admin-danger);
}

@keyframes pulse-red {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.alert-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--admin-radius);
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #b91c1c;
  cursor: pointer;
  transition: background 0.2s;
  font-family: var(--font-sans);
}
.alert-banner:hover {
  background: #fee2e2;
}
.alert-banner-icon {
  color: var(--admin-danger);
}

.requests-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: flex-end;
}
.requests-sort {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.requests-sort label {
  font-size: 0.875rem;
  color: var(--admin-text-muted);
  font-family: var(--font-sans);
}
.requests-sort select {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  color: var(--admin-text);
  border-radius: 6px;
  padding: 0.5rem;
  font-family: var(--font-sans);
}

.requests-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: stretch;
}
@media (min-width: 768px) {
  .requests-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1200px) {
  .requests-grid { grid-template-columns: repeat(3, 1fr); }
}

.request-card {
  background: var(--admin-surface);
  border-radius: var(--admin-radius-lg);
  border: 1px solid var(--admin-border);
  box-shadow: var(--admin-shadow);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: var(--font-sans);
}
.request-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--admin-shadow-md);
}
.request-card.priority-critical { border-left: 4px solid #dc2626; }
.request-card.priority-high { border-left: 4px solid #ea580c; }
.request-card.priority-medium { border-left: 4px solid #d97706; }
.request-card.priority-low { border-left: 4px solid #16a34a; }

.request-card.is-emergency {
  border: 2px solid #ef4444;
  animation: border-pulse 2s infinite;
}
@keyframes border-pulse {
  0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 rgba(239, 68, 68, 0.15); }
  50% { border-color: #f87171; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12); }
}
.emergency-label {
  background: var(--admin-brand);
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  text-align: center;
  padding: 2px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: var(--font-sans);
}

.request-card__body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.request-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.request-card__title {
  font-family: var(--font-sans);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--admin-text);
  margin: 0 0 0.25rem 0;
  line-height: 1.25;
}
.request-card__ref {
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--admin-text-muted);
  background: var(--admin-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
.request-card__badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  font-family: var(--font-sans);
}
.priority-badge.critical { background: #fee2e2; color: #dc2626; }
.priority-badge.high { background: #fff7ed; color: #ea580c; }
.priority-badge.medium { background: #fefce8; color: #d97706; }
.priority-badge.low { background: #f0fdf4; color: #16a34a; }

.request-card__desc {
  font-size: 0.875rem;
  color: var(--admin-text-muted);
  margin: 0;
  line-height: 1.45;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}
.request-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--admin-text-muted);
}
.request-card__meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.request-card__sla {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--font-sans);
}
.sla-green { background: rgba(22, 163, 74, 0.1); color: #15803d; }
.sla-yellow { background: rgba(217, 119, 6, 0.1); color: #b45309; }
.sla-red { background: rgba(220, 38, 38, 0.1); color: #b91c1c; }

.request-card__actions {
  border-top: 1px solid var(--admin-border);
  padding: 0.75rem 1.25rem;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-top: auto;
  background: var(--admin-bg);
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--admin-text-muted);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-icon:hover {
  background: var(--admin-brand-muted);
  color: var(--admin-brand);
}
.btn-icon.active {
  color: var(--admin-danger);
}

.requests-page .btn--outline {
  background: transparent;
  border-color: var(--admin-border);
  color: var(--admin-text);
}
.requests-page .btn--outline:hover {
  background: var(--admin-brand-muted);
  border-color: rgba(175, 16, 26, 0.25);
  color: var(--admin-brand);
}

.requests-page .admin-modal__right {
  flex: 2;
  background: var(--admin-bg);
  border-radius: var(--admin-radius);
  padding: 1.25rem;
  border: 1px solid var(--admin-border);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-group label {
  font-size: 0.875rem;
  color: var(--admin-text-muted);
  font-weight: 500;
  font-family: var(--font-sans);
}
.form-group input, .form-group select, .form-group textarea {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  color: var(--admin-text);
  padding: 0.75rem;
  border-radius: 6px;
  font-family: var(--font-sans);
}
.form-group textarea { min-height: 100px; resize: vertical; }
.form-group select:focus, .form-group input:focus, .form-group textarea:focus {
  outline: none;
  border-color: var(--admin-brand);
}

.admin-modal__footer {
  padding: 1.5rem;
  border-top: 1px solid var(--admin-border);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  background: var(--admin-bg);
}

.barangay-context-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.barangay-context-card h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-family: var(--font-sans);
  color: var(--admin-text);
}
.barangay-stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--admin-text-muted);
}
.barangay-stat strong { color: var(--admin-text); }

.admin-modal__body {
  display: flex;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  overflow: auto;
}

.admin-modal__left {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

@media (max-width: 640px) {
  .admin-modal__body {
    flex-direction: column;
    padding: 1rem;
  }

  .requests-page .admin-modal__right {
    flex: none;
  }
}
`;

const priorityConfig = {
  Critical: { color: 'critical', icon: AlertTriangle, label: 'CRITICAL', slaHours: 4, weight: 4 },
  High: { color: 'high', icon: AlertCircle, label: 'HIGH', slaHours: 24, weight: 3 },
  Medium: { color: 'medium', icon: Clock, label: 'MEDIUM', slaHours: 72, weight: 2 },
  Low: { color: 'low', icon: CheckCircle, label: 'LOW', slaHours: 168, weight: 1 }
};

function getSLALabel(req) {
  const pConf = priorityConfig[req.priority] || priorityConfig.Medium;
  const created = new Date(req.requestDate || req.date || Date.now());
  const now = new Date();
  const elapsedHours = (now - created) / (1000 * 60 * 60);
  const remainingHours = pConf.slaHours - elapsedHours;
  const percentUsed = (elapsedHours / pConf.slaHours) * 100;

  if (remainingHours < 0) {
    const overdueHrs = Math.floor(Math.abs(remainingHours));
    const overdueMins = Math.floor((Math.abs(remainingHours) * 60) % 60);
    return { status: 'red', text: `⚠️ OVERDUE by ${overdueHrs}h ${overdueMins}m` };
  }
  if (percentUsed >= 50) {
    return { status: 'yellow', text: `Response in ${Math.floor(remainingHours)}h` };
  }
  return { status: 'green', text: `Response in ${Math.floor(remainingHours)}h` };
}

function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const diffMins = Math.floor((new Date() - new Date(dateString)) / 60000);
  if (diffMins < 60) return `${Math.max(0, diffMins)} min${diffMins !== 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

export default function RequestsPage() {
  const navigate = useNavigate();
  const { data: requestsData, loading: reqLoading, error: reqError, reload: reqReload } = useApiList(() => assistanceRequestsApi.list());
  const { data: beneficiariesData } = useApiList(() => beneficiariesApi.list());
  
  const [emergencyIds, setEmergencyIds] = useState(() => new Set());
  const [sortBy, setSortBy] = useState('priority');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = styles;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // Allocated / Completed requests have left the relief queue — they continue in Allocation / Distribution.
  const DONE_RELIEF_STATUSES = ['Allocated', 'Completed']

  const enrichedData = useMemo(() => {
    if (!requestsData || !beneficiariesData) return requestsData || [];
    const bMap = new Map(beneficiariesData.map(b => [b.dbId, b]));
    return requestsData.map(req => {
      const b = bMap.get(req.beneficiaryId);
      return {
        ...req,
        affectedFamilies: b?.affectedFamilies || b?.population || 0,
        municipality: b?.municipality || 'Cebu',
        representative: b?.representative || 'Unknown'
      };
    });
  }, [requestsData, beneficiariesData]);

  const activeReliefData = useMemo(
    () => enrichedData.filter((r) => !DONE_RELIEF_STATUSES.includes(r.status)),
    [enrichedData],
  );

  const filterConfig = useMemo(() => ({
    searchKeys: ['beneficiary', 'id', 'type', 'notes'],
    filters: [
      { key: 'priority', label: 'Priority', options: ['Critical', 'High', 'Medium', 'Low'] },
      { key: 'status', label: 'Status', options: ['Pending Review', 'Under Review', 'Approved', 'Rejected'] }
    ]
  }), []);

  const filterController = useFilters(activeReliefData, filterConfig);

  const sortedData = useMemo(() => {
    const arr = [...filterController.filtered];
    return arr.sort((a, b) => {
      const aEm = emergencyIds.has(a.dbId);
      const bEm = emergencyIds.has(b.dbId);
      if (aEm && !bEm) return -1;
      if (!aEm && bEm) return 1;

      if (sortBy === 'priority') {
        const pA = priorityConfig[a.priority]?.weight || 0;
        const pB = priorityConfig[b.priority]?.weight || 0;
        if (pA !== pB) return pB - pA;
        return new Date(a.date || a.requestDate) - new Date(b.date || b.requestDate);
      }
      if (sortBy === 'date') return new Date(b.date || b.requestDate) - new Date(a.date || a.requestDate);
      if (sortBy === 'barangay') return (a.beneficiary || '').localeCompare(b.beneficiary || '');
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
      return 0;
    });
  }, [filterController.filtered, emergencyIds, sortBy]);

  const paging = usePagination(
    sortedData,
    DEFAULT_PAGE_SIZE,
    `${filterController.search}|${filterController.values?.priority || ''}|${filterController.values?.status || ''}|${sortBy}`,
  );

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let critical = 0;
    activeReliefData.forEach(r => {
      if (r.status === 'Pending Review' || r.status === 'Under Review') pending++;
      if (r.status === 'Approved') approved++;
      if (r.priority === 'Critical' && r.status !== 'Rejected') critical++;
    });
    return { total: activeReliefData.length, pending, approved, critical };
  }, [activeReliefData]);

  const toggleEmergency = (dbId, e) => {
    e.stopPropagation();
    setEmergencyIds(prev => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  };

  const handleUpdateStatus = async (dbId, updates) => {
    try {
      setIsUpdating(true);
      await assistanceRequestsApi.update(dbId, updates);
      await reqReload();
      notify.success('Request updated successfully');
      if (selectedRequest && selectedRequest.dbId === dbId) {
        setSelectedRequest(prev => ({ ...prev, ...updates }));
      }
    } catch {
      notify.error('Failed to update request');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="requests-page">
      <PageHeader
        title="Relief Requests"
        description="Manage and review incoming relief requests from partner barangays."
      />

      <ApiState loading={reqLoading} error={reqError} onRetry={reqReload}>
        <div className="requests-stats">
          <div className="stat-card">
            <h3>Total Requests</h3>
            <p className="value">{stats.total}</p>
          </div>
          <div className="stat-card">
            <h3>Pending Review</h3>
            <p className="value">{stats.pending}</p>
          </div>
          <div className="stat-card">
            <h3>Approved</h3>
            <p className="value">{stats.approved}</p>
          </div>
          <div className="stat-card critical">
            <h3>Critical Alerts</h3>
            <p className="value">{stats.critical}</p>
          </div>
        </div>

        {stats.critical > 0 && (
          <div className="alert-banner" onClick={() => filterController.setValue('priority', 'Critical')}>
            <AlertTriangle className="alert-banner-icon" />
            <strong>⚠️ {stats.critical} Critical request{stats.critical !== 1 ? 's' : ''} need immediate attention!</strong>
            <span>Click to filter</span>
          </div>
        )}

        <FilterBar controller={filterController} searchPlaceholder="Search barangay, type, notes..." />

        <div className="requests-toolbar">
          <div className="requests-sort">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="priority">Priority (Default)</option>
              <option value="date">Date Submitted</option>
              <option value="barangay">Barangay</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        <div className="requests-grid">
          {paging.pageItems.map(req => {
            const pConf = priorityConfig[req.priority] || priorityConfig.Medium;
            const PIcon = pConf.icon;
            const isEmergency = emergencyIds.has(req.dbId);
            const sla = getSLALabel(req);

            return (
              <div key={req.dbId} className={`request-card priority-${pConf.color} ${isEmergency ? 'is-emergency' : ''}`}>
                {isEmergency && <div className="emergency-label">EMERGENCY PINNED</div>}
                
                <div className="request-card__body">
                  <div className="request-card__header">
                    <div>
                      <h3 className="request-card__title">{req.beneficiary} <span style={{fontSize: '0.875rem', color: '#94a3b8', fontWeight: 'normal'}}>| {req.municipality}</span></h3>
                      <div className="request-card__badges">
                        <span className={`priority-badge ${pConf.color}`}>
                          <PIcon size={12} /> {pConf.label}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                    </div>
                    <span className="request-card__ref">{req.id}</span>
                  </div>

                  <p className="request-card__desc"><strong>{req.type}</strong> - {req.notes}</p>
                  
                  <div className="request-card__meta">
                    <div className="request-card__meta-item">
                      <Users size={14} /> {req.affectedFamilies} families
                    </div>
                    <div className="request-card__meta-item">
                      <Clock size={14} /> {timeAgo(req.requestDate || req.date)}
                    </div>
                  </div>

                  {!['Completed', 'Rejected', 'Allocated'].includes(req.status) && (
                    <div style={{marginTop: 'auto'}}>
                      <span className={`request-card__sla sla-${sla.status}`}>
                        {sla.status === 'red' ? <AlertTriangle size={12} /> : <Info size={12} />}
                        {sla.text}
                      </span>
                    </div>
                  )}
                </div>

                <div className="request-card__actions">
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className={`btn-icon ${isEmergency ? 'active' : ''}`} onClick={(e) => toggleEmergency(req.dbId, e)} title="Pin as Emergency">
                      <Pin size={16} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {req.status === 'Approved' ? (
                      <button className="btn btn--sm btn--primary" onClick={() => navigate('/admin/allocation', { state: { prefillRequest: { requestId: req.dbId, beneficiaryId: req.beneficiaryId, type: req.type, notes: req.notes, beneficiaryName: req.beneficiary } } })}>
                        Create Allocation &rarr;
                      </button>
                    ) : (
                      <>
                        <button className="btn btn--sm btn--outline" onClick={() => setSelectedRequest(req)}>Review</button>
                        {req.status !== 'Rejected' && (
                          <button className="btn btn--sm btn--success" onClick={() => handleUpdateStatus(req.dbId, { status: 'Approved' })}><Check size={14}/></button>
                        )}
                        {req.status !== 'Rejected' && (
                          <button className="btn btn--sm btn--danger" onClick={() => handleUpdateStatus(req.dbId, { status: 'Rejected' })}><X size={14}/></button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {sortedData.length === 0 && (
            <div className="admin-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--admin-text-muted)' }}>No requests found matching the current filters.</p>
            </div>
          )}
        </div>
        {sortedData.length > 0 && (
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            startIndex={paging.startIndex}
            endIndex={paging.endIndex}
            onPageChange={paging.setPage}
            className="pagination--portal"
            noun="requests"
          />
        )}
      </ApiState>

      {selectedRequest && (
        <ReviewModal 
          request={selectedRequest} 
          allRequests={enrichedData}
          onClose={() => setSelectedRequest(null)}
          onUpdate={handleUpdateStatus}
          isUpdating={isUpdating}
          navigate={navigate}
        />
      )}

    </div>
  );
}

function ReviewModal({ request, allRequests, onClose, onUpdate, isUpdating, navigate }) {
  const [notes, setNotes] = useState(request.notes || '');
  const [priority, setPriority] = useState(request.priority || 'Medium');
  
  const activeCriticalRequests = useMemo(() => {
    return allRequests.filter(r => 
      r.beneficiaryId === request.beneficiaryId && 
      r.priority === 'Critical' && 
      !['Completed', 'Rejected', 'Allocated', 'Cancelled'].includes(r.status) && 
      r.dbId !== request.dbId
    );
  }, [allRequests, request]);

  const handleSave = async (status) => {
    await onUpdate(request.dbId, { status, priority, notes, type: request.type });
    if (status !== 'Approved') onClose();
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2>Review Request: {request.id}</h2>
          <button className="admin-modal__close" onClick={onClose}><X size={24} /></button>
        </div>
        
        <div className="admin-modal__body">
          <div className="admin-modal__left">
            {activeCriticalRequests.length > 0 && priority === 'Critical' && (
              <div className="alert-banner">
                <AlertTriangle />
                <strong>⚠️ Duplicate Alert: There is already an open Critical request for this barangay.</strong>
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <input type="text" value={request.status} readOnly style={{ opacity: 0.7 }} />
              </div>
            </div>

            <div className="form-group">
              <label>Request Type</label>
              <input type="text" value={request.type} readOnly style={{ opacity: 0.7 }} />
            </div>

            <div className="form-group">
              <label>Description / Notes (Editable)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter details..."></textarea>
            </div>
            
            <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
              Submitted: {request.requestDate || request.date ? new Date(request.requestDate || request.date).toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="admin-modal__right">
            <div className="barangay-context-card">
              <h3><MapPin size={18} /> {request.beneficiary}</h3>
              <div className="barangay-stat">
                <MapPin size={16}/> <span>Municipality: <strong>{request.municipality}</strong></span>
              </div>
              <div className="barangay-stat">
                <Users size={16}/> <span>Affected Families: <strong>{request.affectedFamilies}</strong></span>
              </div>
              <div className="barangay-stat">
                <Users size={16}/> <span>Representative: <strong>{request.representative}</strong></span>
              </div>
              <div className="barangay-stat">
                <FileText size={16}/> <span>Previous Requests: <strong>{allRequests.filter(r => r.beneficiaryId === request.beneficiaryId).length - 1}</strong></span>
              </div>
              <button 
                className="btn btn--outline" 
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={() => navigate(`/admin/beneficiaries/${request.beneficiaryId}`)}
              >
                View Barangay Details &rarr;
              </button>
            </div>
          </div>
        </div>

        <div className="admin-modal__footer">
          {request.status === 'Pending Review' && (
            <button className="btn btn--outline" disabled={isUpdating} onClick={() => handleSave('Under Review')}>
              Mark Under Review
            </button>
          )}
          {request.status !== 'Rejected' && request.status !== 'Approved' && (
            <button className="btn btn--danger" disabled={isUpdating} onClick={() => handleSave('Rejected')}>
              Reject ✗
            </button>
          )}
          {request.status !== 'Approved' ? (
            <button className="btn btn--success" disabled={isUpdating} onClick={() => handleSave('Approved')}>
              {isUpdating ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Approve ✓
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => navigate('/admin/allocation', { state: { prefillRequest: { requestId: request.dbId, beneficiaryId: request.beneficiaryId, type: request.type, notes: request.notes, beneficiaryName: request.beneficiary } } })}>
              Create Allocation &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
