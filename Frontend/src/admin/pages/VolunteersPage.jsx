import { useEffect, useMemo, useState } from 'react'
import {
  Clock3, ListTodo, Mail, UserCheck, Pencil, Trash2,
  CheckCircle2, XCircle, CalendarDays, Briefcase, Truck, Users, Plus,
  FileText, Download, ExternalLink, GraduationCap, Sparkles, RefreshCw,
  Award, School, Check, Phone, Info, Lock, Unlock, AlertTriangle, Quote, User, Eye,
} from 'lucide-react'
import { volunteersApi, tasksApi, volunteerMatchApi, distributionsApi, internAiMatchApi } from '../../api/resources'
import { getTodayDateString, isPastDateString } from '../../utils/date'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import ModalHeader from '../components/shared/ModalHeader'
import Req from '../../components/shared/Req'
import { useSeeMore } from '../../hooks/useSeeMore'
import { SeeMoreToggle } from '../components/shared/SeeMoreList'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { notify, confirmAction, showSuccessModal, showErrorModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { VOLUNTEER_PROGRAMS, VOLUNTEER_SKILLS } from '../../constants/options'
import { useTaskTitles } from '../../hooks/useTaskTitles'
import { useLoading } from '../../context/LoadingContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

const filterConfig = {
  searchKeys: ['id', 'name', 'email', 'institution', 'skills', 'programs'],
  filters: [
    {
      key: 'status',
      label: 'Status',
      match: (row, val) => {
        if (!val || val === 'all') return true
        if (val === 'Approved' || val === 'Active') {
          return ['Approved', 'Active', 'Assigned'].includes(row.status)
        }
        return String(row.status) === String(val)
      },
    },
    {
      key: 'program',
      label: 'Program',
      deriveOptions: (data) =>
        Array.from(new Set(data.flatMap((v) => v.programs || []))).sort(),
      match: (row, val) => (row.programs || []).includes(val),
    },
  ],
}

const emptyGeneralTaskForm = {
  title: '',
  priority: 'Medium',
  dueDate: '',
  module: '',
  requiredSkills: [],
  distributionId: '',
}

const emptyDirectTaskForm = {
  title: '',
  priority: 'Medium',
  dueDate: '',
  dutyStart: '',
  dutyEnd: '',
  dutyHours: '',
  module: '',
  distributionId: '',
}

const ACTIVE_DIST_STATUSES = ['Planning', 'Preparing', 'In Transit', 'Scheduled', 'In Progress', 'Pending']

function isDistributionProgram(module) {
  const m = String(module || '').toLowerCase().trim()
  return m.includes('distribution')
}

function ChipList({ items, empty = '—' }) {
  const list = (items || []).filter(Boolean)
  if (!list.length) return <span className="volunteer-muted">{empty}</span>
  return (
    <ul className="volunteer-chip-list">
      {list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function VolunteersPage() {
  const [activeTab, setActiveTab] = useState('Volunteer') // 'Volunteer' | 'Intern'
  const { showLoading, hideLoading } = useLoading()
  const { data: allVolunteers, loading, error, reload } = useApiList(() => volunteersApi.list())
  const { data: distributions } = useApiList(() => distributionsApi.list())

  // Tab for Intern View Details modal: 'details' | 'ai_matching' | 'tasks'
  const [internModalTab, setInternModalTab] = useState('details')

  // Separate volunteers and interns
  const tabFilteredData = useMemo(() => {
    const list = allVolunteers || []
    return list.filter((v) => (v.applicantType || 'Volunteer') === activeTab)
  }, [allVolunteers, activeTab])

  const filters = useFilters(tabFilteredData, filterConfig)
  const bulk = useBulkSelection(
    filters.filtered,
    (id) => volunteersApi.remove(id),
    reload,
    activeTab === 'Intern' ? 'interns' : 'volunteers',
  )
  
  const { options: programOptions } = useCatalogOptions(
    'volunteer_programs',
    VOLUNTEER_PROGRAMS,
  )
  const { options: volunteerSkillOptions } = useCatalogOptions(
    'volunteer_skills',
    VOLUNTEER_SKILLS,
  )

  const [selected, setSelected] = useState(null)
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const tasksSeeMore = useSeeMore(tasks, 4)

  // AI Recommendations State (Interns)
  const [aiRecs, setAiRecs] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiSource, setAiSource] = useState('')
  const [hasRecommendedPrograms, setHasRecommendedPrograms] = useState(true)

  // 1. General Task Assignment modal state (Outside Manage)
  const [showGeneralTaskModal, setShowGeneralTaskModal] = useState(false)
  const [generalTaskForm, setGeneralTaskForm] = useState(emptyGeneralTaskForm)
  const { options: generalTaskTitleOptions } = useTaskTitles(generalTaskForm.module)
  const [generalSelectedVolunteerIds, setGeneralSelectedVolunteerIds] = useState([])
  const [selectedSkillToAdd, setSelectedSkillToAdd] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  // 2. Direct Task Assignment Form state (Inside Manage)
  const [showDirectTaskModal, setShowDirectTaskModal] = useState(false)
  const [directTaskForm, setDirectTaskForm] = useState(emptyDirectTaskForm)
  const { options: directTaskTitleOptions } = useTaskTitles(directTaskForm.module)
  const [saving, setSaving] = useState(false)
  const [hoursForm, setHoursForm] = useState({ hours: 0, requiredHours: 0 })
  const [selectedProgramToEnroll, setSelectedProgramToEnroll] = useState('')

  const linkableDistributions = useMemo(
    () => (distributions || []).filter((d) => ACTIVE_DIST_STATUSES.includes(d.status)),
    [distributions],
  )

  const volunteerCount = useMemo(
    () => (allVolunteers || []).filter((v) => (v.applicantType || 'Volunteer') === 'Volunteer').length,
    [allVolunteers],
  )
  const internCount = useMemo(
    () => (allVolunteers || []).filter((v) => (v.applicantType || 'Volunteer') === 'Intern').length,
    [allVolunteers],
  )

  const pendingCount = useMemo(
    () => tabFilteredData.filter((v) => v.status === 'Pending Review').length,
    [tabFilteredData],
  )
  const activeCount = useMemo(
    () => tabFilteredData.filter((v) => ['Approved', 'Active', 'Assigned'].includes(v.status)).length,
    [tabFilteredData],
  )

  const activeAssigneesList = useMemo(
    () => (allVolunteers || []).filter((v) => ['Approved', 'Active', 'Assigned'].includes(v.status)),
    [allVolunteers],
  )

  const loadTasks = async (volunteer) => {
    if (!volunteer) {
      setTasks([])
      return
    }
    setTasksLoading(true)
    try {
      const res = await tasksApi.list(`?volunteerId=${volunteer.dbId}`)
      setTasks(Array.isArray(res.data) ? res.data : (res.list || []))
    } catch {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }

  // Load AI recommendations for Intern (Strict & Evidence-Based)
  const loadAiRecommendations = async (volRow) => {
    if (!volRow?.dbId) return
    setAiLoading(true)
    showLoading('Analyzing CV…')
    setAiError(null)
    try {
      const res = await internAiMatchApi.getRecommendations(volRow.dbId)
      if (res?.ok) {
        if (res.cvExtractionStatus === 'failed' || res.cvExtractionError) {
          setAiError(res.cvExtractionError || 'CV could not be analyzed')
          setAiRecs([])
        } else {
          setAiRecs(Array.isArray(res.data) ? res.data : [])
          setAiSource(res.source || 'strict_evidence_ai')
          setHasRecommendedPrograms(Boolean(res.hasRecommendedPrograms))
        }
      } else {
        setAiError(res?.error || 'CV could not be analyzed')
        setAiRecs([])
      }
    } catch (err) {
      setAiError(err.message || 'Failed to analyze CV with AI')
      setAiRecs([])
    } finally {
      hideLoading()
      setAiLoading(false)
    }
  }

  // Check if current volunteer is tasked with any distribution
  const hasDistributionTasks = useMemo(() => {
    return (tasks || []).some((t) => Boolean(t.distributionId || t.distributionCode))
  }, [tasks])

  // Keep selected row fresh after reloads
  useEffect(() => {
    if (!selected?.dbId) return
    const fresh = (allVolunteers || []).find((v) => Number(v.dbId) === Number(selected.dbId))
    if (!fresh) {
      setSelected(null)
      return
    }
    setSelected((prev) => {
      if (!prev || Number(prev.dbId) !== Number(fresh.dbId)) return prev
      return fresh
    })
  }, [allVolunteers]) // eslint-disable-line react-hooks/exhaustive-deps

  const openVolunteer = (row) => {
    setSelected(row)
    setInternModalTab('details')
    setHoursForm({ hours: row.hours || 0, requiredHours: row.requiredHours || 0 })
    setSelectedProgramToEnroll('')
    setAiRecs([])
    setAiError(null)
    setAiSource('')
    setHasRecommendedPrograms(true)
    const initialProg = row.programs?.[0] || (row.applicantType === 'Intern' ? 'Internship' : 'Volunteer')
    setDirectTaskForm({ ...emptyDirectTaskForm, module: initialProg })
    loadTasks(row)

    // Auto-fetch AI recommendations for Interns with CV
    if (row.applicantType === 'Intern') {
      loadAiRecommendations(row)
    }
  }

  const closeVolunteer = () => {
    setSelected(null)
    setSuggestions([])
    setAiRecs([])
  }

  const handleApprove = async (row) => {
    const isIntern = row.applicantType === 'Intern'
    const typeLabel = isIntern ? 'Intern' : 'Volunteer'
    const ok = await confirmAction({
      title: `Approve ${typeLabel} Application`,
      message: `Approve application for "${row.name}" and provision their portal account?`,
      confirmText: `Approve ${typeLabel}`,
      type: 'primary',
    })
    if (!ok) return

    showLoading(`Approving ${typeLabel.toLowerCase()}…`)
    try {
      const res = await volunteersApi.update(row.dbId, { status: 'Approved' })
      const status = res?.data?.status || 'Approved'

      // Refresh currently open modal immediately so it transitions to Approved
      setSelected((prev) => {
        if (!prev || (prev.dbId !== row.dbId && prev.id !== row.id)) return prev
        return {
          ...prev,
          status: 'Approved',
          ...(res?.data || {}),
        }
      })

      const credentialMsg = res?.credentialsSent
        ? ' Login credentials have been sent to their email.'
        : res?.temporaryPassword
          ? ` Temporary password: ${res.temporaryPassword}`
          : ''

      hideLoading()
      await showSuccessModal(
        `“${row.name}” has been successfully approved as a ${typeLabel.toLowerCase()}.${credentialMsg}`,
        `${typeLabel} Approved`
      )
      reload()
      notifyBadgesChanged()
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || `Failed to approve ${typeLabel.toLowerCase()}`)
    } finally {
      hideLoading()
    }
  }

  const handleReject = async (row) => {
    const isIntern = row.applicantType === 'Intern'
    const typeLabel = isIntern ? 'Intern' : 'Volunteer'
    const ok = await confirmAction({
      title: `Reject ${typeLabel} Application`,
      message: `Reject application for "${row.name}"? This action is final.`,
      confirmText: 'Reject Application',
      type: 'danger',
    })
    if (!ok) return

    showLoading(`Rejecting application…`)
    try {
      const res = await volunteersApi.update(row.dbId, { status: 'Rejected' })
      const status = res?.data?.status || 'Rejected'

      // Refresh currently open modal immediately so it reflects Rejected
      setSelected((prev) => {
        if (!prev || (prev.dbId !== row.dbId && prev.id !== row.id)) return prev
        return {
          ...prev,
          status: 'Rejected',
          ...(res?.data || {}),
        }
      })

      hideLoading()
      await showSuccessModal(
        `Application for “${row.name}” has been rejected.`,
        `${typeLabel} Rejected`
      )
      reload()
      notifyBadgesChanged()
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || 'Failed to reject application')
    } finally {
      hideLoading()
    }
  }

  const handleDelete = async (row) => {
    const isIntern = row.applicantType === 'Intern'
    const typeLabel = isIntern ? 'Intern' : 'Volunteer'
    const ok = await confirmAction({
      title: `Delete ${typeLabel}`,
      message: `Permanently delete record for "${row.name}"? This cannot be undone.`,
      confirmText: `Delete ${typeLabel}`,
      type: 'danger',
    })
    if (!ok) return

    showLoading(`Deleting ${typeLabel.toLowerCase()}…`)
    try {
      await volunteersApi.remove(row.dbId)
      notify.success(`${typeLabel} deleted.`)
      hideLoading()
      await showSuccessModal('Successfully deleted.')
      reload()
      notifyBadgesChanged()
      if (selected?.dbId === row.dbId) closeVolunteer()
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || `Failed to delete ${typeLabel.toLowerCase()}`)
    } finally {
      hideLoading()
    }
  }

  const handleSaveHours = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!selected) return
    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await volunteersApi.update(selected.dbId, {
        hours: Number(hoursForm.hours) || 0,
        requiredHours: Number(hoursForm.requiredHours) || 0,
      })
      const data = res?.data
      if (data) {
        setHoursForm({ hours: data.hours || 0, requiredHours: data.requiredHours || 0 })
        setSelected(data)
      }
      reload()
      notify.success('Hours updated successfully.')
      hideLoading()
      await showSuccessModal('Hours successfully updated.')
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || 'Failed to update hours')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  // 1-Program Rule: Assign single enrolled program (replaces any previous program and locks it)
  const handleSetSingleProgram = async (progToEnroll, isOverride = false) => {
    const targetProgram = typeof progToEnroll === 'string' ? progToEnroll : selectedProgramToEnroll
    if (!selected || !targetProgram) return

    const isCurrent = (selected.programs || [])[0] === targetProgram
    if (isCurrent) {
      notify.info(`Already enrolled in "${targetProgram}".`)
      return
    }

    const typeLabel = selected.applicantType === 'Intern' ? 'Intern' : 'Volunteer'
    const hasExisting = (selected.programs || []).length > 0
    if (hasExisting) {
      const ok = await confirmAction({
        title: `Change Enrolled Program`,
        message: `Change ${typeLabel.toLowerCase()} program from "${selected.programs[0]}" to "${targetProgram}"? Each ${typeLabel.toLowerCase()} is assigned to exactly one program.`,
        confirmText: `Set to ${targetProgram}`,
        type: 'primary',
      })
      if (!ok) return
    } else if (isOverride) {
      const ok = await confirmAction({
        title: `Manual Program Assignment`,
        message: `Assign "${targetProgram}" to ${selected.name}? (Admin Override: AI indicated limited direct evidence in CV).`,
        confirmText: `Assign to ${targetProgram}`,
        type: 'primary',
      })
      if (!ok) return
    }

    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await volunteersApi.update(selected.dbId, { programs: [targetProgram] })
      if (res?.data) {
        setSelected(res.data)
        setDirectTaskForm((prev) => ({ ...prev, module: targetProgram }))
      }
      setSelectedProgramToEnroll('')
      reload()
      notify.success(`Enrolled ${selected.name} in "${targetProgram}".`)
      hideLoading()
      await showSuccessModal(`Successfully assigned to ${targetProgram}.`)
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || 'Failed to set program')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleRemoveSingleProgram = async () => {
    if (!selected) return
    const typeLabel = selected.applicantType === 'Intern' ? 'Intern' : 'Volunteer'
    const ok = await confirmAction({
      title: `Remove Enrolled Program`,
      message: `Remove the assigned program for ${selected.name}?`,
      confirmText: `Remove Program`,
      type: 'danger',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await volunteersApi.update(selected.dbId, { programs: [] })
      if (res?.data) setSelected(res.data)
      reload()
      notify.success(`Program removed.`)
    } catch (err) {
      notify.error(err.message || 'Failed to remove program')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const loadSuggestions = async (skills, volunteer) => {
    if (!skills?.length) {
      setSuggestions([])
      return
    }
    setSuggestionsLoading(true)
    try {
      const res = await volunteerMatchApi.suggest({
        skills,
        programs: volunteer?.programs || [],
        availability: volunteer?.availability || '',
        limit: 5,
      })
      setSuggestions(Array.isArray(res.data) ? res.data : [])
    } catch {
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  // 1. Open General Assign Task modal (Outside Manage)
  const openGeneralAssignTask = () => {
    if (activeAssigneesList.length === 0) {
      showErrorModal('No approved volunteers or interns are available to assign tasks to. Please approve volunteer applications first.')
      return
    }
    const firstVolId = activeAssigneesList[0]?.dbId ? String(activeAssigneesList[0].dbId) : ''
    setGeneralSelectedVolunteerIds(firstVolId ? [firstVolId] : [])
    setGeneralTaskForm({ ...emptyGeneralTaskForm, module: programOptions[0] || 'Volunteer' })
    setSelectedSkillToAdd('')
    setSuggestions([])
    setShowGeneralTaskModal(true)
  }

  // 2. Open Direct Assign Task modal (Inside Manage)
  const openAssignTaskForSelected = () => {
    if (!selected) return
    if (selected.status !== 'Approved') {
      showErrorModal(`Cannot assign task: ${selected.name}'s status is ${selected.status}. Only Approved volunteers can be assigned tasks.`)
      return
    }
    const enrolledProg = (selected.programs && selected.programs.length > 0) ? selected.programs[0] : ''
    const initialProg = enrolledProg || (selected.applicantType === 'Intern' ? 'Internship' : 'Volunteer')
    setDirectTaskForm({ ...emptyDirectTaskForm, module: initialProg })
    setShowDirectTaskModal(true)
  }

  const handleCreateGeneralTask = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!generalSelectedVolunteerIds.length) {
      showErrorModal('Please select at least one approved member to assign this task to.')
      return
    }
    if (!generalTaskForm.title.trim()) {
      showErrorModal('Task title is required.')
      return
    }
    if (generalTaskForm.dueDate && isPastDateString(generalTaskForm.dueDate)) {
      showErrorModal('Due date cannot be in the past. Please select today or a future date.')
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      const isDist = isDistributionProgram(generalTaskForm.module)
      const distId = isDist && generalTaskForm.distributionId ? Number(generalTaskForm.distributionId) : null
      const module = generalTaskForm.module || 'Volunteer'
      await tasksApi.create({
        title: generalTaskForm.title,
        priority: generalTaskForm.priority,
        dueDate: generalTaskForm.dueDate || null,
        dutyStart: null,
        dutyEnd: null,
        dutyHours: null,
        module,
        requiredSkills: generalTaskForm.requiredSkills || [],
        volunteerIds: generalSelectedVolunteerIds.map(Number),
        distributionId: distId || undefined,
        boardColumn: 'todo',
      })
      setShowGeneralTaskModal(false)
      setGeneralTaskForm(emptyGeneralTaskForm)
      setGeneralSelectedVolunteerIds([])
      setSuggestions([])
      if (selected) loadTasks(selected)
      reload()
      notifyBadgesChanged()
      hideLoading()
      await showSuccessModal(
        generalSelectedVolunteerIds.length === 1
          ? 'Task created and assigned successfully.'
          : `Task created and assigned to ${generalSelectedVolunteerIds.length} assignees successfully.`
      )
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || 'Failed to create task')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleCreateDirectTask = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!selected?.dbId) {
      showErrorModal('No record selected.')
      return
    }
    if (selected.status !== 'Approved') {
      showErrorModal(`Cannot assign task: ${selected.name}'s status is ${selected.status}. Only Approved volunteers can be assigned tasks.`)
      return
    }
    if (!directTaskForm.title.trim()) {
      showErrorModal('Task title is required.')
      return
    }
    if (directTaskForm.dueDate && isPastDateString(directTaskForm.dueDate)) {
      notify.error('Due date cannot be in the past. Please select today or a future date.')
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      const enrolledProg = (selected.programs && selected.programs.length > 0) ? selected.programs[0] : ''
      const chosenModule = directTaskForm.module || enrolledProg || (selected.applicantType === 'Intern' ? 'Internship' : 'Volunteer')
      const isDist = isDistributionProgram(chosenModule)
      const distId = isDist && directTaskForm.distributionId ? Number(directTaskForm.distributionId) : null
      const module = chosenModule
      const isIntern = selected.applicantType === 'Intern'
      await tasksApi.create({
        title: directTaskForm.title,
        priority: directTaskForm.priority,
        dueDate: directTaskForm.dueDate || null,
        dutyStart: isIntern ? (directTaskForm.dutyStart || null) : null,
        dutyEnd: isIntern ? (directTaskForm.dutyEnd || null) : null,
        dutyHours: isIntern && directTaskForm.dutyHours !== '' ? Number(directTaskForm.dutyHours) : null,
        module,
        volunteerId: Number(selected.dbId),
        distributionId: distId || undefined,
        boardColumn: 'todo',
      })
      setShowDirectTaskModal(false)
      setDirectTaskForm({ ...emptyDirectTaskForm, module: enrolledProg || (selected.applicantType === 'Intern' ? 'Internship' : 'Volunteer') })
      loadTasks(selected)
      reload()
      notifyBadgesChanged()
      notify.success(`Task assigned to ${selected.name} successfully.`)
      hideLoading()
      await showSuccessModal(`Task successfully assigned to ${selected.name}.`)
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || 'Failed to assign task')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleAdminCompleteTask = async (task) => {
    if (!task?.dbId) return
    const isIntern = selected?.applicantType === 'Intern'
    const ok = await confirmAction({
      title: 'Complete Task',
      message: isIntern
        ? `Mark task "${task.title}" as completed for ${selected.name}? This will verify duty hours and credit them to the intern profile record.`
        : `Mark task "${task.title}" as completed for ${selected.name}?`,
      confirmText: 'Mark Completed',
      type: 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Saving…')
    try {
      await tasksApi.update(task.dbId, { boardColumn: 'done', status: 'Completed' })
      notify.success(`Task "${task.title}" marked as completed.`)
      hideLoading()
      await showSuccessModal('Task successfully completed.')
      if (selected) loadTasks(selected)
      reload()
      notifyBadgesChanged()
    } catch (err) {
      hideLoading()
      showErrorModal(err.message || 'Failed to complete task')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const remaining = useMemo(() => {
    if (!selected) return 0
    return Math.max(0, (Number(hoursForm.requiredHours) || 0) - (Number(hoursForm.hours) || 0))
  }, [selected, hoursForm])

  // Single enrolled program for currently selected
  const singleEnrolledProgram = useMemo(() => {
    return (selected?.programs || [])[0] || null
  }, [selected])

  // Enrolled programs list for currently selected (strictly limited to enrolled program)
  const enrolledPrograms = useMemo(() => {
    if (!selected) return []
    if (Array.isArray(selected.programs) && selected.programs.length > 0) {
      return selected.programs.filter(Boolean)
    }
    return []
  }, [selected])

  // Check if any recommendation is suitable
  const hasMatchedSuitableProgram = useMemo(() => {
    return aiRecs.some((r) => Boolean(r.isRecommended) || (Number(r.matchPercentage) || 0) >= 55)
  }, [aiRecs])

  // Table columns for Volunteers: NO Hours column, NO CV badge
  const volunteerColumns = [
    { key: 'id', label: 'ID' },
    {
      key: 'name',
      label: 'Volunteer',
      render: (row) => (
        <div className="volunteer-cell-primary">
          <strong>{row.name}</strong>
          <span className="volunteer-cell-sub">{row.email || 'No email'}</span>
        </div>
      ),
    },
    {
      key: 'programs',
      label: 'Enrolled Program',
      render: (row) => (
        <span className="volunteer-table-clip">
          {(row.programs || [])[0] || '—'}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'assignedTasks',
      label: 'Tasks',
      render: (row) => (
        <span title={`${row.openTasks || 0} open`}>
          {row.assignedTasks || 0}
          {row.openTasks ? <small className="volunteer-open-tasks"> · {row.openTasks} open</small> : null}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Review' || row.status === 'Rejected' ? (
            <button
              type="button"
              className="btn btn--sm btn--outline"
              onClick={(e) => { e.stopPropagation(); openVolunteer(row) }}
              title={row.status === 'Pending Review' ? 'View volunteer application' : 'View volunteer details'}
            >
              <Eye size={13} /> View
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--sm btn--outline"
              onClick={(e) => { e.stopPropagation(); openVolunteer(row) }}
              title="Manage volunteer"
            >
              <Pencil size={13} /> Manage
            </button>
          )}
        </div>
      ),
    },
  ]

  // Table columns for Interns: Has CV badge, School, and Hours tracking
  const internColumns = [
    { key: 'id', label: 'ID' },
    {
      key: 'name',
      label: 'Intern Applicant',
      render: (row) => (
        <div className="volunteer-cell-primary">
          <strong>{row.name}</strong>
          <span className="volunteer-cell-sub">
            {row.email || 'No email'}
            {row.hasResume ? (
              <span className="volunteer-cv-pill" title="CV/Resume document attached">
                <FileText size={11} aria-hidden /> CV
              </span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      key: 'institution',
      label: 'School / Institution',
      render: (row) => (
        <span style={{ fontSize: '0.84rem', color: '#334155' }}>
          {row.institution || '—'}
        </span>
      ),
    },
    {
      key: 'programs',
      label: 'Enrolled Program',
      render: (row) => (
        <span className="volunteer-table-clip">
          {(row.programs || [])[0] || '—'}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'hours',
      label: 'Duty Hours',
      render: (row) => `${row.hours || 0} / ${row.requiredHours || 0} hrs`,
    },
    {
      key: 'assignedTasks',
      label: 'Tasks',
      render: (row) => (
        <span title={`${row.openTasks || 0} open`}>
          {row.assignedTasks || 0}
          {row.openTasks ? <small className="volunteer-open-tasks"> · {row.openTasks} open</small> : null}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'Pending Review' || row.status === 'Rejected' ? (
            <button
              type="button"
              className="btn btn--sm btn--outline"
              onClick={(e) => { e.stopPropagation(); openVolunteer(row) }}
              title={row.status === 'Pending Review' ? 'View intern application' : 'View intern details'}
            >
              <Eye size={13} /> View
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--sm btn--outline"
              onClick={(e) => { e.stopPropagation(); openVolunteer(row) }}
              title="Manage intern"
            >
              <Pencil size={13} /> Manage
            </button>
          )}
        </div>
      ),
    },
  ]

  const activeColumns = activeTab === 'Intern' ? internColumns : volunteerColumns

  return (
    <>
      <PageHeader
        title={activeTab === 'Intern' ? 'Intern Management' : 'Volunteer Management'}
        description={
          activeTab === 'Intern'
            ? 'Review student internship applications, examine evidence-based AI CV matching, track duty hours, and assign tasks.'
            : 'Review community volunteer applications, manage single program placement, and assign field and outreach tasks.'
        }
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={openGeneralAssignTask}
          >
            + Assign Task
          </button>
        }
      />

      {/* Main Tab Switcher */}
      <div className="admin-applicant-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'Volunteer'}
          className={`admin-applicant-tab ${activeTab === 'Volunteer' ? 'admin-applicant-tab--active' : ''}`}
          onClick={() => {
            setActiveTab('Volunteer')
            bulk.setSelectedIds([])
          }}
        >
          <Users size={16} />
          <span>Volunteers</span>
          <span className="admin-applicant-tab__count">{volunteerCount}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'Intern'}
          className={`admin-applicant-tab ${activeTab === 'Intern' ? 'admin-applicant-tab--active' : ''}`}
          onClick={() => {
            setActiveTab('Intern')
            bulk.setSelectedIds([])
          }}
        >
          <GraduationCap size={16} />
          <span>Interns</span>
          <span className="admin-applicant-tab__count">{internCount}</span>
        </button>
      </div>

      <div className="volunteer-stats">
        <div
          className={`volunteer-stat volunteer-stat--clickable ${filters.values.status === 'all' ? 'volunteer-stat--active' : ''}`}
          onClick={() => filters.setValue('status', 'all')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', 'all') } }}
          title={`View all ${activeTab.toLowerCase()}s`}
        >
          <strong>{tabFilteredData.length}</strong>
          <span>Total {activeTab === 'Intern' ? 'Interns' : 'Volunteers'}</span>
        </div>
        <div
          className={`volunteer-stat volunteer-stat--clickable ${filters.values.status === 'Pending Review' ? 'volunteer-stat--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Pending Review' ? 'all' : 'Pending Review')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', filters.values.status === 'Pending Review' ? 'all' : 'Pending Review') } }}
          title={`Filter by Pending Review ${activeTab.toLowerCase()}s`}
        >
          <strong>{pendingCount}</strong>
          <span>Pending Review</span>
        </div>
        <div
          className={`volunteer-stat volunteer-stat--clickable ${['Approved', 'Active'].includes(filters.values.status) ? 'volunteer-stat--active' : ''}`}
          onClick={() => filters.setValue('status', ['Approved', 'Active'].includes(filters.values.status) ? 'all' : 'Approved')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', ['Approved', 'Active'].includes(filters.values.status) ? 'all' : 'Approved') } }}
          title={`Filter by Approved / Active ${activeTab.toLowerCase()}s`}
        >
          <strong>{activeCount}</strong>
          <span>Approved / Active</span>
        </div>
      </div>

      <FilterBar
        controller={filters}
        searchPlaceholder={
          activeTab === 'Intern'
            ? 'Search by ID, name, email, school, skill, or program...'
            : 'Search by ID, name, email, skill, or program...'
        }
        exportConfig={{
          filename: `${activeTab.toLowerCase()}-report`,
          title: `${activeTab} Report`,
          columns: activeColumns,
          rows: filters.filtered,
        }}
      />

      <ApiState loading={loading} error={error} message="Loading volunteers…" onRetry={reload}>
        <DataTable
          columns={activeColumns}
          data={filters.filtered}
          onRowClick={openVolunteer}
          pageSize={10}
          resetKey={`${activeTab}|${filters.search}|${JSON.stringify(filters.values)}`}
          selectable
          selectedIds={bulk.selectedIds}
          onSelectionChange={bulk.setSelectedIds}
          onBulkDelete={bulk.handleBulkDelete}
          deleting={bulk.deleting}
          bulkDeleteLabel="Delete Selected"
        />
      </ApiState>

      {/* Volunteer / Intern Manage Modal */}
      {selected && (
        <div className="admin-modal-overlay" onClick={closeVolunteer}>
          <div className="admin-modal admin-modal--xl volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={`${selected.name}`}
              subtitle={`${selected.applicantType === 'Intern' ? (selected.status === 'Pending Review' ? 'Intern Applicant (Pending Review)' : 'Intern') : (selected.status === 'Pending Review' ? 'Volunteer Applicant (Pending Review)' : 'Volunteer')} · ${selected.id} · ${selected.email || 'No email'}${selected.institution ? ` · ${selected.institution}` : ''}`}
              onClose={closeVolunteer}
            />

            <div className="volunteer-detail">
              <header className="volunteer-detail__hero">
                <div className="volunteer-detail__hero-main">
                  <div className="volunteer-detail__meta">
                    <span className="volunteer-type-badge">
                      {selected.applicantType === 'Intern' ? (
                        <><GraduationCap size={13} /> Intern</>
                      ) : (
                        <><Users size={13} /> Volunteer</>
                      )}
                    </span>
                    {selected.institution ? (
                      <span><School size={14} aria-hidden /> {selected.institution}</span>
                    ) : null}
                    <span><Mail size={14} aria-hidden /> {selected.email || '—'}</span>
                    {singleEnrolledProgram ? (
                      <span><Briefcase size={14} aria-hidden /> {singleEnrolledProgram}</span>
                    ) : null}
                    {selected.status === 'Approved' && (
                      <span><ListTodo size={14} aria-hidden /> {selected.assignedTasks || tasks.length} tasks</span>
                    )}
                    {selected.availability ? (
                      <span><CalendarDays size={14} aria-hidden /> {selected.availability}</span>
                    ) : null}
                    {selected.hasResume && selected.applicantType === 'Intern' ? (
                      <span className="volunteer-detail__cv-tag">
                        <FileText size={14} aria-hidden /> CV Attached
                      </span>
                    ) : null}
                    {hasDistributionTasks ? (
                      <span style={{ color: 'var(--admin-brand, #0f766e)', fontWeight: 600 }}>
                        <Truck size={14} aria-hidden /> Distribution Tasked
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="volunteer-detail__hero-aside" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <StatusBadge status={selected.status} />
                  {selected.userId ? <span className="volunteer-detail__pill">Portal linked</span> : null}
                  {selected.status === 'Pending Review' && (
                    <div className="volunteer-hero__actions" style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => handleApprove(selected)}
                        title="Approve application"
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: '1px solid #15803d',
                          fontWeight: 650,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '6px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => handleReject(selected)}
                        title="Reject application"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.85rem',
                          fontWeight: 650,
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </header>

              {/* ==============================================================
                  INTERN MODAL: 3 CLEAN TABS (Details, AI CV Matching, Assign Task)
                  ============================================================== */}
              {selected.applicantType === 'Intern' ? (
                <>
                  {/* Modal Tab Selector */}
                  <div className="intern-modal-tabs" role="tablist" aria-label="Intern View Tabs">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={internModalTab === 'details'}
                      className={`intern-modal-tab ${internModalTab === 'details' ? 'intern-modal-tab--active' : ''}`}
                      onClick={() => setInternModalTab('details')}
                    >
                      <Info size={15} />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={internModalTab === 'ai_matching'}
                      className={`intern-modal-tab ${internModalTab === 'ai_matching' ? 'intern-modal-tab--active' : ''}`}
                      onClick={() => setInternModalTab('ai_matching')}
                    >
                      <Sparkles size={15} className="ai-sparkle-icon" />
                      <span>AI CV Matching</span>
                      {singleEnrolledProgram ? (
                        <span className="intern-modal-tab__badge" title={`Enrolled in ${singleEnrolledProgram}`}>
                          <Lock size={10} />
                        </span>
                      ) : !hasMatchedSuitableProgram && aiRecs.length > 0 ? (
                        <span className="intern-modal-tab__badge intern-modal-tab__badge--alert" title="No matching program found in CV">
                          !
                        </span>
                      ) : null}
                    </button>

                    {selected.status === 'Approved' && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={internModalTab === 'tasks'}
                        className={`intern-modal-tab ${internModalTab === 'tasks' ? 'intern-modal-tab--active' : ''}`}
                        onClick={() => setInternModalTab('tasks')}
                      >
                        <ListTodo size={15} />
                        <span>Assign Task</span>
                        <span className="intern-modal-tab__badge">{tasks.length}</span>
                      </button>
                    )}
                  </div>

                  {/* TAB 1: DETAILS ONLY (Personal & Academic Info, Resume, Program) */}
                  {internModalTab === 'details' && (
                    <div className="volunteer-detail__two-col intern-tab-pane">
                      {/* Left Column: Profile & Academic Info */}
                      <div className="volunteer-detail__col">
                        <section className="volunteer-detail__card volunteer-detail__card--fullheight">
                          <h4>
                            <Info size={15} aria-hidden /> Intern Profile & Academic Info
                          </h4>
                          <dl className="volunteer-detail__list">
                            <div>
                              <dt>Full Name</dt>
                              <dd><strong>{selected.name}</strong></dd>
                            </div>
                            <div>
                              <dt>School / University / Institution</dt>
                              <dd>
                                <strong style={{ color: '#0f172a' }}>
                                  {selected.institution || 'Not specified'}
                                </strong>
                              </dd>
                            </div>
                            <div className="volunteer-detail__list-row">
                              <div>
                                <dt>Email Address</dt>
                                <dd style={{ wordBreak: 'break-word' }}>{selected.email || '—'}</dd>
                              </div>
                              <div>
                                <dt>Phone Number</dt>
                                <dd>{selected.phone || '—'}</dd>
                              </div>
                            </div>
                            <div className="volunteer-detail__list-row">
                              <div>
                                <dt>Availability & Schedule</dt>
                                <dd>{selected.availability || '—'}</dd>
                              </div>
                              <div>
                                <dt>Application Status</dt>
                                <dd><StatusBadge status={selected.status} /></dd>
                              </div>
                            </div>
                          </dl>
                        </section>
                      </div>

                      {/* Right Column: CV Document & Program Enrollment */}
                      <div className="volunteer-detail__col">
                        {/* Uploaded CV Document Card */}
                        <section className="volunteer-detail__card">
                          <h4>
                            <FileText size={15} aria-hidden /> Uploaded CV / Resume
                          </h4>
                          {selected.hasResume ? (
                            <div className="admin-resume-card">
                              <div className="admin-resume-card__preview">
                                <div className="admin-resume-card__icon-wrap">
                                  <FileText size={22} aria-hidden />
                                </div>
                                <div className="admin-resume-card__info">
                                  <strong className="admin-resume-card__title" title={selected.resumeFileName || 'Intern_Resume.pdf'}>
                                    {selected.resumeFileName || 'Intern_Resume.pdf'}
                                  </strong>
                                  <div className="admin-resume-card__meta-row">
                                    <span className="admin-resume-card__meta">
                                      {selected.resumeFileType || 'PDF'}
                                      {selected.resumeFileSize ? ` · ${(selected.resumeFileSize / (1024 * 1024)).toFixed(1)} MB` : ''}
                                    </span>
                                    <span className="admin-resume-card__status-pill">
                                      <CheckCircle2 size={11} aria-hidden /> Attached
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="admin-resume-card__actions">
                                <a
                                  href={selected.resumeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn--sm btn--primary admin-resume-card__btn"
                                >
                                  <ExternalLink size={13} aria-hidden /> View CV
                                </a>
                                <a
                                  href={`${selected.resumeUrl}&download=${encodeURIComponent(selected.resumeFileName || 'intern-resume.pdf')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  download={selected.resumeFileName || 'intern-resume.pdf'}
                                  className="btn btn--sm btn--outline admin-resume-card__btn"
                                >
                                  <Download size={13} aria-hidden /> Download
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="admin-resume-empty">
                              <FileText size={20} className="admin-resume-empty__icon" aria-hidden />
                              <span>No CV / Resume document attached.</span>
                            </div>
                          )}
                        </section>

                        {/* Program Enrollment Status Card */}
                        <section className="volunteer-detail__card">
                          <h4>
                            <Briefcase size={15} aria-hidden /> Program Enrollment (1 per Intern)
                          </h4>
                          {singleEnrolledProgram ? (
                            <div className="volunteer-program-enrolled-box">
                              <div className="volunteer-program-enrolled-info">
                                <span className="volunteer-program-label">Currently Enrolled:</span>
                                <div className="volunteer-program-name-wrap">
                                  <strong>{singleEnrolledProgram}</strong>
                                  <span className="volunteer-program-lock-pill">
                                    <Lock size={10} /> Locked
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn--sm btn--outline"
                                onClick={handleRemoveSingleProgram}
                                disabled={saving}
                              >
                                <Unlock size={12} /> Change / Remove
                              </button>
                            </div>
                          ) : (
                            <div className="volunteer-program-unassigned">
                              <p className="volunteer-program-hint">
                                No program enrolled yet. Select one via AI Matching tab or below.
                              </p>
                              <button
                                type="button"
                                className="btn btn--sm btn--primary"
                                onClick={() => setInternModalTab('ai_matching')}
                                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                              >
                                <Sparkles size={13} /> Open AI CV Matching
                              </button>
                            </div>
                          )}
                        </section>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: AI CV MATCHING (Strict & Evidence-Based) */}
                  {internModalTab === 'ai_matching' && (
                    <div className="intern-tab-pane">
                      {/* 1. Uploaded CV Document Card */}
                      <section className="volunteer-detail__card volunteer-detail__card--wide" style={{ marginBottom: '1.25rem' }}>
                        <h4>
                          <FileText size={16} aria-hidden /> Uploaded CV / Resume Document
                        </h4>
                        {selected.hasResume ? (
                          <div className="admin-resume-card">
                            <div className="admin-resume-card__preview">
                              <div className="admin-resume-card__icon-wrap">
                                <FileText size={22} aria-hidden />
                              </div>
                              <div className="admin-resume-card__info">
                                <strong className="admin-resume-card__title" title={selected.resumeFileName || 'Intern_Resume.pdf'}>
                                  {selected.resumeFileName || 'Intern_Resume.pdf'}
                                </strong>
                                <div className="admin-resume-card__meta-row">
                                  <span className="admin-resume-card__meta">
                                    {selected.resumeFileType || 'PDF'}
                                    {selected.resumeFileSize ? ` · ${(selected.resumeFileSize / (1024 * 1024)).toFixed(1)} MB` : ''}
                                  </span>
                                  <span className="admin-resume-card__status-pill">
                                    <CheckCircle2 size={11} aria-hidden /> Attached
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="admin-resume-card__actions">
                              <a
                                href={selected.resumeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn--sm btn--primary admin-resume-card__btn"
                              >
                                <ExternalLink size={13} aria-hidden /> View CV / Resume
                              </a>
                              <a
                                href={`${selected.resumeUrl}&download=${encodeURIComponent(selected.resumeFileName || 'intern-resume.pdf')}`}
                                target="_blank"
                                rel="noreferrer"
                                download={selected.resumeFileName || 'intern-resume.pdf'}
                                className="btn btn--sm btn--outline admin-resume-card__btn"
                              >
                                <Download size={13} aria-hidden /> Download File
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-resume-empty">
                            <FileText size={20} className="admin-resume-empty__icon" aria-hidden />
                            <span>No CV / Resume document was found for this intern record.</span>
                          </div>
                        )}
                      </section>

                      {/* 2. Enrolled Program Status Banner */}
                      <section className="volunteer-detail__card volunteer-detail__card--wide" style={{ marginBottom: '1.25rem', background: singleEnrolledProgram ? '#f0fdf4' : '#fffbeb', border: singleEnrolledProgram ? '1.5px solid #86efac' : '1.5px solid #fde68a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: singleEnrolledProgram ? '#166534' : '#92400e' }}>
                              Enrolled Program Status (1 Program per Intern)
                            </span>
                            <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {singleEnrolledProgram ? (
                                <>
                                  <strong style={{ fontSize: '1.05rem', color: '#14532d' }}>{singleEnrolledProgram}</strong>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.5rem', background: '#dcfce7', color: '#15803d', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                                    <Lock size={11} /> Locked
                                  </span>
                                </>
                              ) : (
                                <span style={{ color: '#78350f', fontSize: '0.92rem' }}>
                                  No program enrolled yet. Select a recommended program below.
                                </span>
                              )}
                            </div>
                          </div>
                          {singleEnrolledProgram && (
                            <button
                              type="button"
                              className="btn btn--sm btn--outline"
                              onClick={handleRemoveSingleProgram}
                              disabled={saving}
                              style={{ fontSize: '0.78rem' }}
                            >
                              <Unlock size={13} /> Change / Remove Program
                            </button>
                          )}
                        </div>
                      </section>

                      {/* 3. Strict Evidence-Based AI Analysis Header & Warning Banner */}
                      <section className="volunteer-detail__card volunteer-detail__card--wide ai-recs-section">
                        <div className="ai-recs-header">
                          <div className="ai-recs-header__title">
                            <Sparkles size={20} className="ai-sparkle-icon" />
                            <div>
                              <h4>Strict Evidence-Based AI CV Matching</h4>
                              <p>
                                Only matches programs when qualifications, education, and skills are explicitly verified in the CV. Does not assume unstated credentials.
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {aiSource ? (
                              <span className="ai-source-badge">
                                {aiSource === 'gemini_strict_ai' ? 'Google Gemini AI (Strict Evidence)' : 'Strict Evidence AI'}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn--sm btn--outline"
                              onClick={() => loadAiRecommendations(selected)}
                              disabled={aiLoading}
                            >
                              <RefreshCw size={13} />
                              {aiLoading ? 'Analyzing…' : 'Re-analyze CV'}
                            </button>
                          </div>
                        </div>

                        {/* CV Analysis Error Banner */}
                        {aiError && !aiLoading && (
                          <div className="ai-error-banner">
                            <AlertTriangle size={24} className="ai-error-banner__icon" />
                            <div>
                              <strong>CV could not be analyzed</strong>
                              <p>{aiError}. The AI matching engine requires searchable, verifiable text to generate accurate recommendations.</p>
                            </div>
                          </div>
                        )}

                        {/* Banner if No Suitable Program is Found */}
                        {!aiLoading && !aiError && aiRecs.length > 0 && !hasMatchedSuitableProgram && (
                          <div className="ai-no-match-banner">
                            <div className="ai-no-match-banner__icon">
                              <AlertTriangle size={24} />
                            </div>
                            <div className="ai-no-match-banner__content">
                              <strong>No Suitable Program Found in CV</strong>
                              <p>
                                The AI evaluated the uploaded CV and found insufficient verifiable evidence matching the core requirements of any available foundation program. No program has been assigned automatically. Admin retains the authority to review the CV or manually select a program below if desired.
                              </p>
                            </div>
                          </div>
                        )}

                        {aiLoading ? (
                          <LoadingSpinner message="Analyzing CV credentials with strict evidence matching…" />
                        ) : aiRecs.length === 0 && !aiError ? (
                          <div className="ai-empty-box">
                            <Sparkles size={24} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                            <p>Click "Re-analyze CV" to evaluate this intern against all available programs.</p>
                          </div>
                        ) : (
                          <div className="ai-recs-grid">
                            {aiRecs.map((rec) => {
                              const isEnrolled = singleEnrolledProgram === rec.program
                              const score = Number(rec.matchPercentage) || 0
                              const isStrong = rec.matchStatus === 'Strong Match' || score >= 80
                              const isModerate = rec.matchStatus === 'Moderate Match' || (score >= 55 && score < 80)
                              const isNoMatch = rec.matchStatus === 'No Match' || (!isStrong && !isModerate)

                              const scoreColor = isStrong ? '#16a34a' : isModerate ? '#2563eb' : '#94a3b8'
                              const statusLabel = isStrong ? 'Strong Match' : isModerate ? 'Moderate Match' : 'No Match'
                              const scoreClass = isStrong ? 'ai-match-badge--high' : isModerate ? 'ai-match-badge--medium' : 'ai-match-badge--nomatch'

                              // Matched Evidence items
                              const matchedItems = Array.isArray(rec.matchedEvidence)
                                ? rec.matchedEvidence.filter((e) => e && e !== 'None found in CV')
                                : (rec.evidenceQuote && rec.evidenceQuote !== 'No relevant evidence found in CV' ? [rec.evidenceQuote] : [])

                              // Missing Requirements items
                              const missingItems = Array.isArray(rec.missingRequirements)
                                ? rec.missingRequirements.filter((m) => m && m !== 'None')
                                : (Array.isArray(rec.missingSkills) ? rec.missingSkills : [])

                              return (
                                <article
                                  key={rec.program}
                                  className={`ai-rec-card ${isEnrolled ? 'ai-rec-card--selected' : ''} ${isNoMatch ? 'ai-rec-card--nomatch' : ''}`}
                                  style={isEnrolled ? { border: '2px solid #16a34a', background: '#f0fdf4' } : {}}
                                >
                                  {/* 1. Header: Program Name & Match Percentage */}
                                  <div className="ai-rec-card__top">
                                    <div>
                                      <span className="ai-rec-card__field-label">PROGRAM</span>
                                      <strong className="ai-rec-card__program-name">{rec.program}</strong>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <span className="ai-rec-card__field-label">MATCH</span>
                                      <span className={`ai-match-badge ${scoreClass}`}>
                                        {score}% · {statusLabel}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Progress meter */}
                                  <div className="ai-rec-meter">
                                    <div
                                      className="ai-rec-meter__fill"
                                      style={{ width: `${Math.max(score, isNoMatch ? 4 : score)}%`, backgroundColor: scoreColor }}
                                    />
                                  </div>

                                  {/* 2. Matched Evidence */}
                                  <div className="ai-factor-row" style={{ marginTop: '0.65rem' }}>
                                    <span className="ai-factor-label">Matched Evidence:</span>
                                    <div className="ai-factor-tags">
                                      {matchedItems.length > 0 ? (
                                        matchedItems.map((ev, i) => (
                                          <span key={i} className="ai-factor-tag ai-factor-tag--matched">
                                            <Check size={11} /> {ev}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="ai-factor-tag ai-factor-tag--none">None found in CV</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* 3. Missing Requirements */}
                                  <div className="ai-factor-row" style={{ marginTop: '0.45rem' }}>
                                    <span className="ai-factor-label">Missing Requirements:</span>
                                    <div className="ai-factor-tags">
                                      {missingItems.length > 0 ? (
                                        missingItems.map((mis, i) => (
                                          <span key={i} className="ai-factor-tag ai-factor-tag--missing" title="Required by program but absent in CV">
                                            <XCircle size={11} /> {mis}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="ai-factor-tag ai-factor-tag--matched">
                                          <Check size={11} /> None (All Requirements Met)
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* 4. Reason */}
                                  {(rec.reason || rec.explanation) && (
                                    <div className="ai-reason-box">
                                      <strong>Reason:</strong> {rec.reason || rec.explanation}
                                    </div>
                                  )}

                                  {/* 5. Action Buttons */}
                                  <div className="ai-rec-card__action">
                                    {isEnrolled ? (
                                      <span className="badge badge--success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.82rem' }}>
                                        <Check size={14} /> Enrolled Program (Locked)
                                      </span>
                                    ) : singleEnrolledProgram ? (
                                      <button
                                        type="button"
                                        className="btn btn--sm btn--outline"
                                        onClick={() => handleSetSingleProgram(rec.program, isNoMatch)}
                                        disabled={saving}
                                        title={`Switch enrolled program from ${singleEnrolledProgram} to ${rec.program}`}
                                      >
                                        Switch to this Program
                                      </button>
                                    ) : isStrong || isModerate ? (
                                      <button
                                        type="button"
                                        className="btn btn--sm btn--primary"
                                        onClick={() => handleSetSingleProgram(rec.program, false)}
                                        disabled={saving}
                                      >
                                        + Select & Enroll in Program
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn--sm btn--ghost"
                                        onClick={() => handleSetSingleProgram(rec.program, true)}
                                        disabled={saving}
                                        title="Admin override: Assign this program despite limited CV evidence"
                                        style={{ fontSize: '0.76rem', color: '#64748b' }}
                                      >
                                        + Assign Anyway (Admin Override)
                                      </button>
                                    )}
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    </div>
                  )}

                  {/* TAB 3: ASSIGN TASK & HOURS (Separate & focused 2-column layout) */}
                  {internModalTab === 'tasks' && (
                    <div className="intern-tab-pane">
                      {/* Duty Hours Summary */}
                      <div className="volunteer-hours-summary" style={{ marginBottom: '1rem' }}>
                        <div className="volunteer-hours-card">
                          <Clock3 size={16} aria-hidden />
                          <div>
                            <strong>{hoursForm.hours || 0}</strong>
                            <span>Rendered hours</span>
                          </div>
                        </div>
                        <div className="volunteer-hours-card">
                          <ListTodo size={16} aria-hidden />
                          <div>
                            <strong>{hoursForm.requiredHours || 0}</strong>
                            <span>Required hours</span>
                          </div>
                        </div>
                        <div className="volunteer-hours-card volunteer-hours-card--accent">
                          <UserCheck size={16} aria-hidden />
                          <div>
                            <strong>{remaining}</strong>
                            <span>Remaining hours</span>
                          </div>
                        </div>
                      </div>

                      <div className="volunteer-detail__two-col">
                        {/* Left Column: Task Assignment & Hours Form */}
                        <div className="volunteer-detail__col">
                          {/* Direct Assign Task Form */}
                          <section className="volunteer-detail__card">
                            <h4>
                              <ListTodo size={15} aria-hidden /> Assign Duty Task to {selected.name}
                            </h4>
                            {['Completed', 'Rejected'].includes(selected.status) ? (
                              <div className="action-locked-banner action-locked-banner--accent" style={{ marginBottom: '0.85rem' }}>
                                <Lock size={15} />
                                <span>This intern profile is <strong>{selected.status}</strong> (finalized). New task assignment and duty hours edits are locked.</span>
                              </div>
                            ) : singleEnrolledProgram ? (
                              <p style={{ fontSize: '0.8rem', color: '#166534', margin: '-0.2rem 0 0.75rem', background: '#f0fdf4', padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                <Lock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                                Enrolled in <strong>{singleEnrolledProgram}</strong>
                              </p>
                            ) : (
                              <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '-0.2rem 0 0.75rem', background: '#fffbeb', padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #fde68a' }}>
                                ⚠️ No program enrolled yet. You can assign to any program below or choose one in AI Matching.
                              </p>
                            )}
                            <form onSubmit={handleCreateDirectTask}>
                              <label>
                                <Req required>Task Title</Req>
                                <input
                                  required
                                  disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                  value={directTaskForm.title}
                                  onChange={(e) => setDirectTaskForm({ ...directTaskForm, title: e.target.value })}
                                  placeholder="e.g. Assist in Food Prep, Support Youth Literacy"
                                />
                              </label>

                              <label>
                                <Req required>Program / Project</Req>
                                {enrolledPrograms.length > 0 ? (
                                  <select
                                    required
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={directTaskForm.module || enrolledPrograms[0]}
                                    onChange={(e) => {
                                      const nextModule = e.target.value
                                      const isDist = isDistributionProgram(nextModule)
                                      setDirectTaskForm((prev) => ({
                                        ...prev,
                                        module: nextModule,
                                        distributionId: isDist ? prev.distributionId : '',
                                      }))
                                    }}
                                  >
                                    {enrolledPrograms.map((p) => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <select
                                    required
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={directTaskForm.module}
                                    onChange={(e) => {
                                      const nextModule = e.target.value
                                      const isDist = isDistributionProgram(nextModule)
                                      setDirectTaskForm((prev) => ({
                                        ...prev,
                                        module: nextModule,
                                        distributionId: isDist ? prev.distributionId : '',
                                      }))
                                    }}
                                  >
                                    <option value="">Select a Program…</option>
                                    {programOptions.map((p) => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                )}
                              </label>

                              <div className="form-row">
                                <label>
                                  Priority
                                  <select
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={directTaskForm.priority}
                                    onChange={(e) => setDirectTaskForm({ ...directTaskForm, priority: e.target.value })}
                                  >
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                    <option>Critical</option>
                                  </select>
                                </label>
                                <label>
                                  Due Date
                                  <input
                                    type="date"
                                    min={getTodayDateString()}
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={directTaskForm.dueDate}
                                    onChange={(e) => setDirectTaskForm({ ...directTaskForm, dueDate: e.target.value })}
                                  />
                                </label>
                              </div>

                              <div className="form-row">
                                <label>
                                  Duty Start
                                  <input
                                    type="time"
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={directTaskForm.dutyStart}
                                    onChange={(e) => setDirectTaskForm({ ...directTaskForm, dutyStart: e.target.value })}
                                  />
                                </label>
                                <label>
                                  Duty End
                                  <input
                                    type="time"
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={directTaskForm.dutyEnd}
                                    onChange={(e) => setDirectTaskForm({ ...directTaskForm, dutyEnd: e.target.value })}
                                  />
                                </label>
                              </div>

                              <label>
                                <Req required>Duty Hours</Req>
                                <input
                                  type="number"
                                  min="0.25"
                                  step="0.25"
                                  required
                                  disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                  value={directTaskForm.dutyHours}
                                  onChange={(e) => setDirectTaskForm({ ...directTaskForm, dutyHours: e.target.value })}
                                  placeholder="e.g. 4"
                                />
                              </label>

                              {/* Link to Distribution (Conditional) */}
                              {isDistributionProgram(directTaskForm.module) && (
                                <label>
                                  <Req required>Link to Distribution Event</Req>
                                  <select
                                    required
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={directTaskForm.distributionId}
                                    onChange={(e) => {
                                      const distributionId = e.target.value
                                      const dist = linkableDistributions.find((d) => String(d.dbId) === distributionId)
                                      setDirectTaskForm((prev) => ({
                                        ...prev,
                                        distributionId,
                                        title: prev.title || (dist
                                          ? `Delivery — ${dist.id || dist.eventName || dist.location || 'Distribution'}`
                                          : prev.title),
                                      }))
                                    }}
                                  >
                                    <option value="">Select a distribution event…</option>
                                    {linkableDistributions.map((d) => (
                                      <option key={d.dbId} value={d.dbId}>
                                        {d.id} · {d.status} · {d.eventName || d.location || 'Distribution'}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}

                              <button
                                type="submit"
                                className="btn btn--primary btn--sm"
                                disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                              >
                                {saving ? 'Assigning…' : ['Completed', 'Rejected'].includes(selected.status) ? 'Assignment Locked (Finalized)' : `+ Assign Task to ${selected.name}`}
                              </button>
                            </form>
                          </section>

                          {/* Hours Tracking Update Card */}
                          <section className="volunteer-detail__card">
                            <h4>
                              <Clock3 size={15} aria-hidden /> Update Duty Hours Record
                            </h4>
                            <form className="volunteer-hours-form" onSubmit={handleSaveHours}>
                              <div className="form-row">
                                <label>
                                  Rendered hours
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={hoursForm.hours}
                                    onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })}
                                  />
                                </label>
                                <label>
                                  Required hours
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                    value={hoursForm.requiredHours}
                                    onChange={(e) => setHoursForm({ ...hoursForm, requiredHours: e.target.value })}
                                  />
                                </label>
                              </div>
                              <button
                                type="submit"
                                className="btn btn--sm btn--outline"
                                disabled={saving || ['Completed', 'Rejected'].includes(selected.status)}
                                style={{ width: '100%', justifyContent: 'center' }}
                              >
                                {['Completed', 'Rejected'].includes(selected.status) ? 'Hours Locked (Finalized)' : 'Save Duty Hours'}
                              </button>
                            </form>
                          </section>
                        </div>

                        {/* Right Column: Assigned Tasks List */}
                        <div className="volunteer-detail__col">
                          <section className="volunteer-detail__card volunteer-detail__card--tasks">
                            <div className="volunteer-panel-section__head">
                              <div className="volunteer-tasks-title-wrap">
                                <h4>
                                  <ListTodo size={15} aria-hidden /> Assigned Tasks
                                </h4>
                                <span className="volunteer-tasks-count-pill">{tasks.length}</span>
                              </div>
                            </div>
                            {tasksLoading ? (
                              <p className="beneficiary-view-empty">Loading tasks…</p>
                            ) : tasks.length === 0 ? (
                              <div className="volunteer-tasks-empty-state">
                                <ListTodo size={28} className="volunteer-tasks-empty-icon" />
                                <p>No tasks assigned to this intern yet.</p>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Use the assignment form on the left to assign duties.</p>
                              </div>
                            ) : (
                              <div className="volunteer-tasks-scroll-container">
                                <div className="see-more-wrap">
                                  <div className="volunteer-task-list">
                                    {tasksSeeMore.visible.map((t) => (
                                      <article key={t.dbId || t.id} className="volunteer-task-card">
                                        <div className="volunteer-task-card__top">
                                          <strong>{t.title}</strong>
                                          <StatusBadge status={t.status || t.boardColumn} />
                                        </div>
                                        <div className="volunteer-task-card__meta">
                                          <span>Priority: {t.priority}</span>
                                          <span>Due: {t.due || '—'}</span>
                                          {t.dutyLabel ? <span>Duty: {t.dutyLabel}</span> : null}
                                          {t.module ? <span>Program: {t.module}</span> : null}
                                          {t.distributionCode || t.distributionId ? (
                                            <span style={{ color: 'var(--admin-brand, #af101a)', fontWeight: 600 }}>
                                              Distribution: {t.distributionCode || `DST-${t.distributionId}`}
                                              {t.distributionStatus ? ` · ${t.distributionStatus}` : ''}
                                            </span>
                                          ) : null}
                                          {(t.requiredSkills || []).length ? (
                                            <span>Skills: {(t.requiredSkills || []).join(', ')}</span>
                                          ) : null}
                                          {t.completedAtLabel ? <span>Completed: {t.completedAtLabel}</span> : null}
                                        </div>
                                        {!(t.status === 'Completed' || t.boardColumn === 'done' || t.isDone || ['Completed', 'Rejected'].includes(selected.status)) ? (
                                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.65rem' }}>
                                            <button
                                              type="button"
                                              className="btn btn--sm btn--primary"
                                              onClick={() => handleAdminCompleteTask(t)}
                                              disabled={saving}
                                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                            >
                                              <CheckCircle2 size={13} /> Complete Task
                                            </button>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#f0fdf4', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                              <CheckCircle2 size={12} /> {['Completed', 'Rejected'].includes(selected.status) ? 'Assignment Locked' : 'Completed & Locked'}
                                            </span>
                                          </div>
                                        )}
                                      </article>
                                    ))}
                                  </div>
                                  {tasksSeeMore.needsToggle && (
                                    <SeeMoreToggle
                                      expanded={tasksSeeMore.expanded}
                                      onToggle={tasksSeeMore.toggle}
                                      hiddenCount={tasksSeeMore.hiddenCount}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </section>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ==============================================================
                   VOLUNTEER MODAL: Clean Two-Column Organized Layout
                   ============================================================== */
                <div className="volunteer-detail__two-col">
                  {/* Left Column: Profile & Program Enrollment */}
                  <div className="volunteer-detail__col">
                    {/* Profile Card */}
                    <section className="volunteer-detail__card">
                      <h4>
                        <User size={15} aria-hidden /> Volunteer Profile
                      </h4>
                      <dl className="volunteer-detail__list">
                        <div>
                          <dt>Full Name</dt>
                          <dd><strong>{selected.name}</strong></dd>
                        </div>
                        <div className="volunteer-detail__list-row">
                          <div>
                            <dt>Email Address</dt>
                            <dd>{selected.email || '—'}</dd>
                          </div>
                          <div>
                            <dt>Phone Number</dt>
                            <dd>{selected.phone || '—'}</dd>
                          </div>
                        </div>
                        <div className="volunteer-detail__list-row">
                          <div>
                            <dt>Availability</dt>
                            <dd>{selected.availability || '—'}</dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd><StatusBadge status={selected.status} /></dd>
                          </div>
                        </div>
                        <div>
                          <dt>Skills & Expertise</dt>
                          <dd>
                            <ChipList items={selected.skills} empty="No skills listed" />
                            {selected.skillsOther ? (
                              <p className="volunteer-detail__note">Other: {selected.skillsOther}</p>
                            ) : null}
                          </dd>
                        </div>
                      </dl>
                    </section>

                    {/* 1-Program Rule: Enrolled Program Card */}
                    <section className="volunteer-detail__card">
                      <h4>
                        <Briefcase size={15} aria-hidden /> Program Enrollment (1 per Volunteer)
                      </h4>
                      {singleEnrolledProgram ? (
                        <div className="volunteer-program-enrolled-box">
                          <div className="volunteer-program-enrolled-info">
                            <span className="volunteer-program-label">Currently Enrolled:</span>
                            <div className="volunteer-program-name-wrap">
                              <strong>{singleEnrolledProgram}</strong>
                              <span className="volunteer-program-lock-pill">
                                <Lock size={10} /> Locked
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn--sm btn--outline"
                            onClick={handleRemoveSingleProgram}
                            disabled={saving}
                          >
                            <Unlock size={12} /> Change / Remove
                          </button>
                        </div>
                      ) : (
                        <div className="volunteer-program-unassigned">
                          <p className="volunteer-program-hint">
                            No program enrolled yet. Select a program to enroll this volunteer.
                          </p>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              handleSetSingleProgram()
                            }}
                            className="volunteer-program-enroll-form"
                          >
                            <label className="volunteer-program-form-label">
                              <span>Select Program:</span>
                              <select
                                value={selectedProgramToEnroll}
                                onChange={(e) => setSelectedProgramToEnroll(e.target.value)}
                              >
                                <option value="">Select a program…</option>
                                {programOptions.map((prog) => (
                                  <option key={prog} value={prog}>{prog}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="submit"
                              className="btn btn--primary btn--sm"
                              disabled={saving || !selectedProgramToEnroll}
                            >
                              + Enroll
                            </button>
                          </form>
                        </div>
                      )}
                    </section>
                  </div>

                  {/* Right Column: Assigned Tasks */}
                  <div className="volunteer-detail__col">
                    <section className="volunteer-detail__card volunteer-detail__card--tasks">
                      <div className="volunteer-panel-section__head">
                        <div className="volunteer-tasks-title-wrap">
                          <h4>
                            <ListTodo size={15} aria-hidden /> Assigned Tasks
                          </h4>
                          {selected.status === 'Approved' && (
                            <span className="volunteer-tasks-count-pill">{tasks.length}</span>
                          )}
                        </div>
                        {selected.status === 'Approved' && (
                          <button
                            type="button"
                            className="btn btn--sm btn--primary"
                            onClick={openAssignTaskForSelected}
                          >
                            + Assign Task
                          </button>
                        )}
                      </div>

                      {selected.status === 'Pending Review' ? (
                        <div className="volunteer-tasks-empty-state" style={{ padding: '2.25rem 1.5rem', textAlign: 'center' }}>
                          <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: '#fef3c7',
                            color: '#b45309',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 0.75rem',
                          }}>
                            <Lock size={22} />
                          </div>
                          <strong style={{ display: 'block', fontSize: '0.92rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                            Task Assignment Unavailable
                          </strong>
                          <p style={{ fontSize: '0.84rem', color: '#64748b', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>
                            This volunteer is currently <strong>Pending Review</strong>. Tasks can only be assigned after the application is approved.
                          </p>
                        </div>
                      ) : selected.status === 'Rejected' ? (
                        <div className="volunteer-tasks-empty-state" style={{ padding: '2.25rem 1.5rem', textAlign: 'center' }}>
                          <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: '#fee2e2',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 0.75rem',
                          }}>
                            <Lock size={22} />
                          </div>
                          <strong style={{ display: 'block', fontSize: '0.92rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                            Task Assignment Locked
                          </strong>
                          <p style={{ fontSize: '0.84rem', color: '#64748b', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>
                            This volunteer application was <strong>Rejected</strong>. Tasks cannot be assigned.
                          </p>
                        </div>
                      ) : ['Completed'].includes(selected.status) ? (
                        <div className="action-locked-banner action-locked-banner--accent" style={{ margin: '0.5rem 0 0.85rem' }}>
                          <Lock size={14} />
                          <span>This volunteer record is <strong>{selected.status}</strong> (finalized). Task assignment is locked.</span>
                        </div>
                      ) : null}

                      {selected.status === 'Approved' && (
                        tasksLoading ? (
                          <p className="beneficiary-view-empty">Loading tasks…</p>
                        ) : tasks.length === 0 ? (
                          <div className="volunteer-tasks-empty-state">
                            <ListTodo size={28} className="volunteer-tasks-empty-icon" />
                            <p>No tasks assigned to this volunteer yet.</p>
                            <button
                              type="button"
                              className="btn btn--sm btn--outline"
                              onClick={openAssignTaskForSelected}
                            >
                              + Create First Task
                            </button>
                          </div>
                        ) : (
                          <div className="volunteer-tasks-scroll-container">
                          <div className="see-more-wrap">
                            <div className="volunteer-task-list">
                              {tasksSeeMore.visible.map((t) => (
                                <article key={t.dbId || t.id} className="volunteer-task-card">
                                  <div className="volunteer-task-card__top">
                                    <strong>{t.title}</strong>
                                    <StatusBadge status={t.status || t.boardColumn} />
                                  </div>
                                  <div className="volunteer-task-card__meta">
                                    <span>Priority: {t.priority}</span>
                                    <span>Due: {t.due || '—'}</span>
                                    {t.module ? <span>Program: {t.module}</span> : null}
                                    {t.distributionCode || t.distributionId ? (
                                      <span style={{ color: 'var(--admin-brand, #af101a)', fontWeight: 600 }}>
                                        Distribution: {t.distributionCode || `DST-${t.distributionId}`}
                                        {t.distributionStatus ? ` · ${t.distributionStatus}` : ''}
                                      </span>
                                    ) : null}
                                    {(t.requiredSkills || []).length ? (
                                      <span>Skills: {(t.requiredSkills || []).join(', ')}</span>
                                    ) : null}
                                    {t.completedAtLabel ? <span>Completed: {t.completedAtLabel}</span> : null}
                                  </div>
                                  {!(t.status === 'Completed' || t.boardColumn === 'done' || t.isDone || ['Completed', 'Rejected'].includes(selected.status)) ? (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.65rem' }}>
                                      <button
                                        type="button"
                                        className="btn btn--sm btn--primary"
                                        onClick={() => handleAdminCompleteTask(t)}
                                        disabled={saving}
                                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                      >
                                        <CheckCircle2 size={13} /> Complete Task
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#f0fdf4', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                        <CheckCircle2 size={12} /> {['Completed', 'Rejected'].includes(selected.status) ? 'Assignment Locked' : 'Completed & Locked'}
                                      </span>
                                    </div>
                                  )}
                                </article>
                              ))}
                            </div>
                            {tasksSeeMore.needsToggle && (
                              <SeeMoreToggle
                                expanded={tasksSeeMore.expanded}
                                onToggle={tasksSeeMore.toggle}
                                hiddenCount={tasksSeeMore.hiddenCount}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                </div>
              )}
            </div>

            <div className="admin-modal__actions admin-modal__actions--split" style={{ marginTop: '1.25rem' }}>
              <button type="button" className="btn btn--ghost" onClick={closeVolunteer}>Close</button>
              <button type="button" className="btn btn--danger" onClick={() => handleDelete(selected)}>
                <Trash2 size={15} /> Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. MAIN GENERAL ASSIGN TASK MODAL (Outside Manage) */}
      {showGeneralTaskModal && (
        <div className="admin-modal-overlay" onClick={() => setShowGeneralTaskModal(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Assign Task — General Task Management"
              onClose={() => setShowGeneralTaskModal(false)}
            />
            <form onSubmit={handleCreateGeneralTask}>
              <div className="task-banner-general">
                <Briefcase size={18} />
                <div>
                  <strong>General Task Management</strong>
                  <span>Create, schedule, and assign duty tasks to active volunteers and interns across programs.</span>
                </div>
              </div>

              {/* Multi-Member Selection */}
              <label>
                <Req required>Assign to Member(s)</Req>
                <div className="volunteer-multi-actions">
                  <span>{generalSelectedVolunteerIds.length} of {activeAssigneesList.length} active member(s) selected</span>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setGeneralSelectedVolunteerIds(activeAssigneesList.map((v) => String(v.dbId)))}
                    >
                      Select All Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeneralSelectedVolunteerIds([])}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
                <div className="volunteer-multi-grid">
                  {activeAssigneesList.map((v) => {
                    const isChecked = generalSelectedVolunteerIds.includes(String(v.dbId))
                    const isIntern = v.applicantType === 'Intern'
                    return (
                      <label
                        key={v.dbId}
                        className={`volunteer-multi-grid__item${isChecked ? ' volunteer-multi-grid__item--selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const val = String(v.dbId)
                            if (e.target.checked) {
                              setGeneralSelectedVolunteerIds((prev) => [...prev, val])
                            } else {
                              setGeneralSelectedVolunteerIds((prev) => prev.filter((id) => id !== val))
                            }
                          }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.name}
                            <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: isIntern ? '#ede9fe' : '#e0f2fe', color: isIntern ? '#6b21a8' : '#0369a1', fontWeight: 600 }}>
                              {isIntern ? 'Intern' : 'Volunteer'}
                            </span>
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.id} · {(v.programs || [])[0] || 'General'}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </label>

              {/* Program Selector */}
              <label>
                <Req required>Program / Project</Req>
                <select
                  required
                  value={generalTaskForm.module}
                  onChange={(e) => {
                    const nextModule = e.target.value
                    const isDist = isDistributionProgram(nextModule)
                    setGeneralTaskForm((prev) => ({
                      ...prev,
                      module: nextModule,
                      title: '',
                      distributionId: isDist ? prev.distributionId : '',
                    }))
                  }}
                >
                  <option value="">Select a Program…</option>
                  {programOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>

              {/* Task Title Dropdown connected to program */}
              <label>
                <Req required>Task Title</Req>
                <select
                  required
                  value={generalTaskForm.title}
                  onChange={(e) => setGeneralTaskForm({ ...generalTaskForm, title: e.target.value })}
                >
                  <option value="">
                    {generalTaskTitleOptions.length > 0 ? 'Select a task title…' : 'No task titles for this program'}
                  </option>
                  {generalTaskTitleOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {generalTaskForm.title && !generalTaskTitleOptions.includes(generalTaskForm.title) && (
                    <option value={generalTaskForm.title}>{generalTaskForm.title}</option>
                  )}
                </select>
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                  {generalTaskForm.module
                    ? `Showing active task titles assigned to "${generalTaskForm.module}".`
                    : 'Select a program above to view available task titles.'}
                </span>
              </label>

              <div className="form-row">
                <label>
                  Priority
                  <select
                    value={generalTaskForm.priority}
                    onChange={(e) => setGeneralTaskForm({ ...generalTaskForm, priority: e.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    type="date"
                    min={getTodayDateString()}
                    value={generalTaskForm.dueDate}
                    onChange={(e) => setGeneralTaskForm({ ...generalTaskForm, dueDate: e.target.value })}
                  />
                </label>
              </div>

              {/* Required Skills Dropdown */}
              <label>
                Required Skills
                <select
                  value={selectedSkillToAdd}
                  onChange={(e) => {
                    const skill = e.target.value
                    if (skill && !generalTaskForm.requiredSkills.includes(skill)) {
                      const updated = [...generalTaskForm.requiredSkills, skill]
                      setGeneralTaskForm({ ...generalTaskForm, requiredSkills: updated })
                      loadSuggestions(updated, null)
                    }
                    setSelectedSkillToAdd('')
                  }}
                >
                  <option value="">Select a required skill to add…</option>
                  {volunteerSkillOptions.map((s) => (
                    <option key={s} value={s} disabled={generalTaskForm.requiredSkills.includes(s)}>
                      {s} {generalTaskForm.requiredSkills.includes(s) ? '✓ (Selected)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {generalTaskForm.requiredSkills.length > 0 && (
                <div className="task-selected-skills-tags">
                  {generalTaskForm.requiredSkills.map((skill) => (
                    <span key={skill} className="task-skill-tag">
                      {skill}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = generalTaskForm.requiredSkills.filter((s) => s !== skill)
                          setGeneralTaskForm({ ...generalTaskForm, requiredSkills: updated })
                          loadSuggestions(updated, null)
                        }}
                        aria-label={`Remove ${skill}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Link to Distribution (Conditional) */}
              {isDistributionProgram(generalTaskForm.module) && (
                <label>
                  <Req required>Link to Distribution Event</Req>
                  <select
                    required
                    value={generalTaskForm.distributionId}
                    onChange={(e) => {
                      const distributionId = e.target.value
                      const dist = linkableDistributions.find((d) => String(d.dbId) === distributionId)
                      setGeneralTaskForm((prev) => ({
                        ...prev,
                        distributionId,
                        title: prev.title || (dist
                          ? `Delivery — ${dist.id || dist.eventName || dist.location || 'Distribution'}`
                          : prev.title),
                      }))
                    }}
                  >
                    <option value="">Select a distribution event…</option>
                    {linkableDistributions.map((d) => (
                      <option key={d.dbId} value={d.dbId}>
                        {d.id} · {d.status} · {d.eventName || d.location || 'Distribution'}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Skill Matching Suggestions */}
              {generalTaskForm.requiredSkills.length > 0 && (
                <section className="suggested-volunteers" style={{ marginTop: '0.75rem' }}>
                  <div className="suggested-volunteers__head">
                    <h4>Suggested Member Matches</h4>
                    <span>Ranked by skill match · programs · availability</span>
                  </div>
                  {suggestionsLoading ? (
                    <p className="beneficiary-view-empty">Finding matches…</p>
                  ) : suggestions.length === 0 ? (
                    <p className="beneficiary-view-empty">No active members matched these skills yet.</p>
                  ) : (
                    <ul className="suggested-volunteers__list">
                      {suggestions.map((s) => {
                        const isAssigned = generalSelectedVolunteerIds.includes(String(s.dbId))
                        return (
                          <li
                            key={s.dbId}
                            className={`suggested-volunteers__item${isAssigned ? ' suggested-volunteers__item--current' : ''}`}
                          >
                            <div>
                              <strong>{s.name}</strong>
                              {isAssigned ? <span className="suggested-volunteers__badge">Assigned</span> : null}
                              <p>{s.whyMatched}</p>
                            </div>
                            <button
                              type="button"
                              className={`btn btn--sm ${isAssigned ? 'btn--outline' : 'btn--primary'}`}
                              onClick={() => {
                                const idStr = String(s.dbId)
                                if (isAssigned) {
                                  setGeneralSelectedVolunteerIds((prev) => prev.filter((id) => id !== idStr))
                                } else {
                                  setGeneralSelectedVolunteerIds((prev) => [...prev, idStr])
                                }
                              }}
                            >
                              {isAssigned ? 'Remove' : '+ Add to Assigned'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )}

              <div className="admin-modal__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowGeneralTaskModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || !generalSelectedVolunteerIds.length}
                >
                  {generalSelectedVolunteerIds.length > 1
                    ? `Assign Task to ${generalSelectedVolunteerIds.length} Members`
                    : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. DIRECT ASSIGN TASK MODAL (Outside / inside triggered) */}
      {showDirectTaskModal && selected && (
        <div className="admin-modal-overlay" onClick={() => setShowDirectTaskModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={`Assign Task — ${selected.name}`}
              onClose={() => setShowDirectTaskModal(false)}
            />
            <form onSubmit={handleCreateDirectTask}>
              <div className="task-banner-direct">
                <UserCheck size={18} />
                <div>
                  <strong>Direct Task Assignment for {selected.name} ({selected.id})</strong>
                  <span>
                    {selected.applicantType === 'Intern' ? 'Intern' : 'Volunteer'} · Enrolled: {(selected.programs || [])[0] || 'General'}
                    {selected.applicantType === 'Intern' ? ` · Hours: ${selected.hours || 0}/${selected.requiredHours || 0}` : ''}
                  </span>
                </div>
              </div>

              {/* Program Selector */}
              <label>
                <Req required>Program / Project</Req>
                {enrolledPrograms.length > 0 ? (
                  <select
                    required
                    value={directTaskForm.module || enrolledPrograms[0]}
                    onChange={(e) => {
                      const nextModule = e.target.value
                      const isDist = isDistributionProgram(nextModule)
                      setDirectTaskForm((prev) => ({
                        ...prev,
                        module: nextModule,
                        title: '',
                        distributionId: isDist ? prev.distributionId : '',
                      }))
                    }}
                  >
                    {enrolledPrograms.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    required
                    value={directTaskForm.module}
                    onChange={(e) => {
                      const nextModule = e.target.value
                      const isDist = isDistributionProgram(nextModule)
                      setDirectTaskForm((prev) => ({
                        ...prev,
                        module: nextModule,
                        title: '',
                        distributionId: isDist ? prev.distributionId : '',
                      }))
                    }}
                  >
                    <option value="">Select a Program…</option>
                    {programOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </label>

              {/* Task Title Dropdown connected to program */}
              <label>
                <Req required>Task Title</Req>
                <select
                  required
                  value={directTaskForm.title}
                  onChange={(e) => setDirectTaskForm({ ...directTaskForm, title: e.target.value })}
                >
                  <option value="">
                    {directTaskTitleOptions.length > 0 ? 'Select a task title…' : 'No task titles for this program'}
                  </option>
                  {directTaskTitleOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {directTaskForm.title && !directTaskTitleOptions.includes(directTaskForm.title) && (
                    <option value={directTaskForm.title}>{directTaskForm.title}</option>
                  )}
                </select>
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                  {directTaskForm.module
                    ? `Showing active task titles assigned to "${directTaskForm.module}".`
                    : 'Select a program above to view available task titles.'}
                </span>
              </label>

              <div className="form-row">
                <label>
                  Priority
                  <select
                    value={directTaskForm.priority}
                    onChange={(e) => setDirectTaskForm({ ...directTaskForm, priority: e.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    type="date"
                    min={getTodayDateString()}
                    value={directTaskForm.dueDate}
                    onChange={(e) => setDirectTaskForm({ ...directTaskForm, dueDate: e.target.value })}
                  />
                </label>
              </div>

              {selected.applicantType === 'Intern' && (
                <>
                  <div className="form-row">
                    <label>
                      Duty Start
                      <input
                        type="time"
                        value={directTaskForm.dutyStart}
                        onChange={(e) => setDirectTaskForm({ ...directTaskForm, dutyStart: e.target.value })}
                      />
                    </label>
                    <label>
                      Duty End
                      <input
                        type="time"
                        value={directTaskForm.dutyEnd}
                        onChange={(e) => setDirectTaskForm({ ...directTaskForm, dutyEnd: e.target.value })}
                      />
                    </label>
                  </div>

                  <label>
                    <Req required>Duty Hours</Req>
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      required
                      value={directTaskForm.dutyHours}
                      onChange={(e) => setDirectTaskForm({ ...directTaskForm, dutyHours: e.target.value })}
                      placeholder="e.g. 4"
                    />
                  </label>
                </>
              )}

              {/* Link to Distribution (Conditional) */}
              {isDistributionProgram(directTaskForm.module) && (
                <label>
                  <Req required>Link to Distribution Event</Req>
                  <select
                    required
                    value={directTaskForm.distributionId}
                    onChange={(e) => {
                      const distributionId = e.target.value
                      const dist = linkableDistributions.find((d) => String(d.dbId) === distributionId)
                      setDirectTaskForm((prev) => ({
                        ...prev,
                        distributionId,
                        title: prev.title || (dist
                          ? `Delivery — ${dist.id || dist.eventName || dist.location || 'Distribution'}`
                          : prev.title),
                      }))
                    }}
                  >
                    <option value="">Select a distribution event…</option>
                    {linkableDistributions.map((d) => (
                      <option key={d.dbId} value={d.dbId}>
                        {d.id} · {d.status} · {d.eventName || d.location || 'Distribution'}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="admin-modal__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowDirectTaskModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {`Assign to ${selected.name}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
