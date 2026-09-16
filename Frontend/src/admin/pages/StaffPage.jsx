import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  ListTodo,
  Mail,
  UserCog,
  Trash2,
  Pencil,
  Building2,
  Phone,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Check,
  Calendar,
  MapPin,
} from 'lucide-react'
import { createStaffAccount, getStaff, updateStaff, deleteStaff, tasksApi } from '../../api/resources'
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
import NameFields from '../../components/shared/NameFields'
import { emptyNameParts, formatFullName } from '../../utils/personName'
import { notify } from '../../utils/toast'
import { confirmAction, showSuccessModal } from '../../utils/confirm'
import { emailError, phoneError } from '../../utils/validation'
import PhoneInput from '../../components/shared/PhoneInput'
import { useCatalogOptions } from '../../hooks/useCatalogOptions'
import { VOLUNTEER_PROGRAMS } from '../../constants/options'
import { useTaskTitles } from '../../hooks/useTaskTitles'
import { useLoading } from '../../context/LoadingContext'

const filterConfig = {
  searchKeys: ['id', 'name', 'email', 'firstName', 'lastName'],
  filters: [
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
  ],
}

const emptyForm = {
  ...emptyNameParts(),
  email: '',
  phone: '',
  birthDate: '',
  address: '',
  emergencyContactNumber: '',
  emergencyContactRelation: '',
  role: 'Staff',
  acceptedTerms: true,
  acceptedPrivacy: true,
  acceptedPolicies: true,
}

const emptyTaskForm = {
  title: '',
  priority: 'Medium',
  dueDate: '',
  module: 'Operations',
}

/**
 * Admin portal — Staff account management & task assignment only.
 * Admin accounts are managed separately by Super Admin at /admin/admins.
 */
export default function StaffPage() {
  const [searchParams] = useSearchParams()
  const { data, loading, error, reload } = useApiList(() => getStaff())
  const staffData = useMemo(
    () => (Array.isArray(data) ? data.filter((row) => row.role === 'Staff') : []),
    [data],
  )
  const filters = useFilters(staffData, filterConfig)
  const { options: programCatalogOptions } = useCatalogOptions('volunteer_programs', VOLUNTEER_PROGRAMS)
  const staffProgramOptions = useMemo(() => {
    const list = Array.isArray(programCatalogOptions) ? [...programCatalogOptions] : []
    const defaults = ['Operations', 'Donations', 'Inventory', 'Distributions']
    defaults.forEach((d) => {
      if (!list.includes(d)) list.push(d)
    })
    return list
  }, [programCatalogOptions])
  const [showForm, setShowForm] = useState(false)
  const { showLoading, hideLoading } = useLoading()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [openedViaEdit, setOpenedViaEdit] = useState(false)
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const tasksSeeMore = useSeeMore(tasks, 4)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const { options: staffTaskTitleOptions } = useTaskTitles(taskForm.module)
  const [successMsg, setSuccessMsg] = useState('')

  const completedTasksCount = useMemo(() => {
    return tasks.filter((t) => (t.status || t.boardColumn) === 'done' || (t.status || t.boardColumn) === 'Completed').length
  }, [tasks])

  const pendingTasksCount = useMemo(() => {
    return tasks.length - completedTasksCount
  }, [tasks, completedTasksCount])

  // Legacy deep-link from when Admin accounts lived under Staff
  if (searchParams.get('role') === 'Admin') {
    return <Navigate to="/admin/admins" replace />
  }

  const loadTasks = async (staff) => {
    if (!staff) {
      setTasks([])
      return
    }
    setTasksLoading(true)
    try {
      const res = await tasksApi.list(`?assigneeUserId=${staff.dbId}&mine=0`)
      setTasks(Array.isArray(res.data) ? res.data : (res.list || []))
    } catch {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }

  const openStaff = (row, startInEditMode = false) => {
    if (row.role !== 'Staff') {
      notify.warning('Admin accounts are managed under Admin Management.')
      return
    }
    setSelected(row)
    setIsEditing(startInEditMode)
    setOpenedViaEdit(startInEditMode)
    setEditForm({
      lastName: row.lastName || '',
      firstName: row.firstName || '',
      middleInitial: row.middleInitial || '',
      email: row.email || '',
      phone: row.phone || '',
      birthDate: row.birthDate || row.dateOfBirth || '',
      address: row.address || '',
      emergencyContactNumber: row.emergencyContactNumber || row.emergencyContactPhone || '',
      emergencyContactRelation: row.emergencyContactRelation || '',
      status: row.status === 'Inactive' ? 'Inactive' : 'Active',
    })
    loadTasks(row)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSuccessMsg('')
    if (!form.lastName.trim() || !form.firstName.trim()) {
      notify.warning('Last Name and First Name are required.')
      return
    }
    const emailMsg = emailError(form.email)
    if (emailMsg) {
      notify.warning(emailMsg)
      return
    }
    const phoneMsg = phoneError(form.phone, { required: false, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    if (form.emergencyContactNumber) {
      const ecMsg = phoneError(form.emergencyContactNumber, { required: false, allowInternational: true })
      if (ecMsg) {
        notify.warning(`Emergency Contact: ${ecMsg}`)
        return
      }
    }
    const ok = await confirmAction({
      title: 'Create Staff Account',
      message: `Create a staff portal account for ${formatFullName(form)} (${form.email}) and email their temporary password?`,
      confirmText: 'Create & Email Credentials',
      type: 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Saving…')
    try {
      const res = await createStaffAccount({
        lastName: form.lastName,
        firstName: form.firstName,
        middleInitial: form.middleInitial,
        name: formatFullName(form),
        email: form.email,
        phone: form.phone,
        birthDate: form.birthDate,
        address: form.address,
        emergencyContactNumber: form.emergencyContactNumber,
        emergencyContactRelation: form.emergencyContactRelation,
        role: 'Staff',
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedPolicies: true,
      })
      if (!res?.ok && !res?.data) {
        throw new Error(res?.error || 'Failed to create staff account.')
      }
      if (res?.credentialsSent) {
        const msg = res.message || 'Staff account created and credentials emailed successfully.'
        setSuccessMsg(msg)
        notify.success(msg)
        showSuccessModal('Credentials successfully sent.')
      } else {
        const temp = res?.temporaryPassword
          ? `\n\nTemporary password (share securely): ${res.temporaryPassword}`
          : ''
        const mailHint = res?.mailError ? `\nMail note: ${res.mailError}` : ''
        setSuccessMsg(
          (res?.message || 'Staff account created.')
          + temp
          + mailHint
          + '\n\nTip: run `npm run mail` with a valid Gmail App Password to email credentials automatically.',
        )
        notify.warning(
          [
            res?.message || 'Staff account was created.',
            res?.temporaryPassword ? `Temporary password: ${res.temporaryPassword}` : '',
            res?.mailError ? `Email issue: ${res.mailError}` : 'Credential email was not delivered.',
            'Share the temporary password securely, or fix mail settings and recreate/resend later.',
          ].filter(Boolean).join('. '),
        )
        showSuccessModal('Successfully added.')
      }
      setShowForm(false)
      setForm(emptyForm)
      reload()
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!selected || !editForm) return
    if (!editForm.lastName.trim() || !editForm.firstName.trim()) {
      notify.warning('Last Name and First Name are required.')
      return
    }
    const emailMsg = emailError(editForm.email)
    if (emailMsg) {
      notify.warning(emailMsg)
      return
    }
    const phoneMsg = phoneError(editForm.phone, { required: false, allowInternational: true })
    if (phoneMsg) {
      notify.warning(phoneMsg)
      return
    }
    if (editForm.emergencyContactNumber) {
      const ecMsg = phoneError(editForm.emergencyContactNumber, { required: false, allowInternational: true })
      if (ecMsg) {
        notify.warning(`Emergency Contact: ${ecMsg}`)
        return
      }
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      await updateStaff(selected.dbId, {
        lastName: editForm.lastName,
        firstName: editForm.firstName,
        middleInitial: editForm.middleInitial,
        email: editForm.email,
        phone: editForm.phone,
        birthDate: editForm.birthDate,
        address: editForm.address,
        emergencyContactNumber: editForm.emergencyContactNumber,
        emergencyContactRelation: editForm.emergencyContactRelation,
        status: editForm.status,
      })
      notify.success('Staff profile updated.')
      showSuccessModal('Successfully updated.')
      reload()
      setSelected((prev) => (prev ? {
        ...prev,
        ...editForm,
        name: formatFullName(editForm),
      } : null))
      setIsEditing(false)
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirmAction({
      title: 'Delete Staff Account',
      message: `Are you sure you want to permanently delete staff account "${row.name}" (${row.email})? This action removes the account from the system and database and cannot be undone.`,
      confirmText: 'Delete Staff',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting staff…')
    try {
      await deleteStaff(row.dbId)
      notify.success(`Staff account "${row.name}" deleted.`)
      showSuccessModal('Successfully deleted.')
      if (selected?.dbId === row.dbId) {
        setSelected(null)
      }
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to delete staff account')
    } finally {
      hideLoading()
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!selected) return
    if (['Inactive', 'Suspended', 'Terminated'].includes(selected.status)) {
      notify.error(`Cannot assign task: ${selected.name}'s account is ${selected.status}.`)
      return
    }
    if (taskForm.dueDate && isPastDateString(taskForm.dueDate)) {
      notify.error('Due date cannot be in the past. Please select today or a future date.')
      return
    }
    setSaving(true)
    showLoading('Saving…')
    try {
      await tasksApi.create({
        title: taskForm.title,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null,
        module: taskForm.module || 'Operations',
        assigneeUserId: selected.dbId,
        assignee: selected.name,
        boardColumn: 'todo',
      })
      setShowTaskForm(false)
      setTaskForm(emptyTaskForm)
      loadTasks(selected)
      notify.success('Task assigned successfully.')
      showSuccessModal('Successfully added.')
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const handleCompleteTask = async (task) => {
    if (!task?.dbId && !task?.id) return
    const id = task.dbId || task.id
    const ok = await confirmAction({
      title: 'Complete Task',
      message: `Mark task "${task.title}" as completed for ${selected?.name || 'this staff member'}?`,
      confirmText: 'Mark Completed',
      type: 'primary',
    })
    if (!ok) return

    setSaving(true)
    showLoading('Updating task…')
    try {
      await tasksApi.update(id, { boardColumn: 'done', status: 'Completed' })
      notify.success(`Task "${task.title}" marked as completed.`)
      showSuccessModal('Task marked as completed.')
      if (selected) loadTasks(selected)
      reload()
    } catch (err) {
      notify.error(err.message || 'Failed to update task')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openStaff(row, false)}>Manage</button>
          <button type="button" className="btn btn--sm btn--outline" onClick={() => openStaff(row, true)}>
            <Pencil size={13} /> Edit
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={() => handleDelete(row)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Staff Accounts"
        description="Create Staff accounts, email temporary credentials, and assign operational tasks."
        actions={(
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setForm(emptyForm)
              setShowForm(true)
              setSuccessMsg('')
            }}
          >
            + Add Staff
          </button>
        )}
      />

      {successMsg ? (
        <div className="admin-banner admin-banner--success" role="status">{successMsg}</div>
      ) : null}

      <div className="admin-stats-grid admin-stats-grid--compact" style={{ marginBottom: '1.25rem' }}>
        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'all' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', 'all')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', 'all') } }}
          title="View all staff members"
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Total Staff</span>
            <UserCog className="admin-stat-card__icon" size={15} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{staffData.length}</span>
          </div>
        </div>
        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'Active' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Active' ? 'all' : 'Active')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', filters.values.status === 'Active' ? 'all' : 'Active') } }}
          title="Filter by Active staff"
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Active Staff</span>
            <UserCog className="admin-stat-card__icon" size={15} style={{ color: '#16a34a' }} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{staffData.filter((s) => s.status === 'Active').length}</span>
          </div>
        </div>
        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'Inactive' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Inactive' ? 'all' : 'Inactive')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filters.setValue('status', filters.values.status === 'Inactive' ? 'all' : 'Inactive') } }}
          title="Filter by Inactive staff"
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Inactive Staff</span>
            <UserCog className="admin-stat-card__icon" size={15} style={{ color: '#dc2626' }} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{staffData.filter((s) => s.status !== 'Active').length}</span>
          </div>
        </div>
      </div>

      <FilterBar controller={filters} searchPlaceholder="Search by ID, name, or email..." />
      <ApiState loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={(row) => openStaff(row, false)}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
        />
      </ApiState>

      {selected && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            setSelected(null)
            setIsEditing(false)
          }}
        >
          <div className="admin-modal admin-modal--xl volunteer-manage-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={isEditing ? `Edit Staff Profile — ${selected.name}` : selected.name}
              subtitle={
                isEditing
                  ? `${selected.id} · Staff Member · Edit contact details, status, and profile information`
                  : `${selected.id} · Staff Member · ${selected.email || 'No email registered'}`
              }
              onClose={() => {
                setSelected(null)
                setIsEditing(false)
              }}
            />

            {isEditing && editForm ? (
              <form onSubmit={handleUpdateProfile} className="volunteer-edit-profile-form">
                <div className="admin-form-grid-2col">
                  {/* Left Column Card: Personal Details & Emergency Contact */}
                  <div className="admin-form-card">
                    <div className="admin-form-card__header">
                      <h4 className="admin-form-card__title">
                        <UserCog size={15} aria-hidden /> Personal & Emergency Details
                      </h4>
                    </div>
                    <div className="admin-form-card__body">
                      <div>
                        <NameFields
                          value={editForm}
                          onChange={(parts) => setEditForm({ ...editForm, ...parts })}
                        />
                      </div>

                      <div className="form-row">
                        <label>
                          <span>Date of Birth</span>
                          <input
                            type="date"
                            value={editForm.birthDate}
                            onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                          />
                        </label>
                        <label>
                          <span>Account Status</span>
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </label>
                      </div>

                      <div className="form-row">
                        <label>
                          <span>Emergency Contact Number</span>
                          <PhoneInput
                            allowInternational
                            value={editForm.emergencyContactNumber}
                            onChange={(num) => setEditForm({ ...editForm, emergencyContactNumber: num })}
                          />
                        </label>
                        <label>
                          <span>Relationship</span>
                          <input
                            type="text"
                            placeholder="e.g., Parent, Spouse, Sibling"
                            value={editForm.emergencyContactRelation}
                            onChange={(e) => setEditForm({ ...editForm, emergencyContactRelation: e.target.value })}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column Card: Contact & Location Details */}
                  <div className="admin-form-card">
                    <div className="admin-form-card__header">
                      <h4 className="admin-form-card__title">
                        <Mail size={15} aria-hidden /> Contact & Location Details
                      </h4>
                    </div>
                    <div className="admin-form-card__body">
                      <label>
                        <Req required>Email Address</Req>
                        <input
                          type="email"
                          required
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          placeholder="staff@riseabovefoundation.org"
                        />
                      </label>

                      <label>
                        <span>Phone Number</span>
                        <PhoneInput
                          allowInternational
                          value={editForm.phone}
                          onChange={(phone) => setEditForm({ ...editForm, phone })}
                        />
                      </label>

                      <label>
                        <span>Home Address</span>
                        <input
                          type="text"
                          placeholder="e.g., Cebu City, Philippines"
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="admin-modal__actions" style={{ justifyContent: 'flex-start' }}>
                  <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      if (openedViaEdit) {
                        setSelected(null)
                        setIsEditing(false)
                      } else {
                        setIsEditing(false)
                        setEditForm({
                          lastName: selected.lastName || '',
                          firstName: selected.firstName || '',
                          middleInitial: selected.middleInitial || '',
                          email: selected.email || '',
                          phone: selected.phone || '',
                          birthDate: selected.birthDate || selected.dateOfBirth || '',
                          address: selected.address || '',
                          emergencyContactNumber: selected.emergencyContactNumber || selected.emergencyContactPhone || '',
                          emergencyContactRelation: selected.emergencyContactRelation || '',
                          status: selected.status === 'Inactive' ? 'Inactive' : 'Active',
                        })
                      }
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="volunteer-detail">
                {/* Hero Summary Header */}
                <header className="volunteer-detail__hero">
                  <div className="volunteer-detail__hero-main">
                    <div className="volunteer-detail__meta">
                      <span className="volunteer-type-badge">
                        <UserCog size={13} aria-hidden /> Staff
                      </span>
                      <span>
                        <Building2 size={14} aria-hidden /> {selected.department || 'Operations'}
                      </span>
                      <span>
                        <Mail size={14} aria-hidden /> {selected.email || '—'}
                      </span>
                      <span>
                        <Phone size={14} aria-hidden /> {selected.phone || '—'}
                      </span>
                      <span>
                        <ListTodo size={14} aria-hidden /> {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                      </span>
                    </div>
                  </div>
                  <div className="volunteer-detail__hero-aside">
                    <StatusBadge status={selected.status} />
                    {selected.status === 'Active' ? (
                      <span className="volunteer-detail__pill">Staff Portal Active</span>
                    ) : null}
                  </div>
                </header>

                {/* 2-Column Responsive Layout */}
                <div className="volunteer-detail__two-col">
                  {/* Left Column: Staff Profile & Stats */}
                  <div className="volunteer-detail__col">
                    {/* Profile Information Card */}
                    <section className="volunteer-detail__card">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.85rem',
                        }}
                      >
                        <h4 style={{ margin: 0 }}>
                          <UserCog size={15} aria-hidden /> Staff Profile Details
                        </h4>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={() => setIsEditing(true)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Pencil size={12} /> Edit Profile
                        </button>
                      </div>

                      <dl className="volunteer-detail__list">
                        <div className="volunteer-detail__list-row">
                          <div>
                            <dt>Full Name</dt>
                            <dd>
                              <strong>{selected.name || formatFullName(selected) || '—'}</strong>
                            </dd>
                          </div>
                          <div>
                            <dt>Staff ID</dt>
                            <dd>
                              <code
                                style={{
                                  fontSize: '0.82rem',
                                  background: '#f1f5f9',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                }}
                              >
                                {selected.id}
                              </code>
                            </dd>
                          </div>
                        </div>

                        <div className="volunteer-detail__list-row">
                          <div>
                            <dt>Role & Department</dt>
                            <dd>Staff · {selected.department || 'Operations'}</dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>
                              <StatusBadge status={selected.status} />
                            </dd>
                          </div>
                        </div>

                        <div className="volunteer-detail__list-row">
                          <div>
                            <dt>Email</dt>
                            <dd style={{ wordBreak: 'break-all' }}>{selected.email || '—'}</dd>
                          </div>
                          <div>
                            <dt>Phone Number</dt>
                            <dd>{selected.phone || '—'}</dd>
                          </div>
                        </div>

                        <div className="volunteer-detail__list-row">
                          <div>
                            <dt>Date of Birth</dt>
                            <dd>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Calendar size={13} style={{ color: '#64748b' }} />
                                {selected.birthDate || selected.dateOfBirth || '—'}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt>Emergency Contact</dt>
                            <dd>
                              {selected.emergencyContactNumber ? (
                                <span>
                                  {selected.emergencyContactNumber}
                                  {selected.emergencyContactRelation
                                    ? ` (${selected.emergencyContactRelation})`
                                    : ''}
                                </span>
                              ) : (
                                '—'
                              )}
                            </dd>
                          </div>
                        </div>

                        <div>
                          <dt>Address</dt>
                          <dd>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <MapPin size={13} style={{ color: '#64748b' }} />
                              {selected.address || '—'}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </section>

                    {/* Task Metrics Summary Card */}
                    <section className="volunteer-detail__card">
                      <h4>
                        <CheckCircle2 size={15} aria-hidden /> Tasks Metric Summary
                      </h4>
                      <div className="volunteer-hours-summary">
                        <div className="volunteer-hours-card">
                          <ListTodo size={16} aria-hidden />
                          <div>
                            <strong>{tasks.length}</strong>
                            <span>Total Tasks</span>
                          </div>
                        </div>
                        <div className="volunteer-hours-card">
                          <Clock size={16} aria-hidden />
                          <div>
                            <strong>{pendingTasksCount}</strong>
                            <span>Pending</span>
                          </div>
                        </div>
                        <div className="volunteer-hours-card volunteer-hours-card--accent">
                          <CheckCircle2 size={16} aria-hidden />
                          <div>
                            <strong>{completedTasksCount}</strong>
                            <span>Completed</span>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Assigned Tasks List */}
                  <div className="volunteer-detail__col">
                    <section className="volunteer-detail__card volunteer-detail__card--tasks">
                      <div className="volunteer-panel-section__head" style={{ marginBottom: '0.85rem' }}>
                        <div className="volunteer-tasks-title-wrap">
                          <h4 style={{ margin: 0 }}>
                            <ListTodo size={15} aria-hidden /> Assigned Tasks
                          </h4>
                          <span className="volunteer-tasks-count-pill">{tasks.length}</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          onClick={() => setShowTaskForm(true)}
                          disabled={['Inactive', 'Suspended', 'Terminated'].includes(selected.status)}
                          title={
                            ['Inactive', 'Suspended', 'Terminated'].includes(selected.status)
                              ? 'Cannot assign tasks to an inactive staff member'
                              : 'Assign a task'
                          }
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          + Assign Task
                        </button>
                      </div>

                      {['Inactive', 'Suspended', 'Terminated'].includes(selected.status) && (
                        <div
                          className="action-locked-banner action-locked-banner--accent"
                          style={{ margin: '0 0 0.85rem' }}
                        >
                          <UserCog size={14} />
                          <span>
                            This staff account is <strong>{selected.status}</strong>. Task assignment is locked.
                          </span>
                        </div>
                      )}

                      {tasksLoading ? (
                        <p className="beneficiary-view-empty">Loading tasks…</p>
                      ) : tasks.length === 0 ? (
                        <div className="volunteer-tasks-empty-state">
                          <ListTodo size={32} className="volunteer-tasks-empty-icon" />
                          <p style={{ fontWeight: 600, color: '#334155' }}>No tasks assigned yet</p>
                          <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '280px', margin: '0 auto' }}>
                            Assign operational tasks or program duties to this staff member using the button above.
                          </p>
                        </div>
                      ) : (
                        <div className="see-more-wrap">
                          <div className="volunteer-task-list">
                            {tasksSeeMore.visible.map((t) => {
                              const isDone =
                                (t.status || t.boardColumn) === 'done' ||
                                (t.status || t.boardColumn) === 'Completed'
                              const priorityColor =
                                t.priority === 'High' || t.priority === 'Critical'
                                  ? '#dc2626'
                                  : t.priority === 'Medium'
                                  ? '#d97706'
                                  : '#64748b'

                              return (
                                <article key={t.dbId || t.id} className="volunteer-task-card">
                                  <div className="volunteer-task-card__top">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                      <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{t.title}</strong>
                                      {t.module ? (
                                        <span
                                          style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            color: '#475569',
                                            background: '#f1f5f9',
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '4px',
                                          }}
                                        >
                                          {t.module}
                                        </span>
                                      ) : null}
                                    </div>
                                    <StatusBadge status={t.status || t.boardColumn} />
                                  </div>

                                  <div className="volunteer-task-card__meta">
                                    <span>
                                      Priority:{' '}
                                      <strong style={{ color: priorityColor }}>{t.priority}</strong>
                                    </span>
                                    <span>Due: {t.due || t.dueDate || '—'}</span>
                                    {t.completedAtLabel ? (
                                      <span>Completed: {t.completedAtLabel}</span>
                                    ) : null}
                                  </div>

                                  {!isDone && (
                                    <div
                                      style={{
                                        marginTop: '0.65rem',
                                        paddingTop: '0.5rem',
                                        borderTop: '1px dashed #e2e8f0',
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="btn btn--sm btn--ghost"
                                        onClick={() => handleCompleteTask(t)}
                                        style={{
                                          fontSize: '0.78rem',
                                          padding: '0.2rem 0.6rem',
                                          color: '#16a34a',
                                          fontWeight: 600,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.3rem',
                                        }}
                                      >
                                        <Check size={13} /> Mark Completed
                                      </button>
                                    </div>
                                  )}
                                </article>
                              )
                            })}
                          </div>
                          {tasksSeeMore.needsToggle && (
                            <SeeMoreToggle
                              expanded={tasksSeeMore.expanded}
                              onToggle={tasksSeeMore.toggle}
                              hiddenCount={tasksSeeMore.hiddenCount}
                            />
                          )}
                        </div>
                      )}

                      <p className="volunteer-panel-hint" style={{ marginTop: '0.85rem' }}>
                        <UserCog size={14} /> Staff mark tasks complete from Staff Portal → My Tasks. First login requires a password change.
                      </p>
                    </section>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div
                  className="admin-modal__actions admin-modal__actions--split"
                  style={{ marginTop: '1.25rem' }}
                >
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => handleDelete(selected)}
                  >
                    <Trash2 size={14} /> Delete Staff Account
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showTaskForm && selected && (
        <div className="admin-modal-overlay" onClick={() => setShowTaskForm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={`Assign Task — ${selected.name}`} onClose={() => setShowTaskForm(false)} />
            <form onSubmit={handleCreateTask}>
              <label>
                <Req required>Program / Project</Req>
                <select
                  required
                  value={taskForm.module}
                  onChange={(e) => {
                    const nextModule = e.target.value
                    setTaskForm((prev) => ({
                      ...prev,
                      module: nextModule,
                      title: '',
                    }))
                  }}
                >
                  <option value="">Select a Program / Project…</option>
                  {staffProgramOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  {taskForm.module && !staffProgramOptions.includes(taskForm.module) && (
                    <option value={taskForm.module}>{taskForm.module}</option>
                  )}
                </select>
              </label>

              <label>
                <Req required>Task Title</Req>
                <select
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                >
                  <option value="">
                    {staffTaskTitleOptions.length > 0 ? 'Select a task title…' : 'No task titles for this program'}
                  </option>
                  {staffTaskTitleOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {taskForm.title && !staffTaskTitleOptions.includes(taskForm.title) && (
                    <option value={taskForm.title}>{taskForm.title}</option>
                  )}
                </select>
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                  {taskForm.module
                    ? `Showing active task titles assigned to "${taskForm.module}".`
                    : 'Select a program above to view available task titles.'}
                </span>
              </label>

              <div className="form-row">
                <label>
                  Priority
                  <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    type="date"
                    min={getTodayDateString()}
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-modal__actions">
                <button type="submit" className="btn btn--primary" disabled={saving || !taskForm.title}>Assign Task</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowTaskForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Create Staff Account" onClose={() => setShowForm(false)} />
            <form onSubmit={handleSave}>
              <NameFields
                value={form}
                onChange={(parts) => setForm({ ...form, ...parts })}
              />
              <div className="form-row">
                <label>
                  <Req required>Email</Req>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@email.com" />
                </label>
                <label>
                  Phone Number
                  <PhoneInput
                    allowInternational
                    value={form.phone}
                    onChange={(phone) => setForm({ ...form, phone })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Date of Birth
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                </label>
                <label>
                  Address
                  <input
                    type="text"
                    placeholder="e.g., Cebu City, Philippines"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Emergency Contact Number
                  <PhoneInput
                    allowInternational
                    value={form.emergencyContactNumber}
                    onChange={(num) => setForm({ ...form, emergencyContactNumber: num })}
                  />
                </label>
                <label>
                  Emergency Contact Relation
                  <input
                    type="text"
                    placeholder="e.g., Parent, Spouse, Sibling"
                    value={form.emergencyContactRelation}
                    onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-modal__actions" style={{ marginTop: '1.25rem' }}>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  Create & Email Credentials
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
