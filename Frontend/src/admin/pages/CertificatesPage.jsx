import { useState, useEffect, useMemo } from 'react'
import {
  Award,
  Download,
  Eye,
  Pencil,
  Printer,
  Trash2,
  FileCheck,
  Clock,
  Sparkles,
  Upload,
  X,
  Image as ImageIcon,
  CheckCircle2,
  PenTool,
  Sliders,
  RefreshCw,
  Plus,
  ShieldCheck,
  UserCheck,
  Check,
} from 'lucide-react'
import {
  certificatesApi,
  volunteersApi,
  donorsApi,
  donationsApi,
  signatoriesApi,
  certificateCaptionApi,
} from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'
import { useFilters } from '../../hooks/useFilters'
import PageHeader from '../components/shared/PageHeader'
import DataTable from '../components/shared/DataTable'
import StatusBadge from '../components/shared/StatusBadge'
import ApiState from '../components/shared/ApiState'
import FilterBar from '../components/shared/FilterBar'
import CertificateView from '../../components/shared/CertificateView'
import { printCertificate } from '../../components/shared/printCertificate'
import ModalHeader from '../components/shared/ModalHeader'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm'
import { notifyBadgesChanged } from '../../utils/badgeSync'
import {
  CERTIFICATE_WORKFLOW,
  CERTIFICATE_TERMINAL,
  getAvailableNextStatuses,
  validateStatusTransition,
  isTerminalStatus,
} from '../../utils/workflow'
import { getTodayDateString } from '../../utils/date'
import { useLoading } from '../../context/LoadingContext'
import {
  CERTIFICATE_TEMPLATES,
  PHOTO_LAYOUTS,
  CAPTION_TEMPLATES,
} from '../../components/shared/certificateHelpers'

const CERT_TYPES = [
  'Certificate of Donation',
  'Acknowledgment of Donation',
  'Certificate of Volunteer Service',
  'Certificate of Participation',
  'Certificate of Appreciation',
  'Special Recognition',
]

const STATUS_OPTIONS = CERTIFICATE_WORKFLOW

const filterConfig = {
  searchKeys: ['id', 'recipient', 'reference', 'type', 'signatoryName'],
  filters: [
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Type' },
    { key: 'recipientType', label: 'Recipient', allLabel: 'All Recipients' },
  ],
  dateKey: 'date',
}

const emptyForm = {
  type: 'Certificate of Donation',
  templateId: 'modern_classic',
  recipientType: 'Donor',
  recipientKey: '',
  recipient: '',
  reference: '',
  details: '',
  signatoryId: null,
  signatoryName: 'Flemming Hansen',
  signatoryTitle: 'CEO and Co-Founder',
  signatureUrl: 'sig_flemming_hansen.png',
  photoUrl: '',
  photoDisplayUrl: '',
  photoLayout: 'none',
  contributionDetails: '',
  certDate: new Date().toISOString().slice(0, 10),
  location: 'Cebu City, Philippines',
  status: 'Generated',
}

export default function CertificatesPage() {
  const { data, loading, error, reload } = useApiList(() => certificatesApi.list())
  const { data: volunteers } = useApiList(() => volunteersApi.list())
  const { data: donors } = useApiList(() => donorsApi.list())
  const { data: donations } = useApiList(() => donationsApi.list())
  const { data: signatories, reload: reloadSignatories } = useApiList(() => signatoriesApi.list())

  const [showForm, setShowForm] = useState(false)
  const [showSignatoriesModal, setShowSignatoriesModal] = useState(false)
  const { showLoading, hideLoading } = useLoading()
  const [editRow, setEditRow] = useState(null)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // AI & Caption Assistant state
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [selectedTone, setSelectedTone] = useState('Professional')
  const [shortCaptionSuggestion, setShortCaptionSuggestion] = useState('')

  // New signatory form state
  const [newSigForm, setNewSigForm] = useState({
    name: '',
    title: '',
    organization: 'Rise Above Foundation Cebu, Inc.',
    signatureImage: '',
    isDefault: false,
  })
  const [savingSig, setSavingSig] = useState(false)

  const filters = useFilters(data, filterConfig)

  // Auto-set default signatory when signatories list loads
  useEffect(() => {
    if (signatories && signatories.length > 0 && !form.signatoryId && !editRow) {
      const def = signatories.find((s) => s.isDefault) || signatories[0]
      if (def) {
        setForm((prev) => ({
          ...prev,
          signatoryId: def.id,
          signatoryName: def.name,
          signatoryTitle: def.title,
          signatureUrl: def.signatureImage || 'sig_flemming_hansen.png',
        }))
      }
    }
  }, [signatories, form.signatoryId, editRow])

  const openCreate = () => {
    setEditRow(null)
    const def = signatories?.find((s) => s.isDefault) || signatories?.[0]
    setForm({
      ...emptyForm,
      signatoryId: def?.id || null,
      signatoryName: def?.name || 'Flemming Hansen',
      signatoryTitle: def?.title || 'CEO and Co-Founder',
      signatureUrl: def?.signatureImage || 'sig_flemming_hansen.png',
    })
    setAiInstruction('')
    setShortCaptionSuggestion('')
    setShowForm(true)
  }

  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      type: row.type,
      templateId: row.templateId || 'modern_classic',
      recipientType: row.recipientType || 'Donor',
      recipientKey: '',
      recipient: row.recipient,
      reference: row.reference || '',
      details: row.details || '',
      signatoryId: row.signatoryId || null,
      signatoryName: row.signatoryName || 'Flemming Hansen',
      signatoryTitle: row.signatoryTitle || 'CEO and Co-Founder',
      signatureUrl: row.signatureUrl || 'sig_flemming_hansen.png',
      photoUrl: row.photoUrl || '',
      photoDisplayUrl: row.photoDisplayUrl || row.photoUrl || '',
      photoLayout: row.photoLayout || 'none',
      contributionDetails: row.contributionDetails || '',
      certDate: row.certDate || new Date().toISOString().slice(0, 10),
      location: row.location || 'Cebu City, Philippines',
      status: row.status,
    })
    setAiInstruction('')
    setShortCaptionSuggestion('')
    setShowForm(true)
  }

  // Handle donor / volunteer pick with real database contribution mapping
  const handleRecipientPick = (key) => {
    if (!key) {
      setForm((prev) => ({
        ...prev,
        recipientKey: '',
        recipient: '',
        reference: '',
        details: '',
        contributionDetails: '',
      }))
      return
    }

    if (form.recipientType === 'Volunteer') {
      const vol = volunteers?.find((v) => String(v.dbId) === key)
      if (!vol) return

      let progDesc = 'community outreach programs'
      try {
        if (vol.programs) {
          const arr = Array.isArray(vol.programs) ? vol.programs : JSON.parse(vol.programs)
          if (arr.length > 0) progDesc = arr.join(', ')
        }
      } catch {}

      const hourText = vol.hours ? `${vol.hours} hours` : ''
      const contribSummary = `Volunteer service${hourText ? ` (${hourText})` : ''} supporting ${progDesc}`

      const caption = `In grateful recognition of ${vol.name} for dedicated volunteer service${hourText ? ` of ${hourText}` : ''} rendered to the ${progDesc} of Rise Above Foundation Cebu, Inc. Your selfless commitment and compassion have directly touched countless lives and brought hope to underprivileged communities in Cebu.`

      setForm((prev) => ({
        ...prev,
        recipientKey: key,
        recipient: vol.name,
        reference: vol.id || `VOL-${key}`,
        type: prev.type.includes('Volunteer') ? prev.type : 'Certificate of Volunteer Service',
        contributionDetails: contribSummary,
        details: caption,
      }))
    } else {
      const donor = donors?.find((d) => String(d.dbId) === key)
      if (!donor) return

      // Find real donation record from donations table
      const donorDonations = (donations || []).filter(
        (dn) => dn.donor === donor.name || dn.donorEmail === donor.email
      )
      const latest = donorDonations[0]

      let contribSummary = ''
      let caption = ''

      if (latest) {
        const isMonetary = latest.type === 'Monetary' || (latest.amount && !latest.amount.includes('items'))
        const program = latest.category || latest.program || 'community relief programs'
        const ref = latest.trackingCode || latest.reference || `DON-${latest.id}`
        const dateStr = latest.date || 'recent operations'

        if (isMonetary) {
          contribSummary = `Monetary donation of ${latest.amount} (${ref}) for ${program}`
          caption = `In grateful recognition of ${donor.name} for the generous monetary contribution of ${latest.amount} (Ref: ${ref}) on ${dateStr} supporting the ${program} of Rise Above Foundation Cebu, Inc. Your vital assistance provides essential relief and sustainable empowerment to vulnerable families across Cebu.`
        } else {
          const itemsDesc = latest.items || latest.description || 'in-kind essential provisions'
          contribSummary = `In-kind donation: ${itemsDesc} (${ref}) for ${program}`
          caption = `In heartfelt appreciation of ${donor.name} for the generous in-kind contribution of ${itemsDesc} (Ref: ${ref}) supporting the ${program} of Rise Above Foundation Cebu, Inc. Your compassionate support directly equips and nourishes families during times of greatest need.`
        }

        setForm((prev) => ({
          ...prev,
          recipientKey: key,
          recipient: donor.name,
          reference: ref,
          type: prev.type.includes('Volunteer') ? 'Certificate of Donation' : prev.type,
          contributionDetails: contribSummary,
          details: caption,
        }))
      } else {
        contribSummary = `Donations totaling ${donor.totalDonated || 'valued support'}`
        caption = `In grateful acknowledgment of ${donor.name} for generous contributions totaling ${donor.totalDonated || 'significant support'}, partnering with Rise Above Foundation Cebu, Inc. in uplifting underprivileged children and communities in Cebu.`

        setForm((prev) => ({
          ...prev,
          recipientKey: key,
          recipient: donor.name,
          reference: donor.id ? `DNR-${donor.id}` : '',
          type: prev.type.includes('Volunteer') ? 'Certificate of Donation' : prev.type,
          contributionDetails: contribSummary,
          details: caption,
        }))
      }
    }
  }

  // AI-Assisted Caption Generator
  const handleGenerateAiCaption = async (toneToUse = selectedTone) => {
    if (!form.recipient.trim()) {
      notify.warning('Please enter or select a recipient name first.')
      return
    }

    setAiGenerating(true)
    try {
      const res = await certificateCaptionApi.generate({
        recipient: form.recipient,
        recipientType: form.recipientType,
        contributionType: form.type,
        amount: form.contributionDetails.includes('₱') ? form.contributionDetails : '',
        items: form.contributionDetails,
        hours: form.contributionDetails.includes('hours') ? form.contributionDetails : '',
        program: form.contributionDetails || 'community outreach',
        reference: form.reference,
        date: form.certDate,
        tone: toneToUse,
        instruction: aiInstruction,
        hasPhoto: form.photoLayout !== 'none',
      })

      if (res && res.data) {
        setForm((prev) => ({
          ...prev,
          details: res.data.caption,
        }))
        if (res.data.shortCaption) {
          setShortCaptionSuggestion(res.data.shortCaption)
        }
        notify.success(`Caption generated with ${res.data.source === 'gemini_ai' ? 'Gemini AI' : 'Smart Assistant'}.`)
      }
    } catch (err) {
      notify.error(err.message || 'Failed to generate caption.')
    } finally {
      setAiGenerating(false)
    }
  }

  // Handle Photo File Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      notify.warning('Please select a valid image file (PNG, JPG, WEBP).')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      notify.warning('Image must be under 8MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result
      setForm((prev) => ({
        ...prev,
        photoUrl: dataUrl,
        photoDisplayUrl: dataUrl,
        photoLayout: prev.photoLayout === 'none' ? 'backdrop' : prev.photoLayout,
      }))
      notify.success('Photo added to certificate.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setForm((prev) => ({
      ...prev,
      photoUrl: '',
      photoDisplayUrl: '',
      photoLayout: 'none',
    }))
  }

  // Signatory Selection
  const handleSignatoryChange = (sigId) => {
    const sig = signatories?.find((s) => String(s.id) === String(sigId))
    if (!sig) return
    setForm((prev) => ({
      ...prev,
      signatoryId: sig.id,
      signatoryName: sig.name,
      signatoryTitle: sig.title,
      signatureUrl: sig.signatureImage || '',
    }))
  }

  // Handle Signatory Creation in Settings Modal
  const handleCreateSignatory = async (e) => {
    e.preventDefault()
    if (!newSigForm.name.trim() || !newSigForm.title.trim()) {
      notify.warning('Please fill in the signatory name and title.')
      return
    }
    setSavingSig(true)
    try {
      await signatoriesApi.create(newSigForm)
      notify.success('Signatory added successfully.')
      setNewSigForm({
        name: '',
        title: '',
        organization: 'Rise Above Foundation Cebu, Inc.',
        signatureImage: '',
        isDefault: false,
      })
      reloadSignatories()
    } catch (err) {
      notify.error(err.message || 'Failed to add signatory.')
    } finally {
      setSavingSig(false)
    }
  }

  const handleSetDefaultSignatory = async (sig) => {
    try {
      await signatoriesApi.update(sig.id, { isDefault: true })
      notify.success(`${sig.name} is now the default signatory.`)
      reloadSignatories()
    } catch (err) {
      notify.error(err.message || 'Failed to set default signatory.')
    }
  }

  // Save Certificate
  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.recipient.trim()) {
      notify.warning('Please select or enter a recipient.')
      return
    }
    setSaving(true)
    showLoading('Saving certificate…')
    try {
      const payload = {
        type: form.type,
        templateId: form.templateId,
        recipientType: form.recipientType,
        recipient: form.recipient.trim(),
        reference: form.reference || null,
        details: form.details,
        signatoryId: form.signatoryId,
        signatoryName: form.signatoryName,
        signatoryTitle: form.signatoryTitle,
        signatureUrl: form.signatureUrl,
        photoUrl: form.photoUrl || null,
        photoLayout: form.photoLayout,
        contributionDetails: form.contributionDetails || null,
        certDate: form.certDate,
        location: form.location,
        status: form.status,
      }

      if (editRow) {
        if (form.status !== editRow.status) {
          const check = validateStatusTransition({
            entityName: 'Certificate',
            currentStatus: editRow.status,
            nextStatus: form.status,
            workflowOrder: CERTIFICATE_WORKFLOW,
            terminalStatuses: CERTIFICATE_TERMINAL,
          })
          if (!check.valid) {
            notify.error(check.message)
            return
          }
        }
        await certificatesApi.update(editRow.dbId, payload)
        notify.success('Certificate updated.')
        showSuccessModal('Successfully updated.')
      } else {
        await certificatesApi.create(payload)
        notify.success('Certificate created.')
        showSuccessModal('Successfully created.')
      }
      setShowForm(false)
      reload()
      notifyBadgesChanged()
    } catch (err) {
      notify.error(err.message || 'Failed to save certificate.')
    } finally {
      hideLoading()
      setSaving(false)
    }
  }

  // Handle Certificate Request Approval
  const handleApproveRequest = async (row) => {
    const ok = await confirmAction({
      title: 'Approve Certificate Request',
      message: `Approve the certificate request for ${row.recipient} (${row.type})? Once approved, you can generate the official certificate for this duty.`,
      confirmText: 'Approve Request',
      type: 'primary',
    })
    if (!ok) return

    showLoading('Approving request…')
    try {
      await certificatesApi.update(row.dbId, { status: 'Approved' })
      notify.success('Certificate Request Approved')
      showSuccessModal('Certificate Request Approved', 'Request Approved')
      reload()
      notifyBadgesChanged()
      if (preview?.dbId === row.dbId) {
        setPreview((prev) => ({ ...prev, status: 'Approved' }))
      }
    } catch (err) {
      notify.error(err.message || 'Failed to approve certificate request.')
    } finally {
      hideLoading()
    }
  }

  // Handle Certificate Request Rejection
  const handleRejectRequest = async (row) => {
    const ok = await confirmAction({
      title: 'Reject Certificate Request',
      message: `Are you sure you want to reject the certificate request for ${row.recipient}?`,
      confirmText: 'Reject Request',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Rejecting request…')
    try {
      await certificatesApi.update(row.dbId, { status: 'Rejected' })
      notify.success('Certificate request rejected.')
      showSuccessModal('Certificate request has been rejected.', 'Request Rejected')
      reload()
      notifyBadgesChanged()
      if (preview?.dbId === row.dbId) {
        setPreview((prev) => ({ ...prev, status: 'Rejected' }))
      }
    } catch (err) {
      notify.error(err.message || 'Failed to reject certificate request.')
    } finally {
      hideLoading()
    }
  }

  // Launch Certificate Generator directly for an Approved Request
  const handleGenerateForApprovedRequest = (row) => {
    setEditRow(row)
    const def = signatories?.find((s) => s.isDefault) || signatories?.[0]
    const dutyReference = row.reference || ''
    let initialDetails = row.details || ''
    if (!initialDetails || initialDetails.startsWith('Requested') || initialDetails.includes('requested a certificate')) {
      initialDetails = `In grateful recognition of ${row.recipient} for exemplary volunteer service and active fulfillment of assigned duty ${dutyReference} in support of the humanitarian programs of Rise Above Foundation Cebu, Inc.`
    }

    setForm({
      type: row.type || 'Certificate of Volunteer Service',
      templateId: row.templateId || 'modern_classic',
      recipientType: row.recipientType || 'Volunteer',
      recipientKey: '',
      recipient: row.recipient,
      reference: row.reference || '',
      details: initialDetails,
      signatoryId: row.signatoryId || def?.id || null,
      signatoryName: row.signatoryName || def?.name || 'Flemming Hansen',
      signatoryTitle: row.signatoryTitle || def?.title || 'CEO and Co-Founder',
      signatureUrl: row.signatureUrl || def?.signatureImage || 'sig_flemming_hansen.png',
      photoUrl: row.photoUrl || '',
      photoDisplayUrl: row.photoDisplayUrl || row.photoUrl || '',
      photoLayout: row.photoLayout || 'none',
      contributionDetails: row.contributionDetails || `Completed Duty: ${dutyReference}`,
      certDate: row.certDate || new Date().toISOString().slice(0, 10),
      location: row.location || 'Cebu City, Philippines',
      status: 'Generated',
      isFromApprovedRequest: true,
    })
    setAiInstruction('')
    setShortCaptionSuggestion('')
    setShowForm(true)
    if (preview) setPreview(null)
  }

  const handleDelete = async (row) => {
    const ok = await confirmAction({
      title: 'Delete Certificate',
      message: `Permanently delete certificate ${row.id} for ${row.recipient}? This cannot be undone.`,
      confirmText: 'Delete Certificate',
      type: 'danger',
    })
    if (!ok) return

    showLoading('Deleting certificate…')
    try {
      await certificatesApi.remove(row.dbId)
      notify.success('Certificate deleted.')
      showSuccessModal('Successfully deleted.')
      reload()
      notifyBadgesChanged()
      if (preview?.dbId === row.dbId) setPreview(null)
    } catch (err) {
      notify.error(err.message)
    } finally {
      hideLoading()
    }
  }

  // Live preview cert object derived from current form
  const livePreviewCert = useMemo(() => {
    return {
      id: editRow?.id || 'CERT-PREVIEW',
      type: form.type,
      templateId: form.templateId,
      recipient: form.recipient || 'Valued Supporter',
      details: form.details,
      reference: form.reference,
      date: form.certDate,
      location: form.location,
      signatoryName: form.signatoryName,
      signatoryTitle: form.signatoryTitle,
      signatureUrl: form.signatureUrl,
      photoUrl: form.photoUrl,
      photoDisplayUrl: form.photoDisplayUrl,
      photoLayout: form.photoLayout,
    }
  }, [form, editRow])

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'type', label: 'Type' },
    { key: 'recipient', label: 'Recipient' },
    { key: 'recipientType', label: 'For' },
    { key: 'reference', label: 'Reference' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const isRequested = row.status === 'Requested' || row.status === 'Pending'
        const isApproved = row.status === 'Approved'

        // New certificate requests initially show ONLY View and Approve/Reject actions
        if (isRequested) {
          return (
            <div className="table-actions">
              <button
                type="button"
                className="btn btn--sm btn--outline"
                title="View Request Details"
                onClick={(e) => { e.stopPropagation(); setPreview(row) }}
              >
                <Eye size={14} />
              </button>
              <button
                type="button"
                className="btn btn--sm"
                style={{ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' }}
                title="Approve Request"
                onClick={(e) => { e.stopPropagation(); handleApproveRequest(row) }}
              >
                <Check size={14} /> Approve
              </button>
              <button
                type="button"
                className="btn btn--sm"
                style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                title="Reject Request"
                onClick={(e) => { e.stopPropagation(); handleRejectRequest(row) }}
              >
                <X size={14} /> Reject
              </button>
            </div>
          )
        }

        // Approved requests show View and Generate Certificate specifically for this request
        if (isApproved) {
          return (
            <div className="table-actions">
              <button
                type="button"
                className="btn btn--sm btn--outline"
                title="View Approved Request"
                onClick={(e) => { e.stopPropagation(); setPreview(row) }}
              >
                <Eye size={14} />
              </button>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                title="Generate Certificate for this Approved Request"
                onClick={(e) => { e.stopPropagation(); handleGenerateForApprovedRequest(row) }}
              >
                <Award size={14} /> Generate
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                title="Reject Request"
                onClick={(e) => { e.stopPropagation(); handleRejectRequest(row) }}
              >
                <X size={14} />
              </button>
            </div>
          )
        }

        if (row.status === 'Rejected') {
          return (
            <div className="table-actions">
              <button
                type="button"
                className="btn btn--sm btn--outline"
                title="View Details"
                onClick={(e) => { e.stopPropagation(); setPreview(row) }}
              >
                <Eye size={14} />
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                title="Delete Record"
                onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        }

        // Generated and Released certificates
        return (
          <div className="table-actions">
            <button type="button" className="btn btn--sm btn--outline" title="Preview" onClick={(e) => { e.stopPropagation(); setPreview(row) }}>
              <Eye size={14} />
            </button>
            <button type="button" className="btn btn--sm btn--outline" title="Download / Print" onClick={(e) => { e.stopPropagation(); printCertificate(row) }}>
              <Download size={14} />
            </button>
            <button type="button" className="btn btn--sm btn--outline" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>
              <Pencil size={14} />
            </button>
            <button type="button" className="btn btn--sm btn--ghost" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(row) }}>
              <Trash2 size={14} />
            </button>
          </div>
        )
      },
    },
  ]

  const requestedCount = data.filter((c) => c.status === 'Requested' || c.status === 'Pending').length
  const approvedCount = data.filter((c) => c.status === 'Approved').length
  const generatedCount = data.filter((c) => c.status === 'Generated' || c.status === 'Released').length

  return (
    <>
      <PageHeader
        title="Certificate Management"
        description="Design, issue, and print clean, professional certificates. Contributions, automated signatories, and AI-assisted captions are integrated seamlessly."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setShowSignatoriesModal(true)}
              title="Configure official signatories"
            >
              <Sliders size={15} /> Signatory Settings
            </button>
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Award size={15} /> New Certificate
            </button>
          </div>
        }
      />

      <div className="admin-stats-grid admin-stats-grid--compact">
        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'all' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', 'all')}
          role="button"
          tabIndex={0}
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Total Certificates</span>
            <Award className="admin-stat-card__icon" size={15} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{data.length}</span>
          </div>
        </div>

        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'Generated' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Generated' ? 'all' : 'Generated')}
          role="button"
          tabIndex={0}
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Generated</span>
            <FileCheck className="admin-stat-card__icon" size={15} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{generatedCount}</span>
          </div>
        </div>

        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'Approved' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Approved' ? 'all' : 'Approved')}
          role="button"
          tabIndex={0}
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Approved Requests</span>
            <CheckCircle2 className="admin-stat-card__icon" size={15} color="#16a34a" />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{approvedCount}</span>
          </div>
        </div>

        <div
          className={`admin-stat-card admin-stat-card--clickable ${filters.values.status === 'Requested' ? 'admin-stat-card--active' : ''}`}
          onClick={() => filters.setValue('status', filters.values.status === 'Requested' ? 'all' : 'Requested')}
          role="button"
          tabIndex={0}
        >
          <div className="admin-stat-card__header">
            <span className="admin-stat-card__label">Pending Requests</span>
            <Clock className="admin-stat-card__icon" size={15} />
          </div>
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__value">{requestedCount}</span>
          </div>
        </div>
      </div>

      <FilterBar
        controller={filters}
        searchPlaceholder="Search by ID, recipient, reference, or signatory..."
        exportConfig={{
          filename: 'certificates-report',
          title: 'Certificates Report',
          columns,
          rows: filters.filtered,
        }}
      />

      <ApiState loading={loading} error={error} message="Loading certificates…" onRetry={reload}>
        <DataTable
          columns={columns}
          data={filters.filtered}
          onRowClick={setPreview}
          pageSize={10}
          resetKey={`${filters.search}|${JSON.stringify(filters.values)}`}
        />
      </ApiState>

      {/* TWO-COLUMN CERTIFICATE CREATOR / EDITOR MODAL */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal cert-creator-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title={editRow ? `Edit Certificate: ${editRow.id}` : 'Create Official Certificate'}
              onClose={() => setShowForm(false)}
            />

            <div className="cert-creator-body">
              {/* LEFT COLUMN: FORM CONTROLS */}
              <div className="cert-form-column">
                <form id="cert-form" onSubmit={handleSave}>
                  {/* SECTION 1: RECIPIENT & CONTRIBUTION */}
                  <div className="cert-section-card">
                    <h3 className="cert-section-title">
                      <UserCheck size={16} color="#af101a" /> 1. Recipient & Contribution
                    </h3>

                    {form.isFromApprovedRequest && (
                      <div style={{ marginBottom: '0.65rem', padding: '0.55rem 0.75rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', fontSize: '0.78rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={15} color="#16a34a" />
                        <span><strong>Approved Request Linked:</strong> Certificate is specifically connected to volunteer <strong>{form.recipient}</strong> and completed duty <strong>{form.reference}</strong>.</span>
                      </div>
                    )}

                    <div className="form-row">
                      <label>
                        <span className="cert-field-label">Recipient Type</span>
                        <select
                          value={form.recipientType}
                          disabled={Boolean(form.isFromApprovedRequest)}
                          onChange={(e) => {
                            setForm({
                              ...form,
                              recipientType: e.target.value,
                              recipientKey: '',
                              recipient: '',
                              reference: '',
                              details: '',
                              contributionDetails: '',
                            })
                          }}
                        >
                          <option value="Donor">Donor</option>
                          <option value="Volunteer">Volunteer</option>
                        </select>
                      </label>

                      <label>
                        <span className="cert-field-label">Select From Database</span>
                        <select
                          value={form.recipientKey}
                          disabled={Boolean(form.isFromApprovedRequest)}
                          onChange={(e) => handleRecipientPick(e.target.value)}
                        >
                          <option value="">Choose a {form.recipientType.toLowerCase()}...</option>
                          {(form.recipientType === 'Volunteer' ? volunteers : donors)?.map((p) => (
                            <option key={p.dbId} value={p.dbId}>
                              {p.name} {form.recipientType === 'Volunteer' ? (p.hours ? `— ${p.hours} hrs` : '') : `— ${p.totalDonated || 'Donor'}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="form-row">
                      <label>
                        <span className="cert-field-label">Recipient Name</span>
                        <input
                          required
                          disabled={Boolean(form.isFromApprovedRequest)}
                          value={form.recipient}
                          onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                          placeholder="Recipient Full Name / Organization"
                        />
                      </label>
                      <label>
                        <span className="cert-field-label">
                          Reference Code {form.recipientType === 'Volunteer' ? <span style={{ color: '#0f766e', fontSize: '0.72rem', fontWeight: 500 }}>(Completed Duty)</span> : null}
                        </span>
                        <input
                          disabled={Boolean(form.isFromApprovedRequest)}
                          value={form.reference}
                          onChange={(e) => setForm({ ...form, reference: e.target.value })}
                          placeholder={form.recipientType === 'Volunteer' ? 'e.g. TSK-CDCEB' : 'e.g. DON-K2F9A or VOL-101'}
                        />
                      </label>
                    </div>

                    {form.contributionDetails && (
                      <div style={{ marginTop: '0.45rem', padding: '0.45rem 0.65rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.74rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #e2e8f0' }}>
                        <CheckCircle2 size={14} color="#16a34a" />
                        <span><strong>Database Match:</strong> {form.contributionDetails}</span>
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: CERTIFICATE STYLE & TEMPLATE */}
                  <div className="cert-section-card" style={{ marginTop: '0.75rem' }}>
                    <h3 className="cert-section-title">
                      <Award size={16} color="#af101a" /> 2. Certificate Title & Template
                    </h3>
                    <div className="form-row">
                      <label>
                        <span className="cert-field-label">Certificate Type</span>
                        <select
                          value={form.type}
                          disabled={editRow && isTerminalStatus(editRow.status, CERTIFICATE_TERMINAL)}
                          onChange={(e) => setForm({ ...form, type: e.target.value })}
                        >
                          {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>

                      <label>
                        <span className="cert-field-label">Date Issued</span>
                        <input
                          type="date"
                          value={form.certDate}
                          onChange={(e) => setForm({ ...form, certDate: e.target.value })}
                        />
                      </label>
                    </div>

                    <label style={{ marginTop: '0.45rem', display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>
                      Choose Design Template
                    </label>
                    <div className="cert-template-selector">
                      {CERTIFICATE_TEMPLATES.map((tmpl) => {
                        const isSelected = form.templateId === tmpl.id
                        return (
                          <button
                            key={tmpl.id}
                            type="button"
                            className={`cert-template-card ${isSelected ? 'cert-template-card--active' : ''}`}
                            onClick={() => setForm({ ...form, templateId: tmpl.id })}
                          >
                            <div className="cert-template-card__header">
                              <span className="cert-template-card__name">
                                {isSelected && <Check size={12} color="#af101a" strokeWidth={3} />}
                                {tmpl.name}
                              </span>
                              <span
                                className="cert-template-card__badge"
                                style={{ backgroundColor: tmpl.accentColor }}
                              >
                                {tmpl.badge}
                              </span>
                            </div>
                            <p className="cert-template-card__desc">{tmpl.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* SECTION 3: RECOGNITION CAPTION & AI ASSISTANT */}
                  <div className="cert-section-card" style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <h3 className="cert-section-title" style={{ margin: 0 }}>
                        <PenTool size={16} color="#af101a" /> 3. Certificate Caption
                      </h3>
                      <button
                        type="button"
                        className="cert-ai-suggest-btn"
                        onClick={() => handleGenerateAiCaption()}
                        disabled={aiGenerating}
                        title="Generate tailored caption based on actual donor/volunteer contribution"
                      >
                        {aiGenerating ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
                        <span>{aiGenerating ? 'Generating Caption…' : 'AI Suggest Caption'}</span>
                      </button>
                    </div>

                    {/* Predefined Tone Selectors */}
                    <div style={{ marginBottom: '0.55rem' }}>
                      <label style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem', display: 'block', fontWeight: 600 }}>
                        Preset Tones & Themes:
                      </label>
                      <div className="cert-ai-tone-chips">
                        {CAPTION_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`cert-ai-tone-chip ${selectedTone === t.id ? 'cert-ai-tone-chip--active' : ''}`}
                            onClick={() => {
                              setSelectedTone(t.id)
                              handleGenerateAiCaption(t.id)
                            }}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Optional Custom AI Guidance */}
                    <div className="cert-ai-custom-prompt">
                      <input
                        className="cert-ai-custom-input"
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        placeholder="Optional AI prompt guidance (e.g. Focus on dental outreach, 50 hours service...)"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGenerateAiCaption(); } }}
                      />
                    </div>

                    {shortCaptionSuggestion && (
                      <div style={{ marginBottom: '0.5rem', background: '#fffbeb', border: '1px dashed #f59e0b', borderRadius: '6px', padding: '0.45rem 0.65rem', fontSize: '0.72rem' }}>
                        <span style={{ fontWeight: 700, color: '#b45309', display: 'block' }}>💡 Photo Layout Compact Version:</span>
                        <p style={{ margin: '2px 0 4px', color: '#4b5563' }}>{shortCaptionSuggestion}</p>
                        <button
                          type="button"
                          className="btn btn--xs btn--outline"
                          onClick={() => setForm({ ...form, details: shortCaptionSuggestion })}
                        >
                          Use Compact Version
                        </button>
                      </div>
                    )}

                    <label style={{ margin: 0, display: 'block' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                        Certificate Caption / Recognition Message (Editable)
                      </span>
                      <textarea
                        className="cert-caption-textarea"
                        rows={4}
                        value={form.details}
                        onChange={(e) => setForm({ ...form, details: e.target.value })}
                        placeholder="Type manual caption or click 'AI Suggest Caption' to generate automatically based on contribution..."
                      />
                    </label>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                      ✓ Admin can edit anytime. Changes immediately update the live certificate preview on the right.
                    </span>
                  </div>

                  {/* SECTION 4: OPTIONAL PHOTO / IMAGE */}
                  <div className="cert-section-card" style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                      <h3 className="cert-section-title" style={{ margin: 0 }}>
                        <ImageIcon size={16} color="#af101a" /> 4. Contribution / Activity Image (Optional)
                      </h3>
                      {form.photoUrl && (
                        <button
                          type="button"
                          className="btn btn--xs btn--ghost"
                          onClick={handleRemovePhoto}
                          style={{ color: '#ef4444' }}
                        >
                          <X size={12} /> Remove Image
                        </button>
                      )}
                    </div>

                    {!form.photoUrl ? (
                      <label className="cert-image-dropzone">
                        <Upload size={20} color="#af101a" />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>
                            Upload Contribution or Activity Photo
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            Optional photo of volunteer outreach, handover, or ceremony (PNG, JPG, WEBP)
                          </div>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    ) : (
                      <div>
                        <div className="cert-image-preview-bar">
                          <div className="cert-image-thumb-wrap">
                            <img src={form.photoUrl} alt="Contribution Preview" className="cert-image-thumb" />
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b' }}>Image Attached</div>
                              <div style={{ fontSize: '0.68rem', color: '#16a34a' }}>✓ Automatically fitted to certificate canvas</div>
                            </div>
                          </div>
                          <label className="btn btn--xs btn--outline" style={{ cursor: 'pointer', margin: 0 }}>
                            Replace Image
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handlePhotoUpload}
                            />
                          </label>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem', display: 'block', fontWeight: 600 }}>
                            Select Photo Placement:
                          </label>
                          <div className="cert-photo-layout-grid">
                            {PHOTO_LAYOUTS.filter((lay) => lay.id !== 'none').map((lay) => (
                              <button
                                key={lay.id}
                                type="button"
                                className={`cert-photo-layout-btn ${form.photoLayout === lay.id ? 'cert-photo-layout-btn--active' : ''}`}
                                onClick={() => setForm({ ...form, photoLayout: lay.id })}
                              >
                                <span className="cert-photo-layout-name">{lay.name}</span>
                                {lay.badge && <span className="cert-photo-layout-badge">{lay.badge}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 5: AUTOMATIC OFFICIAL SIGNATORY */}
                  <div className="cert-section-card" style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                      <h3 className="cert-section-title" style={{ margin: 0 }}>
                        <ShieldCheck size={16} color="#af101a" /> 5. Automatic Official Signatory
                      </h3>
                      <button
                        type="button"
                        className="btn btn--xs btn--outline"
                        onClick={() => setShowSignatoriesModal(true)}
                      >
                        <Sliders size={12} /> Signatory Settings
                      </button>
                    </div>

                    <div className="form-row">
                      <label>
                        <span className="cert-field-label">Official Signatory</span>
                        <select
                          value={form.signatoryId || ''}
                          onChange={(e) => handleSignatoryChange(e.target.value)}
                        >
                          {signatories?.map((sig) => (
                            <option key={sig.id} value={sig.id}>
                              {sig.name} — {sig.title} {sig.isDefault ? '(Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="cert-field-label">Location</span>
                        <input
                          value={form.location}
                          onChange={(e) => setForm({ ...form, location: e.target.value })}
                          placeholder="Cebu City, Philippines"
                        />
                      </label>
                    </div>

                    <div style={{ marginTop: '0.45rem', padding: '0.45rem 0.65rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.45rem', border: '1px solid #e2e8f0' }}>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <span><strong>Official Signatory Attached:</strong> {form.signatoryName || 'Flemming Hansen'} ({form.signatoryTitle || 'CEO and Co-Founder'}). Stored signature and Rise Above official seal are automatically attached.</span>
                    </div>
                  </div>

                  {/* SECTION 6: WORKFLOW STATUS */}
                  <div className="cert-section-card" style={{ marginTop: '0.75rem' }}>
                    <label>Workflow Status
                      <select
                        value={form.status}
                        disabled={editRow && isTerminalStatus(editRow.status, CERTIFICATE_TERMINAL)}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {getAvailableNextStatuses({
                          currentStatus: editRow ? editRow.status : form.status,
                          allStatuses: STATUS_OPTIONS,
                          workflowOrder: CERTIFICATE_WORKFLOW,
                          terminalStatuses: CERTIFICATE_TERMINAL,
                        }).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {editRow && isTerminalStatus(editRow.status, CERTIFICATE_TERMINAL) && (
                        <small style={{ display: 'block', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                          🔒 Certificate is Released and locked from further changes.
                        </small>
                      )}
                    </label>
                  </div>
                </form>
              </div>

              {/* RIGHT COLUMN: REAL-TIME LIVE PREVIEW */}
              <div className="cert-preview-column">
                <div className="cert-preview-card">
                  <div className="cert-preview-header">
                    <span className="cert-preview-label">
                      <Award size={15} color="#af101a" /> Live Certificate Preview
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span className="cert-preview-spec-badge">A4 Landscape</span>
                      <button
                        type="button"
                        className="btn btn--xs btn--outline"
                        onClick={() => setPreview(livePreviewCert)}
                        title="Open full high-resolution review modal"
                      >
                        <Eye size={13} /> Fullscreen Review
                      </button>
                      <button
                        type="button"
                        className="btn btn--xs btn--outline"
                        onClick={() => printCertificate(livePreviewCert)}
                        title="Print or export current preview"
                      >
                        <Printer size={13} /> Quick Print
                      </button>
                    </div>
                  </div>
                  <div className="cert-live-canvas-wrap">
                    <CertificateView cert={livePreviewCert} />
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER ACTIONS */}
            <div className="cert-creator-footer">
              <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <div className="cert-creator-footer__group">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => printCertificate(livePreviewCert)}
                >
                  <Download size={14} /> Preview / Export PDF
                </button>
                <button
                  type="submit"
                  form="cert-form"
                  className="btn btn--primary"
                  disabled={saving || (editRow && isTerminalStatus(editRow.status, CERTIFICATE_TERMINAL))}
                >
                  <Award size={14} /> {saving ? 'Saving...' : editRow ? 'Save Changes' : 'Issue Certificate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL PREVIEW MODAL (FROM TABLE) */}
      {preview && (
        <div className="admin-modal-overlay" onClick={() => setPreview(null)}>
          <div className="admin-modal admin-modal--cert" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={preview.type} onClose={() => setPreview(null)} />
            <div className="cert-preview-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 className="cert-preview-toolbar__title" style={{ margin: 0 }}>
                  <Award size={18} color="#af101a" />
                  {preview.id} — {preview.recipient}
                </h2>
                <StatusBadge status={preview.status} />
              </div>
              <div className="cert-preview-toolbar__actions">
                {(preview.status === 'Requested' || preview.status === 'Pending') && (
                  <>
                    <button
                      type="button"
                      className="btn btn--sm"
                      style={{ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' }}
                      onClick={() => handleApproveRequest(preview)}
                    >
                      <Check size={14} /> Approve Request
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm"
                      style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                      onClick={() => handleRejectRequest(preview)}
                    >
                      <X size={14} /> Reject Request
                    </button>
                  </>
                )}
                {preview.status === 'Approved' && (
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    onClick={() => handleGenerateForApprovedRequest(preview)}
                  >
                    <Award size={14} /> Generate Certificate
                  </button>
                )}
                {(preview.status === 'Generated' || preview.status === 'Released') && (
                  <>
                    <button type="button" className="btn btn--sm btn--outline" onClick={() => printCertificate(preview)}>
                      <Printer size={14} /> Print
                    </button>
                    <button type="button" className="btn btn--sm btn--primary" onClick={() => printCertificate(preview)}>
                      <Download size={14} /> Download PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            {(preview.status === 'Requested' || preview.status === 'Approved' || preview.status === 'Rejected') ? (
              <div style={{ padding: '1.25rem', background: '#fff', borderRadius: '8px', margin: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Recipient</span>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>{preview.recipient} ({preview.recipientType})</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Duty / Task Reference</span>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: 600, fontSize: '0.95rem', color: '#0f766e' }}>{preview.reference || 'General Duty'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Request Date</span>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: '#334155' }}>{preview.date || 'Today'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Current Workflow Status</span>
                    <div style={{ marginTop: '0.25rem' }}><StatusBadge status={preview.status} /></div>
                  </div>
                </div>
                {preview.details && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Request Purpose / Details:</span>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>{preview.details}</p>
                  </div>
                )}
                {preview.status === 'Approved' && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#166534', fontSize: '0.85rem', fontWeight: 500 }}>
                      ✓ This request has been approved. Click <strong>Generate Certificate</strong> to finalize and issue the official certificate.
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => handleGenerateForApprovedRequest(preview)}
                    >
                      <Award size={14} /> Generate Certificate Now
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <CertificateView cert={preview} />
            )}
          </div>
        </div>
      )}

      {/* SIGNATORIES MANAGEMENT MODAL */}
      {showSignatoriesModal && (
        <div className="admin-modal-overlay" onClick={() => setShowSignatoriesModal(false)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              title="Official Certificate Signatories & Settings"
              onClose={() => setShowSignatoriesModal(false)}
            />

            <div style={{ padding: '0.5rem 0' }}>
              <p style={{ fontSize: '0.82rem', color: '#4b5563', margin: '0 0 1rem' }}>
                Register authorized executive signatories once. The default signatory is automatically attached to all new certificates without repeatedly uploading signatures.
              </p>

              {/* LIST OF REGISTERED SIGNATORIES */}
              <div className="signatories-list-grid">
                {signatories?.map((sig) => (
                  <div key={sig.id} className={`signatory-card ${sig.isDefault ? 'signatory-card--default' : ''}`}>
                    {sig.signatureUrl ? (
                      <img src={sig.signatureUrl} alt={sig.name} className="signatory-card__sig" />
                    ) : (
                      <div className="signatory-card__sig" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#9ca3af' }}>
                        No Image
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{sig.name}</strong>
                        {sig.isDefault && (
                          <span style={{ fontSize: '0.62rem', background: '#c9a227', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                            Default
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{sig.title}</div>
                      <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{sig.organization}</div>
                    </div>
                    {!sig.isDefault && (
                      <button
                        type="button"
                        className="btn btn--xs btn--outline"
                        onClick={() => handleSetDefaultSignatory(sig)}
                        title="Set as Default Signatory"
                      >
                        Set Default
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* ADD NEW SIGNATORY FORM */}
              <div className="cert-section-card" style={{ marginTop: '1.25rem' }}>
                <h3 className="cert-section-title">
                  <Plus size={16} /> Register New Authorized Signatory
                </h3>
                <form onSubmit={handleCreateSignatory}>
                  <div className="form-row">
                    <label>Signatory Full Name
                      <input
                        required
                        value={newSigForm.name}
                        onChange={(e) => setNewSigForm({ ...newSigForm, name: e.target.value })}
                        placeholder="e.g. Flemming Hansen"
                      />
                    </label>
                    <label>Position / Title
                      <input
                        required
                        value={newSigForm.title}
                        onChange={(e) => setNewSigForm({ ...newSigForm, title: e.target.value })}
                        placeholder="e.g. CEO and Co-Founder"
                      />
                    </label>
                  </div>

                  <div className="form-row">
                    <label>Organization
                      <input
                        value={newSigForm.organization}
                        onChange={(e) => setNewSigForm({ ...newSigForm, organization: e.target.value })}
                        placeholder="Rise Above Foundation Cebu, Inc."
                      />
                    </label>
                    <label>Signature File (PNG / JPG / WEBP)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onload = (re) => setNewSigForm({ ...newSigForm, signatureImage: re.target?.result })
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <input
                        type="checkbox"
                        checked={newSigForm.isDefault}
                        onChange={(e) => setNewSigForm({ ...newSigForm, isDefault: e.target.checked })}
                      />
                      Make this the Default Signatory
                    </label>
                    <button type="submit" className="btn btn--primary" disabled={savingSig}>
                      {savingSig ? 'Saving…' : 'Register Signatory'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="admin-modal__actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn--primary" onClick={() => setShowSignatoriesModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
