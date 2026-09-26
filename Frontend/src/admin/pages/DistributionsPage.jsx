import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Eye, ArrowRightCircle, MapPin, Calendar, Package, Users,
  Truck, UserRound, FileCheck, ClipboardList, Route, Fuel, StickyNote,
  Sparkles, Check, Plus, X, UserCheck, ShieldCheck, RefreshCw, AlertCircle,
  FileText, Lock, Trash2, Maximize2, ExternalLink, Camera,
} from 'lucide-react'
import { distributionsApi, beneficiariesApi, volunteerMatchApi, volunteersApi, getStaff, allocationsApi } from '../../api/resources'
import { getTodayDateString, isPastDateString } from '../../utils/date'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import WorkflowStepper from '../components/shared/WorkflowStepper'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import SkillTagPicker from '../../components/shared/SkillTagPicker'
import WizardStepper from '../../components/shared/WizardStepper'
import RowActionsMenu from '../components/shared/RowActionsMenu'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../components/shared/SeeMoreList'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
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
  getNextDistributionAction,
} from '../../utils/workflow'
import { useLoading } from '../../context/LoadingContext'

const WORKFLOW = DISTRIBUTION_WORKFLOW
const PROOF_STATUS = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected']
const DELIVERY_WIZARD_STEPS = [
  { id: 'destination', label: 'Destination & Time' },
  { id: 'logistics', label: 'Cargo & Logistics' },
  { id: 'requirements', label: 'Status & Notes' },
]

const DEFAULT_PROGRAMS = [
  'Disaster Relief and House Building Project',
  'Community Feeding & Nutrition Program',
  'Educational Sponsorship & Youth Development',
  'Medical and Dental Missions',
  'Family Hygiene & Preventive Health',
  'Livelihood & Skills Training',
]

const PROGRAM_REQUIRED_SKILLS = {
  'Disaster Relief and House Building Project': ['Logistics / Driving', 'Packing / Repacking', 'Heavy Lifting', 'First Aid', 'Crowd Management'],
  'Disaster Relief': ['Logistics / Driving', 'Packing / Repacking', 'Heavy Lifting', 'First Aid', 'Crowd Management'],
  'Community Feeding & Nutrition Program': ['Meal Preparation', 'Food Distribution', 'Packing / Repacking', 'Kitchen Assistance', 'Logistics / Driving'],
  'Food Program': ['Meal Preparation', 'Food Distribution', 'Packing / Repacking', 'Kitchen Assistance', 'Logistics / Driving'],
  'Feeding Program': ['Meal Preparation', 'Food Distribution', 'Packing / Repacking', 'Kitchen Assistance'],
  'Medical and Dental Missions': ['First Aid', 'Medical Support', 'Nursing', 'Sanitation / Sterilization', 'Patient Registration'],
  'Medical Mission': ['First Aid', 'Medical Support', 'Nursing', 'Pharmacy Assistance', 'Patient Registration'],
  'Dental Mission': ['Dental Support', 'Patient Assistance', 'Sanitation / Sterilization', 'Patient Registration'],
  'Educational Sponsorship & Youth Development': ['Teaching / Tutoring', 'Child Care / Engagement', 'Student Registration', 'Mentorship'],
  'Educational Sponsorship': ['Teaching / Tutoring', 'Child Care / Engagement', 'Student Registration', 'Mentorship'],
  'Educational Support': ['Teaching / Tutoring', 'Child Care / Engagement', 'Student Registration', 'Mentorship'],
  'Family Hygiene & Preventive Health': ['Hygiene Kit Assembly', 'Health Education', 'Sanitation / Sterilization', 'Logistics / Driving'],
  'Livelihood & Skills Training': ['Vocational Training', 'Skills Development', 'Community Outreach'],
  'Livelihood Program': ['Vocational Training', 'Skills Development', 'Community Outreach'],
  'Child-Minding Program': ['Child Care / Engagement', 'Arts & Crafts', 'Storytelling', 'First Aid'],
  'Children\'s Library': ['Teaching / Tutoring', 'Storytelling', 'Reading / Literacy', 'Child Care / Engagement'],
  'Community Outreach': ['Community Outreach', 'Logistics / Driving', 'Translation / Local Dialects', 'Crowd Management'],
}

function getSkillsForProgram(prog) {
  if (!prog) return ['Logistics / Driving', 'Packing / Repacking', 'First Aid']
  if (PROGRAM_REQUIRED_SKILLS[prog]) return PROGRAM_REQUIRED_SKILLS[prog]
  const pLower = prog.toLowerCase()
  for (const [key, skills] of Object.entries(PROGRAM_REQUIRED_SKILLS)) {
    if (pLower.includes(key.toLowerCase()) || key.toLowerCase().includes(pLower)) {
      return skills
    }
  }
  return ['Logistics / Driving', 'Packing / Repacking', 'First Aid']
}

const filterConfig = {
  searchKeys: ['barangay', 'location', 'program', 'coordinator', 'eventName', 'itemsSummary'],
  filters: [
    { key: 'status', label: 'Status' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  eventName: '', location: '', beneficiaryId: '', program: '', distributionDate: '', scheduleTime: '',
  beneficiaries: '', volunteers: '', vehicles: '1', distanceKm: '', status: 'Preparing',
  type: 'Delivery', itemsSummary: '', coordinator: '', notes: '', proofStatus: 'Awaiting Proof',
  allocationIds: [],
}

function formFromAllocations(allocs, barangays) {
  if (!allocs?.length) return null
  const first = allocs[0]
  const ben = barangays.find((b) => Number(b.dbId) === Number(first.beneficiaryId))
  const location = ben?.barangay || ben?.name || first.beneficiary || first.beneficiaryName || ''
  const itemsSummary = allocs.map((a) => `${a.resource || a.resourceName || a.resource_name || 'Relief Goods'} × ${a.quantity || 1}`).join('; ')
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
    notes: `From allocation(s): ${allocs.map((a) => a.id || a.allocationId || a.code || 'ALC').join(', ')}`,
    allocationIds: allocs.map((a) => a.dbId || a.allocationId || a.id).filter(Boolean),
    status: 'Preparing',
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
  const { data: staffData } = useApiList(() => getStaff())
  const { data: allVolunteersData } = useApiList(() => volunteersApi.list())
  const { data: allocationsData } = useApiList(() => allocationsApi.list())

  const staffList = useMemo(() => {
    return Array.isArray(staffData) ? staffData : (staffData?.staff || staffData?.data || [])
  }, [staffData])

  const allVolunteers = useMemo(() => {
    return Array.isArray(allVolunteersData) ? allVolunteersData : (allVolunteersData?.data || [])
  }, [allVolunteersData])

  const allocationsList = useMemo(() => {
    return Array.isArray(allocationsData) ? allocationsData : (allocationsData?.data || [])
  }, [allocationsData])

  const filters = useFilters(data, filterConfig)
  const { showLoading, hideLoading } = useLoading()
  const [detailRow, setDetailRow] = useState(null)
  const [detailTab, setDetailTab] = useState('cargo') // 'cargo' | 'logistics' | 'proof' | 'notes'
  const [activePhoto, setActivePhoto] = useState(null)
  const [formTab, setFormTab] = useState('destination') // 'destination' | 'logistics' | 'requirements'
  const [editRow, setEditRow] = useState(null)
  const [statusRow, setStatusRow] = useState(null)
  const [statusValue, setStatusValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [manpowerSkills, setManpowerSkills] = useState(['Logistics / Driving', 'Packing / Repacking'])
  const [manpowerSuggestions, setManpowerSuggestions] = useState([])
  const [assignedVolunteers, setAssignedVolunteers] = useState([])
  const [showVolunteerHelp, setShowVolunteerHelp] = useState(true)
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

  const [stepErrors, setStepErrors] = useState({})

  const { options: catalogPrograms } = useCatalogOptions('volunteer_programs', DEFAULT_PROGRAMS)
  const availablePrograms = useMemo(() => {
    const set = new Set([...catalogPrograms, ...DEFAULT_PROGRAMS, ...Object.keys(PROGRAM_REQUIRED_SKILLS)])
    if (form.program) set.add(form.program)
    return Array.from(set).filter(Boolean).sort()
  }, [catalogPrograms, form.program])

  const selectedBarangay = useMemo(() => {
    return barangays.find((b) => String(b.dbId) === String(form.beneficiaryId)) || null
  }, [barangays, form.beneficiaryId])

  const matchingActiveAllocs = useMemo(() => {
    if (!form.beneficiaryId) return []
    return allocationsList.filter(
      (a) => Number(a.beneficiaryId) === Number(form.beneficiaryId) && a.status !== 'Delivered' && a.status !== 'Cancelled'
    )
  }, [allocationsList, form.beneficiaryId])

  // Resolve all cargo allocations actively linked to this delivery
  const resolvedCargoAllocations = useMemo(() => {
    const list = []
    const seenIds = new Set()

    if (editRow?.allocations?.length) {
      editRow.allocations.forEach((a) => {
        const key = a.dbId || a.id
        if (!seenIds.has(key)) {
          seenIds.add(key)
          list.push(a)
        }
      })
    }

    if (editRow?.dbId) {
      allocationsList.forEach((a) => {
        const matchId = Number(a.distributionId || a.distribution_id || 0)
        if (matchId === Number(editRow.dbId) && !seenIds.has(a.dbId || a.id)) {
          seenIds.add(a.dbId || a.id)
          list.push({
            dbId: a.dbId || a.id,
            id: a.code || a.id,
            resource: a.resource || a.resourceName || 'Relief Goods',
            quantity: a.quantity || 1,
            program: a.program || '',
            status: a.status || 'Allocated',
          })
        }
      })
    }

    if (form.allocationIds?.length) {
      form.allocationIds.forEach((allocId) => {
        if (!seenIds.has(allocId)) {
          const match = allocationsList.find((a) => Number(a.dbId || a.id) === Number(allocId))
          if (match) {
            seenIds.add(allocId)
            list.push({
              dbId: match.dbId || match.id,
              id: match.code || match.id,
              resource: match.resource || match.resourceName || 'Relief Goods',
              quantity: match.quantity || 1,
              program: match.program || '',
              status: match.status || 'Allocated',
            })
          }
        }
      })
    }

    return list
  }, [editRow, form.allocationIds, allocationsList])

  const isStep1Complete = useMemo(() => {
    return Boolean(
      form.beneficiaryId &&
      form.location?.trim() &&
      form.program?.trim() &&
      form.distributionDate &&
      (!isPastDateString(form.distributionDate) || (editRow && form.distributionDate === editRow.distributionDate))
    )
  }, [form.beneficiaryId, form.location, form.program, form.distributionDate, editRow])

  const isStep2Complete = useMemo(() => {
    const hasItems = Boolean(form.itemsSummary?.trim())
    const hasCoord = Boolean(form.coordinator?.trim())
    const hasVehicles = form.type !== 'Delivery' || (Boolean(form.vehicles) && Number(form.vehicles) >= 1)
    return hasItems && hasCoord && hasVehicles
  }, [form.itemsSummary, form.coordinator, form.type, form.vehicles])

  const completedDeliverySteps = useMemo(() => {
    const completed = []
    if (isStep1Complete) completed.push('destination')
    if (isStep1Complete && isStep2Complete) completed.push('logistics')
    return completed
  }, [isStep1Complete, isStep2Complete])

  const lockedDeliverySteps = useMemo(() => {
    const locked = []
    if (!isStep1Complete) locked.push('logistics')
    if (!isStep1Complete || !isStep2Complete) locked.push('requirements')
    return locked
  }, [isStep1Complete, isStep2Complete])

  const isDistributionProgram = useMemo(() => {
    const prog = (form.program || '').toLowerCase()
    const type = (form.type || '').toLowerCase()
    return prog.includes('distribution') || type.includes('distribution')
  }, [form.program, form.type])

  const validateStep = (stepName) => {
    const errs = {}
    if (stepName === 'destination') {
      if (!form.beneficiaryId) errs.beneficiaryId = 'Destination barangay is required'
      if (!form.location?.trim()) errs.location = 'Drop-off address is required'
      if (!form.program?.trim()) errs.program = 'Program / Project is required'
      if (!form.distributionDate) {
        errs.distributionDate = 'Distribution date is required'
      } else if (isPastDateString(form.distributionDate) && (!editRow || form.distributionDate !== editRow.distributionDate)) {
        errs.distributionDate = 'Distribution date cannot be in the past'
      }
    }
    if (stepName === 'logistics') {
      if (!form.itemsSummary?.trim()) {
        errs.itemsSummary = 'Items to deliver / cargo summary cannot be empty'
      }
      if (!form.coordinator?.trim()) {
        errs.coordinator = 'Coordinator in charge is required'
      }
      if (form.type === 'Delivery' && (!form.vehicles || Number(form.vehicles) < 1)) {
        errs.vehicles = 'At least 1 transport vehicle is required for delivery'
      }
    }
    return errs
  }

  const handleGoToStep = (targetStep) => {
    if (targetStep === formTab) return

    // Allow backward navigation at any time
    if (formTab === 'requirements' && (targetStep === 'logistics' || targetStep === 'destination')) {
      setFormTab(targetStep)
      setStepErrors({})
      return
    }
    if (formTab === 'logistics' && targetStep === 'destination') {
      setFormTab(targetStep)
      setStepErrors({})
      return
    }

    // Forward to Step 2: Validate Step 1
    if (targetStep === 'logistics' || targetStep === 'requirements') {
      const destErrors = validateStep('destination')
      if (Object.keys(destErrors).length > 0) {
        setStepErrors(destErrors)
        setFormTab('destination')
        notify.warning('Please complete all required fields in Destination & Time before proceeding.')
        return
      }
    }

    // Forward to Step 3: Validate Step 2
    if (targetStep === 'requirements') {
      const logErrors = validateStep('logistics')
      if (Object.keys(logErrors).length > 0) {
        setStepErrors(logErrors)
        setFormTab('logistics')
        notify.warning('Please complete all required fields in Cargo & Logistics before proceeding.')
        return
      }
    }

    setStepErrors({})
    setFormTab(targetStep)
  }

  useEffect(() => {
    if (form.program) {
      setManpowerSkills(getSkillsForProgram(form.program))
    }
  }, [form.program])

  useEffect(() => {
    if (!(showCreate || editRow)) return
    if (!manpowerSkills.length) {
      setManpowerSuggestions([])
      return
    }
    volunteerMatchApi.suggest({
      skills: manpowerSkills,
      programs: form.program ? [form.program] : [],
      limit: 8,
    })
      .then((res) => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
        setManpowerSuggestions(raw)
      })
      .catch(() => setManpowerSuggestions([]))
  }, [showCreate, editRow, manpowerSkills, form.program])

  const handleIncludeAllocation = (alloc) => {
    if (!alloc) return
    const allocId = alloc.dbId || alloc.id
    const currentIds = form.allocationIds || []
    if (currentIds.some((id) => String(id) === String(allocId))) {
      notify.info('This allocation batch is already included.')
      return
    }
    const nextIds = [...currentIds, allocId]

    const itemDesc = `${alloc.resource || alloc.resourceName || 'Relief Goods'} × ${alloc.quantity || 1}`
    let nextSummary = form.itemsSummary?.trim() || ''
    if (!nextSummary.includes(alloc.resource || alloc.resourceName)) {
      nextSummary = nextSummary ? `${nextSummary}; ${itemDesc}` : itemDesc
    }

    setForm((prev) => ({
      ...prev,
      allocationIds: nextIds,
      itemsSummary: nextSummary,
      program: prev.program || alloc.program || '',
    }))
    setStepErrors((prev) => ({ ...prev, itemsSummary: null }))
    notify.success(`Included ${alloc.resource || alloc.resourceName} in delivery!`)
  }

  const handleUnlinkAllocation = (allocId) => {
    const nextIds = (form.allocationIds || []).filter((id) => String(id) !== String(allocId))
    setForm((prev) => ({ ...prev, allocationIds: nextIds }))
    notify.info('Allocation batch unlinked from delivery.')
  }

  const handleSyncFromAllocations = (customBenId = null) => {
    const targetBenId = customBenId || form.beneficiaryId
    if (!targetBenId) {
      notify.warning('Please select a barangay first.')
      return
    }
    const matching = allocationsList.filter(
      (a) => Number(a.beneficiaryId) === Number(targetBenId) && a.status !== 'Delivered' && a.status !== 'Cancelled'
    )
    const source = matching.length ? matching : resolvedCargoAllocations
    if (!source.length) {
      notify.info('No active allocations found for this barangay.')
      return
    }
    const items = source
      .map((a) => `${a.resource || a.resourceName || a.item || 'Relief Goods'} × ${a.quantity || 1}`)
      .join('; ')
    const allocIds = source.map((a) => a.dbId || a.id).filter(Boolean)
    const prog = form.program || source.find((a) => a.program)?.program || ''

    setForm((prev) => ({
      ...prev,
      itemsSummary: items,
      allocationIds: Array.from(new Set([...(prev.allocationIds || []), ...allocIds])),
      program: prog || prev.program,
    }))
    setStepErrors((prev) => ({ ...prev, itemsSummary: null, program: null }))
    notify.success(`Synced cargo with ${source.length} active allocation batch(es)!`)
  }

  const handleAddVolunteer = (vol) => {
    if (!vol) return
    const volId = vol.dbId || vol.id
    if (assignedVolunteers.some((v) => String(v.id) === String(volId))) {
      notify.warning(`${vol.name || 'Volunteer'} is already assigned.`)
      return
    }
    const newVol = {
      id: volId,
      name: vol.name || `${vol.firstName || ''} ${vol.lastName || ''}`.trim() || 'Volunteer',
      type: vol.applicantType || vol.volunteerType || (vol.institution ? 'Intern' : 'Volunteer'),
      skills: vol.skills || [],
    }
    const updated = [...assignedVolunteers, newVol]
    setAssignedVolunteers(updated)
    setForm((prev) => ({
      ...prev,
      volunteers: String(updated.length),
    }))
    notify.success(`Added ${newVol.name} (${newVol.type}) to delivery team!`)
  }

  const handleRemoveVolunteer = (volId) => {
    const updated = assignedVolunteers.filter((v) => String(v.id) !== String(volId))
    setAssignedVolunteers(updated)
    setForm((prev) => ({
      ...prev,
      volunteers: updated.length ? String(updated.length) : '',
    }))
  }

  const openEdit = (row) => {
    setEditRow(row)
    setDetailRow(null)
    setStatusRow(null)
    setShowVolunteerHelp(true)
    setFormTab('destination')
    setStepErrors({})

    // Detect skills aligned to program
    const prog = row.program || ''
    const alignedSkills = getSkillsForProgram(prog)
    setManpowerSkills(alignedSkills)

    // Gather all linked allocations from row and global list
    const linkedAllocs = [...(row.allocations || [])]
    if (row.dbId && allocationsList.length > 0) {
      allocationsList.forEach((a) => {
        const matchId = Number(a.distributionId || a.distribution_id || 0)
        if (matchId === Number(row.dbId) && !linkedAllocs.some((la) => (la.dbId || la.id) === (a.dbId || a.id))) {
          linkedAllocs.push({
            dbId: a.dbId || a.id,
            id: a.code || a.id,
            resource: a.resource || a.resourceName || 'Relief Goods',
            quantity: a.quantity || 1,
            program: a.program || '',
            status: a.status || 'Allocated',
          })
        }
      })
    }

    const allocIds = Array.from(new Set([
      ...(row.allocationIds || []),
      ...linkedAllocs.map((a) => a.dbId || a.id).filter(Boolean),
    ]))

    // Parse items if empty or format from allocations
    let items = row.itemsSummary || row.items || ''
    if (!items && linkedAllocs.length > 0) {
      items = linkedAllocs.map((a) => `${a.resource || a.resourceName || 'Relief Goods'} × ${a.quantity || 1}`).join('; ')
    } else if (!items && row.beneficiaryId && allocationsList.length > 0) {
      const matchAllocs = allocationsList.filter((a) => Number(a.beneficiaryId) === Number(row.beneficiaryId) && a.status !== 'Cancelled')
      if (matchAllocs.length > 0) {
        items = matchAllocs.map((a) => `${a.resource || a.resourceName || a.item || 'Relief Goods'} × ${a.quantity || 1}`).join('; ')
      }
    }

    // Parse assigned volunteers from notes if available
    const parsedVolunteers = []
    if (row.notes && row.notes.includes('Assigned Team:')) {
      const match = row.notes.match(/Assigned Team:\s*([^\n]+)/)
      if (match && match[1]) {
        const parts = match[1].split(',').map((s) => s.trim()).filter(Boolean)
        parts.forEach((p, idx) => {
          const cleanName = p.replace(/\s*\((Volunteer|Intern)\)/i, '').trim()
          const isIntern = /intern/i.test(p)
          const matchVol = allVolunteers.find((v) => (v.name || `${v.firstName || ''} ${v.lastName || ''}`).trim().toLowerCase() === cleanName.toLowerCase())
          parsedVolunteers.push({
            id: matchVol?.dbId || matchVol?.id || `v-${idx}`,
            name: matchVol?.name || cleanName,
            type: matchVol?.applicantType || (isIntern ? 'Intern' : 'Volunteer'),
            skills: matchVol?.skills || [],
          })
        })
      }
    }
    setAssignedVolunteers(parsedVolunteers)

    setForm({
      eventName: row.eventName || '',
      location: row.location || '',
      beneficiaryId: row.beneficiaryId ? String(row.beneficiaryId) : '',
      program: row.program || '',
      distributionDate: row.distributionDate || (row.date && row.date !== '—' ? row.date : '') || '',
      scheduleTime: row.scheduleTime || '',
      beneficiaries: row.beneficiaries || '',
      volunteers: row.volunteers || (parsedVolunteers.length ? String(parsedVolunteers.length) : ''),
      vehicles: row.vehicles || (row.type === 'Delivery' ? '1' : ''),
      distanceKm: '',
      status: row.status === 'Planning' ? 'Preparing' : (row.status || 'Preparing'),
      type: row.type || 'Delivery',
      itemsSummary: items,
      coordinator: row.coordinator || '',
      notes: row.notes || '',
      proofStatus: 'Awaiting Proof',
      allocationIds: allocIds,
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
    setShowVolunteerHelp(true)
    setAssignedVolunteers([])
    setFormTab('destination')
    setStepErrors({})
  }

  const handleFormSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (formTab === 'destination') {
      handleGoToStep('logistics')
    } else if (formTab === 'logistics') {
      handleGoToStep('requirements')
    } else {
      handleSave(e)
    }
  }

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    const wasEditing = Boolean(editRow)

    // Validate Step 1
    const destErrors = validateStep('destination')
    if (Object.keys(destErrors).length > 0) {
      setStepErrors(destErrors)
      setFormTab('destination')
      notify.error('Please complete all required fields in Destination & Time.')
      return
    }

    // Validate Step 2
    const logErrors = validateStep('logistics')
    if (Object.keys(logErrors).length > 0) {
      setStepErrors(logErrors)
      setFormTab('logistics')
      notify.error('Please complete all required fields in Cargo & Logistics.')
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
      let updatedNotes = form.notes || ''
      if (assignedVolunteers.length > 0) {
        const teamNames = assignedVolunteers.map((v) => `${v.name} (${v.type})`).join(', ')
        if (updatedNotes.includes('Assigned Team:')) {
          updatedNotes = updatedNotes.replace(/Assigned Team:[^\n]*/, `Assigned Team: ${teamNames}`)
        } else {
          updatedNotes = updatedNotes ? `${updatedNotes}\n\nAssigned Team: ${teamNames}` : `Assigned Team: ${teamNames}`
        }
      }

      const payload = {
        eventName: form.eventName || (selectedBarangay ? `Delivery — ${selectedBarangay.barangay || selectedBarangay.name}` : 'Delivery'),
        location: form.location,
        beneficiaryId: Number(form.beneficiaryId),
        program: form.program || null,
        distributionDate: form.distributionDate,
        scheduleTime: form.scheduleTime || null,
        beneficiaries: Number(form.beneficiaries) || 0,
        volunteers: Number(form.volunteers) || assignedVolunteers.length || 0,
        vehicles: Number(form.vehicles) || 0,
        distanceKm: '',
        status: 'Preparing',
        type: form.type,
        itemsSummary: form.itemsSummary || (resolvedCargoAllocations.length > 0 ? resolvedCargoAllocations.map((a) => `${a.resource || a.resourceName || a.item || 'Relief Goods'} × ${a.quantity || 1}`).join('; ') : ''),
        coordinator: form.coordinator,
        notes: updatedNotes,
        proofStatus: 'Awaiting Proof',
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
      setShowVolunteerHelp(true)
      setAssignedVolunteers([])
      setStepErrors({})
      setFormTab('destination')
      reload()
      notifyBadgesChanged()
      await showSuccessModal({
        title: wasEditing ? 'Delivery Updated' : 'Delivery Scheduled',
        message: wasEditing
          ? `${payload.eventName} was updated successfully.`
          : `${payload.eventName} was scheduled successfully and is ready for logistics preparation.`,
        confirmText: 'Done',
      })
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

  const handleAdvanceStatus = async (row, nextStatus, promptMessage = null) => {
    if (!row || !nextStatus) return
    const check = validateStatusTransition({
      entityName: 'Distribution',
      currentStatus: row.status,
      nextStatus,
      workflowOrder: DISTRIBUTION_WORKFLOW,
      terminalStatuses: DISTRIBUTION_TERMINAL,
      aliases: DISTRIBUTION_ALIASES,
    })
    if (!check.valid) {
      notify.error(check.message)
      return
    }

    const ok = await confirmAction({
      title: `Advance Status: ${nextStatus}`,
      message: promptMessage || `Are you sure you want to transition this delivery to "${nextStatus}"?`,
      confirmText: `Advance to ${nextStatus}`,
      type: 'primary',
    })
    if (!ok) return

    showLoading('Updating delivery status…')
    try {
      const res = await distributionsApi.update(row.dbId || row.id, { status: nextStatus })
      const updated = res?.data || { ...row, status: nextStatus }
      setDetailRow(updated)
      reload()
      notifyBadgesChanged()
      notify.success(`Delivery advanced to ${nextStatus}.`)
    } catch (err) {
      notify.error(err.message || 'Failed to update delivery status.')
    } finally {
      hideLoading()
    }
  }

  const handleApproveProofAndComplete = async (row) => {
    if (!row) return
    const ok = await confirmAction({
      title: 'Approve Proof & Complete Delivery',
      message: 'Approve the turnover proof photos and confirm completion for this distribution? This will verify the proof, mark the delivery Completed, and close the linked relief request.',
      confirmText: 'Approve Proof & Complete',
      type: 'primary',
    })
    if (!ok) return

    showLoading('Finalizing delivery completion…')
    try {
      const res = await distributionsApi.update(row.dbId || row.id, {
        action: 'approve_proof_and_complete',
        status: 'Completed',
        proofStatus: 'Proof Verified',
        forceComplete: true,
      })
      const updated = res?.data || { ...row, status: 'Completed', proofStatus: 'Proof Verified' }
      setDetailRow(updated)
      reload()
      notifyBadgesChanged()
      notify.success('Delivery marked Completed and proof verified!')
      showSuccessModal('Delivery completed! Turnover proof photos verified and linked relief request closed.')
    } catch (err) {
      notify.error(err.message || 'Failed to approve proof and complete delivery.')
    } finally {
      hideLoading()
    }
  }

  const fromAllocation = !!form.allocationIds?.length

  const columns = [
    {
      key: 'request',
      label: 'Request ID',
      exportValue: (row) => row.request?.id || (row.requestId ? (typeof row.requestId === 'object' ? (row.requestId.id || `#${row.requestId.dbId}`) : `#${row.requestId}`) : '—'),
      render: (row) => (
        <span className="alloc-request-id" title={row.request?.type || ''}>
          {row.request?.id || (row.requestId ? `#${row.requestId}` : '—')}
        </span>
      ),
    },
    {
      key: 'eventName',
      label: 'Delivery',
      exportValue: (row) => row.eventName || row.location || '—',
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
        <ApiState loading={loading} error={error} message="Loading distribution data…" onRetry={reload}>
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
      {/* =========================================================
          1. Delivery Details Modal (Clean, Spacious & Intuitive)
          ========================================================= */}
      {detailRow && (() => {
        const nextAction = getNextDistributionAction(detailRow)
        const proofs = detailRow.proofs || []
        const hasProofs = proofs.length > 0 || (detailRow.proofsCount > 0)
        const isProofSubmitted = detailRow.proofStatus === 'Proof Submitted' || (hasProofs && detailRow.proofStatus !== 'Proof Rejected')
        const isProofVerified = detailRow.proofStatus === 'Proof Verified' || detailRow.status === 'Completed'
        const normCurrent = DISTRIBUTION_ALIASES[detailRow.status] || detailRow.status || 'Planning'
        const currIdx = WORKFLOW.indexOf(normCurrent)

        return (
          <div className="admin-modal-overlay" onClick={() => setDetailRow(null)}>
            <div className="admin-modal dist-detail-modal" onClick={(e) => e.stopPropagation()}>
              <ModalHeader
                title={detailRow.eventName || (detailRow.barangay ? `Delivery — ${detailRow.barangay}` : (detailRow.location || 'Delivery Details'))}
                subtitle={`Logistics Event · ${detailRow.id || detailRow.code || 'DST'} · ${[detailRow.barangay, detailRow.barangayMunicipality].filter(Boolean).join(', ') || detailRow.location || 'Barangay'}`}
                onClose={() => setDetailRow(null)}
              />

              {/* Fixed Top Essentials Overview */}
              <div className="dist-modal-overview">
                <div className="dist-overview-meta-row">
                  <div className="dist-overview-left">
                    <span className="dist-overview-chip" title="Destination Barangay">
                      <MapPin size={14} />
                      {[detailRow.barangay, detailRow.barangayMunicipality || detailRow.location]
                        .filter(Boolean)
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .join(' · ') || '—'}
                    </span>
                    <span className="dist-overview-chip" title="Delivery Schedule">
                      <Calendar size={14} />
                      {detailRow.date || 'Unscheduled'}
                      {detailRow.scheduleTime ? ` · ${detailRow.scheduleTime}` : ''}
                    </span>
                    {(detailRow.request?.id || detailRow.requestId) && (
                      <span className="dist-overview-chip" title="Linked Relief Request">
                        <Package size={14} />
                        Request: <strong style={{ color: '#AF101A' }}>{detailRow.request?.id || `#${detailRow.requestId}`}</strong>
                        {detailRow.requestPriority && (
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: detailRow.requestPriority === 'Critical' ? '#fee2e2' : '#fefce8',
                            color: detailRow.requestPriority === 'Critical' ? '#dc2626' : '#d97706',
                          }}>
                            {detailRow.requestPriority}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="dist-overview-right">
                    <span className="dist-detail__code-badge">{detailRow.id || detailRow.code || 'DST'}</span>
                    <StatusBadge status={detailRow.status} />
                    {detailRow.proofStatus && detailRow.proofStatus !== 'Not Required' && (
                      <StatusBadge status={detailRow.proofStatus} />
                    )}
                    {detailRow.receiptStatus && detailRow.receiptStatus !== 'Awaiting Confirmation' && (
                      <StatusBadge status={detailRow.receiptStatus} />
                    )}
                  </div>
                </div>

                {/* Workflow Stepper: Planning → Preparing → In Transit → Delivered → Proof Review → Completed */}
                <div className="dist-mini-stepper" aria-label="Workflow progress">
                  {WORKFLOW.map((step, idx) => {
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

                {/* Stage guidance & status clarity */}
                {nextAction && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.45rem 0.8rem',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {nextAction.verifiedText && (
                        <span style={{ color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                          <Check size={13} style={{ color: '#16a34a' }} /> {nextAction.verifiedText}
                        </span>
                      )}
                      {nextAction.pendingText && (
                        <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          · <Clock size={12} style={{ color: '#d97706' }} /> {nextAction.pendingText}
                        </span>
                      )}
                    </div>
                    {nextAction.canAdvance && (
                      <span style={{ color: '#AF101A', fontWeight: 700 }}>
                        Next Step: {nextAction.label}
                      </span>
                    )}
                  </div>
                )}
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
                  {(hasProofs || detailRow.receivedQuantity != null) && (
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

              {/* Tab Content Body */}
              <div className="dist-tab-content-body">
                {detailTab === 'cargo' && (
                  <>
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Allocated Cargo / Relief Items</span>
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
                              {detailRow.request?.notes && (
                                <small style={{ display: 'block', width: '100%', color: '#64748b', marginTop: '0.2rem' }}>
                                  "{detailRow.request.notes}"
                                </small>
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

                    <div className="dist-info-grid-2">
                      <div className="dist-info-tile">
                        <span className="dist-info-tile__label">Drop-off Location / Address</span>
                        <div className="dist-info-tile__value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={13} style={{ color: '#AF101A' }} />
                          {detailRow.location || '—'}
                        </div>
                      </div>

                      <div className="dist-info-tile">
                        <span className="dist-info-tile__label">Assigned Program</span>
                        <div className="dist-info-tile__value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <ClipboardList size={13} style={{ color: '#AF101A' }} />
                          {detailRow.program || 'Standard Relief Delivery'}
                        </div>
                      </div>
                    </div>

                    {(detailRow.allocations || []).length > 0 && (
                      <div className="dist-info-tile">
                        <span className="dist-info-tile__label">Source Allocation Batches</span>
                        <div className="dist-tag-list">
                          {detailRow.allocations.map((a) => (
                            <span key={a.dbId || a.id || `${a.resource}-${a.quantity}`} className="dist-tag-chip">
                              <Package size={11} style={{ color: '#AF101A' }} /> {a.id ? `${a.id}: ` : ''}{a.resource} × {a.quantity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                        <span className="dist-info-tile__label">Transport &amp; Fuel</span>
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

                    {/* Assigned Personnel / Tasks */}
                    <div className="dist-info-tile">
                      <span className="dist-info-tile__label">Assigned Logistics Team</span>
                      {(detailRow.assignedTeam || []).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                          {detailRow.assignedTeam.map((t) => (
                            <div key={t.id || t.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.65rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: '#1e293b' }}>
                                <UserCheck size={13} style={{ color: '#16a34a' }} />
                                {t.assignee || 'Volunteer'}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                {t.title || t.code}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {detailRow.volunteers > 0 ? `${detailRow.volunteers} volunteer(s) allocated for this dispatch.` : 'No volunteer tasks assigned yet.'}
                        </div>
                      )}
                    </div>
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
                            {proofs.length > 0 ? `${proofs.length} photo(s) uploaded for review` : `${detailRow.proofsCount ?? 0} photos reported`}
                          </small>
                        </div>
                      </div>

                      <div className="dist-info-tile">
                        <span className="dist-info-tile__label">Barangay Receipt Confirmation</span>
                        <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <StatusBadge status={detailRow.receiptStatus} />
                          <small style={{ color: '#64748b' }}>
                            {detailRow.receivedQuantity != null
                              ? `${detailRow.receivedQuantity} items/packs confirmed${detailRow.receivedAt ? ` on ${detailRow.receivedAt}` : ''}`
                              : 'Awaiting barangay acknowledgment'}
                          </small>
                        </div>
                      </div>
                    </div>

                    {detailRow.receiptNotes && (
                      <div className="dist-info-tile">
                        <span className="dist-info-tile__label">Barangay Remarks / Feedback</span>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.45 }}>
                          "{detailRow.receiptNotes}"
                        </p>
                      </div>
                    )}

                    {/* Photo Proof Gallery */}
                    <div className="dist-proof-gallery-header">
                      <div className="dist-proof-gallery-title">
                        <Camera size={15} style={{ color: '#AF101A' }} /> Uploaded Proof Photos
                        <span className="dist-proof-gallery-count">{proofs.length} photos</span>
                      </div>
                    </div>

                    {proofs.length > 0 ? (
                      <div className="dist-proof-grid">
                        {proofs.map((proof, pIdx) => (
                          <div
                            key={proof.id || pIdx}
                            className="dist-proof-card"
                            onClick={() => setActivePhoto(proof)}
                            title="Click to view enlarged"
                          >
                            <div className="dist-proof-thumb-wrap">
                              {proof.categoryLabel && (
                                <span className="dist-proof-category-tag">
                                  {proof.categoryLabel}
                                </span>
                              )}
                              <img
                                src={proof.fileUrl}
                                alt={proof.fileName || 'Proof photo'}
                                className="dist-proof-thumb-img"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                  if (e.currentTarget.nextSibling) {
                                    e.currentTarget.nextSibling.style.display = 'flex'
                                  }
                                }}
                              />
                              <div style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#94a3b8' }}>
                                <FileText size={32} />
                              </div>
                              <div className="dist-proof-overlay">
                                <span className="dist-proof-overlay-btn">
                                  <Maximize2 size={13} /> Click to Enlarge
                                </span>
                              </div>
                            </div>
                            <div className="dist-proof-card-info">
                              <span className="dist-proof-card-name" title={proof.fileName}>
                                {proof.fileName || 'Proof Image'}
                              </span>
                              <div className="dist-proof-card-sub">
                                <Calendar size={11} />
                                <span>{proof.submittedAt || 'Uploaded'}</span>
                                {proof.status && (
                                  <span style={{
                                    marginLeft: 'auto',
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                    color: proof.status === 'Approved' ? '#166534' : '#d97706',
                                  }}>
                                    {proof.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="dist-proof-empty-box">
                        <div className="dist-proof-empty-icon">
                          <Camera size={22} />
                        </div>
                        <h4 className="dist-proof-empty-title">No turnover proof photos uploaded yet</h4>
                        <p className="dist-proof-empty-desc">
                          Once items arrive at the barangay destination, the barangay representative will upload handover photos and submit their receipt acknowledgment through the Barangay Portal.
                        </p>
                      </div>
                    )}

                    {/* Admin Verification & Completion Banner */}
                    {isProofSubmitted && detailRow.status !== 'Completed' && (
                      <div className="dist-proof-verify-banner">
                        <div className="dist-proof-verify-content">
                          <ShieldCheck size={28} className="dist-proof-verify-icon" />
                          <div>
                            <h4 className="dist-proof-verify-title">Proof Review Ready</h4>
                            <p className="dist-proof-verify-desc">
                              Turnover photos and receipt confirmation have been submitted. Inspect the proof photos above before approving.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn--success btn--sm"
                          onClick={() => handleApproveProofAndComplete(detailRow)}
                          style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: 700 }}
                        >
                          <ShieldCheck size={14} /> Approve Proof &amp; Complete Delivery
                        </button>
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
              <div className="dist-modal-footer admin-modal__actions--split">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDetailRow(null)}>
                  Close
                </button>
                <div className="admin-modal__actions-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {['Planning', 'Preparing'].includes(detailRow.status) && (
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(detailRow)}>
                      <Trash2 size={13} /> Delete Delivery
                    </button>
                  )}

                  {/* Contextual Single Next Step Action Button */}
                  {nextAction?.canAdvance ? (
                    nextAction.isApproveAction ? (
                      <button
                        type="button"
                        className="btn btn--success btn--sm"
                        onClick={() => handleApproveProofAndComplete(detailRow)}
                        style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: 700 }}
                      >
                        <ShieldCheck size={14} /> {nextAction.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => handleAdvanceStatus(detailRow, nextAction.nextStatus, nextAction.prompt)}
                        style={{ fontWeight: 700 }}
                      >
                        {nextAction.nextStatus === 'Preparing' ? (
                          <Truck size={14} />
                        ) : nextAction.nextStatus === 'In Transit' ? (
                          <Route size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                        {' '}{nextAction.label} &rarr;
                      </button>
                    )
                  ) : detailRow.status === 'Completed' ? (
                    <span className="dist-status-completed-pill">
                      <Check size={14} /> Delivery Completed &amp; Verified
                    </span>
                  ) : ['Delivered', 'Proof Review', 'Awaiting Proof'].includes(detailRow.status) ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled
                      style={{ opacity: 0.7, cursor: 'not-allowed', color: '#64748b' }}
                      title="Waiting for barangay proof submission"
                    >
                      <AlertCircle size={14} style={{ color: '#d97706' }} /> Awaiting Barangay Proof
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Lightbox Modal for Full-Size Proof Viewing */}
      {activePhoto && (
        <div className="dist-lightbox-overlay" onClick={() => setActivePhoto(null)}>
          <div className="dist-lightbox-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dist-lightbox-header">
              <div className="dist-lightbox-meta">
                <span className="dist-proof-category-tag" style={{ position: 'static' }}>
                  {activePhoto.categoryLabel || activePhoto.category || 'Turnover Proof'}
                </span>
                <span className="dist-lightbox-title" title={activePhoto.fileName}>
                  {activePhoto.fileName || 'Turnover Proof Photo'}
                </span>
              </div>
              <div className="dist-lightbox-actions">
                {activePhoto.fileUrl && (
                  <a
                    href={activePhoto.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--ghost btn--sm"
                    style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <ExternalLink size={13} /> Open Original
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ color: '#fff' }}
                  onClick={() => setActivePhoto(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="dist-lightbox-body">
              {activePhoto.isImage !== false ? (
                <img
                  src={activePhoto.fileUrl}
                  alt={activePhoto.fileName || 'Turnover Proof'}
                  className="dist-lightbox-img"
                />
              ) : (
                <div style={{ color: '#cbd5e1', textAlign: 'center', padding: '2rem' }}>
                  <FileText size={48} style={{ color: '#94a3b8', marginBottom: '0.75rem' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>{activePhoto.fileName}</p>
                  <small style={{ color: '#64748b' }}>{activePhoto.fileType || 'Document file'}</small>
                </div>
              )}
            </div>

            <div className="dist-lightbox-footer">
              <span>
                Uploaded: {activePhoto.submittedAt || 'Recently'}
                {activePhoto.status && ` · Status: ${activePhoto.status}`}
              </span>
              {activePhoto.notes && (
                <span style={{ maxWidth: '60%', textAlign: 'right', fontStyle: 'italic' }}>
                  "{activePhoto.notes}"
                </span>
              )}
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

            <form onSubmit={handleFormSubmit} noValidate>
              {form.allocationIds?.length > 0 && (
                <div className="alloc-handoff-banner" style={{ margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
                  📦 {form.allocationIds.length} Resource Allocation batch(es) linked to this distribution.
                </div>
              )}

              <WizardStepper
                steps={DELIVERY_WIZARD_STEPS}
                currentStep={formTab}
                completedSteps={completedDeliverySteps}
                lockedSteps={lockedDeliverySteps}
                onStepChange={handleGoToStep}
                ariaLabel="Delivery planning progress"
                className="dist-delivery-wizard-stepper"
              />

              {/* Validation Alert for Current Step */}
              {stepErrors[formTab] && Object.keys(stepErrors[formTab]).length > 0 && (
                <div className="dist-step-validation-alert">
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Please complete all required fields before proceeding:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {Object.values(stepErrors[formTab]).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="dist-tab-content-body">
                {/* =========================================================
                    STEP 1: DESTINATION & TIME
                    ========================================================= */}
                {formTab === 'destination' && (
                  <>
                    <div className="dist-form-grid-2">
                      <label>
                        Delivery Event / Operation Name
                        <input
                          value={form.eventName}
                          onChange={(e) => {
                            setForm({ ...form, eventName: e.target.value })
                            if (stepErrors.destination?.eventName) {
                              setStepErrors((prev) => ({ ...prev, destination: { ...prev.destination, eventName: null } }))
                            }
                          }}
                          placeholder="e.g. Food pack delivery — Brgy. Talisay"
                        />
                      </label>
                      <label>
                        Destination Barangay <span style={{ color: '#AF101A' }}>*</span>
                        <select
                          required
                          disabled={form.allocationIds?.length > 0}
                          className={stepErrors.destination?.beneficiaryId ? 'input-error' : ''}
                          value={form.beneficiaryId}
                          onChange={(e) => {
                            const id = e.target.value
                            const brgy = barangays.find((b) => String(b.dbId) === id)
                            const matching = id ? allocationsList.filter((a) => Number(a.beneficiaryId) === Number(id) && a.status !== 'Delivered' && a.status !== 'Cancelled') : []
                            const allocIds = matching.map((a) => a.dbId || a.id).filter(Boolean)
                            const items = matching.map((a) => `${a.resource || a.resourceName || a.item || 'Relief Goods'} × ${a.quantity || 1}`).join('; ')
                            const prog = matching.find((a) => a.program)?.program || form.program || ''

                            setForm((prev) => ({
                              ...prev,
                              beneficiaryId: id,
                              location: prev.location || brgy?.barangay || brgy?.name || '',
                              eventName: prev.eventName || (brgy ? `Delivery — ${brgy.barangay || brgy.name}` : ''),
                              beneficiaries: prev.beneficiaries || String(brgy?.affectedFamilies || ''),
                              allocationIds: allocIds.length ? allocIds : prev.allocationIds,
                              itemsSummary: items || prev.itemsSummary,
                              program: prog || prev.program,
                            }))
                            if (stepErrors.destination?.beneficiaryId) {
                              setStepErrors((prev) => ({ ...prev, destination: { ...prev.destination, beneficiaryId: null } }))
                            }
                          }}
                        >
                          <option value="">Select barangay…</option>
                          {barangays.map((b) => (
                            <option key={b.dbId} value={b.dbId}>
                              {b.barangay || b.name}
                            </option>
                          ))}
                        </select>
                        {stepErrors.destination?.beneficiaryId && (
                          <span className="dist-field-error">{stepErrors.destination.beneficiaryId}</span>
                        )}
                      </label>
                    </div>

                    <div className="dist-form-grid-2">
                      <label>
                        Drop-off Address / Specific Venue <span style={{ color: '#AF101A' }}>*</span>
                        <input
                          required
                          className={stepErrors.destination?.location ? 'input-error' : ''}
                          value={form.location}
                          onChange={(e) => {
                            setForm({ ...form, location: e.target.value })
                            if (stepErrors.destination?.location) {
                              setStepErrors((prev) => ({ ...prev, destination: { ...prev.destination, location: null } }))
                            }
                          }}
                          placeholder="e.g. Barangay Hall / Evacuation Center / Covered Court"
                        />
                        {stepErrors.destination?.location && (
                          <span className="dist-field-error">{stepErrors.destination.location}</span>
                        )}
                      </label>

                      <label>
                        Affiliated Program / Project <span style={{ color: '#AF101A' }}>*</span>
                        <select
                          required
                          className={stepErrors.destination?.program ? 'input-error' : ''}
                          value={form.program}
                          onChange={(e) => {
                            setForm({ ...form, program: e.target.value })
                            if (stepErrors.destination?.program) {
                              setStepErrors((prev) => ({ ...prev, destination: { ...prev.destination, program: null } }))
                            }
                          }}
                        >
                          <option value="">Select affiliated program…</option>
                          {availablePrograms.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {stepErrors.destination?.program && (
                          <span className="dist-field-error">{stepErrors.destination.program}</span>
                        )}
                      </label>
                    </div>

                    <div className="dist-form-grid-2">
                      <label>
                        Distribution Date <span style={{ color: '#AF101A' }}>*</span>
                        <input
                          type="date"
                          required
                          min={editRow ? undefined : getTodayDateString()}
                          className={stepErrors.destination?.distributionDate ? 'input-error' : ''}
                          value={form.distributionDate}
                          onChange={(e) => {
                            setForm({ ...form, distributionDate: e.target.value })
                            if (stepErrors.destination?.distributionDate) {
                              setStepErrors((prev) => ({ ...prev, destination: { ...prev.destination, distributionDate: null } }))
                            }
                          }}
                        />
                        {stepErrors.destination?.distributionDate && (
                          <span className="dist-field-error">{stepErrors.destination.distributionDate}</span>
                        )}
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
                          placeholder={selectedBarangay?.affectedFamilies ? `e.g. ${selectedBarangay.affectedFamilies}` : 'e.g. 50'}
                        />
                      </label>
                    </div>
                  </>
                )}

                {/* =========================================================
                    STEP 2: CARGO & LOGISTICS
                    ========================================================= */}
                {formTab === 'logistics' && (
                  <div className="dist-logistics-layout">

                    {/* ── Context Summary Cards Strip (UI Clean Cards) ── */}
                    <div className="dist-cl-summary-strip">
                      {/* Destination Card */}
                      <div className="dist-cl-sum-card" title={`Destination: ${selectedBarangay?.barangay || selectedBarangay?.name || form.location || 'Not set'}`}>
                        <div className="dist-cl-sum-card__icon dist-cl-sum-card__icon--pin">
                          <MapPin size={14} />
                        </div>
                        <div className="dist-cl-sum-card__content">
                          <span className="dist-cl-sum-card__label">Target Barangay</span>
                          <span className="dist-cl-sum-card__value">
                            {selectedBarangay?.barangay || selectedBarangay?.name || form.location || 'No destination'}
                          </span>
                        </div>
                      </div>

                      {/* Program Card */}
                      <div className="dist-cl-sum-card" title={`Affiliated Program: ${form.program || 'None'}`}>
                        <div className="dist-cl-sum-card__icon dist-cl-sum-card__icon--program">
                          <Sparkles size={14} />
                        </div>
                        <div className="dist-cl-sum-card__content">
                          <span className="dist-cl-sum-card__label">Program</span>
                          <span className="dist-cl-sum-card__value">
                            {form.program || 'General Relief'}
                          </span>
                        </div>
                      </div>

                      {/* Cargo Source / Allocations Card */}
                      <div className="dist-cl-sum-card" title={`Allocations: ${form.allocationIds?.length > 0 ? `${form.allocationIds.length} batch(es) linked` : 'Direct delivery'}`}>
                        <div className={`dist-cl-sum-card__icon ${form.allocationIds?.length > 0 ? 'dist-cl-sum-card__icon--alloc' : 'dist-cl-sum-card__icon--muted'}`}>
                          <Package size={14} />
                        </div>
                        <div className="dist-cl-sum-card__content">
                          <span className="dist-cl-sum-card__label">Allocations</span>
                          <span className="dist-cl-sum-card__value">
                            {form.allocationIds?.length > 0 ? `${form.allocationIds.length} batch(es) linked` : 'Direct delivery'}
                          </span>
                        </div>
                      </div>

                      {/* Mode Card */}
                      <div className="dist-cl-sum-card" title={`Dispatch Mode: ${form.type}`}>
                        <div className="dist-cl-sum-card__icon dist-cl-sum-card__icon--type">
                          <Truck size={14} />
                        </div>
                        <div className="dist-cl-sum-card__content">
                          <span className="dist-cl-sum-card__label">Dispatch Mode</span>
                          <span className="dist-cl-sum-card__value">{form.type || 'Delivery'}</span>
                        </div>
                      </div>

                    </div>

                    {/* ── Cargo to Deliver (Allocated Resources Only — Read-Only) ── */}
                    <div className="dist-cl-card">
                      <div className="dist-cl-card__head">
                        <div className="dist-cl-card__title">
                          <Package size={14} style={{ color: '#AF101A' }} />
                          <span>Cargo to Deliver</span>
                          {resolvedCargoAllocations.length > 0 && (
                            <span className="dist-cl-count-badge">
                              {resolvedCargoAllocations.length} allocated batch(es)
                            </span>
                          )}
                        </div>
                        <span className="dist-badge dist-badge--code" style={{ color: '#64748b' }}>
                          <Lock size={10} style={{ marginRight: '3px' }} />
                          Allocated &amp; Read-Only
                        </span>
                      </div>

                      {/* Display allocated batches as clean read-only chips */}
                      {resolvedCargoAllocations.length > 0 ? (
                        <div className="dist-cargo-batches-list">
                          {resolvedCargoAllocations.map((a) => {
                            const allocKey = a.dbId || a.id
                            const batchCode = `ALC-${String(allocKey).padStart(4, '0')}`
                            const itemName = a.resource || a.resourceName || a.item || 'Relief Goods'
                            const qty = a.quantity || 1
                            return (
                              <div key={allocKey} className="dist-cargo-batch-chip dist-cargo-batch-chip--readonly">
                                <div className="dist-cargo-batch-chip__main">
                                  <Package size={14} className="dist-cargo-batch-chip__icon" />
                                  <div>
                                    <div className="dist-cargo-batch-chip__title">{itemName}</div>
                                    <div className="dist-cargo-batch-chip__meta">
                                      <span className="dist-badge dist-badge--code">{batchCode}</span>
                                      {a.program && <span>• {a.program}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="dist-cargo-batch-chip__qty">
                                  <span className="dist-badge dist-badge--qty">Qty: {qty}</span>
                                  <span className="dist-badge dist-badge--status">{a.status || 'Allocated'}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}

                      {/* Read-Only Cargo Summary Manifest */}
                      <div className="dist-cargo-readonly-box">
                        <span className="dist-cargo-readonly-label">Allocated Cargo Manifest:</span>
                        <div className="dist-cargo-readonly-text">
                          {form.itemsSummary || (resolvedCargoAllocations.length > 0
                            ? resolvedCargoAllocations.map((a) => `${a.resource || a.resourceName || a.item || 'Relief Goods'} × ${a.quantity || 1}`).join('; ')
                            : 'No allocated cargo specified for this request.')}
                        </div>
                      </div>
                      <small className="dist-cl-hint">Cargo items are locked and reflect the resources already allocated to this relief request.</small>
                    </div>

                    {/* ── Dispatch Leadership & Fleet (Perfect Alignment) ── */}
                    <div className="dist-cl-card">
                      <div className="dist-cl-card__head">
                        <div className="dist-cl-card__title">
                          <Truck size={14} style={{ color: '#AF101A' }} />
                          <span>Dispatch Leadership &amp; Fleet</span>
                        </div>
                        <span className="dist-cl-mode-pill">
                          Mode: <strong>{form.type || 'Delivery'}</strong>
                        </span>
                      </div>

                      {/* Symmetrical 2-Column Grid */}
                      <div className="dist-cl-dispatch-grid">
                        {/* Column 1: Coordinator */}
                        <div className="dist-cl-dispatch-col">
                          <div className="dist-cl-col-header">
                            <span className="dist-cl-col-title">Lead Coordinator</span>
                            <span className="dist-cl-col-badge">Operations Lead</span>
                          </div>

                          <label className="dist-cl-field-label">
                            Coordinator in Charge <span className="dist-cl-req-star">*</span>
                          </label>

                          <div className="dist-cl-coord-combo">
                            <input
                              required
                              className={`dist-cl-aligned-input ${stepErrors.logistics?.coordinator ? 'input-error' : ''}`}
                              value={form.coordinator}
                              onChange={(e) => {
                                setForm({ ...form, coordinator: e.target.value })
                                if (stepErrors.logistics?.coordinator) {
                                  setStepErrors((prev) => ({ ...prev, logistics: { ...prev.logistics, coordinator: null } }))
                                }
                              }}
                              placeholder="Staff / Coordinator in charge"
                            />
                            {staffList.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    setForm((prev) => ({ ...prev, coordinator: e.target.value }))
                                    if (stepErrors.logistics?.coordinator) {
                                      setStepErrors((prev) => ({ ...prev, logistics: { ...prev.logistics, coordinator: null } }))
                                    }
                                  }
                                }}
                                className="dist-cl-quick-pick"
                                title="Quick pick coordinator from staff list"
                              >
                                <option value="">⚡ Quick Pick…</option>
                                {staffList.map((s) => (
                                  <option key={s.id || s.name} value={s.name}>
                                    {s.name} ({s.role || 'Staff'})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          {stepErrors.logistics?.coordinator && (
                            <span className="dist-field-error">{stepErrors.logistics.coordinator}</span>
                          )}

                          {staffList.length > 0 && (
                            <div className="dist-cl-sugg-row">
                              <span className="dist-cl-sugg-label">💡 Suggestions:</span>
                              <div className="dist-cl-sugg-chips">
                                {staffList.slice(0, 3).map((s) => (
                                  <button
                                    key={s.id || s.name}
                                    type="button"
                                    className={`dist-cl-staff-chip ${form.coordinator === s.name ? 'dist-cl-staff-chip--active' : ''}`}
                                    onClick={() => {
                                      setForm((prev) => ({ ...prev, coordinator: s.name }))
                                      if (stepErrors.logistics?.coordinator) {
                                        setStepErrors((prev) => ({ ...prev, logistics: { ...prev.logistics, coordinator: null } }))
                                      }
                                    }}
                                  >
                                    {s.name} ({s.role || 'Staff'})
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column 2: Fleet Requirements & Target Quota */}
                        <div className="dist-cl-dispatch-col">
                          <div className="dist-cl-col-header">
                            <span className="dist-cl-col-title">Fleet Requirements &amp; Target Quota</span>
                            <span className="dist-cl-col-badge">Transport Capacity</span>
                          </div>

                          <div className="dist-cl-fleet-triple">
                            <div className="dist-cl-fleet-cell">
                              <label className="dist-cl-fleet-cell__label">
                                Vehicles {form.type === 'Delivery' && <span className="dist-cl-req-star">*</span>}
                              </label>
                              <input
                                type="number"
                                min="0"
                                className={`dist-cl-aligned-input ${stepErrors.logistics?.vehicles ? 'input-error' : ''}`}
                                value={form.vehicles}
                                onChange={(e) => {
                                  setForm({ ...form, vehicles: e.target.value })
                                  if (stepErrors.logistics?.vehicles) {
                                    setStepErrors((prev) => ({ ...prev, logistics: { ...prev.logistics, vehicles: null } }))
                                  }
                                }}
                                placeholder={form.type === 'Delivery' ? '1' : '0'}
                              />
                            </div>
                            <div className="dist-cl-fleet-cell">
                              <label className="dist-cl-fleet-cell__label">Volunteers</label>
                              <input
                                type="number"
                                min="0"
                                className="dist-cl-aligned-input"
                                value={form.volunteers}
                                onChange={(e) => setForm({ ...form, volunteers: e.target.value })}
                                placeholder={assignedVolunteers.length ? String(assignedVolunteers.length) : '0'}
                                title="Target volunteer headcount"
                              />
                            </div>
                          </div>
                          {stepErrors.logistics?.vehicles && (
                            <span className="dist-field-error" style={{ fontSize: '0.68rem' }}>{stepErrors.logistics.vehicles}</span>
                          )}

                          <div className="dist-cl-fleet-hint-row">
                            <small className="dist-cl-hint">Transport capacity and minimum crew needed for this dispatch.</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Delivery Team & Volunteer Roster ── */}
                    <div className="dist-cl-card dist-cl-card--team">
                      <div className="dist-cl-card__head">
                        <div className="dist-cl-card__title">
                          <Users size={14} style={{ color: '#AF101A' }} />
                          <span>Delivery Team</span>
                          <span className="dist-cl-count-badge">
                            {assignedVolunteers.length}{form.volunteers ? ` / ${form.volunteers}` : ''}
                          </span>
                          {isDistributionProgram && (
                            <span className="dist-cl-locked-pill" title="Volunteers are managed via Volunteer Tasks for Distribution programs">
                              <Lock size={11} /> Locked (Distribution Program)
                            </span>
                          )}
                        </div>

                        {/* Directory dropdown only if NOT locked */}
                        {!isDistributionProgram && allVolunteers.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              const found = allVolunteers.find((v) => String(v.dbId || v.id) === String(e.target.value))
                              if (found) handleAddVolunteer(found)
                            }}
                            className="dist-cl-dir-select"
                          >
                            <option value="">+ Add from directory…</option>
                            {allVolunteers.map((v) => {
                              const isAssigned = assignedVolunteers.some((av) => String(av.id) === String(v.dbId || v.id))
                              return (
                                <option key={v.dbId || v.id} value={v.dbId || v.id} disabled={isAssigned}>
                                  {isAssigned ? '✓ ' : ''}{v.name} ({v.applicantType || 'Volunteer'})
                                </option>
                              )
                            })}
                          </select>
                        )}
                      </div>

                      {/* Assigned roster */}
                      <div className="dist-cl-roster">
                        {assignedVolunteers.length > 0 ? (
                          assignedVolunteers.map((v) => (
                            <span key={v.id} className={`dist-cl-member-chip ${isDistributionProgram ? 'dist-cl-member-chip--locked' : ''}`}>
                              <span className="dist-cl-member-avatar">
                                {(v.name || '?').charAt(0).toUpperCase()}
                              </span>
                              <span className="dist-cl-member-name">{v.name}</span>
                              <span className={`vol-role-badge vol-role-badge--${v.type?.toLowerCase() === 'intern' ? 'intern' : 'volunteer'}`}>
                                {v.type}
                              </span>
                              {!isDistributionProgram ? (
                                <button
                                  type="button"
                                  className="dist-cl-remove-btn"
                                  title="Remove from team"
                                  onClick={() => handleRemoveVolunteer(v.id)}
                                >
                                  ×
                                </button>
                              ) : (
                                <Lock size={10} style={{ color: '#94a3b8', marginLeft: '2px' }} title="Volunteer assignment is locked for Distribution programs" />
                              )}
                            </span>
                          ))
                        ) : isDistributionProgram ? (
                          <div className="dist-cl-locked-notice">
                            <Lock size={14} style={{ color: '#AF101A', flexShrink: 0 }} />
                            <span>
                              Volunteer assignments are locked for Distribution programs. Volunteers are assigned automatically via the Volunteer Tasks &amp; Deployment schedule.
                            </span>
                          </div>
                        ) : (
                          <span className="dist-cl-roster-empty">
                            <Users size={14} />
                            No team members assigned — use recommendations below or the directory dropdown.
                          </span>
                        )}
                      </div>

                      {/* Locked note or Skills filter & Candidate grid */}
                      {isDistributionProgram ? (
                        assignedVolunteers.length > 0 && (
                          <div className="dist-cl-locked-footer">
                            <Lock size={12} style={{ color: '#64748b' }} />
                            <span>The assigned volunteer team is locked and managed through Volunteer Tasks for Distribution programs.</span>
                          </div>
                        )
                      ) : (
                        <>
                          {/* Skills filter */}
                          <div className="dist-cl-skills-row">
                            <span className="dist-cl-skills-label">
                              <Sparkles size={11} style={{ color: '#AF101A' }} />
                              Skills for {form.program || 'Delivery'}:
                            </span>
                            <div className="dist-cl-skills-tags">
                              {(PROGRAM_REQUIRED_SKILLS[form.program] || ['Logistics / Driving', 'Packing / Repacking', 'First Aid']).map((skill) => {
                                const isReq = manpowerSkills.includes(skill)
                                return (
                                  <button
                                    key={skill}
                                    type="button"
                                    className={`dist-cl-skill-tag ${isReq ? 'dist-cl-skill-tag--on' : ''}`}
                                    onClick={() => setManpowerSkills((prev) => isReq ? prev.filter((s) => s !== skill) : [...prev, skill])}
                                  >
                                    {isReq ? '✓ ' : ''}{skill}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Candidate grid */}
                          {manpowerSuggestions.length === 0 ? (
                            <p className="dist-cl-no-candidates">
                              No matching volunteers found. Try adjusting skills or use the directory dropdown.
                            </p>
                          ) : (
                            <div className="dist-cl-candidates">
                              {manpowerSuggestions.map((s) => {
                                const isAssigned = assignedVolunteers.some((av) => String(av.id) === String(s.dbId || s.id))
                                const isProgramMatch = form.program && (
                                  (s.programs || []).some((p) => p.toLowerCase().includes(form.program.toLowerCase())) ||
                                  (s.program && s.program.toLowerCase().includes(form.program.toLowerCase()))
                                )
                                return (
                                  <div key={s.dbId || s.id} className={`dist-cl-candidate ${isAssigned ? 'dist-cl-candidate--assigned' : ''}`}>
                                    <div className="dist-cl-candidate__avatar">
                                      {(s.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="dist-cl-candidate__info">
                                      <div className="dist-cl-candidate__name-row">
                                        <strong>{s.name}</strong>
                                        <span className={`vol-role-badge vol-role-badge--${s.applicantType?.toLowerCase() === 'intern' ? 'intern' : 'volunteer'}`}>
                                          {s.applicantType || 'Volunteer'}
                                        </span>
                                        {isProgramMatch && (
                                          <span className="dist-cl-match-badge">🎯 Match</span>
                                        )}
                                      </div>
                                      <p className="dist-cl-candidate__skills">
                                        {s.whyMatched || (s.skills || []).slice(0, 3).join(' · ')}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      className={`dist-cl-assign-btn ${isAssigned ? 'dist-cl-assign-btn--on' : ''}`}
                                      onClick={() => isAssigned ? handleRemoveVolunteer(s.dbId || s.id) : handleAddVolunteer(s)}
                                    >
                                      {isAssigned ? <Check size={12} /> : <Plus size={12} />}
                                      {isAssigned ? 'Assigned' : 'Assign'}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* =========================================================
                    STEP 3: STATUS & NOTES (REVIEW & FINALIZE)
                    ========================================================= */}
                {formTab === 'requirements' && (
                  <>
                    {/* Setup Review Card */}
                    <div className="dist-summary-review-card">
                      <div className="dist-summary-review-card__header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                          <FileText size={16} style={{ color: '#AF101A' }} />
                          <span>Delivery Setup Summary</span>
                        </div>
                        <span className="dist-summary-review-badge">
                          Mode: {form.type || 'Delivery'}
                        </span>
                      </div>

                      <div className="dist-summary-review-grid">
                        <div className="dist-summary-review-item">
                          <span className="dist-summary-review-label">
                            <MapPin size={11} style={{ color: '#AF101A' }} />
                            Destination Barangay
                          </span>
                          <strong>
                            {selectedBarangay?.barangay || selectedBarangay?.name || form.location || '—'}
                          </strong>
                          {form.location && <small>{form.location}</small>}
                        </div>

                        <div className="dist-summary-review-item">
                          <span className="dist-summary-review-label">
                            <Sparkles size={11} style={{ color: '#AF101A' }} />
                            Program / Project
                          </span>
                          <strong>{form.program || 'General Relief'}</strong>
                        </div>

                        <div className="dist-summary-review-item">
                          <span className="dist-summary-review-label">
                            <Calendar size={11} style={{ color: '#AF101A' }} />
                            Schedule Date &amp; Time
                          </span>
                          <strong>
                            {form.distributionDate || '—'} {form.scheduleTime ? `at ${form.scheduleTime}` : ''}
                          </strong>
                        </div>

                        <div className="dist-summary-review-item">
                          <span className="dist-summary-review-label">
                            <UserRound size={11} style={{ color: '#AF101A' }} />
                            Coordinator in Charge
                          </span>
                          <strong>{form.coordinator || 'Unassigned'}</strong>
                        </div>

                        <div className="dist-summary-review-item">
                          <span className="dist-summary-review-label">
                            <Truck size={11} style={{ color: '#AF101A' }} />
                            Fleet &amp; Transport
                          </span>
                          <strong>
                            {form.vehicles || 0} vehicle(s)
                          </strong>
                        </div>

                        <div className="dist-summary-review-item">
                          <span className="dist-summary-review-label">
                            <Users size={11} style={{ color: '#AF101A' }} />
                            Assigned Team
                          </span>
                          <strong>
                            {assignedVolunteers.length > 0
                              ? `${assignedVolunteers.length} member(s): ${assignedVolunteers.map((v) => v.name).join(', ')}`
                              : (form.volunteers ? `${form.volunteers} volunteer(s) quota` : 'None assigned yet')}
                          </strong>
                        </div>
                      </div>

                      {/* Items Cargo Subcard */}
                      <div className="dist-summary-cargo-box">
                        <div className="dist-summary-cargo-box__header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Package size={13} style={{ color: '#AF101A' }} />
                            Cargo Items to Deliver
                          </span>
                          {resolvedCargoAllocations.length > 0 && (
                            <span className="dist-badge dist-badge--qty">
                              {resolvedCargoAllocations.length} batch(es) linked
                            </span>
                          )}
                        </div>
                        <div className="dist-summary-cargo-box__content">
                          {form.itemsSummary || 'No items specified'}
                        </div>
                      </div>
                    </div>

                    <div className="dist-form-grid-2">
                      <div className="dist-readonly-status-card">
                        <div className="dist-readonly-status-card__header">
                          <ShieldCheck size={13} style={{ color: '#0369a1' }} />
                          <span>Workflow Status</span>
                        </div>
                        <div className="dist-readonly-status-card__body">
                          <span className="dist-badge--preparing">
                            Preparing
                          </span>
                          <p className="dist-readonly-status-card__hint">
                            Workflow status automatically remains Preparing during delivery planning.
                          </p>
                        </div>
                      </div>

                      <div className="dist-readonly-status-card">
                        <div className="dist-readonly-status-card__header">
                          <FileCheck size={13} style={{ color: '#b45309' }} />
                          <span>Proof Requirement</span>
                        </div>
                        <div className="dist-readonly-status-card__body">
                          <span className="dist-badge--proof-pending">
                            Awaiting Delivery Proof
                          </span>
                          <p className="dist-readonly-status-card__hint">
                            Locked during planning. Proof is handled and verified upon field handover.
                          </p>
                        </div>
                      </div>
                    </div>

                    <label>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <StickyNote size={13} style={{ color: '#AF101A' }} />
                        Logistics Notes &amp; Dispatch Instructions
                      </span>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Optional instructions or notes for the delivery team (assigned volunteers are automatically recorded)"
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Step-Contextual Modal Footer Navigation */}
              <div className="dist-modal-footer">
                {formTab === 'destination' && (
                  <>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={closeForm}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => handleGoToStep('logistics')}
                      disabled={!isStep1Complete || saving}
                    >
                      Continue
                    </button>
                  </>
                )}

                {formTab === 'logistics' && (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={closeForm}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => handleGoToStep('destination')}
                      >
                        Back
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => handleGoToStep('requirements')}
                      disabled={!isStep1Complete || !isStep2Complete || saving}
                    >
                      Continue
                    </button>
                  </>
                )}

                {formTab === 'requirements' && (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={closeForm}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => handleGoToStep('logistics')}
                      >
                        Back
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="btn btn--primary btn--sm"
                      disabled={saving || !isStep1Complete || !isStep2Complete}
                    >
                      {saving ? 'Saving...' : 'Confirm & Save Delivery'}
                    </button>
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
