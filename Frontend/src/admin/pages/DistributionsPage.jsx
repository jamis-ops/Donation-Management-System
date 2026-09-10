import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Eye, Pencil, ArrowRightCircle, MapPin, Calendar, Package, Users,
  Truck, UserRound, FileCheck, ClipboardList, Route, Fuel, StickyNote,
} from 'lucide-react'
import { distributionsApi, beneficiariesApi, volunteerMatchApi } from '../../api/resources'
import { getTodayDateString, isPastDateString } from '../../utils/date'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import WorkflowStepper from '../components/shared/WorkflowStepper'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import SkillTagPicker from '../../components/shared/SkillTagPicker'
import RowActionsMenu from '../components/shared/RowActionsMenu'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../components/shared/SeeMoreList'
import { notify } from '../../utils/toast'
import { confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useHashScroll, useQueryFocus } from '../../hooks/useDeepLinkFocus'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import {
  DISTRIBUTION_WORKFLOW,
  DISTRIBUTION_TERMINAL,
  DISTRIBUTION_ALIASES,
  getAvailableNextStatuses,
  validateStatusTransition,
  isTerminalStatus,
} from '../../utils/workflow'
import { useLoading } from '../../context/LoadingContext'

const WORKFLOW = DISTRIBUTION_WORKFLOW
const PROOF_STATUS = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected']

const filterConfig = {
  searchKeys: ['barangay', 'location', 'program', 'coordinator', 'eventName', 'itemsSummary'],
  filters: [
    { key: 'status', label: 'Status' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  eventName: '', location: '', beneficiaryId: '', program: '', distributionDate: '', scheduleTime: '',
  beneficiaries: '', volunteers: '', vehicles: '', distanceKm: '', status: 'Planning',
  type: 'Delivery', itemsSummary: '', coordinator: '', notes: '', proofStatus: 'Awaiting Proof',
  allocationIds: [],
}

function formFromAllocations(allocs, barangays) {
  if (!allocs?.length) return null
  const first = allocs[0]
  const ben = barangays.find((b) => Number(b.dbId) === Number(first.beneficiaryId))
  const location = ben?.barangay || ben?.name || first.beneficiary || first.beneficiaryName || ''
  const itemsSummary = allocs.map((a) => `${a.resource || a.resourceName || 'Relief Goods'} × ${a.quantity || 1}`).join('; ')
  const program = allocs.find((a) => a.program)?.program || ''
  const families = first.affectedFamilies || ben?.affectedFamilies || ''
  return {
    ...emptyForm,
    eventName: location ? `Delivery — ${location}` : '',
    location,
    beneficiaryId: String(first.beneficiaryId || ''),
    program,
    beneficiaries: families ? String(families) : '',
    itemsSummary,
    notes: `From allocation(s): ${allocs.map((a) => a.id || a.allocationId || 'ALC').join(', ')}`,
    allocationIds: allocs.map((a) => a.dbId || a.allocationId).filter(Boolean),
    status: 'Planning',
    type: 'Delivery',
    proofStatus: 'Awaiting Proof',
  }
}

export default function DistributionsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [deepLink, setDeepLink] = useState(() => ({
    id: searchParams.get('id') || searchParams.get('distributionId') || '',
    code: searchParams.get('code') || '',
    focus: searchParams.get('focus') || '',
  }))
  const { data, loading, error, reload } = useApiList(() => distributionsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const filters = useFilters(data, filterConfig)
  const { showLoading, hideLoading } = useLoading()
  const [detailRow, setDetailRow] = useState(null)
  const [detailTab, setDetailTab] = useState('cargo') // 'cargo' | 'logistics' | 'proof' | 'notes'
  const [formTab, setFormTab] = useState('destination') // 'destination' | 'logistics' | 'requirements'
  const [editRow, setEditRow] = useState(null)
  const [statusRow, setStatusRow] = useState(null)
  const [statusValue, setStatusValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [manpowerSkills, setManpowerSkills] = useState(['Logistics / Driving', 'Packing / Repacking'])
  const [manpowerSuggestions, setManpowerSuggestions] = useState([])
  const [showVolunteerHelp, setShowVolunteerHelp] = useState(false)
  const [selectedDraftIds, setSelectedDraftIds] = useState([])
  const [grouping, setGrouping] = useState(false)

  // Bulk selection controller for main distribution table
  const bulk = useBulkSelection(filters.filtered, (id) => distributionsApi.remove(id), reload, 'distributions')

  useEffect(() => {
    bulk.setSelectedIds([])
  }, [filters.search, filters.values])

  const planningDrafts = useMemo(() => {
    return (data || []).filter((d) => d.status === 'Planning')
  }, [data])
  const draftsSeeMore = useSeeMore(planningDrafts, 3)

  const handleGroupDrafts = async () => {
    if (selectedDraftIds.length < 2) {
      notify.warning('Select at least 2 draft distributions for the same barangay to group.')
      return
    }
    setGrouping(true)
    try {
      const res = await fetch('/api/distributions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'group', distributionIds: selectedDraftIds }),
        credentials: 'include',
      }).then((r) => r.json())

      if (res?.ok) {
        setSelectedDraftIds([])
        reload()
        notify.success('Draft distributions grouped.')
      } else {
        notify.error(res?.error || 'Failed to group distributions')
      }
    } catch (err) {
      notify.error(err.message)
    } finally {
      setGrouping(false)
    }
  }

  const handleBulkDeleteDrafts = async () => {
    if (!selectedDraftIds.length) return
    const count = selectedDraftIds.length
    const confirmed = await confirmAction({
      title: `Delete Selected Drafts`,
      message: `Are you sure you want to permanently delete ${count} selected draft ${count === 1 ? 'distribution' : 'distributions'}? This cannot be undone.`,
      confirmText: `Delete ${count} ${count === 1 ? 'Draft' : 'Drafts'}`,
      type: 'danger',
    })
    if (!confirmed) return

    try {
      await Promise.all(selectedDraftIds.map((id) => distributionsApi.remove(id)))
      notify.success(`Successfully deleted ${count} draft ${count === 1 ? 'distribution' : 'distributions'}.`)
      showSuccessModal('Successfully deleted.')
      setSelectedDraftIds([])
      reload()
      notifyBadgesChanged()
    } catch (err) {
      notify.error(err.message || 'Failed to delete selected draft distributions')
      reload()
    }
  }

  useEffect(() => {
    const incoming = location.state?.fromAllocations || (location.state?.prefillAllocation ? [location.state.prefillAllocation] : null)
    if (!incoming?.length || !barangays.length) return
    const prefilled = formFromAllocations(incoming, barangays)
    if (prefilled) {
      setForm(prefilled)
      setShowCreate(true)
      setEditRow(null)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, barangays, navigate])

  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('distributionId') || ''
    const code = searchParams.get('code') || ''
    const focus = searchParams.get('focus') || ''
    if (id || code || focus) {
      setDeepLink({ id, code, focus })
    }
  }, [searchParams])

  const contentReady = !loading && Array.isArray(data)
  const deepLinkRow = useMemo(() => {
    if (!contentReady) return null
    if (deepLink.id) return (data || []).find((d) => String(d.dbId) === String(deepLink.id)) || null
    if (deepLink.code) {
      return (data || []).find((d) => String(d.id).toLowerCase() === String(deepLink.code).toLowerCase()
        || String(d.eventName || '').toLowerCase().includes(String(deepLink.code).toLowerCase())) || null
    }
    return null
  }, [contentReady, data, deepLink.id, deepLink.code])

  const scrollTargetId = deepLink.focus === 'drafts'
    ? 'distributions-drafts'
    : (deepLinkRow || deepLink.focus === 'issues' || deepLink.id || deepLink.code
      ? 'distributions-table'
      : null)

  useHashScroll({ enabled: contentReady, deps: [data?.length] })
  useQueryFocus(contentReady && Boolean(scrollTargetId), scrollTargetId)

  useEffect(() => {
    if (!deepLinkRow) return
    setDetailRow(deepLinkRow)
    if (deepLinkRow.receiptStatus === 'Not Received' || deepLinkRow.proofStatus === 'Proof Submitted') {
      filters.setValue?.('status', deepLinkRow.status || 'all')
    }
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    next.delete('distributionId')
    next.delete('code')
    next.delete('focus')
    setSearchParams(next, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkRow?.dbId])

  useEffect(() => {
    if (!(showCreate || editRow) || !showVolunteerHelp) return
    if (!manpowerSkills.length) {
      setManpowerSuggestions([])
      return
    }
    volunteerMatchApi.suggest({ skills: manpowerSkills, programs: form.program ? [form.program] : [], limit: 5 })
      .then((res) => setManpowerSuggestions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setManpowerSuggestions([]))
  }, [showCreate, editRow, showVolunteerHelp, manpowerSkills, form.program])

  const openEdit = (row) => {
    setEditRow(row)
    setDetailRow(null)
    setStatusRow(null)
    setShowVolunteerHelp(false)
    setForm({
      eventName: row.eventName || '',
      location: row.location || '',
      beneficiaryId: row.beneficiaryId || '',
      program: row.program || '',
      distributionDate: row.distributionDate || (row.date && row.date !== '—' ? row.date : '') || '',
      scheduleTime: row.scheduleTime || '',
      beneficiaries: row.beneficiaries || '',
      volunteers: row.volunteers || '',
      vehicles: row.vehicles || '',
      distanceKm: row.distanceKm ?? '',
      status: row.status,
      type: row.type || 'Delivery',
      itemsSummary: row.itemsSummary || '',
      coordinator: row.coordinator || '',
      notes: row.notes || '',
      proofStatus: row.proofStatus || 'Awaiting Proof',
      allocationIds: row.allocationIds || [],
    })
  }

  const openStatus = (row) => {
    if (isTerminalStatus(row.status, DISTRIBUTION_TERMINAL)) {
      notify.info(`Distribution ${row.id || ''} is already Completed (final stage) and locked from status changes.`)
      return
    }
    setStatusRow(row)
    setStatusValue(row.status)
    setDetailRow(null)
  }

  const closeForm = () => {
    setEditRow(null)
    setShowCreate(false)
    setShowVolunteerHelp(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.beneficiaryId) {
      notify.warning('Please select a barangay for this delivery.')
      return
    }
    if (editRow && form.status !== editRow.status) {
      const check = validateStatusTransition({
        entityName: 'Distribution',
        currentStatus: editRow.status,
        nextStatus: form.status,
        workflowOrder: DISTRIBUTION_WORKFLOW,
        terminalStatuses: DISTRIBUTION_TERMINAL,
        aliases: DISTRIBUTION_ALIASES,
      })
      if (!check.valid) {
        notify.error(check.message)
        return
      }
    }
    if (form.distributionDate && isPastDateString(form.distributionDate)) {
      if (!editRow || form.distributionDate !== editRow.distributionDate) {
        notify.error('Distribution date cannot be in the past. Please select today or a future date.')
        return
      }
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      const payload = {
        eventName: form.eventName,
        location: form.location,
        beneficiaryId: Number(form.beneficiaryId),
        program: form.program,
        distributionDate: form.distributionDate,
        scheduleTime: form.scheduleTime,
        beneficiaries: Number(form.beneficiaries) || 0,
        volunteers: Number(form.volunteers) || 0,
        vehicles: Number(form.vehicles) || 0,
        distanceKm: form.type === 'Delivery' && form.distanceKm !== '' ? Number(form.distanceKm) : '',
        status: form.status,
        type: form.type,
        itemsSummary: form.itemsSummary,
        coordinator: form.coordinator,
        notes: form.notes,
        proofStatus: form.proofStatus,
      }

      if (editRow) {
        await distributionsApi.update(editRow.dbId, payload)
        setEditRow(null)
      } else {
        if (form.allocationIds?.length) {
          payload.allocationIds = form.allocationIds.map(Number)
        }
        await distributionsApi.create(payload)
        setShowCreate(false)
      }
      setShowVolunteerHelp(false)
      reload()
      notifyBadgesChanged()
      notify.success(editRow ? 'Delivery updated.' : 'Delivery created.')
      showSuccessModal(editRow ? 'Successfully updated.' : 'Successfully added.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (e) => {
    e.preventDefault()
    if (!statusRow) return
    const check = validateStatusTransition({
      entityName: 'Distribution',
      currentStatus: statusRow.status,
      nextStatus: statusValue,
      workflowOrder: DISTRIBUTION_WORKFLOW,
      terminalStatuses: DISTRIBUTION_TERMINAL,
      aliases: DISTRIBUTION_ALIASES,
    })
    if (!check.valid) {
      notify.error(check.message)
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await distributionsApi.update(statusRow.dbId, { status: statusValue })
      const status = res?.data?.status || statusValue
      setStatusRow(null)
      setDetailRow(null)
      reload()
      notifyBadgesChanged()
      notify.success(`Status successfully updated to: ${status}.`)
      showSuccessModal('Successfully updated.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirmAction({
      title: 'Delete Delivery',
      message: `Permanently delete delivery "${row.eventName || row.distributionCode || 'this delivery'}"? This cannot be undone.`,
      confirmText: 'Delete Delivery',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting delivery…')
    try {
      await distributionsApi.remove(row.dbId)
      setDetailRow(null)
      setEditRow(null)
      reload()
      notifyBadgesChanged()
      notify.success('Delivery deleted.')
      showSuccessModal('Successfully deleted.')
    } catch (err) {
      notify.error(err.message || 'Failed to delete distribution')
    } finally {
      hideLoading()
    }
  }

  const fromAllocation = !!form.allocationIds?.length

  const columns = [
    {
      key: 'request',
      label: 'Request ID',
      render: (row) => (
        <span className="alloc-request-id" title={row.request?.type || ''}>
          {row.request?.id || (row.requestId ? `#${row.requestId}` : '—')}
        </span>
      ),
    },
    {
      key: 'eventName',
      label: 'Delivery',
      render: (row) => (
        <div className="dist-cell-primary">
          <strong>{row.eventName || row.location || '—'}</strong>
          {row.itemsSummary ? <span>{row.itemsSummary}</span> : null}
        </div>
      ),
    },
    { key: 'barangay', label: 'Barangay' },
    { key: 'date', label: 'Date', render: (row) => row.date || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <RowActionsMenu
          items={[
            { label: 'View', icon: <Eye size={14} />, onClick: () => setDetailRow(row) },
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(row) },
            {
              label: 'Update status',
              icon: <ArrowRightCircle size={14} />,
              onClick: () => openStatus(row),
              hidden: WORKFLOW.indexOf(row.status) >= WORKFLOW.length - 1,
            },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Logistics & Distribution"
        description="Schedule and track deliveries. Approved resource allocations appear in the Ready to Schedule Queue below automatically."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setForm(emptyForm)
              setShowCreate(true)
              setEditRow(null)
              setShowVolunteerHelp(false)
            }}
          >
            + Plan Delivery
          </button>
        }
      />

      {planningDrafts.length > 0 && (
        <section id="distributions-drafts" className="admin-panel" style={{ marginBottom: '24px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📅 Ready to Schedule Queue ({planningDrafts.length})
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--admin-text-muted, #94a3b8)', fontSize: '0.88rem' }}>
                Auto-drafted distributions from approved allocations. Select date, team, and logistics to schedule delivery.
              </p>
            </div>
            {selectedDraftIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedDraftIds.length > 1 && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={handleGroupDrafts}
                    disabled={grouping}
                  >
                    {grouping ? 'Grouping...' : `Group Selected (${selectedDraftIds.length}) into 1 Distribution`}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                  onClick={handleBulkDeleteDrafts}
                >
                  Delete Selected ({selectedDraftIds.length})
                </button>
              </div>
            )}
          </div>

          <div className="see-more-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {draftsSeeMore.visible.map((draft) => {
              const isSelected = selectedDraftIds.includes(draft.dbId)
              return (
                <div
                  key={draft.dbId}
                  style={{
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--admin-surface, #1e293b)',
                    border: isSelected ? '1px solid #3b82f6' : '1px solid var(--admin-border, #334155)',
                    borderRadius: '10px',
                    padding: '16px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDraftIds((prev) => [...prev, draft.dbId])
                          } else {
                            setSelectedDraftIds((prev) => prev.filter((id) => id !== draft.dbId))
                          }
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--admin-text-muted, #94a3b8)' }}>
                        Draft
                      </span>
                    </div>
                    <StatusBadge status={draft.status} />
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--admin-text, #f1f5f9)' }}>
                    {draft.barangay || draft.eventName || 'Barangay'}
                  </h3>

                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '12px' }}>
                    📦 <strong>Items:</strong> {draft.itemsSummary || 'Packs allocated'}
                  </div>

                  {draft.requestPriority && (
                    <div style={{ fontSize: '0.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Urgency:</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        background: draft.requestPriority === 'Critical' ? '#fee2e2' : '#fefce8',
                        color: draft.requestPriority === 'Critical' ? '#dc2626' : '#d97706',
                      }}>
                        {draft.requestPriority}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      style={{ flex: 1 }}
                      onClick={() => openEdit(draft)}
                    >
                      Schedule Delivery &rarr;
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {draftsSeeMore.needsToggle && (
            <SeeMoreToggle
              expanded={draftsSeeMore.expanded}
              onToggle={draftsSeeMore.toggle}
              hiddenCount={draftsSeeMore.hiddenCount}
            />
          )}
          </div>
        </section>
      )}

      <FilterBar
        controller={filters}
        searchPlaceholder="Search deliveries by barangay or event..."
        exportConfig={{ filename: 'distribution-report', title: 'Distribution Report', columns, rows: filters.filtered }}
      />

      <div id="distributions-table">
        <ApiState loading={loading} error={error} onRetry={reload}>
          <DataTable
            columns={columns}
            data={filters.filtered}
            onRowClick={setDetailRow}
            pageSize={10}
            resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
            selectable={true}
            selectedIds={bulk.selectedIds}
            onSelectionChange={bulk.setSelectedIds}
            onBulkDelete={bulk.handleBulkDelete}
            deleting={bulk.deleting}
            bulkDeleteLabel="Delete Selected"
            noun="distributions"
          />
        </ApiState>
      </div>

      {/* =========================================================
          1. Delivery Details Modal (Compact & Tabbed Design)
          ========================================================= */}
      {detailRow && (
        <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="admin-modal dist-detail-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={detailRow.eventName || detailRow.barangay || detailRow.location || 'Delivery Details'}
              subtitle={`Logistics Event · ${[detailRow.barangay, detailRow.barangayMunicipality].filter(Boolean).join(', ') || detailRow.location || 'Barangay'}`}
              onClose={() => setDetailRow(null)}
            />

            {/* Fixed Top Essentials Overview */}
            <div className="dist-modal-overview">
              <div className="dist-overview-meta-row">
                <div className="dist-overview-left">
                  <span className="dist-overview-chip" title="Location">
                    <MapPin size={14} />
                    {[detailRow.barangay, detailRow.barangayMunicipality || detailRow.location]
                      .filter(Boolean)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .join(' · ') || '—'}
                  </span>
                  <span className="dist-overview-chip" title="Schedule">
                    <Calendar size={14} />
                    {detailRow.date || 'Unscheduled'}
                    {detailRow.scheduleTime ? ` · ${detailRow.scheduleTime}` : ''}
                  </span>
                  {detailRow.program && (
                    <span className="dist-overview-chip" title="Program">
                      <ClipboardList size={14} />
                      {detailRow.program}
                    </span>
                  )}
                </div>
                <div className="dist-overview-right">
                  <span className="dist-detail__code-badge">{detailRow.id || detailRow.code || 'DST'}</span>
                  <StatusBadge status={detailRow.status} />
                  {detailRow.type && <span className="dist-detail__pill">{detailRow.type}</span>}
                </div>
              </div>

              {/* Compact Mini Progress Tracker */}
              <div className="dist-mini-stepper" aria-label="Workflow progress">
                {WORKFLOW.map((step, idx) => {
                  const currIdx = WORKFLOW.indexOf(detailRow.status)
                  const isDone = currIdx > idx
                  const isActive = currIdx === idx
                  return (
                    <div
                      key={step}
                      className={`dist-mini-step ${isDone ? 'dist-mini-step--done' : ''} ${isActive ? 'dist-mini-step--active' : ''}`}
                    >
                      <span className="dist-mini-step__dot">
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <span className="dist-mini-step__label">{step}</span>
                      {idx < WORKFLOW.length - 1 && (
                        <span className={`dist-mini-step__line ${isDone ? 'dist-mini-step__line--done' : ''}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tabs Navigation Bar */}
            <div className="dist-tabs-bar">
              <button
                type="button"
                className={`dist-tab-btn ${detailTab === 'cargo' ? 'dist-tab-btn--active' : ''}`}
                onClick={() => setDetailTab('cargo')}
              >
                <Package size={14} /> Cargo &amp; Request
              </button>
              <button
                type="button"
                className={`dist-tab-btn ${detailTab === 'logistics' ? 'dist-tab-btn--active' : ''}`}
                onClick={() => setDetailTab('logistics')}
              >
                <Truck size={14} /> Logistics &amp; Team
              </button>
              <button
                type="button"
                className={`dist-tab-btn ${detailTab === 'proof' ? 'dist-tab-btn--active' : ''}`}
                onClick={() => setDetailTab('proof')}
              >
                <FileCheck size={14} /> Proof &amp; Receipt
                {(detailRow.proofsCount > 0 || detailRow.receivedQuantity != null) && (
                  <span className="dist-tab-badge">✓</span>
                )}
              </button>
              {(detailRow.notes || (detailRow.statusActivity || []).length > 0) && (
                <button
                  type="button"
                  className={`dist-tab-btn ${detailTab === 'notes' ? 'dist-tab-btn--active' : ''}`}
                  onClick={() => setDetailTab('notes')}
                >
                  <StickyNote size={14} /> Notes &amp; History
                </button>
              )}
            </div>

            {/* Tab Content Body (Scrolls inside bounding box if needed) */}
            <div className="dist-tab-content-body">
              {detailTab === 'cargo' && (
                <>
                  <div className="dist-info-tile">
                    <span className="dist-info-tile__label">Items to Deliver</span>
                    <div className="dist-info-tile__value">
                      {detailRow.itemsSummary ? (
                        <div className="dist-tag-list">
                          {String(detailRow.itemsSummary)
                            .split(/;|\n/)
                            .map((item) => item.trim())
                            .filter(Boolean)
                            .map((item) => (
                              <span key={item} className="dist-tag-chip">
                                <Package size={12} style={{ color: '#AF101A' }} /> {item}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>No items specified</span>
                      )}
                    </div>
                  </div>

                  <div className="dist-info-grid-2">
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Linked Relief Request</span>
                      <div className="dist-info-tile__value">
                        {detailRow.request?.id || detailRow.requestId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span className="alloc-request-id">
                              {detailRow.request?.id || `#${detailRow.requestId}`}
                            </span>
                            {detailRow.request?.type && (
                              <small style={{ color: '#64748b' }}>· {detailRow.request.type}</small>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Manual Delivery (No linked request)</span>
                        )}
                      </div>
                    </div>
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Target Beneficiaries</span>
                      <div className="dist-info-tile__value">
                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                          {detailRow.beneficiaries ?? '—'}
                        </strong>{' '}
                        <span style={{ color: '#64748b', fontSize: '0.84rem' }}>Families / Recipients</span>
                      </div>
                    </div>
                  </div>

                  <div className="dist-info-tile">
                    <span className="dist-info-tile__label">Drop-off Location / Address</span>
                    <div className="dist-info-tile__value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} style={{ color: '#AF101A' }} />
                      {detailRow.location || '—'}
                    </div>
                  </div>
                </>
              )}

              {detailTab === 'logistics' && (
                <>
                  <div className="dist-stat-strip">
                    <div className="dist-stat-item">
                      <strong>{detailRow.volunteers ?? 0}</strong>
                      <span>Volunteers</span>
                    </div>
                    <div className="dist-stat-item">
                      <strong>{detailRow.vehicles ?? 0}</strong>
                      <span>Vehicles</span>
                    </div>
                    <div className="dist-stat-item">
                      <strong>{detailRow.distanceKm != null ? `${detailRow.distanceKm} km` : '—'}</strong>
                      <span>Distance</span>
                    </div>
                    <div className="dist-stat-item">
                      <strong>{detailRow.type || 'Delivery'}</strong>
                      <span>Type</span>
                    </div>
                  </div>

                  <div className="dist-info-grid-2">
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Assigned Coordinator</span>
                      <div className="dist-info-tile__value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <UserRound size={13} style={{ color: '#AF101A' }} />
                        {detailRow.coordinator || 'Unassigned'}
                      </div>
                    </div>
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Fuel / Transport Cost</span>
                      <div className="dist-info-tile__value">
                        {detailRow.fuelLiters != null ? (
                          <span>
                            <Fuel size={12} style={{ display: 'inline', marginRight: '3px' }} />
                            {detailRow.fuelLiters} L
                            {detailRow.fuelCost != null ? ` · ₱${Number(detailRow.fuelCost).toLocaleString()}` : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Standard dispatch</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(detailRow.allocations || []).length > 0 && (
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Source Allocation Batches</span>
                      <div className="dist-tag-list">
                        {detailRow.allocations.map((a) => (
                          <span key={a.dbId || a.id || `${a.resource}-${a.quantity}`} className="dist-tag-chip">
                            {a.resource} × {a.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'proof' && (
                <>
                  <div className="dist-info-grid-2">
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Turnover Proof Status</span>
                      <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <StatusBadge status={detailRow.proofStatus} />
                        <small style={{ color: '#64748b' }}>
                          {detailRow.proofsCount ?? 0} verification photos uploaded
                        </small>
                      </div>
                    </div>
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Barangay Receipt Confirmation</span>
                      <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <StatusBadge status={detailRow.receiptStatus} />
                        <small style={{ color: '#64748b' }}>
                          {detailRow.receivedQuantity != null
                            ? `${detailRow.receivedQuantity} received${detailRow.receivedAt ? ` on ${detailRow.receivedAt}` : ''}`
                            : 'Awaiting barangay acknowledgment'}
                        </small>
                      </div>
                    </div>
                  </div>

                  {detailRow.receiptNotes && (
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Barangay Remarks / Feedback</span>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.4 }}>
                        {detailRow.receiptNotes}
                      </p>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'notes' && (
                <>
                  {detailRow.notes && (
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Logistics Notes</span>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                        {detailRow.notes}
                      </p>
                    </div>
                  )}

                  {(detailRow.statusActivity || []).length > 0 && (
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Status Activity Log</span>
                      <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                        {detailRow.statusActivity.map((evt, idx) => (
                          <li
                            key={`${evt.atRaw || evt.at}-${idx}`}
                            style={{
                              padding: '0.35rem 0',
                              borderBottom: idx < detailRow.statusActivity.length - 1 ? '1px solid #e2e8f0' : 'none',
                            }}
                          >
                            <strong style={{ display: 'block', fontSize: '0.82rem', color: '#0f172a' }}>{evt.title}</strong>
                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{evt.message}</span>
                            {evt.at && (
                              <small style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem' }}>{evt.at}</small>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Fixed Bottom Actions Footer */}
            <div className="dist-modal-footer">
              <button type="button" className="btn btn--primary btn--sm" onClick={() => openEdit(detailRow)}>
                <Pencil size={13} /> Edit Delivery
              </button>
              {WORKFLOW.indexOf(detailRow.status) < WORKFLOW.length - 1 && (
                <button type="button" className="btn btn--outline btn--sm" onClick={() => openStatus(detailRow)}>
                  <ArrowRightCircle size={13} /> Update Status
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(detailRow)}>
                Delete
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDetailRow(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          2. Update Status Modal
          ========================================================= */}
      {statusRow && (
        <div className="admin-modal-overlay" onClick={() => setStatusRow(null)}>
          <div className="admin-modal dist-status-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Update Status"
              subtitle={statusRow.eventName || statusRow.barangay || 'Delivery Progress'}
              onClose={() => setStatusRow(null)}
            />
            <form onSubmit={handleUpdateStatus}>
              <div className="dist-status-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>Current Status:</span>
                  <StatusBadge status={statusRow.status} />
                </div>
                <label>
                  Advance to Next Status
                  <select required value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                    {getAvailableNextStatuses({
                      currentStatus: statusRow.status,
                      allStatuses: WORKFLOW,
                      workflowOrder: DISTRIBUTION_WORKFLOW,
                      terminalStatuses: DISTRIBUTION_TERMINAL,
                      aliases: DISTRIBUTION_ALIASES,
                    }).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="dist-modal-footer">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatusRow(null)}>Cancel</button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>{saving ? 'Saving...' : 'Update Status'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          3. Plan / Edit Delivery Modal (Compact & Tabbed)
          ========================================================= */}
      {(editRow || showCreate) && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal dist-form-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? 'Edit Delivery' : 'Plan Delivery'}
              subtitle={editRow ? `Editing ${editRow.eventName || editRow.code || 'Delivery'}` : 'Schedule relief delivery and assign logistics'}
              onClose={closeForm}
            />

            <form onSubmit={handleSave}>
              {fromAllocation && (
                <div className="alloc-handoff-banner" style={{ margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
                  Items and barangay pre-filled from Resource Allocation.
                </div>
              )}

              {/* Tabs for Form */}
              <div className="dist-tabs-bar">
                <button
                  type="button"
                  className={`dist-tab-btn ${formTab === 'destination' ? 'dist-tab-btn--active' : ''}`}
                  onClick={() => setFormTab('destination')}
                >
                  <MapPin size={14} /> 1. Destination &amp; Time
                </button>
                <button
                  type="button"
                  className={`dist-tab-btn ${formTab === 'logistics' ? 'dist-tab-btn--active' : ''}`}
                  onClick={() => setFormTab('logistics')}
                >
                  <Truck size={14} /> 2. Cargo &amp; Logistics
                </button>
                <button
                  type="button"
                  className={`dist-tab-btn ${formTab === 'requirements' ? 'dist-tab-btn--active' : ''}`}
                  onClick={() => setFormTab('requirements')}
                >
                  <FileCheck size={14} /> 3. Status &amp; Notes
                </button>
              </div>

              <div className="dist-tab-content-body">
                {formTab === 'destination' && (
                  <>
                    <div className="dist-form-grid-2">
                      <label>
                        Delivery Event Name
                        <input
                          value={form.eventName}
                          onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                          placeholder="e.g. Food pack delivery — Brgy. Talisay"
                        />
                      </label>
                      <label>
                        Barangay *
                        <select
                          required
                          disabled={fromAllocation}
                          value={form.beneficiaryId}
                          onChange={(e) => {
                            const id = e.target.value
                            const brgy = barangays.find((b) => String(b.dbId) === id)
                            setForm({
                              ...form,
                              beneficiaryId: id,
                              location: form.location || brgy?.barangay || brgy?.name || '',
                              eventName: form.eventName || (brgy ? `Delivery — ${brgy.barangay || brgy.name}` : ''),
                              beneficiaries: form.beneficiaries || String(brgy?.affectedFamilies || ''),
                            })
                          }}
                        >
                          <option value="">Select barangay…</option>
                          {barangays.map((b) => (
                            <option key={b.dbId} value={b.dbId}>{b.barangay || b.name} — {b.affectedFamilies || 0} families</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label>
                      Drop-off Location / Address *
                      <input
                        required
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        placeholder="e.g. Barangay Hall / Evacuation Center"
                      />
                    </label>

                    <div className="dist-form-grid-2">
                      <label>
                        Distribution Date
                        <input
                          type="date"
                          min={getTodayDateString()}
                          value={form.distributionDate}
                          onChange={(e) => setForm({ ...form, distributionDate: e.target.value })}
                        />
                      </label>
                      <label>
                        Schedule Time
                        <input
                          type="time"
                          value={form.scheduleTime}
                          onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="dist-form-grid-2">
                      <label>
                        Delivery Type
                        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                          {['Delivery', 'Pickup', 'Mobile Distribution'].map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <label>
                        Target Families / Beneficiaries
                        <input
                          type="number"
                          min="0"
                          value={form.beneficiaries}
                          onChange={(e) => setForm({ ...form, beneficiaries: e.target.value })}
                        />
                      </label>
                    </div>
                  </>
                )}

                {formTab === 'logistics' && (
                  <>
                    <label>
                      Items to Deliver
                      <textarea
                        rows={2}
                        value={form.itemsSummary}
                        onChange={(e) => setForm({ ...form, itemsSummary: e.target.value })}
                        placeholder="e.g. Rice packs × 50; Hygiene kits × 30"
                        readOnly={fromAllocation}
                      />
                    </label>

                    <label>
                      Coordinator in Charge
                      <input
                        value={form.coordinator}
                        onChange={(e) => setForm({ ...form, coordinator: e.target.value })}
                        placeholder="Staff / Volunteer in charge"
                      />
                    </label>

                    <div className="dist-form-grid-3">
                      <label>
                        Volunteers Needed
                        <input
                          type="number"
                          min="0"
                          value={form.volunteers}
                          onChange={(e) => setForm({ ...form, volunteers: e.target.value })}
                        />
                      </label>
                      <label>
                        Vehicles
                        <input
                          type="number"
                          min="0"
                          value={form.vehicles}
                          onChange={(e) => setForm({ ...form, vehicles: e.target.value })}
                        />
                      </label>
                      {form.type === 'Delivery' && (
                        <label>
                          Distance (km)
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={form.distanceKm}
                            onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
                          />
                        </label>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => setShowVolunteerHelp((v) => !v)}
                      >
                        {showVolunteerHelp ? 'Hide Volunteer Suggestions' : '🔍 Suggest Volunteers by Skill'}
                      </button>

                      {showVolunteerHelp && (
                        <div className="suggested-volunteers" style={{ marginTop: '0.5rem', padding: '0.75rem' }}>
                          <SkillTagPicker
                            label="Skills needed"
                            value={manpowerSkills}
                            showOther={false}
                            onChange={setManpowerSkills}
                          />
                          {manpowerSuggestions.length === 0 ? (
                            <p className="beneficiary-view-empty" style={{ margin: '0.4rem 0', fontSize: '0.8rem' }}>No matches yet — adjust skills above.</p>
                          ) : (
                            <ul className="suggested-volunteers__list" style={{ marginTop: '0.4rem', gap: '0.4rem' }}>
                              {manpowerSuggestions.map((s) => (
                                <li key={s.dbId} className="suggested-volunteers__item" style={{ padding: '0.6rem 0.75rem' }}>
                                  <div>
                                    <strong style={{ fontSize: '0.85rem' }}>{s.name}</strong>
                                    <p style={{ fontSize: '0.78rem', margin: 0 }}>{s.whyMatched}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {formTab === 'requirements' && (
                  <>
                    <div className="dist-form-grid-2">
                      <label>
                        Workflow Status
                        <select
                          value={form.status}
                          disabled={editRow && isTerminalStatus(editRow.status, DISTRIBUTION_TERMINAL)}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                        >
                          {getAvailableNextStatuses({
                            currentStatus: editRow ? editRow.status : form.status,
                            allStatuses: WORKFLOW,
                            workflowOrder: DISTRIBUTION_WORKFLOW,
                            terminalStatuses: DISTRIBUTION_TERMINAL,
                            aliases: DISTRIBUTION_ALIASES,
                          }).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {editRow && isTerminalStatus(editRow.status, DISTRIBUTION_TERMINAL) && (
                          <small style={{ display: 'block', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                            🔒 Status is finalized and locked.
                          </small>
                        )}
                      </label>
                      <label>
                        Proof Requirement
                        <select value={form.proofStatus} onChange={(e) => setForm({ ...form, proofStatus: e.target.value })}>
                          {PROOF_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                    </div>
                    <label>
                      Logistics Notes
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Optional instructions or notes for the delivery team"
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Form Footer */}
              <div className="dist-modal-footer">
                <button type="button" className="btn btn--ghost btn--sm" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                  {saving ? 'Saving...' : (editRow ? 'Save Changes' : 'Save Delivery')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
