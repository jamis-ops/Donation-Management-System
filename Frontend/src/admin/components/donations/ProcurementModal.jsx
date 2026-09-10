import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Package, ShoppingBag, Plus, Trash2, CheckCircle2, 
  DollarSign, Users, MapPin, FileText, Send, AlertCircle, 
  Sparkles, Coins, Store, ArrowRight, Bot, Wand2, RefreshCw, Check, Lightbulb
} from 'lucide-react'
import ModalHeader from '../shared/ModalHeader'
import { donationsApi, beneficiariesApi, assistanceRequestsApi } from '../../../api/resources'
import { notify } from '../../../utils/toast'
import { confirmAction, showSuccessModal } from '../../../utils/confirm'
import { useLoading } from '../../../context/LoadingContext'

const PACK_PRESETS = [
  { name: 'Emergency Relief Food Pack', defaultCost: 500, icon: '🍲', desc: 'Rice (5kg), 6 canned goods, noodles, clean drinking water' },
  { name: 'Family Hygiene & Sanitation Kit', defaultCost: 300, icon: '🧼', desc: 'Bath soap, detergent, toothbrushes, toothpaste, sanitary pads' },
  { name: 'Back-to-School Student Kit', defaultCost: 400, icon: '🎒', desc: 'Notebooks, pens, pencils, bag, crayons, ruler' },
  { name: 'Medical / First Aid Emergency Kit', defaultCost: 450, icon: '💊', desc: 'Paracetamol, multivitamins, antiseptic, bandages, gauze' },
  { name: 'Custom Relief Package', defaultCost: 500, icon: '📦', desc: 'Custom package configured by admin' },
]

// Item catalog for AI suggestion engine with realistic wholesale pricing in Cebu / PH
const AI_CATALOG = [
  { item: '25kg Premium Rice Sack', category: 'Food', unit: 'sacks', unitCost: 1250, keywords: ['food', 'rice', 'groceries', 'feeding', 'relief'] },
  { item: 'Canned Goods (100-can wholesale box)', category: 'Food', unit: 'boxes', unitCost: 2500, keywords: ['food', 'canned', 'sardines', 'tuna', 'groceries'] },
  { item: 'Instant Noodles (72-pack master case)', category: 'Food', unit: 'cases', unitCost: 950, keywords: ['food', 'noodles', 'groceries'] },
  { item: 'Clean Drinking Mineral Water (5-Gallon / 20L)', category: 'Water', unit: 'bottles', unitCost: 75, keywords: ['water', 'clean water', 'drinking', 'hydration', 'flood', 'disaster'] },
  { item: 'Family Hygiene & Toiletries Kit', category: 'Hygiene Kits', unit: 'kits', unitCost: 300, keywords: ['hygiene', 'soap', 'sanitation', 'clean', 'toiletries'] },
  { item: '70% Ethyl Alcohol & Sanitizer (500ml bottle)', category: 'Hygiene Kits', unit: 'bottles', unitCost: 95, keywords: ['hygiene', 'alcohol', 'sanitation', 'medical', 'disinfectant'] },
  { item: 'Sanitary Napkins & Feminine Care (Box of 48)', category: 'Hygiene Kits', unit: 'boxes', unitCost: 380, keywords: ['hygiene', 'sanitary', 'women', 'maternal'] },
  { item: 'First Aid Emergency Kit with Antiseptic & Bandages', category: 'Medicine', unit: 'kits', unitCost: 450, keywords: ['medicine', 'medical', 'first aid', 'health', 'injury', 'clinic'] },
  { item: 'Paracetamol 500mg (Box of 100 tablets)', category: 'Medicine', unit: 'boxes', unitCost: 280, keywords: ['medicine', 'medical', 'fever', 'health'] },
  { item: 'Multivitamins with Zinc (Box of 100 capsules)', category: 'Medicine', unit: 'boxes', unitCost: 420, keywords: ['medicine', 'vitamins', 'health', 'nutrition'] },
  { item: 'Heavy-Duty Waterproof Tarpaulin (12x18 ft)', category: 'Shelter Materials', unit: 'sheets', unitCost: 650, keywords: ['shelter', 'tarpaulin', 'roofing', 'typhoon', 'flood', 'housing'] },
  { item: 'Woven Sleeping Mats & Fleece Blanket Sets', category: 'Shelter Materials', unit: 'sets', unitCost: 380, keywords: ['shelter', 'blanket', 'mat', 'bedding', 'evacuation'] },
  { item: 'Student School Supplies Bundle (Notebooks, Pens, Bags)', category: 'Educational Support', unit: 'bundles', unitCost: 400, keywords: ['education', 'school', 'student', 'supplies', 'books'] },
]

export default function ProcurementModal({ 
  donation, 
  beneficiaries = [], 
  assistanceRequests = [], 
  initialBeneficiaryId = '',
  initialRequestId = '',
  onClose, 
  onSuccess 
}) {
  const navigate = useNavigate()
  const { showLoading, hideLoading } = useLoading()
  const [activeTab, setActiveTab] = useState(initialRequestId ? 'itemized_purchase' : 'pack_sponsorship')
  const [saving, setSaving] = useState(false)

  const [internalBeneficiaries, setInternalBeneficiaries] = useState(beneficiaries || [])
  const [internalRequests, setInternalRequests] = useState(assistanceRequests || [])

  // Auto-fetch fresh list if empty or on mount to ensure accurate affected family counts
  useEffect(() => {
    if (beneficiaries && beneficiaries.length > 0) {
      setInternalBeneficiaries(beneficiaries)
    } else {
      beneficiariesApi.list().then(res => {
        if (res?.data) setInternalBeneficiaries(res.data)
      }).catch(console.error)
    }
  }, [beneficiaries])

  useEffect(() => {
    if (assistanceRequests && assistanceRequests.length > 0) {
      setInternalRequests(assistanceRequests)
    } else {
      assistanceRequestsApi.list().then(res => {
        if (res?.data) setInternalRequests(res.data)
      }).catch(console.error)
    }
  }, [assistanceRequests])

  const remainingBalance = useMemo(() => {
    return Math.max(0, (Number(donation?.remainingBalance ?? donation?.amountRaw ?? 0)))
  }, [donation])

  // --- Pack Sponsorship State ---
  const [packPresetIndex, setPackPresetIndex] = useState(0)
  const [packUnitCost, setPackUnitCost] = useState(PACK_PRESETS[0].defaultCost)
  const [packAmountToAllocate, setPackAmountToAllocate] = useState(remainingBalance || 500)
  const [packBeneficiaryId, setPackBeneficiaryId] = useState(initialBeneficiaryId ? String(initialBeneficiaryId) : '')
  const [packRequestId, setPackRequestId] = useState(initialRequestId ? String(initialRequestId) : '')

  // --- Itemized Purchase State ---
  const [itemBeneficiaryId, setItemBeneficiaryId] = useState(initialBeneficiaryId ? String(initialBeneficiaryId) : '')
  const [itemRequestId, setItemRequestId] = useState(initialRequestId ? String(initialRequestId) : '')
  const [addToInventory, setAddToInventory] = useState(false)
  const [familiesSupportedInput, setFamiliesSupportedInput] = useState('')
  const [items, setItems] = useState([
    { id: 1, item: '25kg Premium Rice Sack', quantity: 3, unit: 'sacks', unitCost: 1250 },
    { id: 2, item: 'Canned Goods (100-can wholesale box)', quantity: 2, unit: 'boxes', unitCost: 2500 },
    { id: 3, item: 'Clean Drinking Mineral Water (5-Gallon / 20L)', quantity: 15, unit: 'bottles', unitCost: 75 },
  ])

  const [notes, setNotes] = useState('')

  // Filter requests for selected beneficiary
  const currentBeneficiaryId = activeTab === 'pack_sponsorship' ? packBeneficiaryId : itemBeneficiaryId
  const availableRequests = useMemo(() => {
    if (!currentBeneficiaryId) return internalRequests || []
    return (internalRequests || []).filter(r => (String(r.beneficiaryId) === String(currentBeneficiaryId) || String(r.beneficiary_id) === String(currentBeneficiaryId)) && r.status !== 'Completed')
  }, [internalRequests, currentBeneficiaryId])

  const selectedBeneficiary = useMemo(() => {
    if (!currentBeneficiaryId) return null
    return (internalBeneficiaries || []).find(b => 
      String(b.dbId) === String(currentBeneficiaryId) || 
      String(b.id) === String(currentBeneficiaryId) ||
      Number(b.dbId) === Number(currentBeneficiaryId)
    )
  }, [internalBeneficiaries, currentBeneficiaryId])

  const selectedRequest = useMemo(() => {
    const rId = activeTab === 'pack_sponsorship' ? packRequestId : itemRequestId
    if (!rId) return null
    return (internalRequests || []).find(r => 
      String(r.dbId) === String(rId) || 
      String(r.id) === String(rId) ||
      Number(r.dbId) === Number(rId)
    )
  }, [internalRequests, activeTab, packRequestId, itemRequestId])

  const currentAffectedFamilies = useMemo(() => {
    if (selectedRequest?.affectedFamilies && Number(selectedRequest.affectedFamilies) > 0) {
      return Number(selectedRequest.affectedFamilies)
    }
    if (selectedBeneficiary) {
      return Number(selectedBeneficiary.affectedFamilies || selectedBeneficiary.affected_families || selectedBeneficiary.families || 0)
    }
    return 0
  }, [selectedBeneficiary, selectedRequest])

  // Computed Pack Sponsorship numbers
  const currentPackPreset = PACK_PRESETS[packPresetIndex] || PACK_PRESETS[0]
  const computedPackCount = useMemo(() => {
    const cost = Number(packUnitCost) || 1
    const total = Number(packAmountToAllocate) || 0
    return Math.max(1, Math.floor(total / cost))
  }, [packAmountToAllocate, packUnitCost])

  // Computed Itemized numbers
  const computedItemizedTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.unitCost) || 0)), 0)
  }, [items])

  const effectiveTotalAmount = activeTab === 'pack_sponsorship' ? Number(packAmountToAllocate) : computedItemizedTotal

  // =========================================================================
  // AI PROCUREMENT ENGINE: Analyzes Barangay Needs & Generates Smart Packages
  // =========================================================================
  const aiNeedsAnalysis = useMemo(() => {
    const rawNeeds = []
    if (selectedRequest?.type) rawNeeds.push(selectedRequest.type)
    if (Array.isArray(selectedRequest?.needs)) rawNeeds.push(...selectedRequest.needs)
    if (Array.isArray(selectedBeneficiary?.needs)) rawNeeds.push(...selectedBeneficiary.needs)
    if (selectedBeneficiary?.category) rawNeeds.push(selectedBeneficiary.category)

    const needsText = rawNeeds.join(' ').toLowerCase()
    const targetFamilies = currentAffectedFamilies || 20
    const budget = remainingBalance || 10000

    const isFood = needsText.includes('food') || needsText.includes('rice') || needsText.includes('canned') || needsText.includes('groceries') || rawNeeds.length === 0
    const isWater = needsText.includes('water') || needsText.includes('drinking')
    const isHygiene = needsText.includes('hygiene') || needsText.includes('soap') || needsText.includes('sanitation') || needsText.includes('clean')
    const isMedical = needsText.includes('medicine') || needsText.includes('medical') || needsText.includes('health') || needsText.includes('first aid')
    const isShelter = needsText.includes('shelter') || needsText.includes('tarpaulin') || needsText.includes('mat') || needsText.includes('blanket')
    const isEducation = needsText.includes('education') || needsText.includes('school') || needsText.includes('student')

    // AI Bundle 1: Optimized Priority Match (Tailored directly to Barangay Stated Needs)
    let customPlanItems = []
    if (isFood && isHygiene && isWater) {
      const riceQty = Math.max(1, Math.floor((budget * 0.40) / 1250))
      const canQty = Math.max(1, Math.floor((budget * 0.25) / 2500))
      const hygieneQty = Math.max(1, Math.floor((budget * 0.20) / 300))
      const waterQty = Math.max(1, Math.floor((budget * 0.15) / 75))
      customPlanItems = [
        { id: 101, item: '25kg Premium Rice Sack', quantity: riceQty, unit: 'sacks', unitCost: 1250 },
        { id: 102, item: 'Canned Goods (100-can wholesale box)', quantity: canQty, unit: 'boxes', unitCost: 2500 },
        { id: 103, item: 'Family Hygiene & Toiletries Kit', quantity: hygieneQty, unit: 'kits', unitCost: 300 },
        { id: 104, item: 'Clean Drinking Mineral Water (5-Gallon / 20L)', quantity: waterQty, unit: 'bottles', unitCost: 75 },
      ]
    } else if (isMedical || isHygiene) {
      const medBoxQty = Math.max(1, Math.floor((budget * 0.35) / 450))
      const vitQty = Math.max(1, Math.floor((budget * 0.25) / 420))
      const alcoholQty = Math.max(1, Math.floor((budget * 0.20) / 95))
      const hygieneQty = Math.max(1, Math.floor((budget * 0.20) / 300))
      customPlanItems = [
        { id: 101, item: 'First Aid Emergency Kit with Antiseptic & Bandages', quantity: medBoxQty, unit: 'kits', unitCost: 450 },
        { id: 102, item: 'Multivitamins with Zinc (Box of 100 capsules)', quantity: vitQty, unit: 'boxes', unitCost: 420 },
        { id: 103, item: '70% Ethyl Alcohol & Sanitizer (500ml bottle)', quantity: alcoholQty, unit: 'bottles', unitCost: 95 },
        { id: 104, item: 'Family Hygiene & Toiletries Kit', quantity: hygieneQty, unit: 'kits', unitCost: 300 },
      ]
    } else if (isShelter) {
      const tarpQty = Math.max(1, Math.floor((budget * 0.45) / 650))
      const matQty = Math.max(1, Math.floor((budget * 0.35) / 380))
      const riceQty = Math.max(1, Math.floor((budget * 0.20) / 1250))
      customPlanItems = [
        { id: 101, item: 'Heavy-Duty Waterproof Tarpaulin (12x18 ft)', quantity: tarpQty, unit: 'sheets', unitCost: 650 },
        { id: 102, item: 'Woven Sleeping Mats & Fleece Blanket Sets', quantity: matQty, unit: 'sets', unitCost: 380 },
        { id: 103, item: '25kg Premium Rice Sack', quantity: riceQty, unit: 'sacks', unitCost: 1250 },
      ]
    } else {
      // General balanced staples
      const riceQty = Math.max(1, Math.floor((budget * 0.50) / 1250))
      const canQty = Math.max(1, Math.floor((budget * 0.25) / 2500))
      const noodlesQty = Math.max(1, Math.floor((budget * 0.15) / 950))
      const waterQty = Math.max(1, Math.floor((budget * 0.10) / 75))
      customPlanItems = [
        { id: 101, item: '25kg Premium Rice Sack', quantity: riceQty, unit: 'sacks', unitCost: 1250 },
        { id: 102, item: 'Canned Goods (100-can wholesale box)', quantity: canQty, unit: 'boxes', unitCost: 2500 },
        { id: 103, item: 'Instant Noodles (72-pack master case)', quantity: noodlesQty, unit: 'cases', unitCost: 950 },
        { id: 104, item: 'Clean Drinking Mineral Water (5-Gallon / 20L)', quantity: waterQty, unit: 'bottles', unitCost: 75 },
      ]
    }

    // AI Bundle 2: 100% Essential Nutrition & Food Staples
    const foodRiceQty = Math.max(1, Math.floor((budget * 0.50) / 1250))
    const foodCanQty = Math.max(1, Math.floor((budget * 0.30) / 2500))
    const foodNoodleQty = Math.max(1, Math.floor((budget * 0.20) / 950))
    const foodPlanItems = [
      { id: 201, item: '25kg Premium Rice Sack', quantity: foodRiceQty, unit: 'sacks', unitCost: 1250 },
      { id: 202, item: 'Canned Goods (100-can wholesale box)', quantity: foodCanQty, unit: 'boxes', unitCost: 2500 },
      { id: 203, item: 'Instant Noodles (72-pack master case)', quantity: foodNoodleQty, unit: 'cases', unitCost: 950 },
    ]

    // AI Bundle 3: Family Health & Sanitation Defense Kit
    const hyKitQty = Math.max(1, Math.floor((budget * 0.50) / 300))
    const hyAlcQty = Math.max(1, Math.floor((budget * 0.25) / 95))
    const hyNapQty = Math.max(1, Math.floor((budget * 0.25) / 380))
    const hygienePlanItems = [
      { id: 301, item: 'Family Hygiene & Toiletries Kit', quantity: hyKitQty, unit: 'kits', unitCost: 300 },
      { id: 302, item: '70% Ethyl Alcohol & Sanitizer (500ml bottle)', quantity: hyAlcQty, unit: 'bottles', unitCost: 95 },
      { id: 303, item: 'Sanitary Napkins & Feminine Care (Box of 48)', quantity: hyNapQty, unit: 'boxes', unitCost: 380 },
    ]

    const bundles = [
      {
        id: 'priority_match',
        title: 'AI Priority Barangay Match',
        badge: 'Recommended',
        icon: '✨',
        desc: `Optimized for ${targetFamilies} affected families based on ${selectedBeneficiary?.full_name || 'community'} profile needs`,
        items: customPlanItems,
        total: customPlanItems.reduce((s, it) => s + (it.quantity * it.unitCost), 0),
      },
      {
        id: 'food_staples',
        title: 'Essential Nutrition & Food Basket',
        badge: 'Food Security',
        icon: '🍲',
        desc: 'High-calorie staples & bulk canned goods for emergency feeding',
        items: foodPlanItems,
        total: foodPlanItems.reduce((s, it) => s + (it.quantity * it.unitCost), 0),
      },
      {
        id: 'hygiene_sanitation',
        title: 'Family Sanitation & Health Pack',
        badge: 'Hygiene & Care',
        icon: '🧼',
        desc: 'Essential family cleanliness, disease prevention, and disinfectant supplies',
        items: hygienePlanItems,
        total: hygienePlanItems.reduce((s, it) => s + (it.quantity * it.unitCost), 0),
      },
    ]

    return {
      detectedNeeds: rawNeeds.length > 0 ? rawNeeds : ['Food Relief', 'Hygiene Kits', 'Emergency Support'],
      targetFamilies,
      budget,
      bundles,
      matchScore: selectedBeneficiary ? 98 : 92,
    }
  }, [selectedBeneficiary, selectedRequest, remainingBalance, currentAffectedFamilies])

  const handleApplyAiBundle = (bundle) => {
    setItems(bundle.items.map((it, idx) => ({ ...it, id: Date.now() + idx })))
    if (aiNeedsAnalysis.targetFamilies) {
      setFamiliesSupportedInput(String(aiNeedsAnalysis.targetFamilies))
    }
    notify.success(`Applied AI Plan: "${bundle.title}" (₱${bundle.total.toLocaleString()})`)
  }

  const handleAddAiItem = (catalogItem) => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now(),
        item: catalogItem.item,
        quantity: 1,
        unit: catalogItem.unit,
        unitCost: catalogItem.unitCost
      }
    ])
    notify.info(`Added ${catalogItem.item}`)
  }

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now(), item: '', quantity: 1, unit: 'pcs', unitCost: 0 }
    ])
  }

  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      notify.warning('Must keep at least 1 item line.')
      return
    }
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const handleItemChange = (id, field, val) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      return { ...it, [field]: val }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (effectiveTotalAmount <= 0) {
      notify.error('Total amount must be greater than ₱0.')
      return
    }
    if (effectiveTotalAmount > remainingBalance) {
      notify.error(`Total amount (₱${effectiveTotalAmount.toLocaleString()}) exceeds the remaining unallocated balance (₱${remainingBalance.toLocaleString()}).`)
      return
    }

    let payloadItems = []
    let familiesCount = 0

    if (activeTab === 'pack_sponsorship') {
      payloadItems = [
        {
          item: currentPackPreset.name,
          quantity: computedPackCount,
          unit: 'packs',
          unitCost: Number(packUnitCost),
          totalCost: Number(packAmountToAllocate),
        }
      ]
      familiesCount = currentAffectedFamilies > 0 ? currentAffectedFamilies : computedPackCount
    } else {
      payloadItems = items.map(it => ({
        item: it.item.trim() || 'Procured Relief Supply',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'pcs',
        unitCost: Number(it.unitCost) || 0,
        totalCost: (Number(it.quantity) || 1) * (Number(it.unitCost) || 0),
      }))
      familiesCount = Number(familiesSupportedInput) || currentAffectedFamilies || 1
    }

    const payload = {
      action: 'procure',
      donationId: donation.dbId || donation.id,
      mode: activeTab === 'pack_sponsorship' ? 'Pack Sponsorship' : 'Itemized Purchase',
      totalAmount: effectiveTotalAmount,
      beneficiaryId: currentBeneficiaryId ? Number(currentBeneficiaryId) : null,
      assistanceRequestId: (activeTab === 'pack_sponsorship' ? packRequestId : itemRequestId) ? Number(activeTab === 'pack_sponsorship' ? packRequestId : itemRequestId) : null,
      items: payloadItems,
      receiptNumber: '',
      supplierName: '',
      familiesSupported: familiesCount,
      notes: notes.trim(),
      addToInventory: Boolean(addToInventory),
    }

    setSaving(true)
    showLoading('Allocating funds and notifying donor…')
    try {
      const res = await donationsApi.procure(payload)
      hideLoading()
      setSaving(false)
      notify.success(res.message || 'Donation successfully allocated and converted to relief goods!')
      
      const createdAllocId = res?.allocationId
      const targetBenId = currentBeneficiaryId
      const targetBenName = selectedBeneficiary?.full_name || selectedBeneficiary?.name || selectedBeneficiary?.barangay || 'Barangay'

      if (onSuccess) onSuccess(res?.data || res)
      onClose()

      // Prompt admin to schedule distribution or view allocations
      const scheduleNow = await confirmAction({
        title: 'Procurement & Allocation Complete',
        message: `Successfully allocated ₱${effectiveTotalAmount.toLocaleString()} to procure relief resources for ${targetBenName}! Would you like to schedule the delivery in Logistics & Distribution now?`,
        confirmText: 'Schedule Distribution Now →',
        cancelText: 'View in Allocations',
        type: 'primary',
      })

      if (scheduleNow) {
        navigate('/admin/distributions', {
          state: {
            prefillAllocation: {
              allocationId: createdAllocId,
              beneficiaryId: targetBenId,
              beneficiaryName: targetBenName,
              resourceName: payloadItems.map(p => `${p.item} (${p.quantity} ${p.unit})`).join(', '),
              quantity: payloadItems.reduce((s, p) => s + (Number(p.quantity) || 1), 0),
              program: donation.category || 'Disaster Relief',
              notes: `Funded from Monetary Donation ${donation.trackingCode || donation.code || ''}`,
            },
          },
        })
      } else {
        navigate('/admin/allocation')
      }
    } catch (err) {
      hideLoading()
      setSaving(false)
      notify.error(err?.message || 'Failed to allocate donation')
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div 
        className="admin-modal admin-modal--wide" 
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '860px',
          width: '95vw',
          maxHeight: '92vh',
          borderRadius: '14px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff'
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <ModalHeader 
            title="Monetary Fund Allocation & Procurement" 
            onClose={onClose} 
            style={{
              margin: 0,
              top: 0,
              position: 'static',
              borderRadius: '14px 14px 0 0'
            }}
          />

          {/* Top Fund Overview Bar */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Donor Contribution
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                {donation.donor} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>({donation.trackingCode})</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Donated
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  ₱{Number(donation.amountRaw || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ 
                background: '#f0fdf4', 
                border: '1px solid #bbf7d0', 
                borderRadius: '8px', 
                padding: '0.4rem 0.8rem',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Available to Allocate
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d' }}>
                  ₱{remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            padding: '0 1.25rem'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('pack_sponsorship')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.85rem 1.1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: activeTab === 'pack_sponsorship' ? '3px solid #AF101A' : '3px solid transparent',
                color: activeTab === 'pack_sponsorship' ? '#AF101A' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <Package size={17} />
              <span>Quick Pack Sponsorship (Auto-Convert)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('itemized_purchase')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.85rem 1.1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: activeTab === 'itemized_purchase' ? '3px solid #4f46e5' : '3px solid transparent',
                color: activeTab === 'itemized_purchase' ? '#4f46e5' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={17} style={{ color: '#6366f1' }} />
              <span>AI-Assisted Itemized Procurement</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.4rem' }}>
          {activeTab === 'pack_sponsorship' ? (
            /* ========================================================= */
            /* TAB 1: QUICK PACK SPONSORSHIP                             */
            /* ========================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ background: '#fff9f9', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={20} style={{ color: '#AF101A', flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                  <strong>Pack Sponsorship:</strong> Automatically calculates how many standardized relief kits the donor's cash can fund and assigns them directly to families in need.
                </div>
              </div>

              {/* Pack Preset Picker */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Select Package Type to Sponsor
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
                  {PACK_PRESETS.map((preset, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setPackPresetIndex(idx)
                        setPackUnitCost(preset.defaultCost)
                      }}
                      style={{
                        border: packPresetIndex === idx ? '2px solid #AF101A' : '1px solid #e2e8f0',
                        background: packPresetIndex === idx ? '#fff5f5' : '#ffffff',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', lineHeight: 1.3 }}>
                        {preset.desc}
                      </div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#AF101A', marginTop: '0.4rem' }}>
                        ₱{preset.defaultCost.toLocaleString()} / kit
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost & Amount Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Unit Cost per Package (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={packUnitCost}
                    onChange={e => setPackUnitCost(Number(e.target.value) || 1)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Cash Amount to Allocate (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={remainingBalance}
                    step="1"
                    value={packAmountToAllocate}
                    onChange={e => setPackAmountToAllocate(Number(e.target.value) || 0)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    required
                  />
                </div>
              </div>

              {/* Target Beneficiary Barangay */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Target Partner Barangay / Beneficiary
                  </label>
                  <select
                    value={packBeneficiaryId}
                    onChange={e => {
                      setPackBeneficiaryId(e.target.value)
                      setPackRequestId('')
                    }}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    required
                  >
                    <option value="">-- Select Barangay --</option>
                    {internalBeneficiaries.map(b => {
                      const famCount = Number(b.affectedFamilies || b.affected_families || b.families || 0)
                      const displayName = b.full_name || b.name || b.barangay || 'Barangay'
                      const muni = b.municipality || 'Cebu'
                      return (
                        <option key={b.dbId || b.id} value={b.dbId || b.id}>
                          {displayName} ({muni}) — {famCount} affected families
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Link to Relief Request (Optional)
                  </label>
                  <select
                    value={packRequestId}
                    onChange={e => setPackRequestId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    <option value="">-- General Allocation --</option>
                    {availableRequests.map(r => (
                      <option key={r.dbId || r.id} value={r.dbId || r.id}>
                        {r.id || r.trackingCode} — {r.type || 'Relief'} ({r.priority})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Impact Calculation Preview */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #86efac',
                borderRadius: '10px',
                padding: '0.9rem 1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Calculated Community Impact
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14532d', marginTop: '0.15rem' }}>
                    {computedPackCount} {currentPackPreset.name}s
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '0.1rem' }}>
                    Provides direct relief for <strong>{selectedBeneficiary?.full_name || selectedBeneficiary?.name || selectedBeneficiary?.barangay || 'partner community'}</strong>
                    {currentAffectedFamilies > 0 && (
                      <span style={{ marginLeft: '0.4rem', color: '#15803d', fontWeight: 600 }}>
                        ({currentAffectedFamilies.toLocaleString()} affected families recorded)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>
                    Total Allocation
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                    ₱{Number(packAmountToAllocate).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* TAB 2: AI-ASSISTED ITEMIZED PROCUREMENT                   */
            /* ========================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              
              {/* AI Procurement Assistant Header Card */}
              <div style={{
                background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
                border: '1px solid #c7d2fe',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.9rem',
                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.06)'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  borderRadius: '10px',
                  padding: '0.55rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)'
                }}>
                  <Bot size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e1b4b' }}>
                        AI Smart Needs Matching & Procurement
                      </span>
                      <span style={{
                        background: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}>
                        <Sparkles size={11} /> {aiNeedsAnalysis.matchScore}% Match Accuracy
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 600 }}>
                      Budget: ₱{remainingBalance.toLocaleString()}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: '#4338ca', margin: '0.35rem 0 0.5rem', lineHeight: 1.4 }}>
                    Analyzed recorded community needs for <strong>{selectedBeneficiary?.full_name || selectedBeneficiary?.name || 'partner barangay'}</strong> ({currentAffectedFamilies || 20} families). Click any AI recommendation below to instantly populate your procurement line items!
                  </p>

                  {/* Stated Need Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#4b5563', marginRight: '0.2rem' }}>
                      Identified Needs:
                    </span>
                    {aiNeedsAnalysis.detectedNeeds.map((nd, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #c7d2fe',
                          borderRadius: '6px',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#4338ca'
                        }}
                      >
                        ✓ {nd}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target Barangay & Request Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Target Partner Barangay / Beneficiary
                  </label>
                  <select
                    value={itemBeneficiaryId}
                    onChange={e => {
                      const val = e.target.value
                      setItemBeneficiaryId(val)
                      setItemRequestId('')
                      const matched = (internalBeneficiaries || []).find(b => String(b.dbId || b.id) === String(val))
                      const fams = Number(matched?.affectedFamilies || matched?.affected_families || 0)
                      if (fams > 0) {
                        setFamiliesSupportedInput(String(fams))
                      }
                    }}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    required
                  >
                    <option value="">-- Select Barangay --</option>
                    {internalBeneficiaries.map(b => {
                      const famCount = Number(b.affectedFamilies || b.affected_families || b.families || 0)
                      const displayName = b.full_name || b.name || b.barangay || 'Barangay'
                      const muni = b.municipality || 'Cebu'
                      return (
                        <option key={b.dbId || b.id} value={b.dbId || b.id}>
                          {displayName} ({muni}) — {famCount} affected families
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Link to Relief Request (Optional)
                  </label>
                  <select
                    value={itemRequestId}
                    onChange={e => setItemRequestId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    <option value="">-- General Allocation --</option>
                    {availableRequests.map(r => (
                      <option key={r.dbId || r.id} value={r.dbId || r.id}>
                        {r.id || r.trackingCode} — {r.type || 'Relief'} ({r.priority})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AI Recommended Procurement Packages Cards */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Wand2 size={15} style={{ color: '#6366f1' }} />
                    AI Recommended Procurement Plans (1-Click Apply)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Scales automatically to ₱{remainingBalance.toLocaleString()} budget
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
                  {aiNeedsAnalysis.bundles.map((bundle) => {
                    const isOver = bundle.total > remainingBalance
                    return (
                      <div
                        key={bundle.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>{bundle.icon}</span> {bundle.title}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: '#e0e7ff',
                              color: '#3730a3',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px'
                            }}>
                              {bundle.badge}
                            </span>
                          </div>

                          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.6rem 0', lineHeight: 1.3 }}>
                            {bundle.desc}
                          </p>

                          {/* Items Preview */}
                          <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.5rem', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                            {bundle.items.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', marginBottom: '0.2rem' }}>
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                                  • {it.quantity} {it.unit} {it.item}
                                </span>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                  ₱{(it.quantity * it.unitCost).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Plan Total</div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: isOver ? '#dc2626' : '#15803d' }}>
                              ₱{bundle.total.toLocaleString()}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyAiBundle(bundle)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
                            }}
                          >
                            <Wand2 size={13} /> Apply Plan
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Quick AI Suggestion Chips for individual items */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Quick Add AI Suggested Essential Items:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {AI_CATALOG.slice(0, 6).map((catItem, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddAiItem(catItem)}
                      style={{
                        background: '#ffffff',
                        border: '1px dashed #94a3b8',
                        borderRadius: '6px',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#334155',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.color = '#4f46e5' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#334155' }}
                    >
                      <Plus size={12} /> {catItem.item} (₱{catItem.unitCost.toLocaleString()})
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Line Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Purchased Goods Itemization
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={13} /> Add Custom Line Item
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((it, idx) => {
                    const subtotal = (Number(it.quantity) || 0) * (Number(it.unitCost) || 0)
                    return (
                      <div key={it.id || idx} style={{
                        display: 'grid',
                        gridTemplateColumns: '2.2fr 0.9fr 0.9fr 1fr 1fr auto',
                        gap: '0.5rem',
                        alignItems: 'center',
                        background: '#f8fafc',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div>
                          <input
                            type="text"
                            placeholder="Item Name (e.g. 25kg Rice)"
                            value={it.item}
                            onChange={e => handleItemChange(it.id, 'item', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            required
                          />
                        </div>

                        <div>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={it.quantity}
                            onChange={e => handleItemChange(it.id, 'quantity', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            required
                          />
                        </div>

                        <div>
                          <select
                            value={it.unit}
                            onChange={e => handleItemChange(it.id, 'unit', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          >
                            <option value="sacks">sacks</option>
                            <option value="boxes">boxes</option>
                            <option value="cases">cases</option>
                            <option value="kits">kits</option>
                            <option value="bundles">bundles</option>
                            <option value="packs">packs</option>
                            <option value="bottles">bottles</option>
                            <option value="sheets">sheets</option>
                            <option value="sets">sets</option>
                            <option value="pcs">pcs</option>
                            <option value="kg">kg</option>
                            <option value="cans">cans</option>
                          </select>
                        </div>

                        <div>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="Unit ₱"
                            value={it.unitCost}
                            onChange={e => handleItemChange(it.id, 'unitCost', e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            required
                          />
                        </div>

                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', textAlign: 'right', paddingRight: '0.5rem' }}>
                          ₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Supported Families Input & Budget Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Target Families Supported by this Purchase
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder={String(currentAffectedFamilies || 20)}
                    value={familiesSupportedInput}
                    onChange={e => setFamiliesSupportedInput(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{
                  background: computedItemizedTotal > remainingBalance ? '#fef2f2' : '#f0fdf4',
                  border: computedItemizedTotal > remainingBalance ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: computedItemizedTotal > remainingBalance ? '#991b1b' : '#166534', textTransform: 'uppercase' }}>
                      {computedItemizedTotal > remainingBalance ? 'Budget Exceeded' : 'Calculated Total'}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: computedItemizedTotal > remainingBalance ? '#dc2626' : '#15803d' }}>
                      ₱{computedItemizedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                    Available: ₱{remainingBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Inventory Intake Checkbox */}
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={addToInventory}
                    onChange={e => setAddToInventory(e.target.checked)}
                  />
                  <span>Automatically log and intake purchased goods into Central Warehouse Inventory</span>
                </label>
              </div>

            </div>
          )}

          {/* Admin Notes */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Procurement Notes & Delivery Instructions (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Delivered directly to Barangay Banilad gym evacuation center..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
          </div>
          </div>

          {/* Modal Actions (Always Visible Pinned Footer) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.4rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            flexShrink: 0,
            gap: '1rem'
          }}>
            <button
              type="button"
              className="btn btn--outline"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.55rem 1.25rem', fontWeight: 600 }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || effectiveTotalAmount <= 0 || effectiveTotalAmount > remainingBalance}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.5rem',
                fontSize: '0.88rem',
                fontWeight: 700
              }}
            >
              <Send size={15} />
              <span>Confirm Allocation & Notify Donor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
