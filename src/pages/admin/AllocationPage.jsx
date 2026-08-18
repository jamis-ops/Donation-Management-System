import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, Pencil, ArrowRightCircle, Truck, Sparkles, CheckCircle2, X, Plus } from 'lucide-react'
import { allocationsApi, beneficiariesApi, needsStockApi, assistanceRequestsApi, inventoryApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../../components/admin/shared/PageHeader'
import DataTable from '../../components/admin/shared/DataTable'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import FilterBar from '../../components/admin/shared/FilterBar'
import ModalHeader from '../../components/admin/shared/ModalHeader'
import RowActionsMenu from '../../components/admin/shared/RowActionsMenu'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../../components/admin/shared/SeeMoreList'
import { notify } from '../../utils/toast'

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

export default function AllocationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, loading, error, reload } = useApiList(() => allocationsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const { data: requests } = useApiList(() => assistanceRequestsApi.list())
  const { data: inventoryData } = useApiList(() => inventoryApi.list())
  const filters = useFilters(data, filterConfig)
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [statusRow, setStatusRow] = useState(null)
  const [statusValue, setStatusValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
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
    try {
      const ben = barangays.find((b) => Number(b.dbId) === Number(form.beneficiaryId))
      const benName = ben?.barangay || ben?.name || ben?.fullName || ''

      if (editRow) {
        const line = lines[0]
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
        const res = await allocationsApi.update(editRow.dbId, payload)
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
      notify.success(editRow ? 'Allocation updated.' : 'Allocation saved.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (e) => {
    e.preventDefault()
    if (!statusRow) return
    setSaving(true)
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
      notify.success(`Status successfully updated to: ${status}.`)
    } catch (err) {
      notify.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete this allocation? This cannot be undone.`)) return
    try {
      await allocationsApi.remove(row.dbId)
      setDetailRow(null)
      setEditRow(null)
      reload()
      notify.success('Allocation deleted.')
    } catch (err) {
      notify.error(err.message || 'Failed to delete allocation')
    }
  }

  const linkedRequest = (row) => {
    if (!row?.assistanceRequestId) return null
    return (requests || []).find((r) => Number(r.dbId) === Number(row.assistanceRequestId))
  }

  const canPlan = (row) => ['Reserved', 'Allocated'].includes(row.status) && !row.distributionId

  const closeForm = () => {
    setEditRow(null)
    setShowCreate(false)
  }

  const columns = [
    {
      key: 'request',
      label: 'Request ID',
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
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
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
        />
      </ApiState>

      {detailRow && (
        <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Allocation Details" onClose={() => setDetailRow(null)} />
            <dl className="detail-list">
              <dt>Resource</dt><dd>{detailRow.resource}</dd>
              <dt>Quantity</dt><dd>{detailRow.quantity}</dd>
              <dt>Program / Need</dt><dd>{detailRow.program || '—'}</dd>
              <dt>Barangay</dt><dd>{detailRow.beneficiary || '—'}</dd>
              <dt>Affected Families</dt><dd>{detailRow.affectedFamilies ?? '—'}</dd>
              <dt>Barangay Needs</dt>
              <dd>
                {(detailRow.beneficiaryNeeds || []).length
                  ? detailRow.beneficiaryNeeds.join(', ')
                  : '—'}
              </dd>
              <dt>Priority</dt><dd><StatusBadge status={detailRow.priority} /></dd>
              <dt>Status</dt><dd><StatusBadge status={detailRow.status} /></dd>
              <dt>Linked Distribution</dt>
              <dd>{detailRow.distributionId ? 'Planned' : 'Not planned yet'}</dd>
              <dt>Date</dt><dd>{detailRow.date || detailRow.allocationDate || '—'}</dd>
              <dt>Request ID</dt>
              <dd>
                {(() => {
                  const req = linkedRequest(detailRow)
                  const code = detailRow.assistanceRequestCode || req?.id
                  if (!code && !detailRow.assistanceRequestId) return '—'
                  return (
                    <span className="alloc-request-id">
                      {code || `#${detailRow.assistanceRequestId}`}
                      {req ? ` · ${req.type} (${req.status})` : detailRow.assistanceRequestType ? ` · ${detailRow.assistanceRequestType}` : ''}
                    </span>
                  )
                })()}
              </dd>
              <dt>Relief Request</dt>
              <dd>
                {(() => {
                  const req = linkedRequest(detailRow)
                  if (!req) return detailRow.assistanceRequestId ? 'Linked' : '—'
                  return `${req.type} (${req.status})`
                })()}
              </dd>
              <dt>Notes</dt><dd>{detailRow.notes || '—'}</dd>
            </dl>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn--primary" onClick={() => openEdit(detailRow)}>Edit</button>
              {canPlan(detailRow) && (
                <button type="button" className="btn btn--outline" onClick={() => planDistribution(detailRow)}>
                  Plan Distribution
                </button>
              )}
              {detailRow.status !== 'Delivered' && detailRow.status !== 'Cancelled' && (
                <button type="button" className="btn btn--outline" onClick={() => openStatus(detailRow)}>Update Status</button>
              )}
              <button type="button" className="btn btn--outline" onClick={() => handleDelete(detailRow)}>Delete</button>
              <button type="button" className="btn btn--ghost" onClick={() => setDetailRow(null)}>Close</button>
            </div>
          </div>
        </div>
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
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
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
