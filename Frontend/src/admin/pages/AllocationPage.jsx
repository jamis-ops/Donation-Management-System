import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { 
  Eye, Pencil, ArrowRightCircle, Truck, Sparkles, CheckCircle2, X, Plus,
  Package, Users, Calendar, MapPin, FileText, Tag, Banknote, Clock, Check, AlertCircle, Trash2, ArrowRight
} from 'lucide-react'
import { allocationsApi, beneficiariesApi, needsStockApi, assistanceRequestsApi, inventoryApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import RowActionsMenu from '../components/shared/RowActionsMenu'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../components/shared/SeeMoreList'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { notify } from '../../utils/toast'
import { confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import {
  ALLOCATION_WORKFLOW,
  ALLOCATION_TERMINAL,
  ALLOCATION_BRANCHES,
  getAvailableNextStatuses,
  validateStatusTransition,
  isTerminalStatus,
} from '../../utils/workflow'
import { useLoading } from '../../context/LoadingContext'

const STATUS_OPTIONS = ['Pending', 'Reserved', 'Allocated', 'Delivered', 'Cancelled']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical']

// How many packs a single affected family is assumed to need for one listed need.
const PACKS_PER_FAMILY = 1

const filterConfig = {
  searchKeys: ['resource', 'program', 'beneficiary'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'program', label: 'Program' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  // Multiple resources to allocate: [{ key, resource, quantity }]
  lines: [],
  program: '',
  beneficiaryId: '',
  assistanceRequestId: '',
  status: 'Pending',
  priority: 'Medium',
  notes: '',
}

let lineKeySeq = 0
function nextLineKey() {
  lineKeySeq += 1
  return `line-${lineKeySeq}`
}

function makeLine(resource = '', quantity = '') {
  return { key: nextLineKey(), resource, quantity: quantity === 0 ? '' : String(quantity || '') }
}

/** Parse structured notes written by the barangay request form. */
function parseRequestDetails(request) {
  if (!request) return null
  const notes = String(request.notes || '')
  const pick = (re) => {
    const m = notes.match(re)
    return m ? m[1].trim() : ''
  }

  const reason = pick(/Calamity\/Program:\s*(.+?)(?:\n|$)/i)
    || (Array.isArray(request.calamityTags) && request.calamityTags[0])
    || ''
  const assistanceType = pick(/Assistance Type:\s*(.+?)(?:\n|$)/i) || request.type || ''
  const familiesRaw = pick(/Families Affected:\s*(\d+)/i)
  const familiesAffected = familiesRaw
    ? Number(familiesRaw)
    : (Number(request.affectedFamilies) || 0)
  const goodsRaw = pick(/Goods Required:\s*(.+?)(?:\n|$)/i)
  const goods = goodsRaw
    ? goodsRaw.split(',').map((g) => g.trim()).filter(Boolean)
    : []
  const additionalNotes = pick(/Additional Notes:\s*([\s\S]+)/i)

  return {
    reason,
    assistanceType,
    familiesAffected,
    goods,
    priority: request.priority || 'Medium',
    additionalNotes,
    status: request.status || '',
    reference: request.id || request.code || '',
  }
}

function suggestedQuantityFromFamilies(families) {
  const n = Number(families) || 0
  return n * PACKS_PER_FAMILY
}

function suggestedQuantity(barangay) {
  if (!barangay) return 0
  return suggestedQuantityFromFamilies(barangay.affectedFamilies)
}

const styles = `
.alloc-detail-modal {
  max-width: 820px !important;
  width: 95vw !important;
  padding: 0 !important;
  border-radius: 14px !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
}

.alloc-detail-modal .admin-modal__header {
  margin: 0 !important;
  top: 0 !important;
  position: static !important;
  padding: 1.1rem 1.35rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  background: linear-gradient(135deg, #AF101A 0%, #8E0D15 100%) !important;
  border-top-left-radius: 14px !important;
  border-top-right-radius: 14px !important;
  box-shadow: none !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
}

.alloc-detail-modal .admin-modal__header h2 {
  font-size: 1.15rem !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.3 !important;
}

.alloc-detail-modal .admin-modal__close {
  margin: 0 !important;
  width: 32px !important;
  height: 32px !important;
  background: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  border-radius: 8px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}
.alloc-detail-modal .admin-modal__close:hover {
  background: rgba(255, 255, 255, 0.25) !important;
  transform: scale(1.05) !important;
}

.alloc-detail-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.alloc-detail-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alloc-meta-strip {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.alloc-detail-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 1rem;
  padding: 1.25rem;
  background: #ffffff;
  overflow-y: auto;
  max-height: calc(85vh - 180px);
}

.alloc-col {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
}

.alloc-section-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alloc-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.alloc-section-title {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.alloc-cargo-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.35;
  margin: 0;
}

.alloc-cargo-metric-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.alloc-qty-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 700;
}

.alloc-program-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
}

.alloc-funding-pill {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: #fefce8;
  border: 1px solid #fef08a;
  color: #854d0e;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8rem;
  line-height: 1.4;
}

.alloc-notes-box {
  font-size: 0.82rem;
  color: #334155;
  line-height: 1.45;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 0.65rem 0.75rem;
  border-radius: 6px;
  word-break: break-word;
}

.alloc-bstat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.alloc-bstat {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.alloc-bstat-label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.alloc-bstat-val {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}

.alloc-req-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.alloc-dispatch-card {
  grid-column: 1 / -1;
  border-radius: 8px;
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.alloc-dispatch-card--ready {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}
.alloc-dispatch-card--planned {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
}

.alloc-dispatch-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: linear-gradient(135deg, #AF101A 0%, #8E0D15 100%);
  color: #ffffff !important;
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.95rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(175, 16, 26, 0.25);
  text-decoration: none;
}
.alloc-dispatch-btn:hover {
  background: linear-gradient(135deg, #8E0D15 0%, #700a10 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(175, 16, 26, 0.35);
}

.alloc-detail-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .alloc-detail-grid {
    grid-template-columns: 1fr;
    padding: 0.85rem;
  }
}
`;

export default function AllocationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, loading, error, reload } = useApiList(() => allocationsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const { data: requests } = useApiList(() => assistanceRequestsApi.list())
  const { data: inventoryData } = useApiList(() => inventoryApi.list())
  const filters = useFilters(data, filterConfig)
  const bulk = useBulkSelection(
    filters.filtered,
    (id) => allocationsApi.remove(id),
    reload,
    'allocations',
  )
  const [detailRow, setDetailRow] = useState(null)
  const { showLoading, hideLoading } = useLoading()
  const [editRow, setEditRow] = useState(null)
  const [statusRow, setStatusRow] = useState(null)
  const [statusValue, setStatusValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    const s = document.createElement('style')
    s.textContent = styles
    document.head.appendChild(s)
    return () => s.remove()
  }, [])
  const [saving, setSaving] = useState(false)
  const [recs, setRecs] = useState([])
  const [needsSummary, setNeedsSummary] = useState(null)
  const [beneficiaryNeeds, setBeneficiaryNeeds] = useState([])
  const [draftNotice, setDraftNotice] = useState(null)
  const needsSeeMore = useSeeMore(beneficiaryNeeds, 3)
  const recsSeeMore = useSeeMore(recs, 3)

  // Display-only: inventory items whose unit is packs
  const inventoryPacks = (inventoryData || []).filter((item) => {
    const unit = String(item.unit || '').toLowerCase()
    return unit.includes('pack')
  })

  const updateLine = (key, patch) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }))
  }

  const removeLine = (key) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((line) => line.key !== key),
    }))
  }

  const addLine = (resource = '', quantity = '') => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, makeLine(resource, quantity)],
    }))
  }

  const seedLinesFromRequest = (details, existingLines = []) => {
    const qty = suggestedQuantityFromFamilies(details?.familiesAffected)
    const goods = details?.goods || []
    if (!goods.length) {
      return existingLines.length ? existingLines : [makeLine('', qty || '')]
    }
    return goods.map((g) => makeLine(g, qty || ''))
  }

  useEffect(() => {
    const pref = location.state?.prefillRequest
    if (!pref) return

    const requestId = pref.requestId || pref.assistanceRequestId
    // Wait for requests list when a specific request was passed in
    if (requestId && !(requests || []).length) {
      setShowCreate(true)
      return
    }

    const req = requestId
      ? (requests || []).find((r) => String(r.dbId) === String(requestId))
      : null

    if (req) {
      const details = parseRequestDetails(req)
      setForm({
        ...emptyForm,
        lines: seedLinesFromRequest(details),
        program: pref.program || details.assistanceType || pref.type || '',
        beneficiaryId: String(pref.beneficiaryId || req.beneficiaryId || ''),
        assistanceRequestId: String(requestId),
        priority: details.priority || 'Medium',
        notes: '',
        status: 'Allocated',
      })
    } else {
      setForm({
        ...emptyForm,
        lines: [makeLine(pref.resource || pref.type || '', pref.quantity || '')],
        program: pref.program || pref.type || '',
        beneficiaryId: pref.beneficiaryId ? String(pref.beneficiaryId) : '',
        assistanceRequestId: requestId ? String(requestId) : '',
        notes: '',
        status: 'Allocated',
      })
    }

    setShowCreate(true)
    window.history.replaceState({}, document.title)
  }, [location.state, requests])

  useEffect(() => {
    needsStockApi.get()
      .then((res) => {
        setRecs(res.data?.recommendations || [])
        setNeedsSummary(res.data?.summary || null)
        setBeneficiaryNeeds(res.data?.beneficiaries || [])
      })
      .catch(() => {
        setRecs([])
        setNeedsSummary(null)
        setBeneficiaryNeeds([])
      })
  }, [data])

  const selectedBarangay = barangays.find((b) => String(b.dbId) === String(form.beneficiaryId))
  const selectedRequest = (requests || []).find((r) => String(r.dbId) === String(form.assistanceRequestId))
  const requestDetails = parseRequestDetails(selectedRequest)
  const barangayRequests = (requests || []).filter((r) => {
    // Only show requests still waiting for allocation on the relief side
    if (['Allocated', 'Completed', 'Rejected', 'Cancelled', 'Done'].includes(r.status)) return false
    if (!form.beneficiaryId) return true
    return Number(r.beneficiaryId) === Number(form.beneficiaryId)
  })
  const familiesForSuggestion = requestDetails?.familiesAffected
    || Number(selectedBarangay?.affectedFamilies)
    || 0
  const recommendedQty = suggestedQuantityFromFamilies(familiesForSuggestion)

  const applyRequestToForm = (requestId, prev = form) => {
    const req = (requests || []).find((r) => String(r.dbId) === String(requestId))
    if (!req) {
      return { ...prev, assistanceRequestId: requestId, lines: prev.lines.length ? prev.lines : [makeLine()] }
    }
    const details = parseRequestDetails(req)
    return {
      ...prev,
      assistanceRequestId: String(req.dbId),
      beneficiaryId: String(req.beneficiaryId || prev.beneficiaryId || ''),
      priority: details.priority || prev.priority,
      program: details.assistanceType || details.goods[0] || prev.program,
      lines: seedLinesFromRequest(details),
    }
  }

  const openEdit = (row) => {
    setEditRow(row)
    setDetailRow(null)
    setStatusRow(null)
    setForm({
      lines: [makeLine(row.resource || '', row.quantity || '')],
      program: row.program || '',
      beneficiaryId: row.beneficiaryId || '',
      assistanceRequestId: row.assistanceRequestId || '',
      status: row.status,
      priority: row.priority || 'Medium',
      notes: row.notes || '',
    })
  }

  const openStatus = (row) => {
    if (isTerminalStatus(row.status, ALLOCATION_TERMINAL)) {
      notify.info(`Allocation ${row.id || ''} is already ${row.status} (final stage) and locked from status changes.`)
      return
    }
    setStatusRow(row)
    setStatusValue(row.status)
    setDetailRow(null)
  }

  const applyRecommendation = (rec) => {
    setShowCreate(true)
    setEditRow(null)
    setDetailRow(null)
    setForm({
      lines: [makeLine(rec.resource || '', rec.quantity || '')],
      program: rec.requestType || rec.need || '',
      beneficiaryId: rec.beneficiaryId || '',
      assistanceRequestId: rec.assistanceRequestId || '',
      status: 'Reserved',
      priority: rec.priority || 'Medium',
      notes: rec.reason || '',
    })
  }

  const quickAllocateForNeed = (barangay, need) => {
    const qty = suggestedQuantity(barangay)
    setDetailRow(null)
    setEditRow(null)
    setForm({
      ...emptyForm,
      lines: [makeLine(need, qty || '')],
      program: need,
      beneficiaryId: String(barangay.beneficiaryId ?? barangay.dbId ?? ''),
      priority: barangay.status === 'Critical' ? 'Critical' : 'Medium',
      notes: qty
        ? `Auto-suggested: ${barangay.affectedFamilies || 0} affected families × ${PACKS_PER_FAMILY} pack(s) for "${need}".`
        : '',
    })
    setShowCreate(true)
  }

  const planDistribution = (rows) => {
    const list = Array.isArray(rows) ? rows : [rows]
    const ready = list.filter((r) => ['Reserved', 'Allocated'].includes(r.status) && !r.distributionId)
    if (!ready.length) {
      notify.warning('Select Reserved/Allocated items that are not yet linked to a distribution.')
      return
    }
    const benIds = [...new Set(ready.map((r) => r.beneficiaryId).filter(Boolean))]
    if (benIds.length !== 1) {
      notify.warning('Plan distribution for one barangay at a time. Select allocations for the same barangay.')
      return
    }
    navigate('/admin/distributions', {
      state: {
        fromAllocations: ready.map((r) => ({
          dbId: r.dbId,
          id: r.id,
          resource: r.resource,
          quantity: r.quantity,
          beneficiaryId: r.beneficiaryId,
          beneficiary: r.beneficiary,
          program: r.program,
          affectedFamilies: r.affectedFamilies,
        })),
      },
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const lines = (form.lines || []).filter((l) => String(l.resource || '').trim())
    if (!lines.length) {
      notify.warning('Add at least one resource pack (e.g. rice, water) with a name.')
      return
    }
    for (const line of lines) {
      if (!line.quantity || Number(line.quantity) < 1) {
        notify.warning(`Enter a valid quantity for "${line.resource}".`)
        return
      }
    }

    setSaving(true)
    showLoading('Saving…')
    try {
      const ben = barangays.find((b) => Number(b.dbId) === Number(form.beneficiaryId))
      const benName = ben?.barangay || ben?.name || ben?.fullName || ''
      if (editRow) {
        if (form.status !== editRow.status) {
          const check = validateStatusTransition({
            entityName: 'Allocation',
            currentStatus: editRow.status,
            nextStatus: form.status,
            workflowOrder: ALLOCATION_WORKFLOW,
            terminalStatuses: ALLOCATION_TERMINAL,
            branches: ALLOCATION_BRANCHES,
          })
          if (!check.valid) {
            notify.error(check.message)
            return
          }
        }
        const res = await allocationsApi.update(editRow.dbId, {
          resource: lines[0]?.resource?.trim() || form.lines[0]?.resource?.trim(),
          quantity: Number(lines[0]?.quantity || form.lines[0]?.quantity || 0),
          program: form.program,
          beneficiaryId: form.beneficiaryId ? Number(form.beneficiaryId) : null,
          beneficiary: benName,
          assistanceRequestId: form.assistanceRequestId ? Number(form.assistanceRequestId) : null,
          status: form.status,
          priority: form.priority,
          notes: form.notes,
        })
        setEditRow(null)
        if (res?.draftDistributionCreated) {
          setDraftNotice({
            id: res.draftDistributionId,
            code: res.draftDistributionCode,
            barangay: benName,
          })
        }
      } else {
        let lastDraftInfo = null
        for (const line of lines) {
          const payload = {
            resource: line.resource.trim(),
            quantity: Number(line.quantity),
            program: form.program,
            beneficiaryId: form.beneficiaryId ? Number(form.beneficiaryId) : null,
            beneficiary: benName,
            assistanceRequestId: form.assistanceRequestId ? Number(form.assistanceRequestId) : null,
            status: form.status,
            priority: form.priority,
            notes: form.notes,
          }
          const res = await allocationsApi.create(payload)
          if (res?.draftDistributionCreated) {
            lastDraftInfo = {
              id: res.draftDistributionId,
              code: res.draftDistributionCode,
              barangay: benName,
            }
          }
        }
        if (lastDraftInfo) setDraftNotice(lastDraftInfo)
        setShowCreate(false)
        setForm(emptyForm)
      }

      reload()
      notifyBadgesChanged()
      notify.success(editRow ? 'Allocation updated.' : 'Allocation saved.')
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
      entityName: 'Allocation',
      currentStatus: statusRow.status,
      nextStatus: statusValue,
      workflowOrder: ALLOCATION_WORKFLOW,
      terminalStatuses: ALLOCATION_TERMINAL,
      branches: ALLOCATION_BRANCHES,
    })
    if (!check.valid) {
      notify.error(check.message)
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await allocationsApi.update(statusRow.dbId, { status: statusValue })
      if (res?.draftDistributionCreated) {
        setDraftNotice({
          id: res.draftDistributionId,
          code: res.draftDistributionCode,
          barangay: statusRow.beneficiary || 'Barangay',
        })
      }
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
      title: 'Delete Allocation',
      message: `Permanently delete allocation ${row.id} for "${row.resource}"? This cannot be undone.`,
      confirmText: 'Delete Allocation',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting allocation…')
    try {
      await allocationsApi.remove(row.dbId)
      notify.success(`Allocation ${row.id} deleted.`)
      showSuccessModal('Successfully deleted.')
      reload()
      notifyBadgesChanged()
      if (detailRow?.dbId === row.dbId) setDetailRow(null)
    } catch (err) {
      notify.error(err.message || 'Failed to delete allocation')
    } finally {
      hideLoading()
    }
  }

  const linkedRequest = (row) => {
    if (!row?.assistanceRequestId) return null
    return (requests || []).find((r) => Number(r.dbId) === Number(row.assistanceRequestId))
  }

  const canPlan = (row) => Boolean(row && !row.distributionId && ['Reserved', 'Allocated'].includes(row.status))

  const closeForm = () => {
    setEditRow(null)
    setShowCreate(false)
  }

  const columns = [
    {
      key: 'request',
      label: 'Request ID',
      exportValue: (row) => row.assistanceRequestCode || row.request?.id || (row.assistanceRequestId ? `#${row.assistanceRequestId}` : '—'),
      render: (row) => (
        <span className="alloc-request-id" title={row.assistanceRequestType || ''}>
          {row.assistanceRequestCode || (row.assistanceRequestId ? `#${row.assistanceRequestId}` : '—')}
        </span>
      ),
    },
    { key: 'resource', label: 'Resource' },
    { key: 'quantity', label: 'Qty' },
    { key: 'beneficiary', label: 'Barangay' },
    {
      key: 'needs',
      label: 'Needs',
      exportValue: (row) => (row.beneficiaryNeeds || []).join(', ') || '—',
      render: (row) => (
        <span className="alloc-needs-cell" title={(row.beneficiaryNeeds || []).join(', ')}>
          {(row.beneficiaryNeeds || []).slice(0, 2).join(', ') || '—'}
          {(row.beneficiaryNeeds || []).length > 2 ? '…' : ''}
        </span>
      ),
    },
    { key: 'priority', label: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', label: 'Date' },
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
              hidden: row.status === 'Delivered' || row.status === 'Cancelled',
            },
            {
              label: 'Plan distribution',
              icon: <Truck size={14} />,
              onClick: () => planDistribution(row),
              hidden: !canPlan(row),
            },
          ]}
        />
      ),
    },
  ]

  const goodsOptions = requestDetails?.goods || []
  const needOptions = goodsOptions.length ? goodsOptions : (selectedBarangay?.needs || [])

  const FormFields = (
    <>
      <label>
        Target Barangay
        <select
          value={form.beneficiaryId}
          onChange={(e) => {
            const id = e.target.value
            setForm((f) => {
              const stillValid = !f.assistanceRequestId || (requests || []).some(
                (r) => String(r.dbId) === String(f.assistanceRequestId)
                  && Number(r.beneficiaryId) === Number(id),
              )
              return {
                ...f,
                beneficiaryId: id,
                assistanceRequestId: stillValid ? f.assistanceRequestId : '',
              }
            })
          }}
        >
          <option value="">Select barangay</option>
          {barangays.map((b) => {
            const openCount = (requests || []).filter(
              (r) => Number(r.beneficiaryId) === Number(b.dbId)
                && !['Completed', 'Rejected', 'Cancelled', 'Done'].includes(r.status),
            ).length
            return (
              <option key={b.dbId} value={b.dbId}>
                {b.barangay || b.name}
                {openCount ? ` — ${openCount} open request${openCount === 1 ? '' : 's'}` : ''}
              </option>
            )
          })}
        </select>
      </label>

      <label>
        Linked Relief Request
        <select
          value={form.assistanceRequestId}
          onChange={(e) => setForm((f) => applyRequestToForm(e.target.value, f))}
        >
          <option value="">{form.beneficiaryId ? 'Select a request for this barangay…' : 'Select a request…'}</option>
          {barangayRequests.map((r) => (
            <option key={r.dbId} value={r.dbId}>
              {r.id} — {r.type} ({r.status}) · {r.priority || 'Medium'}
            </option>
          ))}
        </select>
      </label>

      {requestDetails ? (
        <div className="alloc-ben-context alloc-request-context">
          <strong>Request details</strong>
          <dl className="alloc-request-facts">
            <div>
              <dt>Reason for Assistance Request</dt>
              <dd>{requestDetails.reason || '—'}</dd>
            </div>
            <div>
              <dt>Type of Assistance Needed</dt>
              <dd>{requestDetails.assistanceType || '—'}</dd>
            </div>
            <div>
              <dt>Families Affected</dt>
              <dd>{requestDetails.familiesAffected || '—'}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{requestDetails.priority || '—'}</dd>
            </div>
            <div className="alloc-request-facts__full">
              <dt>Goods That Might Be Required</dt>
              <dd>
                {goodsOptions.length ? (
                  <div className="alloc-need-tags">
                    {goodsOptions.map((g) => (
                      <span
                        key={g}
                        className="alloc-need-tag"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                ) : '—'}
              </dd>
            </div>
            <div className="alloc-request-facts__full">
              <dt>Additional Information</dt>
              <dd>{requestDetails.additionalNotes || '—'}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="alloc-ben-context alloc-ben-context--muted">
          <strong>Request details</strong>
          <p>
            {form.beneficiaryId
              ? 'Select a linked relief request above to load the barangay’s submitted details (reason, assistance type, goods, families affected, and notes).'
              : 'Select a barangay and a relief request to see what they submitted.'}
          </p>
        </div>
      )}

      <div className="alloc-inventory-packs">
        <strong>Available packs in inventory</strong>
        {inventoryPacks.length === 0 ? (
          <p className="alloc-inventory-packs__empty">No pack items in inventory yet.</p>
        ) : (
          <ul className="alloc-inventory-packs__list">
            {inventoryPacks.map((pack) => (
              <li key={pack.dbId}>
                <span>{pack.item}</span>
                <span>{pack.available ?? pack.quantity} {pack.unit}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="alloc-resource-lines">
        <div className="alloc-resource-lines__head">
          <strong>Resource packs to allocate</strong>
          <span>{(form.lines || []).length} item{(form.lines || []).length === 1 ? '' : 's'}</span>
        </div>
        <p className="alloc-resource-lines__hint">
          Add multiple packs the barangay requested (e.g. rice, water, hygiene kits). Each row becomes its own allocation.
        </p>

        {(form.lines || []).length === 0 && (
          <p className="alloc-resource-lines__empty">No resources yet. Add a pack below or select a relief request to load requested goods.</p>
        )}

        <div className="alloc-resource-lines__rows">
          {(form.lines || []).map((line) => (
            <div key={line.key} className="alloc-resource-line">
              <label>
                Resource
                <input
                  list="allocation-resource-options"
                  required
                  value={line.resource}
                  onChange={(e) => updateLine(line.key, { resource: e.target.value })}
                  placeholder="e.g. Rice, Water, Food Packs"
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  required
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  placeholder={recommendedQty ? String(recommendedQty) : '0'}
                />
              </label>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                title="Remove"
                aria-label="Remove resource"
                onClick={() => removeLine(line.key)}
                disabled={(form.lines || []).length <= 1 && editRow}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <datalist id="allocation-resource-options">
          {[...needOptions, ...inventoryPacks.map((p) => p.item)].filter(Boolean).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        {!editRow && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => addLine('', recommendedQty || '')}
          >
            <Plus size={14} /> Add another pack
          </button>
        )}
      </div>

      <label>
        Program / Need
        <input
          list="allocation-program-options"
          value={form.program}
          onChange={(e) => setForm({ ...form, program: e.target.value })}
          placeholder={requestDetails?.assistanceType || 'e.g. Food Supplies'}
        />
        <datalist id="allocation-program-options">
          {[requestDetails?.assistanceType, ...needOptions].filter(Boolean).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>

      {requestDetails && familiesForSuggestion > 0 && (
        <div className="alloc-suggestion">
          <Sparkles size={14} aria-hidden />
          <span>
            From request: {familiesForSuggestion} families affected × {PACKS_PER_FAMILY} pack{PACKS_PER_FAMILY === 1 ? '' : 's'} ≈{' '}
            <strong>{recommendedQty} suggested per pack</strong>
          </span>
        </div>
      )}

      <div className="form-row">
        <label>
          Priority
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>
          Status
          <select
            value={form.status}
            disabled={editRow && isTerminalStatus(editRow.status, ALLOCATION_TERMINAL)}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {getAvailableNextStatuses({
              currentStatus: editRow ? editRow.status : form.status,
              allStatuses: STATUS_OPTIONS,
              workflowOrder: ALLOCATION_WORKFLOW,
              terminalStatuses: ALLOCATION_TERMINAL,
              branches: ALLOCATION_BRANCHES,
            }).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {editRow && isTerminalStatus(editRow.status, ALLOCATION_TERMINAL) && (
            <small style={{ display: 'block', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
              🔒 Status is finalized and locked.
            </small>
          )}
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
    </>
  )

  return (
    <>
      {draftNotice && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle2 size={22} />
            <div>
              <strong>Distribution Draft Auto-Created!</strong>
              <div style={{ fontSize: '0.88rem', opacity: 0.9 }}>
                Draft <code>{draftNotice.code}</code> was automatically generated for {draftNotice.barangay}.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              to="/admin/distributions"
              style={{
                background: '#ffffff',
                color: '#059669',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.88rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Truck size={15} />
              View in Distributions &rarr;
            </Link>
            <button
              onClick={() => setDraftNotice(null)}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.8 }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <PageHeader
        title="Resource Allocation"
        description="Match relief request details to available inventory. Quantities are suggested from families affected on the request — confirm here, then use Plan Distribution to schedule delivery."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditRow(null)
              setForm({ ...emptyForm, lines: [makeLine()] })
              setShowCreate(true)
            }}
          >
            + New Allocation
          </button>
        }
      />

      {needsSummary && (
        <div className="needs-summary-strip">
          <span className="needs-chip needs-chip--shortage">{needsSummary.shortage} shortages</span>
          <span className="needs-chip needs-chip--ok">{needsSummary.sufficient} sufficient</span>
          <span className="needs-chip needs-chip--excess">{needsSummary.excess} excess</span>
          <span className="needs-chip">{needsSummary.totalAvailablePacks} packs available</span>
        </div>
      )}

      {beneficiaryNeeds.length > 0 && (
        <section className="admin-panel alloc-needs-panel">
          <h2>Barangay Needs Overview</h2>
          <p className="alloc-panel-hint">
            Needs and family counts used to calculate recommended pack quantities (≈ {PACKS_PER_FAMILY} pack per family per need).
            Click a need to start an allocation for it.
          </p>
          <div className="see-more-wrap">
          <div className="alloc-needs-grid">
            {needsSeeMore.visible.map((b) => (
              <article key={b.beneficiaryId} className="alloc-needs-card">
                <div className="alloc-needs-card__top">
                  <strong>{b.name}</strong>
                  <StatusBadge status={b.status} />
                </div>
                <p className="alloc-needs-card__meta">
                  {b.affectedFamilies} affected families · ≈ {suggestedQuantity(b)} packs/need
                </p>
                <div className="alloc-need-tags">
                  {(b.needs || []).length
                    ? b.needs.map((n) => (
                        <button
                          type="button"
                          key={n}
                          className="alloc-need-tag alloc-need-tag--clickable"
                          onClick={() => quickAllocateForNeed(b, n)}
                          title={`Quick-allocate for "${n}"`}
                        >
                          {n}
                        </button>
                      ))
                    : <span className="alloc-need-tag alloc-need-tag--muted">No needs listed</span>}
                </div>
              </article>
            ))}
          </div>
          {needsSeeMore.needsToggle && (
            <SeeMoreToggle
              expanded={needsSeeMore.expanded}
              onToggle={needsSeeMore.toggle}
              hiddenCount={needsSeeMore.hiddenCount}
            />
          )}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section className="admin-panel alloc-recs-panel">
          <h2>Recommended Allocations</h2>
          <p className="alloc-panel-hint">Auto-matched from barangay needs × affected families against available inventory.</p>
          <div className="see-more-wrap">
          <div className="volunteer-task-list">
            {recsSeeMore.visible.map((rec) => (
              <article
                key={`${rec.assistanceRequestId || 'b'}-${rec.beneficiaryId}-${rec.inventoryId}-${rec.need}`}
                className="volunteer-task-card"
              >
                <div className="volunteer-task-card__top">
                  <strong>{rec.resource} × {rec.quantity} {rec.unit}</strong>
                  <StatusBadge status={rec.priority} />
                </div>
                <div className="volunteer-task-card__meta">
                  <span>{rec.beneficiary || '—'}</span>
                  <span>{rec.affectedFamilies || 0} families</span>
                  <span>Need: {rec.need || rec.requestType}</span>
                  <span>Stock: {rec.available}</span>
                </div>
                {(rec.beneficiaryNeeds || []).length > 0 && (
                  <div className="alloc-need-tags" style={{ marginTop: '0.45rem' }}>
                    {rec.beneficiaryNeeds.map((n) => <span key={n} className="alloc-need-tag">{n}</span>)}
                  </div>
                )}
                <p style={{ margin: '0.4rem 0 0.6rem', fontSize: '0.82rem', color: '#64748b' }}>{rec.reason}</p>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => applyRecommendation(rec)}>
                  Use Recommendation
                </button>
              </article>
            ))}
          </div>
          {recsSeeMore.needsToggle && (
            <SeeMoreToggle
              expanded={recsSeeMore.expanded}
              onToggle={recsSeeMore.toggle}
              hiddenCount={recsSeeMore.hiddenCount}
            />
          )}
          </div>
        </section>
      )}

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by resource, program, or barangay..."
        exportConfig={{ filename: 'allocation-report', title: 'Resource Allocation Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={setDetailRow}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
          selectable
          selectedIds={bulk.selectedIds}
          onSelectionChange={bulk.setSelectedIds}
          onBulkDelete={bulk.handleBulkDelete}
          deleting={bulk.deleting}
          bulkDeleteLabel="Delete Selected"
        />
      </ApiState>

      {detailRow && (
        <AllocationDetailModal
          detailRow={detailRow}
          linkedReq={linkedRequest(detailRow)}
          onClose={() => setDetailRow(null)}
          onEdit={() => openEdit(detailRow)}
          onUpdateStatus={() => openStatus(detailRow)}
          onPlanDistribution={() => planDistribution(detailRow)}
          onDelete={() => handleDelete(detailRow)}
          canPlan={canPlan(detailRow)}
          navigate={navigate}
        />
      )}

      {statusRow && (
        <div className="admin-modal-overlay" onClick={() => setStatusRow(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Update Status" onClose={() => setStatusRow(null)} />
            <form onSubmit={handleUpdateStatus}>
              <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>
                {statusRow.resource} × {statusRow.quantity}
              </p>
              <label>
                Status
                <select required value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                  {getAvailableNextStatuses({
                    currentStatus: statusRow.status,
                    allStatuses: STATUS_OPTIONS,
                    workflowOrder: ALLOCATION_WORKFLOW,
                    terminalStatuses: ALLOCATION_TERMINAL,
                    branches: ALLOCATION_BRANCHES,
                  }).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save Status'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setStatusRow(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(editRow || showCreate) && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? `Edit Allocation` : 'New Allocation'}
              onClose={closeForm}
            />
            <form onSubmit={handleSave}>
              {FormFields}
              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn--ghost" onClick={closeForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function AllocationDetailModal({
  detailRow,
  linkedReq,
  onClose,
  onEdit,
  onUpdateStatus,
  onPlanDistribution,
  onDelete,
  canPlan,
  navigate,
}) {
  const isMonetaryFunded = (detailRow.notes || '').toLowerCase().includes('funded from monetary donation') || 
    (detailRow.notes || '').toLowerCase().includes('monetary donation') ||
    (detailRow.notes || '').includes('DON-')

  const formattedDate = (() => {
    const raw = detailRow.date || detailRow.allocationDate || detailRow.createdAt
    if (!raw) return 'N/A'
    try {
      return new Date(raw).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return raw
    }
  })()

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal alloc-detail-modal" onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          title={`Allocation Details: ${detailRow.code || detailRow.id}`}
          onClose={onClose}
        />

        {/* Overview Header Strip */}
        <div className="alloc-detail-strip">
          <div className="alloc-detail-badges">
            <StatusBadge status={detailRow.priority} />
            <StatusBadge status={detailRow.status} />
            {isMonetaryFunded && (
              <span className="badge" style={{ background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}>
                <Banknote size={12} /> Cash Procured
              </span>
            )}
          </div>

          <div className="alloc-meta-strip">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={13} style={{ color: '#94a3b8' }} />
              <span>{formattedDate}</span>
            </div>
            {detailRow.code && (
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                {detailRow.code}
              </span>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="alloc-detail-grid">
          {/* Left Column: Cargo & Sourcing Specs */}
          <div className="alloc-col">
            <div className="alloc-section-card">
              <div className="alloc-section-header">
                <span className="alloc-section-title">
                  <Package size={14} style={{ color: 'var(--admin-brand, #AF101A)' }} />
                  <span>Allocated Cargo & Supplies</span>
                </span>
                {detailRow.program && (
                  <span className="alloc-program-badge">
                    🏷️ {detailRow.program}
                  </span>
                )}
              </div>

              <h3 className="alloc-cargo-title">{detailRow.resource}</h3>

              <div className="alloc-cargo-metric-box">
                <div className="alloc-qty-badge">
                  <span>Quantity:</span>
                  <strong>{detailRow.quantity}</strong>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#3b82f6' }}>Packs / Units</span>
                </div>
              </div>

              {isMonetaryFunded ? (
                <div className="alloc-funding-pill">
                  <Banknote size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#ca8a04' }} />
                  <div>
                    <strong>Funded via Monetary Donation:</strong>
                    <div style={{ fontSize: '0.78rem', marginTop: '2px', color: '#713f12' }}>
                      {detailRow.notes || 'Procured with cash donation support.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alloc-funding-pill" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                  <Package size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#16a34a' }} />
                  <div>
                    <strong>Warehouse Sourced:</strong>
                    <div style={{ fontSize: '0.78rem', marginTop: '2px', color: '#14532d' }}>
                      Allocated from existing warehouse stock reserve.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {detailRow.notes && !isMonetaryFunded && (
              <div className="alloc-section-card">
                <span className="alloc-section-title">
                  <FileText size={13} />
                  <span>Administrative Remarks</span>
                </span>
                <div className="alloc-notes-box">
                  {detailRow.notes}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Barangay Destination & Linked Relief Request */}
          <div className="alloc-col">
            <div className="alloc-section-card">
              <div className="alloc-section-header">
                <span className="alloc-section-title">
                  <MapPin size={14} style={{ color: 'var(--admin-brand, #AF101A)' }} />
                  <span>Target Community</span>
                </span>
              </div>

              <h4 style={{ margin: '0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                {detailRow.beneficiary || 'Barangay'}
              </h4>

              <div className="alloc-bstat-grid">
                <div className="alloc-bstat">
                  <span className="alloc-bstat-label">
                    <Users size={12} /> Affected Families
                  </span>
                  <span className="alloc-bstat-val">
                    {(detailRow.affectedFamilies ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="alloc-bstat">
                  <span className="alloc-bstat-label">
                    <Tag size={12} /> Reported Needs
                  </span>
                  <span className="alloc-bstat-val" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {(detailRow.beneficiaryNeeds || []).length
                      ? detailRow.beneficiaryNeeds.slice(0, 2).join(', ')
                      : (detailRow.program || 'General Relief')}
                  </span>
                </div>
              </div>

              {detailRow.beneficiaryId && (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', padding: '0.4rem 0.6rem' }}
                  onClick={() => {
                    onClose()
                    navigate(`/admin/beneficiaries/${detailRow.beneficiaryId}`)
                  }}
                >
                  View Barangay Profile &rarr;
                </button>
              )}
            </div>

            <div className="alloc-section-card">
              <div className="alloc-section-header">
                <span className="alloc-section-title">
                  <FileText size={14} />
                  <span>Linked Relief Request</span>
                </span>
                {linkedReq && <StatusBadge status={linkedReq.status} />}
              </div>

              {linkedReq || detailRow.assistanceRequestId ? (
                <div className="alloc-req-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                      {detailRow.assistanceRequestCode || linkedReq?.id || `#${detailRow.assistanceRequestId}`}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {linkedReq?.priority || detailRow.priority || 'Medium'} Priority
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                    {linkedReq?.type || detailRow.assistanceRequestType || 'General Relief Assistance'}
                  </div>

                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.76rem', color: 'var(--admin-brand, #AF101A)', justifyContent: 'flex-start' }}
                    onClick={() => {
                      onClose()
                      navigate('/admin/requests')
                    }}
                  >
                    Open in Relief Requests &rarr;
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.4rem 0' }}>
                  Direct administrative allocation (no incoming relief request linked).
                </div>
              )}
            </div>
          </div>

          {/* Full Width Logistics & Dispatch Banner */}
          <div className={`alloc-dispatch-card ${detailRow.distributionId ? 'alloc-dispatch-card--planned' : 'alloc-dispatch-card--ready'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: detailRow.distributionId ? '#dbeafe' : '#dcfce7',
                color: detailRow.distributionId ? '#1d4ed8' : '#15803d',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Truck size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  {detailRow.distributionId ? 'Distribution Scheduled' : 'Ready for Logistics Dispatch'}
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                  {detailRow.distributionId
                    ? 'This cargo is assigned to an active delivery schedule in Logistics & Distribution.'
                    : `Cargo is allocated for ${detailRow.beneficiary || 'community'}. Click 'Plan Distribution' to schedule delivery date and assign trucks.`}
                </div>
              </div>
            </div>

            {canPlan ? (
              <button
                type="button"
                className="alloc-dispatch-btn"
                onClick={() => {
                  onClose()
                  onPlanDistribution()
                }}
              >
                <Truck size={14} />
                <span>Plan Distribution &rarr;</span>
              </button>
            ) : detailRow.distributionId ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  onClose()
                  navigate('/admin/distributions')
                }}
              >
                View in Distributions &rarr;
              </button>
            ) : null}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="alloc-detail-footer">
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={onDelete}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onEdit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Pencil size={13} />
              <span>Edit Details</span>
            </button>
            {detailRow.status !== 'Delivered' && detailRow.status !== 'Cancelled' && (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={onUpdateStatus}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ArrowRightCircle size={13} />
                <span>Update Status</span>
              </button>
            )}
            {canPlan && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  onClose()
                  onPlanDistribution()
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
              >
                <Truck size={14} />
                <span>Plan Distribution &rarr;</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
