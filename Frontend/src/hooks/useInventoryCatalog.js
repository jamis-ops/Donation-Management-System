import { useState, useEffect, useCallback } from 'react'
import { inventoryCatalogApi } from '../api/resources'

export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Water', icon: 'Droplets', isActive: true },
  { id: 2, name: 'Food', icon: 'Utensils', isActive: true },
  { id: 3, name: 'Clothing', icon: 'Shirt', isActive: true },
  { id: 4, name: 'Medical Supplies', icon: 'HeartPulse', isActive: true },
  { id: 5, name: 'Hygiene Kits', icon: 'Sparkles', isActive: true },
  { id: 6, name: 'Shelter & Bedding', icon: 'Home', isActive: true },
  { id: 7, name: 'Logistics & Equipment', icon: 'Truck', isActive: true },
]

export const DEFAULT_ITEM_TYPES = [
  // Water
  { id: 1, categoryName: 'Water', name: 'Bottled Water', defaultUnit: 'bottles', defaultLowThreshold: 100, isActive: true },
  { id: 2, categoryName: 'Water', name: 'Mineral Water Gallons', defaultUnit: 'gallons', defaultLowThreshold: 20, isActive: true },
  { id: 3, categoryName: 'Water', name: 'Distilled Water', defaultUnit: 'bottles', defaultLowThreshold: 50, isActive: true },
  { id: 4, categoryName: 'Water', name: 'Water Purification Tablets', defaultUnit: 'packs', defaultLowThreshold: 50, isActive: true },

  // Food
  { id: 5, categoryName: 'Food', name: 'Canned Goods', defaultUnit: 'cans', defaultLowThreshold: 150, isActive: true },
  { id: 6, categoryName: 'Food', name: 'Rice', defaultUnit: 'sacks', defaultLowThreshold: 25, isActive: true },
  { id: 7, categoryName: 'Food', name: 'Instant Noodles', defaultUnit: 'packs', defaultLowThreshold: 200, isActive: true },
  { id: 8, categoryName: 'Food', name: 'Biscuits & Snacks', defaultUnit: 'packs', defaultLowThreshold: 100, isActive: true },
  { id: 9, categoryName: 'Food', name: 'Cooking Oil', defaultUnit: 'bottles', defaultLowThreshold: 40, isActive: true },
  { id: 10, categoryName: 'Food', name: 'Powdered Milk & Dairy', defaultUnit: 'pouches', defaultLowThreshold: 60, isActive: true },
  { id: 11, categoryName: 'Food', name: 'Baby Food & Formula', defaultUnit: 'cans', defaultLowThreshold: 30, isActive: true },

  // Clothing
  { id: 12, categoryName: 'Clothing', name: 'T-Shirts & Tops', defaultUnit: 'pcs', defaultLowThreshold: 100, isActive: true },
  { id: 13, categoryName: 'Clothing', name: 'Pants & Shorts', defaultUnit: 'pcs', defaultLowThreshold: 80, isActive: true },
  { id: 14, categoryName: 'Clothing', name: 'Blankets & Linens', defaultUnit: 'pcs', defaultLowThreshold: 50, isActive: true },
  { id: 15, categoryName: 'Clothing', name: 'Footwear & Slippers', defaultUnit: 'pairs', defaultLowThreshold: 50, isActive: true },
  { id: 16, categoryName: 'Clothing', name: 'Jackets & Raincoats', defaultUnit: 'pcs', defaultLowThreshold: 30, isActive: true },
  { id: 17, categoryName: 'Clothing', name: 'Undergarments', defaultUnit: 'packs', defaultLowThreshold: 60, isActive: true },

  // Medical
  { id: 18, categoryName: 'Medical Supplies', name: 'First Aid Kits', defaultUnit: 'kits', defaultLowThreshold: 30, isActive: true },
  { id: 19, categoryName: 'Medical Supplies', name: 'Pain Relievers & Fever', defaultUnit: 'boxes', defaultLowThreshold: 50, isActive: true },
  { id: 20, categoryName: 'Medical Supplies', name: 'Antiseptics & Bandages', defaultUnit: 'bottles', defaultLowThreshold: 40, isActive: true },
  { id: 21, categoryName: 'Medical Supplies', name: 'Antibiotics & Prescription', defaultUnit: 'boxes', defaultLowThreshold: 30, isActive: true },
  { id: 22, categoryName: 'Medical Supplies', name: 'PPE & Face Masks', defaultUnit: 'boxes', defaultLowThreshold: 50, isActive: true },
  { id: 23, categoryName: 'Medical Supplies', name: 'Medical Devices', defaultUnit: 'units', defaultLowThreshold: 15, isActive: true },

  // Hygiene
  { id: 24, categoryName: 'Hygiene Kits', name: 'Standard Hygiene Kit', defaultUnit: 'kits', defaultLowThreshold: 50, isActive: true },
  { id: 25, categoryName: 'Hygiene Kits', name: 'Bath Soap & Body Wash', defaultUnit: 'bars', defaultLowThreshold: 120, isActive: true },
  { id: 26, categoryName: 'Hygiene Kits', name: 'Toothpaste & Brushes', defaultUnit: 'packs', defaultLowThreshold: 100, isActive: true },
  { id: 27, categoryName: 'Hygiene Kits', name: 'Sanitary Pads', defaultUnit: 'packs', defaultLowThreshold: 80, isActive: true },
  { id: 28, categoryName: 'Hygiene Kits', name: 'Baby Diapers', defaultUnit: 'packs', defaultLowThreshold: 50, isActive: true },
  { id: 29, categoryName: 'Hygiene Kits', name: 'Hand Sanitizers & Alcohol', defaultUnit: 'bottles', defaultLowThreshold: 60, isActive: true },

  // Shelter
  { id: 30, categoryName: 'Shelter & Bedding', name: 'Tarpaulins & Plastic Sheets', defaultUnit: 'pcs', defaultLowThreshold: 40, isActive: true },
  { id: 31, categoryName: 'Shelter & Bedding', name: 'Sleeping Mats (Banig)', defaultUnit: 'pcs', defaultLowThreshold: 50, isActive: true },
  { id: 32, categoryName: 'Shelter & Bedding', name: 'Emergency Tents', defaultUnit: 'units', defaultLowThreshold: 15, isActive: true },
  { id: 33, categoryName: 'Shelter & Bedding', name: 'Mosquito Nets', defaultUnit: 'pcs', defaultLowThreshold: 40, isActive: true },

  // Logistics & Equipment
  { id: 34, categoryName: 'Logistics & Equipment', name: 'Flashlights & Torches', defaultUnit: 'units', defaultLowThreshold: 30, isActive: true },
  { id: 35, categoryName: 'Logistics & Equipment', name: 'Batteries', defaultUnit: 'packs', defaultLowThreshold: 60, isActive: true },
  { id: 36, categoryName: 'Logistics & Equipment', name: 'Ropes & Tie-Downs', defaultUnit: 'rolls', defaultLowThreshold: 25, isActive: true },
  { id: 37, categoryName: 'Logistics & Equipment', name: 'Storage Boxes & Crates', defaultUnit: 'boxes', defaultLowThreshold: 30, isActive: true },
]

export const DEFAULT_UNITS = [
  { id: 1, name: 'bottles', abbreviation: 'btl', isActive: true },
  { id: 2, name: 'cans', abbreviation: 'can', isActive: true },
  { id: 3, name: 'sacks', abbreviation: 'sck', isActive: true },
  { id: 4, name: 'packs', abbreviation: 'pck', isActive: true },
  { id: 5, name: 'pcs', abbreviation: 'pcs', isActive: true },
  { id: 6, name: 'boxes', abbreviation: 'box', isActive: true },
  { id: 7, name: 'kits', abbreviation: 'kit', isActive: true },
  { id: 8, name: 'kg', abbreviation: 'kg', isActive: true },
  { id: 9, name: 'gallons', abbreviation: 'gal', isActive: true },
]

export function useInventoryCatalog(options = {}) {
  const { activeOnly = true } = options
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [itemTypes, setItemTypes] = useState(DEFAULT_ITEM_TYPES)
  const [brands, setBrands] = useState([])
  const [variants, setVariants] = useState([])
  const [units, setUnits] = useState(DEFAULT_UNITS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // First try fetching the entire catalog via single unified response
      const res = await inventoryCatalogApi.list('', { activeOnly })
      const data = res?.data

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Merge categories with defaults to guarantee all 7 standard categories exist
        const catMap = new Map()
        DEFAULT_CATEGORIES.forEach((c) => catMap.set(c.name.toLowerCase(), c))
        if (Array.isArray(data.categories)) {
          data.categories.forEach((c) => {
            if (c && c.name) catMap.set(c.name.toLowerCase(), { ...c, name: c.name })
          })
        }
        setCategories(Array.from(catMap.values()))

        // Merge item types with defaults
        const typeMap = new Map()
        DEFAULT_ITEM_TYPES.forEach((t) => typeMap.set(`${(t.categoryName || '').toLowerCase()}::${t.name.toLowerCase()}`, t))
        if (Array.isArray(data.itemTypes)) {
          data.itemTypes.forEach((t) => {
            if (t && t.name) typeMap.set(`${(t.categoryName || '').toLowerCase()}::${t.name.toLowerCase()}`, t)
          })
        }
        setItemTypes(Array.from(typeMap.values()))

        if (Array.isArray(data.brands) && data.brands.length > 0) setBrands(data.brands)
        if (Array.isArray(data.variants) && data.variants.length > 0) setVariants(data.variants)
        if (Array.isArray(data.units) && data.units.length > 0) setUnits(data.units)
      } else if (Array.isArray(data) && data.length > 0) {
        const catMap = new Map()
        DEFAULT_CATEGORIES.forEach((c) => catMap.set(c.name.toLowerCase(), c))
        data.forEach((c) => {
          if (c && c.name) catMap.set(c.name.toLowerCase(), c)
        })
        setCategories(Array.from(catMap.values()))
      }
    } catch (err) {
      console.warn('Inventory catalog load warning (using defaults):', err)
      setError(err?.message || 'Using offline catalog defaults')
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const getItemTypesByCategory = useCallback(
    (categoryIdentifier) => {
      const types = Array.isArray(itemTypes) ? itemTypes : []
      const cats = Array.isArray(categories) ? categories : []
      if (!categoryIdentifier) return types

      const cat = cats.find(
        (c) =>
          c &&
          (c.id === categoryIdentifier ||
            String(c.id) === String(categoryIdentifier) ||
            (c.name && c.name.toLowerCase() === String(categoryIdentifier).toLowerCase()))
      )

      if (!cat) {
        // Fallback: match by categoryName property directly
        const matched = types.filter(
          (t) => t && t.categoryName && t.categoryName.toLowerCase() === String(categoryIdentifier).toLowerCase()
        )
        return matched.length > 0 ? matched : types
      }

      const filtered = types.filter(
        (t) =>
          t &&
          (!t.categoryId || t.categoryId === cat.id) &&
          (!t.categoryName || t.categoryName.toLowerCase() === cat.name.toLowerCase())
      )
      return filtered.length > 0 ? filtered : types
    },
    [categories, itemTypes]
  )

  const getBrandsByItemType = useCallback(
    (typeIdentifier) => {
      const allBrands = Array.isArray(brands) ? brands : []
      const allTypes = Array.isArray(itemTypes) ? itemTypes : []
      if (!typeIdentifier) return allBrands

      const t = allTypes.find(
        (item) =>
          item &&
          (item.id === typeIdentifier ||
            String(item.id) === String(typeIdentifier) ||
            (item.name && item.name.toLowerCase() === String(typeIdentifier).toLowerCase()))
      )

      if (!t) return allBrands
      return allBrands.filter(
        (b) => b && (!b.itemTypeId || b.itemTypeId === t.id || !b.itemTypeName || b.itemTypeName === t.name)
      )
    },
    [itemTypes, brands]
  )

  const getVariantsByItemType = useCallback(
    (typeIdentifier) => {
      const allVariants = Array.isArray(variants) ? variants : []
      const allTypes = Array.isArray(itemTypes) ? itemTypes : []
      if (!typeIdentifier) return allVariants

      const t = allTypes.find(
        (item) =>
          item &&
          (item.id === typeIdentifier ||
            String(item.id) === String(typeIdentifier) ||
            (item.name && item.name.toLowerCase() === String(typeIdentifier).toLowerCase()))
      )

      if (!t) return allVariants
      return allVariants.filter(
        (v) => v && (!v.itemTypeId || v.itemTypeId === t.id || !v.itemTypeName || v.itemTypeName === t.name)
      )
    },
    [itemTypes, variants]
  )

  return {
    categories: Array.isArray(categories) ? categories : [],
    itemTypes: Array.isArray(itemTypes) ? itemTypes : [],
    brands: Array.isArray(brands) ? brands : [],
    variants: Array.isArray(variants) ? variants : [],
    units: Array.isArray(units) ? units : [],
    loading,
    error,
    refreshCatalog: fetchAll,
    getItemTypesByCategory,
    getBrandsByItemType,
    getVariantsByItemType,
  }
}
