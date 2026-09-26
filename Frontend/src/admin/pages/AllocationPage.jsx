import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { 
  Eye, ArrowRightCircle, Truck, Sparkles, CheckCircle2, X, Plus,
  Package, Users, Calendar, MapPin, FileText, Banknote, Check, AlertCircle, Trash2, ArrowRight, ExternalLink, RotateCcw
} from 'lucide-react'
import { allocationsApi, beneficiariesApi, needsStockApi, assistanceRequestsApi, inventoryApi, adminBadgesApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import WizardStepper from '../../components/shared/WizardStepper'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../components/shared/SeeMoreList'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged, BADGES_CHANGED } from '../../utils/badgeSync'
import {
  ALLOCATION_WORKFLOW,
  ALLOCATION_TERMINAL,
  ALLOCATION_BRANCHES,
  getAvailableNextStatuses,
  validateStatusTransition,
  isTerminalStatus,
} from '../../utils/workflow'
import { useLoading } from '../../context/LoadingContext'

const STATUS_OPTIONS = ['Allocated', 'Scheduled', 'In Transit', 'Delivered', 'Cancelled']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical']
const ALLOCATABLE_REQUEST_STATUSES = new Set(['Approved', 'Ready for Allocation', 'Partially Funded', 'Partially Allocated'])
const ALLOCATION_STEPS = [
  { id: 'request', label: 'Select Request', description: 'Approved request' },
  { id: 'review', label: 'Review Allocation', description: 'Items and quantities' },
  { id: 'confirm', label: 'Confirm & Allocate', description: 'Final check' },
]

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
  // Multiple resources to allocate: [{ key, resource, quantity, inventoryItemId }]
  lines: [],
  program: '',
  beneficiaryId: '',
  assistanceRequestId: '',
  status: 'Allocated',
  priority: 'Low',
  notes: '',
}

let lineKeySeq = 0
function nextLineKey() {
  lineKeySeq += 1
  return `line-${lineKeySeq}`
}

function makeLine(resource = '', quantity = '', inventoryItemId = null, unit = '', variant = '') {
  return {
    key: nextLineKey(),
    resource,
    quantity: quantity === 0 ? '' : String(quantity || ''),
    inventoryItemId,
    unit,
    variant,
    requestedName: '',
    requestedQuantity: null,
    requestedUnit: '',
    alreadyAllocated: 0,
    remainingRequested: null,
  }
}

// Helper to tokenize and clean item names for fuzzy matching
function cleanResourceTokens(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // remove parenthetical specs e.g. (50kg), (150 packs), (155g), (1L), (Assembled)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .map((w) => {
      if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y'
      if (w.endsWith('ses') && w.length > 4) return w.slice(0, -2)
      if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1)
      return w
    })
}

const RESOURCE_KEYWORD_GROUPS = [
  ['rice', 'bigas'],
  ['canned', 'sardine', 'tuna', 'corned', 'beef', 'meat', 'can'],
  ['food', 'pack', 'relief', 'ration', 'grocery', 'feeding', 'good'],
  ['water', 'drink', 'bottle', 'mineral'],
  ['hygiene', 'kit', 'toiletries', 'soap', 'shampoo', 'sanitary'],
  ['medicine', 'medical', 'firstaid', 'aid', 'vitamin', 'health'],
  ['tarpaulin', 'tarp', 'shelter', 'tent'],
  ['school', 'supply', 'education', 'student'],
  ['clothing', 'clothes', 'blanket', 'apparel'],
]

function resourceNamesMatch(inventoryName, requestedName) {
  if (!inventoryName || !requestedName) return false
  const rawInv = String(inventoryName).toLowerCase().trim()
  const rawReq = String(requestedName).toLowerCase().trim()
  if (rawInv === rawReq) return true

  const invTokens = cleanResourceTokens(rawInv)
  const reqTokens = cleanResourceTokens(rawReq)
  if (!invTokens.length || !reqTokens.length) return false

  const invClean = invTokens.join(' ')
  const reqClean = reqTokens.join(' ')
  if (invClean === reqClean || invClean.includes(reqClean) || reqClean.includes(invClean)) {
    return true
  }

  // Token overlap of meaningful words
  const sharedTokens = reqTokens.filter((t) => t.length >= 3 && invTokens.includes(t))
  if (sharedTokens.length > 0) return true

  // Keyword group matching
  for (const group of RESOURCE_KEYWORD_GROUPS) {
    const reqHas = reqTokens.some((t) => group.some((g) => t.includes(g) || g.includes(t)))
    const invHas = invTokens.some((t) => group.some((g) => t.includes(g) || g.includes(t)))
    if (reqHas && invHas) {
      return true
    }
  }

  return false
}

function scoreResourceMatch(inventoryItem, requestedName) {
  if (!inventoryItem || !requestedName) return 0
  const rawInv = String(inventoryItem.item || inventoryItem.item_name || '').toLowerCase().trim()
  const rawReq = String(requestedName).toLowerCase().trim()
  if (rawInv === rawReq) return 100

  const invTokens = cleanResourceTokens(rawInv)
  const reqTokens = cleanResourceTokens(rawReq)
  const catTokens = cleanResourceTokens(inventoryItem.category)

  let score = 0
  const invClean = invTokens.join(' ')
  const reqClean = reqTokens.join(' ')
  if (invClean === reqClean) score += 90
  else if (invClean.includes(reqClean) || reqClean.includes(invClean)) score += 75

  // Common tokens
  const sharedTokens = reqTokens.filter((t) => t.length >= 3 && invTokens.includes(t))
  score += sharedTokens.length * 20

  // Category match
  if (reqTokens.some((t) => catTokens.includes(t))) {
    score += 25
  }

  // Keyword group match
  for (const group of RESOURCE_KEYWORD_GROUPS) {
    const reqHas = reqTokens.some((t) => group.some((g) => t.includes(g) || g.includes(t)))
    const invHas = invTokens.some((t) => group.some((g) => t.includes(g) || g.includes(t)))
      || catTokens.some((t) => group.some((g) => t.includes(g) || g.includes(t)))
    if (reqHas && invHas) {
      score += 30
      break
    }
  }

  // Bonus for items currently in stock
  const stock = Number(inventoryItem.available ?? inventoryItem.quantity ?? 0)
  if (stock > 0) score += 5

  return score
}

function parseLegacyRequestedItem(value) {
  if (value && typeof value === 'object') {
    const name = String(value.item || value.name || '').trim()
    const numericQuantity = Number(value.quantity)
    return name ? {
      name,
      quantity: Number.isInteger(numericQuantity) && numericQuantity > 0 ? numericQuantity : null,
      unit: String(value.unit || '').trim(),
      estimated: !(Number.isInteger(numericQuantity) && numericQuantity > 0),
    } : null
  }

  const label = String(value || '').trim()
  if (!label) return null
  const quantityMatch = label.match(/^(.*)\s+\((\d+)\s+([^)]+)\)$/)
  if (!quantityMatch) return { name: label, quantity: null, unit: '', estimated: true }
  return {
    name: quantityMatch[1].trim(),
    quantity: Number(quantityMatch[2]),
    unit: quantityMatch[3].trim(),
    estimated: false,
  }
}

function requestItemsFrom(request, fallbackGoods = []) {
  const source = Array.isArray(request?.requestedItems) && request.requestedItems.length
    ? request.requestedItems
    : (Array.isArray(request?.needs) && request.needs.length ? request.needs : fallbackGoods)

  const byName = new Map()
  source.map(parseLegacyRequestedItem).filter(Boolean).forEach((item) => {
    const key = String(item.name || '').toLowerCase().trim()
    if (!key) return
    if (!byName.has(key)) {
      byName.set(key, item)
      return
    }
    const existing = byName.get(key)
    if (existing.quantity !== null && item.quantity !== null) {
      byName.set(key, { ...existing, quantity: existing.quantity + item.quantity })
    }
  })
  return Array.from(byName.values())
}

/** Parse structured notes written by the barangay request form or enriched API fields. */
function parseRequestDetails(request) {
  if (!request) return null
  const notes = String(request.notes || '')
  const pick = (re) => {
    const m = notes.match(re)
    return m ? m[1].trim() : ''
  }

  const reason = request.reason
    || pick(/Calamity\/Program:\s*(.+?)(?:\n|$)/i)
    || (Array.isArray(request.calamityTags) && request.calamityTags[0])
    || ''
  const assistanceType = request.assistanceType || pick(/Assistance Type:\s*(.+?)(?:\n|$)/i) || request.type || ''
  const familiesRaw = pick(/Families Affected:\s*(\d+)/i)
  const familiesAffected = Number(request.affectedFamilies)
    || (familiesRaw ? Number(familiesRaw) : 0)

  const goodsRaw = pick(/Goods Required:\s*(.+?)(?:\n|$)/i) || pick(/Type of Needs:\s*(.+?)(?:\n|$)/i)
  let goods = Array.isArray(request.needs) && request.needs.length
    ? request.needs
    : (goodsRaw ? goodsRaw.split(',').map((g) => g.trim()).filter(Boolean) : [])

  if (!goods.length && assistanceType) {
    goods = assistanceType.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
  }

  const requestedItems = requestItemsFrom(request, goods)

  const additionalNotes = request.additionalNotes || pick(/Additional Notes:\s*([\s\S]+)/i)

  return {
    reason,
    assistanceType,
    familiesAffected,
    goods: requestedItems.length ? requestedItems.map((item) => item.name) : goods,
    requestedItems,
    priority: request.priority || 'Medium',
    additionalNotes,
    status: request.status || '',
    reference: request.id || request.code || request.reference_code || '',
    beneficiary: request.beneficiary || request.beneficiary_name || '',
    municipality: request.municipality || '',
    barangay: request.barangay || '',
    beneficiaryId: request.beneficiaryId || request.beneficiary_id,
    dbId: request.dbId || request.id,
  }
}

function suggestedQuantityFromFamilies(families) {
  const n = Number(families) || 0
  return n * PACKS_PER_FAMILY
}

function isRequestFullyAllocated(request, allocations) {
  const reqStatus = String(request?.status || '').trim()
  if (['Allocated', 'Completed', 'In Distribution', 'In Transit', 'Delivered', 'Cancelled', 'Rejected'].includes(reqStatus)) {
    return true
  }
  const details = parseRequestDetails(request)
  if (!details) return false

  const reqAllocations = (allocations || []).filter(
    (a) => Number(a.assistanceRequestId) === Number(request.dbId || details.dbId) && a.status !== 'Cancelled'
  )
  if (!reqAllocations.length) {
    return false
  }

  const itemsWithQuantity = (details.requestedItems || []).filter((item) => Number(item.quantity) > 0)
  if (itemsWithQuantity.length > 0) {
    return itemsWithQuantity.every((item) => {
      const allocatedQty = reqAllocations
        .filter((a) => resourceNamesMatch(a.resource, item.name))
        .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0)
      return allocatedQty >= Number(item.quantity)
    })
  }

  return false
}

const styles = `
.alloc-detail-modal {
  max-width: 620px !important;
  width: 94vw !important;
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
  padding: 1rem 1.25rem !important;
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
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.3 !important;
}

.alloc-detail-modal .admin-modal__close {
  margin: 0 !important;
  width: 30px !important;
  height: 30px !important;
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
  flex-wrap: wrap;
}

.alloc-meta-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #64748b;
  flex-wrap: wrap;
}

.alloc-detail-grid {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.85rem !important;
  padding: 1.15rem 1.25rem !important;
  background: #ffffff !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  max-height: calc(88vh - 130px) !important;
  box-sizing: border-box !important;
}

.alloc-col {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  width: 100%;
}

.alloc-section-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.95rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  box-sizing: border-box;
  overflow-wrap: break-word;
  word-break: break-word;
}

.alloc-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.alloc-section-title {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.alloc-cargo-title {
  font-size: 1.05rem;
  font-weight: 750;
  color: #0f172a;
  line-height: 1.35;
  margin: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.alloc-cargo-metric-box {
  display: flex;
  align-items: center;
  gap: 0.65rem;
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
  font-size: 0.85rem;
  font-weight: 700;
}

.alloc-program-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.alloc-funding-pill {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: #fefce8;
  border: 1px solid #fef08a;
  color: #854d0e;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-size: 0.78rem;
  line-height: 1.4;
  overflow-wrap: break-word;
  word-break: break-word;
}

.alloc-notes-box {
  font-size: 0.82rem;
  color: #334155;
  line-height: 1.45;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 0.65rem 0.75rem;
  border-radius: 6px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
}

.alloc-bstat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}

.alloc-bstat {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-wrap: break-word;
  word-break: break-word;
}
.alloc-bstat-label {
  font-size: 0.68rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.alloc-bstat-val {
  font-size: 0.95rem;
  font-weight: 750;
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
  overflow-wrap: break-word;
  word-break: break-word;
}

.alloc-dispatch-card {
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
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
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 650;
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

.alloc-tab-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 1.25rem 0 1rem 0;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.25rem;
  flex-wrap: wrap;
}
.alloc-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.95rem;
  border-radius: 6px 6px 0 0;
  background: transparent;
  border: none;
  font-size: 0.84rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}
.alloc-tab-btn:hover {
  color: #0f172a;
}
.alloc-tab-btn--active {
  color: var(--admin-brand, #AF101A) !important;
  font-weight: 750;
  border-bottom: 2px solid var(--admin-brand, #AF101A);
  margin-bottom: -2px;
}
.alloc-tab-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 9999px;
  background: #f1f5f9;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  line-height: 1;
}
.alloc-tab-btn--active .alloc-tab-badge {
  background: #fef2f2;
  color: var(--admin-brand, #AF101A);
}
.alloc-tab-badge--urgent {
  background: #fee2e2 !important;
  color: #b91c1c !important;
  font-weight: 750 !important;
  border: 1px solid #fca5a5 !important;
  box-shadow: 0 1px 3px rgba(185, 28, 28, 0.15) !important;
}

.alloc-resource-line-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.65rem 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.alloc-stock-feedback {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
}
.alloc-stock-feedback--ok {
  color: #166534;
  background: #f0fdf4;
}
.alloc-stock-feedback--err {
  color: #b91c1c;
  background: #fef2f2;
}

.alloc-resource-table-head {
  display: grid;
  grid-template-columns: 2.2fr 1.2fr 1fr 40px;
  gap: 12px;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
.alloc-resource-row {
  display: grid;
  grid-template-columns: 2.2fr 1.2fr 1fr 40px;
  gap: 12px;
  align-items: center;
}
.alloc-avail-stock {
  font-size: 0.85rem;
  padding: 0.45rem 0.65rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}
@media (max-width: 640px) {
  .alloc-resource-table-head {
    display: none;
  }
  .alloc-resource-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .alloc-detail-grid {
    grid-template-columns: 1fr;
    padding: 0.85rem;
  }
}

.alloc-req-code-tag {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--admin-brand, #AF101A);
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
  letter-spacing: 0.02em;
  transition: all 0.15s ease;
}
.alloc-req-code-tag:hover {
  background: #fee2e2;
  border-color: #f87171;
}

.alloc-calamity-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 650;
  color: #0369a1;
  background: #e0f2fe;
  border: 1px solid #bae6fd;
  padding: 0.15rem 0.55rem;
  border-radius: 9999px;
}

.alloc-needs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1.25rem;
}

.alloc-needs-card {
  position: relative;
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-left: 4px solid var(--admin-brand, #AF101A) !important;
  border-radius: 12px !important;
  padding: 1.15rem 1.25rem !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 0.75rem !important;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease !important;
  box-sizing: border-box !important;
}

.alloc-needs-card:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 10px 25px -5px rgba(175, 16, 26, 0.12), 0 0 0 1px rgba(175, 16, 26, 0.15) !important;
  border-color: #fca5a5 !important;
}

.alloc-card-brgy-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #fef2f2;
  color: var(--admin-brand, #AF101A);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.alloc-card-brgy-name {
  font-size: 1.05rem;
  font-weight: 750;
  color: #0f172a;
  transition: color 0.15s ease;
}
.alloc-needs-card:hover .alloc-card-brgy-name {
  color: var(--admin-brand, #AF101A);
}

.alloc-card-external-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}
.alloc-card-external-btn:hover {
  background: #fef2f2;
  color: var(--admin-brand, #AF101A);
  border-color: #fca5a5;
  transform: scale(1.08);
}

.alloc-needs-card__meta {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #f1f5f9;
}

.alloc-families-count {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: #475569;
}

.alloc-needs-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.alloc-needs-subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.alloc-need-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  transition: all 0.15s ease;
}
.alloc-need-item-row:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}

.alloc-need-name {
  font-size: 0.82rem;
  font-weight: 650;
  color: #1e293b;
}

.alloc-need-allocate-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
  border-radius: 6px;
  background: #fef2f2;
  color: var(--admin-brand, #AF101A);
  border: 1px solid #fecaca;
  cursor: pointer;
  transition: all 0.15s ease;
}
.alloc-need-allocate-btn:hover {
  background: var(--admin-brand, #AF101A);
  color: #ffffff;
  border-color: var(--admin-brand, #AF101A);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(175, 16, 26, 0.25);
}

.alloc-needs-card__footer {
  margin-top: 0.2rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e2e8f0;
}

.alloc-view-request-link {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--admin-brand, #AF101A);
  background: #fff8f8;
  border: 1px solid #fecaca;
  cursor: pointer;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.alloc-view-request-link:hover {
  background: var(--admin-brand, #AF101A);
  color: #ffffff;
  border-color: var(--admin-brand, #AF101A);
  box-shadow: 0 2px 6px rgba(175, 16, 26, 0.2);
}

/* Modal Banner */
.alloc-modal-linked-request-banner {
  margin-bottom: 1.15rem;
  padding: 0.85rem 1.15rem;
  background: #fff8f8;
  border: 1px solid #fecaca;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.alloc-modal-linked-label {
  font-size: 0.68rem;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #b91c1c;
}

.alloc-modal-linked-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 1rem;
  color: #0f172a;
  margin-top: 0.15rem;
}

.alloc-modal-linked-sub {
  font-size: 0.78rem;
  color: #64748b;
  margin-top: 0.15rem;
}

.alloc-modal-open-request-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 650;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.alloc-modal-open-request-btn:hover {
  border-color: var(--admin-brand, #AF101A);
  color: var(--admin-brand, #AF101A);
  background: #fef2f2;
}
`;

export default function AllocationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, loading, error, reload } = useApiList(() => allocationsApi.list())
  const { data: barangays } = useApiList(() => beneficiariesApi.list())
  const { data: requests, loading: requestsLoading, reload: reloadRequests } = useApiList(() => assistanceRequestsApi.list())
  const { data: inventoryData, loading: inventoryLoading, reload: reloadInventory } = useApiList(() => inventoryApi.list())

  const [activeTab, setActiveTab] = useState('active') // 'active' | 'inDistribution' | 'all'

  const activeAllocations = useMemo(() => {
    return (data || []).filter(
      (a) => !['In Distribution', 'Scheduled', 'In Transit', 'Delivered', 'Cancelled'].includes(a.status) && !a.distributionId
    )
  }, [data])

  const inDistributionAllocations = useMemo(() => {
    return (data || []).filter(
      (a) => ['In Distribution', 'Scheduled', 'In Transit'].includes(a.status) || (Boolean(a.distributionId) && !['Delivered', 'Cancelled'].includes(a.status))
    )
  }, [data])

  const tabData = useMemo(() => {
    if (activeTab === 'active') return activeAllocations
    if (activeTab === 'inDistribution') return inDistributionAllocations
    return data || []
  }, [activeTab, activeAllocations, inDistributionAllocations, data])

  const [badgeCounts, setBadgeCounts] = useState({})

  const fetchBadges = useCallback(async () => {
    try {
      const res = await adminBadgesApi.get()
      if (res?.ok && res?.data) {
        setBadgeCounts(res.data)
      }
    } catch {
      // Badges are supplemental; keep the allocation page usable if this request fails.
    }
  }, [])

  useEffect(() => {
    const initialFetch = window.setTimeout(() => { void fetchBadges() }, 0)
    window.addEventListener(BADGES_CHANGED, fetchBadges)
    // Synchronize section view in backend
    adminBadgesApi.markSeen('/admin/allocation').catch(() => {})
    return () => {
      window.clearTimeout(initialFetch)
      window.removeEventListener(BADGES_CHANGED, fetchBadges)
    }
  }, [fetchBadges])

  // Attention badge count: only shown when there are actionable items requiring attention
  const activeAttentionCount = useMemo(() => {
    const urgentCount = activeAllocations.filter(
      (a) => ['Urgent', 'Critical'].includes(a.priority) || a.status === 'Pending'
    ).length
    const backendCount = Number(badgeCounts['/admin/allocation'] || 0)
    return Math.max(urgentCount, backendCount)
  }, [activeAllocations, badgeCounts])

  const inDistAttentionCount = useMemo(() => {
    return inDistributionAllocations.filter(
      (a) => ['Urgent', 'Critical'].includes(a.priority) && a.status === 'In Distribution'
    ).length
  }, [inDistributionAllocations])

  const filters = useFilters(tabData, filterConfig)
  const bulk = useBulkSelection(
    filters.filtered,
    (id) => allocationsApi.remove(id),
    reload,
    'allocations',
  )
  const [detailRow, setDetailRow] = useState(null)
  const { showLoading, hideLoading } = useLoading()
  const [editRow, setEditRow] = useState(null)
  
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [activeReliefRequest, setActiveReliefRequest] = useState(null)
  const [activeRequestLoading, setActiveRequestLoading] = useState(false)
  const [allocationStep, setAllocationStep] = useState(1)
  const [highestAllocationStep, setHighestAllocationStep] = useState(1)

  useEffect(() => {
    const s = document.createElement('style')
    s.textContent = styles
    document.head.appendChild(s)
    return () => s.remove()
  }, [])
  const [saving, setSaving] = useState(false)
  const [needsSummary, setNeedsSummary] = useState(null)
  const [draftNotice, setDraftNotice] = useState(null)

  const activeReliefRequests = useMemo(() => {
    if (!requests || !requests.length) return []
    return requests
      .filter((r) => {
        const st = String(r.status || '').trim()
        if (!ALLOCATABLE_REQUEST_STATUSES.has(st)) return false
        if (isRequestFullyAllocated(r, data)) return false
        return true
      })
      .map((r) => {
        const details = parseRequestDetails(r)
        const rawNeeds = details?.goods?.length
          ? details.goods
          : (Array.isArray(r.needs) ? r.needs : (r.type ? [r.type] : []))
        const cleanNeeds = Array.from(new Set(rawNeeds.filter((n) => n && !n.toLowerCase().startsWith('calamity/'))))
        
        let families = Number(details?.familiesAffected || r.affectedFamilies || r.familiesAffected || 0)
        if (!families && r.notes) {
          const match = r.notes.match(/Families\s*Affected\s*:\s*(\d+)/i) || r.notes.match(/(\d+)\s*families/i)
          if (match) families = parseInt(match[1], 10)
        }

        return {
          ...r,
          parsedDetails: details,
          families,
          needs: cleanNeeds.length ? cleanNeeds : ['Relief Assistance'],
          calamity: details?.reason || r.reason || r.type || 'Relief Assistance',
          requestCode: r.id || r.code || r.reference_code || `AST-${r.dbId}`,
          beneficiaryName: r.beneficiary || r.beneficiaryName || 'Barangay',
        }
      })
  }, [requests, data])

  const findMatchingInventory = useCallback((resourceName, inventoryItemId = null) => {
    if (!inventoryData || !inventoryData.length) return null
    if (inventoryItemId) {
      const byId = inventoryData.find((i) => Number(i.dbId) === Number(inventoryItemId))
      if (byId) return byId
    }
    if (!resourceName) return null

    let bestItem = null
    let bestScore = 0

    for (const item of inventoryData) {
      const score = scoreResourceMatch(item, resourceName)
      if (score >= 20 && score > bestScore) {
        bestScore = score
        bestItem = item
      }
    }

    return bestItem
  }, [inventoryData])

  const matchGoodsToInventory = useCallback((goodsName) => {
    if (!goodsName) return null
    const availableItems = (inventoryData || []).filter((i) => Number(i.available ?? i.quantity ?? 0) > 0)
    return availableItems.find((i) => resourceNamesMatch(i.item, goodsName)) || null
  }, [inventoryData])

  const buildRequestItemRows = useCallback((request) => {
    const details = parseRequestDetails(request)
    if (!details) return []
    const fallbackQuantity = suggestedQuantityFromFamilies(details.familiesAffected) || 1
    return (details.requestedItems || []).map((requestedItem) => {
      const inventoryItem = findMatchingInventory(requestedItem.name)
      const requestedQuantity = requestedItem.quantity || fallbackQuantity
      const alreadyAllocated = (data || [])
        .filter((allocation) => (
          Number(allocation.assistanceRequestId) === Number(request.dbId || details.dbId)
          && allocation.status !== 'Cancelled'
          && (
            (inventoryItem && Number(allocation.inventoryItemId) === Number(inventoryItem.dbId))
            || resourceNamesMatch(allocation.resource, requestedItem.name)
          )
        ))
        .reduce((sum, allocation) => sum + (Number(allocation.quantity) || 0), 0)
      const remainingRequested = Math.max(0, requestedQuantity - alreadyAllocated)
      const available = inventoryItem ? Number(inventoryItem.available ?? inventoryItem.quantity ?? 0) : 0
      return {
        ...requestedItem,
        requestedQuantity,
        alreadyAllocated,
        remainingRequested,
        inventoryItem,
        available,
        allocatableQuantity: Math.max(0, Math.min(remainingRequested, available)),
      }
    })
  }, [data, findMatchingInventory])

  const eligibleReliefRequests = useMemo(() => {
    const hasWarehouseStock = (inventoryData || []).some((inv) => Number(inv.available ?? inv.quantity ?? 0) > 0)
    return activeReliefRequests.filter((request) => {
      if (!request.beneficiaryId && !request.beneficiary) return false
      const rows = buildRequestItemRows(request)
      if (rows.some((item) => item.allocatableQuantity > 0)) return true
      const hasRemaining = rows.some((item) => item.remainingRequested > 0)
      return hasRemaining && hasWarehouseStock
    })
  }, [activeReliefRequests, buildRequestItemRows, inventoryData])

  const emptyStateInfo = useMemo(() => {
    if (requestsLoading || inventoryLoading) {
      return {
        title: 'Loading relief requests…',
        message: 'Checking approved requests and warehouse inventory.',
        action: 'none',
      }
    }
    const approvedTotal = (requests || []).filter((r) =>
      ALLOCATABLE_REQUEST_STATUSES.has(String(r.status || '').trim())
    )
    if (!approvedTotal.length) {
      return {
        title: 'No approved relief requests available',
        message: 'Only approved requests are eligible for inventory allocation. Pending requests must be reviewed and approved under Requests Management first.',
        action: 'requests',
      }
    }
    const unallocated = approvedTotal.filter((r) => !isRequestFullyAllocated(r, data))
    if (!unallocated.length) {
      return {
        title: 'All approved requests are fully allocated',
        message: 'Every approved relief request has already been 100% allocated or is currently in distribution.',
        action: 'none',
      }
    }
    const hasAnyStock = (inventoryData || []).some((i) => Number(i.available ?? i.quantity ?? 0) > 0)
    if (!hasAnyStock) {
      return {
        title: 'Warehouse inventory is out of stock',
        message: 'There are approved requests waiting, but warehouse inventory currently has zero available stock to allocate.',
        action: 'inventory',
      }
    }
    return {
      title: 'No requests ready for allocation',
      message: 'Approved requests do not currently have matching warehouse stock available.',
      action: 'refresh',
    }
  }, [requests, data, inventoryData, requestsLoading, inventoryLoading])

  const requestsSeeMore = useSeeMore(eligibleReliefRequests, 3)

  // Calculate live remaining stock for an item considering other rows in the same allocation modal
  const getItemAvailableStock = (inventoryItemId, currentLineKey) => {
    if (!inventoryItemId) return 0
    const item = (inventoryData || []).find((i) => Number(i.dbId) === Number(inventoryItemId))
    if (!item) return 0
    const totalBaseStock = Number(item.available ?? item.quantity ?? 0)

    const editOffset = (editRow && Number(editRow.inventoryItemId) === Number(inventoryItemId))
      ? Number(editRow.deductedQuantity || editRow.quantity || 0)
      : 0

    const otherRowsSum = (form.lines || [])
      .filter((l) => l.key !== currentLineKey && Number(l.inventoryItemId) === Number(inventoryItemId))
      .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0)

    return Math.max(0, totalBaseStock + editOffset - otherRowsSum)
  }

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

  const addLine = (resource = '', quantity = '', inventoryItemId = null, unit = '', variant = '') => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, makeLine(resource, quantity, inventoryItemId, unit, variant)],
    }))
  }

  const seedLinesFromRequest = useCallback((request, onlyRequestedItem = null, existingLines = []) => {
    let requestItems = buildRequestItemRows(request)
    if (onlyRequestedItem) {
      requestItems = requestItems.filter((item) => resourceNamesMatch(item.name, onlyRequestedItem))
    }
    if (!requestItems.length) {
      return existingLines
    }
    const allocatable = requestItems
      .filter((item) => item.inventoryItem && item.allocatableQuantity > 0)
      .map((item) => ({
        ...makeLine(
          item.inventoryItem.item,
          item.allocatableQuantity,
          item.inventoryItem.dbId,
          item.inventoryItem.unit || item.unit || 'units',
          item.inventoryItem.variant || ''
        ),
        requestedName: item.name,
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.unit || item.inventoryItem.unit || 'units',
        alreadyAllocated: item.alreadyAllocated,
        remainingRequested: item.remainingRequested,
      }))
    if (allocatable.length > 0) {
      return allocatable
    }

    const matched = requestItems
      .filter((item) => item.inventoryItem)
      .map((item) => ({
        ...makeLine(
          item.inventoryItem.item,
          item.allocatableQuantity > 0 ? item.allocatableQuantity : '',
          item.inventoryItem.dbId,
          item.inventoryItem.unit || item.unit || 'units',
          item.inventoryItem.variant || ''
        ),
        requestedName: item.name,
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.unit || item.inventoryItem.unit || 'units',
        alreadyAllocated: item.alreadyAllocated,
        remainingRequested: item.remainingRequested,
      }))
    if (matched.length > 0) {
      return matched
    }

    const firstAvailable = (inventoryData || []).find((i) => Number(i.available ?? i.quantity ?? 0) > 0)
    if (firstAvailable) {
      const fallbackQty = suggestedQuantityFromFamilies(request.families || request.affectedFamilies) || 1
      const avail = Number(firstAvailable.available ?? firstAvailable.quantity ?? 0)
      return [
        makeLine(
          firstAvailable.item,
          Math.min(fallbackQty, avail),
          firstAvailable.dbId,
          firstAvailable.unit || 'units',
          firstAvailable.variant || ''
        ),
      ]
    }

    return existingLines
  }, [buildRequestItemRows, inventoryData])

  useEffect(() => {
    const pref = location.state?.prefillRequest
    if (!pref) return

    const requestId = pref.requestId || pref.assistanceRequestId || pref.dbId || pref.id
    if (!requestId) return
    if (inventoryLoading) return

    assistanceRequestsApi.get(requestId)
      .then((res) => {
        const fullReq = res.data || res
        const reqStatus = String(fullReq.status || '').trim()
        if (!ALLOCATABLE_REQUEST_STATUSES.has(reqStatus)) {
          notify.warning(`Relief request is ${reqStatus || 'not approved'} and is not eligible for allocation.`)
          setAllocationStep(1)
          setHighestAllocationStep(1)
          setShowCreate(true)
          return
        }
        setActiveReliefRequest(fullReq)
        const details = parseRequestDetails(fullReq)
        const lines = seedLinesFromRequest(fullReq)
        setForm({
          ...emptyForm,
          lines,
          program: details?.reason || details?.assistanceType || fullReq.type || '',
          beneficiaryId: String(fullReq.beneficiaryId || ''),
          assistanceRequestId: String(fullReq.dbId || requestId),
          priority: details?.priority || fullReq.priority || 'Medium',
          notes: fullReq.affectedFamilies
            ? `Allocating for relief request ${fullReq.id || fullReq.reference_code || ''}: ${fullReq.affectedFamilies} affected families.`
            : '',
          status: 'Allocated',
        })
        if (lines.length > 0) {
          setAllocationStep(2)
          setHighestAllocationStep(2)
        } else {
          setAllocationStep(1)
          setHighestAllocationStep(1)
          notify.info('Relief request loaded. Review requested needs and stock availability.')
        }
        setShowCreate(true)
      })
      .catch((err) => {
        console.error('Failed to load relief request details:', err)
        notify.error(err.message || 'This relief request could not be loaded for allocation.')
        setAllocationStep(1)
        setHighestAllocationStep(1)
        setShowCreate(true)
      })

    window.history.replaceState({}, document.title)
  }, [location.state, inventoryLoading, seedLinesFromRequest])

  // Automatically refresh requests and inventory when opening the Create Allocation modal
  useEffect(() => {
    if (showCreate) {
      reloadRequests()
      reloadInventory()
      reload()
    }
  }, [showCreate, reloadRequests, reloadInventory, reload])

  // Auto-sync when window gains focus so newly approved requests appear immediately
  useEffect(() => {
    const handleFocus = () => {
      if (showCreate) {
        reloadRequests()
        reloadInventory()
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [showCreate, reloadRequests, reloadInventory])

  useEffect(() => {
    needsStockApi.get()
      .then((res) => {
        setNeedsSummary(res.data?.summary || null)
      })
      .catch(() => {
        setNeedsSummary(null)
      })
  }, [data])

  const selectedRequest = activeReliefRequest || (requests || []).find((r) => String(r.dbId) === String(form.assistanceRequestId))
  const requestDetails = parseRequestDetails(selectedRequest)
  const selectedBarangay = barangays.find((b) => String(b.dbId) === String(form.beneficiaryId || selectedRequest?.beneficiaryId))
  const barangayRequests = eligibleReliefRequests
  const selectedRequestItems = selectedRequest ? buildRequestItemRows(selectedRequest) : []
  const familiesForSuggestion = requestDetails
    ? Number(requestDetails.familiesAffected) || 0
    : Number(selectedBarangay?.affectedFamilies) || 0
  const recommendedQty = suggestedQuantityFromFamilies(familiesForSuggestion)
  const linesForSave = (form.lines || []).filter((line) => line.inventoryItemId || String(line.resource || '').trim())
  const selectedInventoryLineCount = (form.lines || []).filter((line) => line.inventoryItemId).length
  const hasAllocationTarget = editRow
    ? Boolean(form.assistanceRequestId || form.beneficiaryId)
    : Boolean(form.assistanceRequestId)
  const showAllocationFields = hasAllocationTarget || Boolean(editRow)
  const isSelectedRequestEligible = Boolean(
    selectedRequest
    && ALLOCATABLE_REQUEST_STATUSES.has(String(selectedRequest.status || '').trim())
    && selectedRequestItems.some((item) => item.allocatableQuantity > 0)
  )
  const isStepOneComplete = Boolean(form.assistanceRequestId && requestDetails && isSelectedRequestEligible && !activeRequestLoading && !requestsLoading)
  const canConfirmAllocation = hasAllocationTarget && !activeRequestLoading && linesForSave.length > 0 && linesForSave.every((line) => {
    const quantity = Number(line.quantity)
    const inventoryItem = (inventoryData || []).find((item) => Number(item.dbId) === Number(line.inventoryItemId))
    const available = getItemAvailableStock(line.inventoryItemId, line.key)
    const requestLimit = !editRow && Number.isFinite(Number(line.remainingRequested))
      ? Number(line.remainingRequested)
      : available
    return Boolean(inventoryItem && Number.isInteger(quantity) && quantity > 0 && quantity <= Math.min(available, requestLimit))
  })
  const reachableAllocationStep = !isStepOneComplete
    ? 1
    : (!canConfirmAllocation ? Math.min(highestAllocationStep, 2) : highestAllocationStep)
  const completedAllocationSteps = [
    ...(isStepOneComplete && highestAllocationStep >= 2 ? ['request'] : []),
    ...(canConfirmAllocation && highestAllocationStep >= 3 ? ['review'] : []),
  ]
  const lockedAllocationSteps = ALLOCATION_STEPS
    .filter((_, index) => (index + 1) > reachableAllocationStep || (index + 1) > highestAllocationStep)
    .map((step) => step.id)




  const quickAllocateForRequest = (req, need = null) => {
    const details = req.parsedDetails || parseRequestDetails(req)
    const lines = seedLinesFromRequest(req, need)
    if (!lines.length) {
      notify.warning('This relief request has no remaining requested items with available warehouse stock.')
      return
    }
    setDetailRow(null)
    setEditRow(null)
    setActiveReliefRequest(req)
    setForm({
      ...emptyForm,
      lines,
      program: details?.reason || details?.assistanceType || req.calamity || '',
      beneficiaryId: String(req.beneficiaryId || ''),
      assistanceRequestId: String(req.dbId || req.id || ''),
      priority: req.priority || 'Medium',
      notes: req.families
        ? `Allocating for relief request ${req.requestCode} (${req.beneficiaryName}): ${req.families} affected families.`
        : `Allocating for relief request ${req.requestCode} (${req.beneficiaryName}).`,
      status: 'Allocated',
    })
    setAllocationStep(2)
    setHighestAllocationStep(2)
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

  const closeForm = () => {
    setEditRow(null)
    setShowCreate(false)
    setActiveReliefRequest(null)
    setForm(emptyForm)
    setAllocationStep(1)
    setHighestAllocationStep(1)
  }

  const selectReliefRequest = async (requestId) => {
    setAllocationStep(1)
    setHighestAllocationStep(1)
    if (!requestId) {
      setActiveReliefRequest(null)
      setForm({ ...emptyForm, lines: [] })
      return
    }

    setActiveReliefRequest(null)
    setForm({ ...emptyForm, assistanceRequestId: String(requestId) })
    setActiveRequestLoading(true)
    try {
      const response = await assistanceRequestsApi.get(requestId)
      const fullRequest = response.data || response
      const reqStatus = String(fullRequest.status || '').trim()
      if (!ALLOCATABLE_REQUEST_STATUSES.has(reqStatus)) {
        throw new Error(`Request ${fullRequest.id || fullRequest.reference_code || ''} is ${reqStatus || 'not approved'} and cannot be allocated.`)
      }
      const details = parseRequestDetails(fullRequest)
      const lines = seedLinesFromRequest(fullRequest)
      setActiveReliefRequest(fullRequest)
      setForm({
        ...emptyForm,
        assistanceRequestId: String(fullRequest.dbId || requestId),
        beneficiaryId: String(fullRequest.beneficiaryId || ''),
        program: details?.reason || details?.assistanceType || fullRequest.type || '',
        priority: details?.priority || fullRequest.priority || 'Medium',
        status: 'Allocated',
        notes: fullRequest.affectedFamilies
          ? `Allocating for relief request ${fullRequest.id || fullRequest.reference_code || ''} (${fullRequest.beneficiary || ''}): ${fullRequest.affectedFamilies} affected families.`
          : '',
        lines,
      })
      if (!lines.length) {
        notify.info('Request details loaded. Please choose items and quantities in Step 2.')
      }
    } catch (error) {
      console.error('Failed to load relief request details:', error)
      notify.error(error.message || 'Failed to load relief request details. Try again or refresh the page.')
      setActiveReliefRequest(null)
      setForm({ ...emptyForm, lines: [] })
    } finally {
      setActiveRequestLoading(false)
    }
  }

  const continueAllocation = () => {
    if (allocationStep === 1) {
      if (!isStepOneComplete) {
        notify.warning('Select an approved request with remaining needs and available warehouse stock.')
        return
      }
      setAllocationStep(2)
      setHighestAllocationStep((step) => Math.max(step, 2))
      return
    }
    if (allocationStep === 2) {
      if (!canConfirmAllocation) {
        notify.warning('Check every allocation quantity. Use whole numbers within both the requested and available limits.')
        return
      }
      setAllocationStep(3)
      setHighestAllocationStep(3)
    }
  }

  const goBackAllocation = () => {
    setAllocationStep((step) => Math.max(1, step - 1))
  }

  const goToAllocationStep = (stepId) => {
    const targetStep = ALLOCATION_STEPS.findIndex((step) => step.id === stepId) + 1
    if (!targetStep || targetStep > reachableAllocationStep || targetStep > highestAllocationStep) return
    setAllocationStep(targetStep)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!editRow && allocationStep !== 3) {
      notify.warning('Review the allocation and continue to the confirmation step before submitting.')
      return
    }

    if (!editRow && !form.assistanceRequestId) {
      notify.warning('Choose an approved, eligible relief request before allocating inventory.')
      return
    }

    const lines = (form.lines || []).filter((l) => l.inventoryItemId || String(l.resource || '').trim())
    if (!lines.length) {
      notify.warning('Select at least one eligible inventory pack to allocate.')
      return
    }

    for (const line of lines) {
      if (!line.inventoryItemId) {
        notify.warning(`Select an available warehouse item for "${line.resource || 'this row'}" before confirming.`)
        return
      }
      const qtyNum = Number(line.quantity)
      if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
        notify.warning(`Enter a whole-number quantity greater than 0 for "${line.resource || 'selected pack'}".`)
        return
      }
      const lineAvail = getItemAvailableStock(line.inventoryItemId, line.key)
      if (qtyNum > lineAvail) {
        notify.error(`Requested quantity (${qtyNum}) exceeds available stock (${lineAvail}) for "${line.resource}".`)
        return
      }
      if (!editRow && line.remainingRequested !== null && qtyNum > Number(line.remainingRequested)) {
        notify.error(`Quantity for "${line.resource}" exceeds the remaining request (${line.remainingRequested} ${line.requestedUnit || line.unit}).`)
        return
      }
    }

    setSaving(true)
    showLoading('Processing allocation…')
    try {
      const ben = barangays.find((b) => Number(b.dbId) === Number(form.beneficiaryId || activeReliefRequest?.beneficiaryId))
      const benName = activeReliefRequest?.barangay || activeReliefRequest?.beneficiary || ben?.barangay || ben?.name || ben?.fullName || ''

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
        const matched = findMatchingInventory(lines[0]?.resource, lines[0]?.inventoryItemId)
        const res = await allocationsApi.update(editRow.dbId, {
          resource: lines[0]?.resource?.trim() || form.lines[0]?.resource?.trim(),
          quantity: Number(lines[0]?.quantity || form.lines[0]?.quantity || 0),
          inventoryItemId: matched?.dbId || null,
          unit: matched?.unit || null,
          variant: matched?.variant || null,
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
        // Multi-line batch atomic allocation
        const payload = {
          assistanceRequestId: form.assistanceRequestId ? Number(form.assistanceRequestId) : null,
          beneficiaryId: form.beneficiaryId ? Number(form.beneficiaryId) : null,
          beneficiary: benName,
          program: form.program,
          priority: form.priority,
          notes: form.notes,
          status: 'Allocated',
          lines: lines.map((l) => {
            const matched = findMatchingInventory(l.resource, l.inventoryItemId)
            return {
              resource: (matched?.item || l.resource || '').trim(),
              quantity: Number(l.quantity),
              inventoryItemId: matched?.dbId || l.inventoryItemId || null,
              unit: matched?.unit || l.unit || null,
              variant: matched?.variant || l.variant || null,
            }
          }),
        }

        const res = await allocationsApi.create(payload)
        const draftCreated = res?.data?.draftDistributionCreated || res?.draftDistributionCreated
        const draftId = res?.data?.draftDistributionId || res?.draftDistributionId
        const draftCode = res?.data?.draftDistributionCode || res?.draftDistributionCode
        if (draftCreated) {
          setDraftNotice({
            id: draftId,
            code: draftCode,
            barangay: benName || 'Barangay',
          })
        }
        setShowCreate(false)
        setForm(emptyForm)
        setActiveReliefRequest(null)
        setAllocationStep(1)
        setHighestAllocationStep(1)
      }

      reload()
      if (typeof reloadInventory === 'function') reloadInventory()
      if (typeof reloadRequests === 'function') reloadRequests()
      notifyBadgesChanged()
      if (editRow) {
        showSuccessModal('The allocation changes were saved successfully.', 'Allocation Updated')
      } else {
        showSuccessModal({
          title: 'Allocation Created',
          message: `${lines.length} requested item${lines.length === 1 ? '' : 's'} allocated to ${benName || 'the selected barangay'}. Warehouse stock was updated successfully.`,
          confirmText: 'Done',
        })
      }
    } catch (err) {
      notify.error(err.message || 'Failed to complete allocation.')
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

    showLoading('Deleting…')
    try {
      await allocationsApi.remove(row.dbId)
      notify.success(`Allocation ${row.id} deleted.`)
      showSuccessModal('Successfully deleted.')
      reload()
      if (typeof reloadInventory === 'function') reloadInventory()
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

  const columns = [
    {
      key: 'request',
      label: 'Request ID',
      width: '135px',
      exportValue: (row) => row.assistanceRequestCode || row.request?.id || (row.assistanceRequestId ? `#${row.assistanceRequestId}` : '—'),
      render: (row) => (
        <span className="alloc-request-id" title={row.assistanceRequestType || ''}>
          {row.assistanceRequestCode || (row.assistanceRequestId ? `#${row.assistanceRequestId}` : '—')}
        </span>
      ),
    },
    {
      key: 'resource',
      label: 'Resource',
      minWidth: '160px',
      render: (row) => (
        <span style={{ fontWeight: 600, color: '#0f172a' }}>
          {row.resource || '—'}
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'Qty',
      width: '95px',
      align: 'center',
      render: (row) => (
        <span style={{ fontWeight: 650, color: '#0f172a' }}>
          {row.quantity} {row.unit ? <small style={{ color: '#64748b', fontWeight: 500 }}>{row.unit}</small> : ''}
        </span>
      ),
    },
    {
      key: 'beneficiary',
      label: 'Barangay',
      minWidth: '150px',
      render: (row) => (
        <span style={{ fontWeight: 550, color: '#1e293b' }}>
          {row.beneficiary || 'Barangay'}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      width: '105px',
      align: 'center',
      render: (row) => <StatusBadge status={row.priority} />,
    },
    {
      key: 'status',
      label: 'Status',
      width: '135px',
      align: 'center',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'date',
      label: 'Date',
      width: '115px',
      align: 'center',
      render: (row) => (
        <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
          {row.date || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '105px',
      align: 'center',
      render: (row) => {
        const isReadyToPlan = (row.status === 'Allocated' || !row.status) && !row.distributionId
        const hasDelivery = Boolean(row.distributionId)
        return (
          <div className="alloc-row-actions">
            <button
              type="button"
              className="icon-btn"
              title="View details"
              aria-label="View allocation details"
              onClick={(event) => {
                event.stopPropagation()
                setDetailRow(row)
              }}
            >
              <Eye size={15} />
            </button>
            {isReadyToPlan && (
              <button
                type="button"
                className="icon-btn"
                title="Plan Delivery for this allocation"
                aria-label="Plan Delivery"
                style={{ color: '#AF101A' }}
                onClick={(event) => {
                  event.stopPropagation()
                  planDistribution(row)
                }}
              >
                <Truck size={15} />
              </button>
            )}
            {hasDelivery && (
              <button
                type="button"
                className="icon-btn"
                title={`View Delivery (${row.draftDistributionCode || 'DST'})`}
                aria-label="View Delivery"
                style={{ color: '#2563eb' }}
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(`/admin/distributions?id=${row.distributionId}#distributions-table`)
                }}
              >
                <ExternalLink size={15} />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  const goodsOptions = requestDetails?.goods || []
  const needOptions = requestDetails ? goodsOptions : (selectedBarangay?.needs || [])

  const CreateAllocationFields = (
    <>
      {allocationStep === 1 && (
        <section className="alloc-wizard-panel" aria-labelledby="alloc-step-request-title">
          <div className="alloc-wizard-heading alloc-wizard-heading--split">
            <div>
              <span className="alloc-wizard-kicker">Step 1 of 3</span>
              <h3 id="alloc-step-request-title">Choose an eligible relief request</h3>
              <p>Only approved requests with remaining itemized needs and matching warehouse stock are shown.</p>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm alloc-refresh-btn"
              onClick={() => {
                reloadRequests()
                reloadInventory()
                reload()
              }}
              title="Refresh approved requests and warehouse inventory"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
            >
              <RotateCcw size={14} className={requestsLoading ? 'alloc-spin' : ''} />
              Refresh
            </button>
          </div>

          <label className="alloc-create-field">
            Relief request <span className="alloc-required-mark" aria-hidden="true">*</span>
            <select
              value={form.assistanceRequestId}
              disabled={activeRequestLoading || inventoryLoading || requestsLoading}
              onChange={(event) => selectReliefRequest(event.target.value)}
            >
              <option value="">Select an approved request…</option>
              {barangayRequests.map((request) => (
                <option key={request.dbId} value={request.dbId}>
                  {request.id || request.requestCode} — {request.beneficiary || request.beneficiaryName || 'Barangay'} · {request.priority || 'Medium'} priority ({request.needs?.slice(0, 2).join(', ') || 'Relief Goods'})
                </option>
              ))}
            </select>
            <small>
              {inventoryLoading || requestsLoading
                ? 'Loading eligible requests and live warehouse stock…'
                : `${barangayRequests.length} request${barangayRequests.length === 1 ? '' : 's'} currently eligible`}
            </small>
          </label>

          {!inventoryLoading && !requestsLoading && barangayRequests.length === 0 && (
            <div className="alloc-wizard-empty" role="status">
              <Package size={22} />
              <div>
                <strong>{emptyStateInfo.title}</strong>
                <span>{emptyStateInfo.message}</span>
                <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => {
                      reloadRequests()
                      reloadInventory()
                      reload()
                    }}
                  >
                    <RotateCcw size={13} /> Refresh Requests
                  </button>
                  {emptyStateInfo.action === 'requests' && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        closeForm()
                        navigate('/admin/requests')
                      }}
                    >
                      Go to Requests
                    </button>
                  )}
                  {emptyStateInfo.action === 'inventory' && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        closeForm()
                        navigate('/admin/inventory')
                      }}
                    >
                      View Inventory
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeRequestLoading && (
            <div className="alloc-create-loading" role="status">Loading request details and live stock…</div>
          )}

          {!requestDetails && !activeRequestLoading && !requestsLoading && barangayRequests.length > 0 && (
            <div className="alloc-create-first-step">
              <MapPin size={19} />
              <div>
                <strong>Select a request to see its allocation details</strong>
                <span>Barangay, priority, requested quantities, prior allocations, and available stock will load automatically.</span>
              </div>
            </div>
          )}

          {requestDetails && !activeRequestLoading && (
            <section className="alloc-request-review-card">
              <div className="alloc-request-review-card__head">
                <div>
                  <span>Selected request</span>
                  <h4>{requestDetails.reference || selectedRequest?.id}</h4>
                  <p><MapPin size={14} /> {requestDetails.barangay || requestDetails.beneficiary || selectedBarangay?.barangay || 'Barangay'}</p>
                </div>
                <div className="alloc-create-request-badges">
                  <StatusBadge status={requestDetails.status || 'Approved'} />
                  <StatusBadge status={requestDetails.priority || 'Medium'} />
                </div>
              </div>

              <dl className="alloc-request-review-facts">
                <div><dt>Program / need</dt><dd>{requestDetails.reason || requestDetails.assistanceType || 'Relief assistance'}</dd></div>
                <div><dt>Affected families</dt><dd>{familiesForSuggestion.toLocaleString()}</dd></div>
                <div><dt>Allocatable items</dt><dd>{selectedRequestItems.filter((item) => item.allocatableQuantity > 0).length} of {selectedRequestItems.length}</dd></div>
              </dl>

              <div className="alloc-request-items" role="table" aria-label="Requested items and available inventory">
                <div className="alloc-request-items__row alloc-request-items__row--head" role="row">
                  <span role="columnheader">Requested item</span>
                  <span role="columnheader">Requested</span>
                  <span role="columnheader">Allocated</span>
                  <span role="columnheader">Available now</span>
                </div>
                {selectedRequestItems.map((item) => {
                  const displayUnit = item.unit || item.inventoryItem?.unit || 'units'
                  return (
                    <div className="alloc-request-items__row" role="row" key={`${item.name}-${displayUnit}`}>
                      <span role="cell"><strong>{item.name}</strong>{item.inventoryItem ? <small>{item.inventoryItem.item}</small> : <small>No matching inventory item</small>}</span>
                      <span role="cell">{item.requestedQuantity} {displayUnit}{item.estimated ? <small>Estimated from families</small> : null}</span>
                      <span role="cell">{item.alreadyAllocated} {displayUnit}</span>
                      <span role="cell" className={item.allocatableQuantity > 0 ? 'is-in-stock' : 'is-out-of-stock'}>
                        {item.inventoryItem ? `${item.available} ${item.inventoryItem.unit || displayUnit}` : 'Unavailable'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </section>
      )}

      {allocationStep === 2 && (
        <section className="alloc-wizard-panel" aria-labelledby="alloc-step-review-title">
          <div className="alloc-wizard-heading alloc-wizard-heading--split">
            <div>
              <span className="alloc-wizard-kicker">Step 2 of 3</span>
              <h3 id="alloc-step-review-title">Review items and quantities</h3>
              <p>Each quantity is capped by both the remaining request and live warehouse stock.</p>
            </div>
            <div className="alloc-wizard-request-chip">
              <span>{requestDetails?.reference || selectedRequest?.id}</span>
              <strong>{requestDetails?.barangay || requestDetails?.beneficiary || selectedBarangay?.barangay || 'Barangay'}</strong>
            </div>
          </div>

          <div className="alloc-review-list">
            {(form.lines || []).map((line) => {
              const inventoryItem = (inventoryData || []).find((item) => Number(item.dbId) === Number(line.inventoryItemId))
              const available = getItemAvailableStock(line.inventoryItemId, line.key)
              const requestedLimit = line.remainingRequested === null ? available : Number(line.remainingRequested)
              const maximum = Math.max(0, Math.min(available, requestedLimit))
              const quantity = Number(line.quantity)
              const isValid = Number.isInteger(quantity) && quantity > 0 && quantity <= maximum
              return (
                <article className={`alloc-review-item${isValid ? '' : ' alloc-review-item--invalid'}`} key={line.key}>
                  <div className="alloc-review-item__identity">
                    <span>Requested item</span>
                    <strong>{line.requestedName || line.resource}</strong>
                    <small>Matched to {inventoryItem?.item || line.resource}</small>
                  </div>
                  <dl className="alloc-review-item__limits">
                    <div><dt>Requested</dt><dd>{line.requestedQuantity ?? '—'} {line.requestedUnit || line.unit}</dd></div>
                    <div><dt>Already allocated</dt><dd>{line.alreadyAllocated || 0} {line.requestedUnit || line.unit}</dd></div>
                    <div><dt>Still needed</dt><dd>{line.remainingRequested ?? '—'} {line.requestedUnit || line.unit}</dd></div>
                    <div><dt>In stock</dt><dd>{available} {inventoryItem?.unit || line.unit}</dd></div>
                  </dl>
                  <label className="alloc-review-item__quantity">
                    Allocate now
                    <div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={maximum}
                        step="1"
                        required
                        value={line.quantity}
                        aria-invalid={!isValid}
                        onChange={(event) => {
                          const rawValue = event.target.value
                          if (rawValue === '') {
                            updateLine(line.key, { quantity: '' })
                            return
                          }
                          if (!/^\d+$/.test(rawValue)) return
                          updateLine(line.key, { quantity: String(Math.min(maximum, Math.max(1, Number(rawValue)))) })
                        }}
                      />
                      <span>{inventoryItem?.unit || line.unit}</span>
                    </div>
                    <small>Maximum {maximum} {inventoryItem?.unit || line.unit}</small>
                  </label>
                  <button
                    type="button"
                    className="alloc-review-item__remove"
                    onClick={() => removeLine(line.key)}
                    disabled={(form.lines || []).length <= 1}
                    title="Skip this requested item"
                    aria-label={`Skip ${line.requestedName || line.resource}`}
                  >
                    <X size={15} /> Skip
                  </button>
                </article>
              )
            })}
          </div>

          {selectedRequestItems.some((item) => item.allocatableQuantity <= 0) && (
            <div className="alloc-review-unavailable">
              <AlertCircle size={16} />
              <span>{selectedRequestItems.filter((item) => item.allocatableQuantity <= 0).length} requested item(s) cannot be included because no remaining need or stock is available.</span>
            </div>
          )}

          <div className="alloc-review-meta">
            <div><span>Priority</span><StatusBadge status={form.priority || 'Medium'} /></div>
            <div><span>Program / Need</span><strong>{form.program || 'Relief assistance'}</strong></div>
          </div>

          <label className="alloc-notes-label">
            Internal notes <span className="alloc-create-optional">Optional</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Add handling instructions or an internal note…"
              className="alloc-notes-textarea"
            />
          </label>
        </section>
      )}

      {allocationStep === 3 && (
        <section className="alloc-wizard-panel" aria-labelledby="alloc-step-confirm-title">
          <div className="alloc-wizard-heading">
            <span className="alloc-wizard-kicker">Step 3 of 3</span>
            <h3 id="alloc-step-confirm-title">Confirm this allocation</h3>
            <p>Check the destination and final quantities. Inventory is deducted only after confirmation.</p>
          </div>

          <div className="alloc-confirm-destination">
            <div className="alloc-confirm-destination__icon"><MapPin size={20} /></div>
            <div>
              <span>Allocate to</span>
              <strong>{requestDetails?.barangay || requestDetails?.beneficiary || selectedBarangay?.barangay || 'Barangay'}</strong>
              <small>{requestDetails?.reference || selectedRequest?.id} · {form.program || 'Relief assistance'}</small>
            </div>
            <StatusBadge status={form.priority || 'Medium'} />
          </div>

          <div className="alloc-confirm-items">
            <div className="alloc-confirm-items__head">
              <strong>{selectedInventoryLineCount} item type{selectedInventoryLineCount === 1 ? '' : 's'} ready</strong>
              <span>Warehouse stock will be deducted</span>
            </div>
            {(form.lines || []).map((line) => {
              const inventoryItem = (inventoryData || []).find((item) => Number(item.dbId) === Number(line.inventoryItemId))
              const quantity = Number(line.quantity) || 0
              const stockBefore = getItemAvailableStock(line.inventoryItemId, line.key)
              return (
                <div className="alloc-confirm-item" key={line.key}>
                  <div><strong>{inventoryItem?.item || line.resource}</strong><span>{line.requestedName && line.requestedName !== line.resource ? `For: ${line.requestedName}` : 'Requested item'}</span></div>
                  <div><span>Allocate</span><strong>{quantity} {inventoryItem?.unit || line.unit}</strong></div>
                  <div><span>Stock after</span><strong>{Math.max(0, stockBefore - quantity)} {inventoryItem?.unit || line.unit}</strong></div>
                  <div><span>Request remaining</span><strong>{Math.max(0, Number(line.remainingRequested || 0) - quantity)} {line.requestedUnit || line.unit}</strong></div>
                </div>
              )
            })}
          </div>

          <div className="alloc-confirm-notice">
            <CheckCircle2 size={18} />
            <div><strong>Ready to allocate</strong><span>This creates allocation records, deducts warehouse stock, and updates the relief request’s fulfillment status.</span></div>
          </div>

          {form.notes && <div className="alloc-confirm-note"><span>Internal note</span><p>{form.notes}</p></div>}
        </section>
      )}
    </>
  )

  const FormFields = (
    <>
      {!editRow && (
        <label className="alloc-create-field">
          Link to an approved relief request <span className="alloc-create-optional">Request-based stock allocations require an approved request</span>
          <select
            value={form.assistanceRequestId}
            disabled={activeRequestLoading || inventoryLoading}
            onChange={async (event) => {
              const requestId = event.target.value
              if (!requestId) {
                setActiveReliefRequest(null)
                setForm({ ...emptyForm, lines: [] })
                return
              }
              setActiveReliefRequest(null)
              setForm({ ...emptyForm, assistanceRequestId: String(requestId) })
              setActiveRequestLoading(true)
              try {
                const response = await assistanceRequestsApi.get(requestId)
                const fullRequest = response.data || response
                const details = parseRequestDetails(fullRequest)
                setActiveReliefRequest(fullRequest)
                setForm({
                  ...emptyForm,
                  assistanceRequestId: String(fullRequest.dbId || requestId),
                  beneficiaryId: String(fullRequest.beneficiaryId || ''),
                  program: details.reason || details.assistanceType || fullRequest.type || '',
                  priority: details.priority || 'Medium',
                  status: 'Allocated',
                  notes: '',
                  lines: seedLinesFromRequest(fullRequest),
                })
              } catch {
                setActiveReliefRequest(null)
                setForm(emptyForm)
                notify.error('Failed to load relief request details. Try again or refresh the page.')
              } finally {
                setActiveRequestLoading(false)
              }
            }}
          >
            <option value="">Select a relief request to allocate…</option>
            {barangayRequests.map((request) => (
              <option key={request.dbId} value={request.dbId}>
                {request.id} — {request.beneficiary || request.beneficiaryName || 'Barangay'} · {request.type}
              </option>
            ))}
          </select>
          <small>{inventoryLoading ? 'Loading live warehouse stock…' : 'Choosing a request loads its barangay, affected-family count, priority, and requested goods.'}</small>
        </label>
      )}

      {activeRequestLoading && <div className="alloc-create-loading" role="status">Loading request details and stock suggestions…</div>}

      {!showAllocationFields && !activeRequestLoading && (
        <div className="alloc-create-first-step">
          <MapPin size={19} />
          <div>
            <strong>Select a relief request to begin</strong>
              <span>Request details and matching warehouse stock will appear here before anything is deducted.</span>
          </div>
        </div>
      )}

      {requestDetails && (
        <section className="alloc-create-request-summary">
          <div className="alloc-create-request-top">
            <div className="alloc-create-request-heading">
              <span className="alloc-create-eyebrow">Linked relief request</span>
              <h3>
                <MapPin size={16} />
                {requestDetails.barangay || requestDetails.beneficiary || selectedBarangay?.barangay || selectedBarangay?.name || 'Beneficiary'}
                <code>{requestDetails.reference || activeReliefRequest?.id || `AST-${selectedRequest?.dbId || ''}`}</code>
              </h3>
              <p>{requestDetails.reason || requestDetails.assistanceType || 'Relief assistance'}</p>
            </div>
            <div className="alloc-create-request-badges">
              <StatusBadge status={requestDetails.status || 'Approved'} />
              <StatusBadge status={requestDetails.priority || 'Medium'} />
            </div>
            <div className="alloc-create-request-actions">
              <button
                type="button"
                className="alloc-modal-open-request-btn"
                onClick={() => {
                  const requestId = activeReliefRequest?.id || activeReliefRequest?.dbId || selectedRequest?.id || selectedRequest?.dbId
                  closeForm()
                  navigate('/admin/requests', { state: { openRequestId: requestId } })
                }}
              >
                View request <ExternalLink size={13} />
              </button>
            </div>
          </div>

          <dl className="alloc-create-request-facts">
            <div><dt>Request type</dt><dd>{requestDetails.assistanceType || 'Relief assistance'}</dd></div>
            <div><dt>Affected families</dt><dd>{familiesForSuggestion.toLocaleString()}</dd></div>
            <div><dt>Barangay</dt><dd>{requestDetails.barangay || selectedBarangay?.barangay || selectedBarangay?.name || '—'}</dd></div>
          </dl>

          <div className="alloc-create-needs">
            <div className="alloc-create-needs-label">Requested goods and stock</div>
            {goodsOptions.length ? (
              <div className="alloc-need-tags">
                {goodsOptions.map((good) => {
                  const matched = matchGoodsToInventory(good)
                  const hasStock = matched && Number(matched.available ?? matched.quantity ?? 0) > 0
                  return (
                    <span key={good} className={`alloc-create-need-chip ${hasStock ? 'is-available' : 'is-unavailable'}`}>
                      <strong>{good}</strong>
                      <span>{hasStock ? `${matched.available ?? matched.quantity} ${matched.unit} available` : 'No matching stock'}</span>
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="alloc-create-no-needs">No itemized goods are recorded on this request. Add requested goods before linking a stock allocation.</p>
            )}
          </div>
          {requestDetails.additionalNotes && <p className="alloc-create-additional-notes">{requestDetails.additionalNotes}</p>}
        </section>
      )}

      {!requestDetails && selectedBarangay && (
        <section className="alloc-create-request-summary alloc-create-direct-summary">
          <div className="alloc-create-request-heading">
            <span className="alloc-create-eyebrow">Direct stock allocation</span>
            <h3><MapPin size={16} />{selectedBarangay.barangay || selectedBarangay.name || selectedBarangay.fullName || 'Beneficiary'}</h3>
            <p>Not linked to a relief request</p>
          </div>
          <dl className="alloc-create-request-facts">
            <div><dt>Barangay families</dt><dd>{Number(selectedBarangay.affectedFamilies || 0).toLocaleString()}</dd></div>
            <div><dt>Program / need</dt><dd>{form.program || 'Choose a need below'}</dd></div>
          </dl>
        </section>
      )}

      {showAllocationFields && <section className="alloc-resource-lines alloc-create-resources">
        <div className="alloc-resource-lines__head">
          <div>
            <strong>Inventory to allocate</strong>
            <p className="alloc-resource-lines__hint">
              Choose warehouse items for the selected needs. Suggestions use affected families and are capped by live stock.
            </p>
          </div>
          <span>{selectedInventoryLineCount} of {(form.lines || []).length} selected</span>
        </div>

        {(form.lines || []).length === 0 && (
          <div className="alloc-create-empty-lines">
            <Package size={18} />
            <div>
              <strong>No inventory items added</strong>
              <span>{form.assistanceRequestId ? 'Choose matching requested goods above, or remove needs that cannot be fulfilled now.' : 'Select an approved relief request above to set the allocation target.'}</span>
            </div>
          </div>
        )}

        {(form.lines || []).length > 0 && (
          <div className="alloc-resource-table-head">
            <span>Resource (Available Stock)</span>
            <span>Available Stock</span>
            <span>Quantity</span>
            <span></span>
          </div>
        )}

        <div className="alloc-resource-lines__rows">
          {(form.lines || []).map((line) => {
            const currentItem = (inventoryData || []).find((i) => Number(i.dbId) === Number(line.inventoryItemId))
            const lineAvail = getItemAvailableStock(line.inventoryItemId, line.key)
            const qtyNum = Number(line.quantity) || 0
            const isOverStock = line.inventoryItemId && qtyNum > lineAvail

            // Filter only available warehouse items
            const availableItems = (inventoryData || []).filter((i) => Number(i.available ?? i.quantity ?? 0) > 0)
            const requestedMatches = availableItems.filter((i) => {
              const iName = String(i.item || '').toLowerCase()
              return needOptions.some((g) => {
                const gClean = String(g).replace(/\s+\(\s*\d+[^)]*\)\s*$/, '').trim().toLowerCase()
                return iName.includes(gClean) || gClean.includes(iName)
              })
            })
            const eligibleItems = needOptions.length ? requestedMatches : availableItems

            return (
              <div key={line.key} className="alloc-resource-line-wrap">
                <div className="alloc-resource-row">
                  <div>
                    <select
                      required
                      value={line.inventoryItemId || ''}
                      onChange={(e) => {
                        const chosenId = e.target.value
                        const item = eligibleItems.find((i) => String(i.dbId) === String(chosenId))
                        if (!item) {
                          updateLine(line.key, { inventoryItemId: null, resource: '', unit: '', variant: '' })
                          return
                        }
                        const remStock = getItemAvailableStock(item.dbId, line.key)
                        const defaultQty = line.quantity ? Math.min(Number(line.quantity), remStock) : Math.min(remStock, recommendedQty || 1)
                        updateLine(line.key, {
                          inventoryItemId: item.dbId,
                          resource: item.item,
                          unit: item.unit,
                          variant: item.variant || '',
                          quantity: defaultQty || '1',
                        })
                      }}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Select an eligible inventory item --</option>
                      {requestedMatches.length > 0 && (
                        <optgroup label="Requested by this community (matching stock)">
                          {requestedMatches.map((item) => (
                            <option key={item.dbId} value={item.dbId}>
                              {item.item} — {item.available ?? item.quantity} {item.unit} available
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {!needOptions.length && <optgroup label="Available warehouse items">
                        {availableItems.map((item) => (
                          <option key={item.dbId} value={item.dbId}>
                            {item.item} — {item.available ?? item.quantity} {item.unit} available
                          </option>
                        ))}
                      </optgroup>}
                      {needOptions.length > 0 && requestedMatches.length === 0 && (
                        <option value="" disabled>No matching stock for the requested goods</option>
                      )}
                    </select>
                  </div>

                  <div className="alloc-avail-stock">
                    {currentItem ? (
                      <span style={{ fontWeight: 600, color: lineAvail > 0 ? '#166534' : '#b91c1c', fontSize: '0.85rem' }}>
                        {lineAvail} {currentItem.unit} available
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Select an item</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="number"
                      min="1"
                      max={lineAvail > 0 ? lineAvail : undefined}
                      required
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      placeholder={recommendedQty ? String(recommendedQty) : '0'}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: isOverStock ? '1px solid #ef4444' : '1px solid #cbd5e1',
                        background: isOverStock ? '#fef2f2' : '#ffffff',
                      }}
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title="Remove pack"
                      aria-label="Remove resource pack"
                      onClick={() => removeLine(line.key)}
                      disabled={(form.lines || []).length <= 1 && editRow}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {currentItem && (
                  <div className={`alloc-stock-feedback ${isOverStock ? 'alloc-stock-feedback--err' : 'alloc-stock-feedback--ok'}`} style={{ marginTop: '4px' }}>
                    {isOverStock ? (
                      <>
                        <AlertCircle size={13} />
                        <span>Insufficient stock! Remaining available: {lineAvail} {currentItem.unit}. Requested: {qtyNum} {currentItem.unit}.</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Valid allocation: {qtyNum || 0} of {lineAvail} {currentItem.unit} selected</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!editRow && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => addLine('', recommendedQty || '')}
            style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Plus size={14} /> Add another pack
          </button>
        )}
      </section>}

      {showAllocationFields && <label className="alloc-create-field">
        Program / Need
        <input
          list="allocation-program-options"
          value={form.program}
          onChange={(e) => setForm({ ...form, program: e.target.value })}
          placeholder={requestDetails?.reason || requestDetails?.assistanceType || 'e.g. Food Supplies'}
          readOnly={Boolean(requestDetails)}
        />
        <datalist id="allocation-program-options">
          {[requestDetails?.reason, requestDetails?.assistanceType, ...needOptions].filter(Boolean).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>}

      {showAllocationFields && requestDetails && familiesForSuggestion > 0 && goodsOptions.length > 0 && (
        <div className="alloc-create-quantity-guide">
          <Sparkles size={14} aria-hidden />
          <span>
            Quantity guide: up to <strong>{recommendedQty} per requested good</strong> for {familiesForSuggestion} affected families; stock limits apply.
          </span>
        </div>
      )}

      {showAllocationFields && <div className="alloc-meta-row">
        <label className="alloc-meta-label">
          Priority
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="alloc-meta-control"
          >
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {editRow ? (
          <label className="alloc-meta-label">
            Status
            <select
              value={form.status}
              disabled={isTerminalStatus(editRow.status, ALLOCATION_TERMINAL)}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="alloc-meta-control"
            >
              {getAvailableNextStatuses({
                currentStatus: editRow.status,
                allStatuses: STATUS_OPTIONS,
                workflowOrder: ALLOCATION_WORKFLOW,
                terminalStatuses: ALLOCATION_TERMINAL,
                branches: ALLOCATION_BRANCHES,
              }).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {isTerminalStatus(editRow.status, ALLOCATION_TERMINAL) && (
              <small style={{ display: 'block', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                Status is finalized and locked.
              </small>
            )}
          </label>
        ) : (
          <div className="alloc-create-outcome">
            <span>After confirmation</span>
            <div><CheckCircle2 size={16} /><strong>Allocated</strong><small>Stock is deducted now; use Plan Distribution to schedule delivery.</small></div>
          </div>
        )}
      </div>}

      {showAllocationFields && <label className="alloc-notes-label">
        Notes
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Optional internal allocation notes..."
          className="alloc-notes-textarea"
        />
      </label>}
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
            disabled={loading || inventoryLoading || requestsLoading}
            onClick={() => {
              setEditRow(null)
              setForm({ ...emptyForm, lines: [] })
              setActiveReliefRequest(null)
              setAllocationStep(1)
              setHighestAllocationStep(1)
              setShowCreate(true)
            }}
            title={loading || inventoryLoading || requestsLoading ? 'Loading allocation data…' : 'Create a new allocation'}
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

      {eligibleReliefRequests.length > 0 && (
        <section className="admin-panel alloc-needs-panel">
          <div className="alloc-needs-header">
            <div>
              <h2>Relief Requests · Needs Overview</h2>
              <p className="alloc-panel-hint">
                Active community requests awaiting stock allocation. Click any card or request code to inspect the full request on the Requests Portal, or click "+ Allocate" on a need to allocate warehouse supplies.
              </p>
            </div>
          </div>
          <div className="see-more-wrap">
            <div className="alloc-needs-grid">
              {requestsSeeMore.visible.map((req) => (
                <article 
                  key={req.dbId} 
                  className="alloc-needs-card"
                  onClick={() => navigate('/admin/requests', { state: { openRequestId: req.id || req.dbId } })}
                  style={{ cursor: 'pointer' }}
                  title={`Click to view full relief request ${req.requestCode}`}
                >
                  <div className="alloc-needs-card__top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span className="alloc-card-brgy-icon"><MapPin size={15} /></span>
                      <strong className="alloc-card-brgy-name">{req.beneficiaryName}</strong>
                      <span 
                        className="alloc-req-code-tag"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/admin/requests', { state: { openRequestId: req.id || req.dbId } });
                        }}
                        title="Click to view relief request"
                      >
                        {req.requestCode}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <StatusBadge status={req.priority} />
                      <button
                        type="button"
                        className="alloc-card-external-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/admin/requests', { state: { openRequestId: req.id || req.dbId } });
                        }}
                        title={`View relief request ${req.requestCode}`}
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="alloc-needs-card__meta">
                    <span className="alloc-calamity-badge">{req.calamity}</span>
                    <span className="alloc-families-count">
                      <Users size={13} style={{ color: 'var(--admin-brand, #AF101A)' }} />
                      <strong>{req.families.toLocaleString()}</strong> affected families · ≈ {req.families * PACKS_PER_FAMILY} packs/need
                    </span>
                  </div>

                  <div className="alloc-needs-card__footer" onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '0.45rem 0.75rem', fontWeight: 650 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          quickAllocateForRequest(req)
                        }}
                        title={`Allocate warehouse inventory for ${req.requestCode}`}
                      >
                        <span>+ Allocate Resources</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        style={{ fontSize: '0.78rem', padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('/admin/requests', { state: { openRequestId: req.id || req.dbId } })
                        }}
                        title="View relief request details"
                      >
                        <span>View Request</span>
                        <ArrowRight size={13} style={{ marginLeft: '4px' }} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {requestsSeeMore.needsToggle && (
              <SeeMoreToggle
                expanded={requestsSeeMore.expanded}
                onToggle={requestsSeeMore.toggle}
                hiddenCount={requestsSeeMore.hiddenCount}
              />
            )}
          </div>
        </section>
      )}

      {/* Scope Segment Tabs */}
      <div className="alloc-tab-nav">
        <button
          type="button"
          className={`alloc-tab-btn ${activeTab === 'active' ? 'alloc-tab-btn--active' : ''}`}
          onClick={() => {
            setActiveTab('active')
            adminBadgesApi.markSeen('/admin/allocation').catch(() => {})
          }}
        >
          <span>Active Allocations (Awaiting Distribution)</span>
          {activeAttentionCount > 0 && (
            <span
              className="alloc-tab-badge alloc-tab-badge--urgent"
              title={`${activeAttentionCount} allocation(s) requiring attention`}
            >
              {activeAttentionCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`alloc-tab-btn ${activeTab === 'inDistribution' ? 'alloc-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('inDistribution')}
        >
          <span>In Distribution</span>
          {inDistAttentionCount > 0 && (
            <span
              className="alloc-tab-badge alloc-tab-badge--urgent"
              title={`${inDistAttentionCount} delivery item(s) requiring attention`}
            >
              {inDistAttentionCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`alloc-tab-btn ${activeTab === 'all' ? 'alloc-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span>All Allocations</span>
        </button>
      </div>

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by resource, program, or barangay..."
        exportConfig={{ filename: 'allocation-report', title: 'Resource Allocation Report', columns, rows: filters.filtered }}
      />

      <ApiState loading={loading} error={error} message="Loading allocations…" onRetry={reload}>
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
          emptyTitle={
            filters.activeCount > 0 || filters.search
              ? 'No Matching Allocations'
              : activeTab === 'active'
                ? 'No Active Allocations (Awaiting Distribution)'
                : activeTab === 'inDistribution'
                  ? 'No Allocations in Distribution'
                  : 'No Allocations Found'
          }
          emptyDescription={
            filters.activeCount > 0 || filters.search
              ? 'No allocations matched your active search or filter criteria. Try resetting the filters.'
              : activeTab === 'active'
                ? 'There are currently no allocations awaiting logistics planning. Approved relief requests ready for allocation appear in the top section.'
                : activeTab === 'inDistribution'
                  ? 'No allocations are currently scheduled or assigned to active distribution events.'
                  : 'No allocation records have been created in the system yet.'
          }
          emptyAction={
            (filters.activeCount > 0 || filters.search) ? (
              <button
                type="button"
                className="btn btn--sm btn--outline"
                onClick={filters.reset}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RotateCcw size={13} />
                <span>Reset Filters</span>
              </button>
            ) : null
          }
        />
      </ApiState>

      {detailRow && (
        <AllocationDetailModal
          detailRow={detailRow}
          linkedReq={linkedRequest(detailRow)}
          onClose={() => setDetailRow(null)}
          onPlanDistribution={() => planDistribution(detailRow)}
          onDelete={() => handleDelete(detailRow)}
          canPlan={canPlan(detailRow)}
          navigate={navigate}
        />
      )}

      {(editRow || showCreate) && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div
            className={`admin-modal admin-modal--wide alloc-create-modal${!editRow ? ' alloc-create-modal--wizard' : ''}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editRow ? 'Edit allocation' : 'Create allocation'}
          >
            <ModalHeader
              title={editRow ? 'Edit Allocation' : 'Create Allocation'}
              subtitle={editRow ? 'Update the allocation details' : 'Allocate warehouse resources to approved relief requests'}
              onClose={closeForm}
            />
            {!editRow && (
              <WizardStepper
                steps={ALLOCATION_STEPS}
                currentStep={ALLOCATION_STEPS[allocationStep - 1].id}
                completedSteps={completedAllocationSteps}
                lockedSteps={lockedAllocationSteps}
                onStepChange={goToAllocationStep}
                ariaLabel="Create allocation progress"
              />
            )}
            <form onSubmit={handleSave} className="alloc-create-form">
              <div className="alloc-create-body">{editRow ? FormFields : CreateAllocationFields}</div>
              <div className="admin-modal__actions alloc-create-footer">
                {editRow ? (
                  <>
                    <button type="button" className="btn btn--ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                    <button type="submit" className="btn btn--primary" disabled={saving || !canConfirmAllocation}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="alloc-create-footer__context">Step {allocationStep} of {ALLOCATION_STEPS.length}</span>
                    <div className="alloc-create-footer__actions">
                      {allocationStep === 1 ? (
                        <button type="button" className="btn btn--ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                      ) : (
                        <button type="button" className="btn btn--outline" onClick={goBackAllocation} disabled={saving}>Back</button>
                      )}
                      {allocationStep < 3 ? (
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={continueAllocation}
                          disabled={saving || (allocationStep === 1 ? !isStepOneComplete : !canConfirmAllocation)}
                          title={allocationStep === 1 && !isStepOneComplete
                            ? 'Select an eligible relief request to continue'
                            : (allocationStep === 2 && !canConfirmAllocation ? 'Enter valid quantities to continue' : '')}
                        >
                          Continue
                        </button>
                      ) : (
                        <button type="submit" className="btn btn--primary" disabled={saving || !canConfirmAllocation}>
                          {saving ? 'Allocating…' : 'Confirm Allocation'}
                        </button>
                      )}
                    </div>
                  </>
                )}
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

  const isInDistribution = Boolean(detailRow.distributionId || detailRow.status === 'In Distribution')

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

        {/* Main Content Vertical Stack */}
        <div className="alloc-detail-grid">
          {/* Section 1: Allocated Cargo & Stock */}
          <div className="alloc-section-card">
            <div className="alloc-section-header">
              <span className="alloc-section-title">
                <Package size={14} style={{ color: 'var(--admin-brand, #AF101A)' }} />
                <span>Allocated Supplies & Stock</span>
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
                <span>Allocated:</span>
                <strong>{detailRow.quantity}</strong>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6' }}>{detailRow.unit || 'units'}</span>
              </div>
              {detailRow.inventoryDeducted && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}>
                  <CheckCircle2 size={14} style={{ color: '#059669' }} />
                  <span>Deducted from Inventory ({detailRow.deductedQuantity || detailRow.quantity} {detailRow.unit || 'units'})</span>
                  {detailRow.inventoryItemCode && (
                    <code style={{ fontSize: '0.72rem', background: '#d1fae5', padding: '1px 5px', borderRadius: '4px' }}>
                      {detailRow.inventoryItemCode}
                    </code>
                  )}
                </div>
              )}
              {detailRow.status === 'Cancelled' && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}>
                  <Check size={14} />
                  <span>Stock Restored to Warehouse</span>
                </div>
              )}
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
                    Allocated directly from active warehouse inventory.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Target Community & Relief Request */}
          <div className="alloc-section-card">
            <div className="alloc-section-header">
              <span className="alloc-section-title">
                <MapPin size={14} style={{ color: 'var(--admin-brand, #AF101A)' }} />
                <span>Target Community & Relief Request</span>
              </span>
              {linkedReq && <StatusBadge status={linkedReq.status} />}
            </div>

            <div className="alloc-bstat-grid">
              <div className="alloc-bstat">
                <span className="alloc-bstat-label">
                  <MapPin size={12} /> Barangay
                </span>
                <span className="alloc-bstat-val">
                  {detailRow.beneficiary || 'Barangay'}
                </span>
              </div>
              <div className="alloc-bstat">
                <span className="alloc-bstat-label">
                  <Users size={12} /> Affected Families
                </span>
                <span className="alloc-bstat-val">
                  {(detailRow.affectedFamilies ?? 0).toLocaleString()} families
                </span>
              </div>
            </div>

            {linkedReq || detailRow.assistanceRequestId ? (
              <div className="alloc-req-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={13} style={{ color: 'var(--admin-brand, #AF101A)' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                      {detailRow.assistanceRequestCode || linkedReq?.id || `#${detailRow.assistanceRequestId}`}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {linkedReq?.priority || detailRow.priority || 'Medium'} Priority
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                  {linkedReq?.type || detailRow.assistanceRequestType || 'Relief Assistance'}
                </div>

                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.76rem', color: 'var(--admin-brand, #AF101A)', justifyContent: 'flex-start', alignSelf: 'flex-start' }}
                  onClick={() => {
                    onClose()
                    navigate('/admin/requests', { state: { openRequestId: detailRow.assistanceRequestCode || linkedReq?.id || detailRow.assistanceRequestId } })
                  }}
                >
                  Open in Relief Requests &rarr;
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.2rem 0' }}>
                Administrative allocation (no incoming relief request linked).
              </div>
            )}
          </div>

          {/* Section 3: Logistics & Distribution Status */}
          <div className={`alloc-dispatch-card ${isInDistribution ? 'alloc-dispatch-card--planned' : 'alloc-dispatch-card--ready'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: isInDistribution ? '#dbeafe' : '#dcfce7',
                color: isInDistribution ? '#1d4ed8' : '#15803d',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Truck size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 750, fontSize: '0.88rem' }}>
                  {isInDistribution ? 'In Distribution / Scheduled' : 'Ready for Logistics Dispatch'}
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                  {isInDistribution
                    ? 'This cargo is assigned to an active delivery schedule in Logistics & Distribution.'
                    : `Cargo is allocated for ${detailRow.beneficiary || 'community'}. Click 'Plan Distribution' to schedule delivery date and assign logistics.`}
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
            ) : isInDistribution ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  onClose()
                  navigate('/admin/distributions')
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Truck size={13} />
                <span>View in Distributions &rarr;</span>
              </button>
            ) : null}
          </div>

          {/* Section 4: Administrative Remarks (only if notes exist) */}
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

        {/* Modal Footer Actions */}
        <div className="alloc-detail-footer">
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={onClose}
          >
            Close
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!isInDistribution && detailRow.status !== 'Delivered' && (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={onDelete}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Trash2 size={13} />
                <span>Delete</span>
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 650 }}
              >
                <Truck size={14} />
                <span>Plan Distribution &rarr;</span>
              </button>
            )}
            {isInDistribution && (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  onClose()
                  navigate('/admin/distributions')
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Truck size={13} />
                <span>View in Distributions &rarr;</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
