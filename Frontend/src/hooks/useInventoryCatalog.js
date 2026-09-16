import { useState, useEffect, useCallback } from 'react'
import { inventoryCatalogApi } from '../api/resources'

export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Food', icon: 'Utensils', isActive: true },
  { id: 2, name: 'Water', icon: 'Droplets', isActive: true },
  { id: 3, name: 'Clothing', icon: 'Shirt', isActive: true },
  { id: 4, name: 'Medical Supplies', icon: 'HeartPulse', isActive: true },
  { id: 5, name: 'Hygiene Kits', icon: 'Sparkles', isActive: true },
  { id: 6, name: 'Shelter Materials', icon: 'Home', isActive: true },
  { id: 7, name: 'Logistics & Tools', icon: 'Truck', isActive: true },
]

export const DEFAULT_ITEM_TYPES = [
  { id: 1, categoryName: 'Food', name: 'Canned Goods', defaultUnit: 'cans', isActive: true },
  { id: 2, categoryName: 'Food', name: 'Rice', defaultUnit: 'sacks', isActive: true },
  { id: 3, categoryName: 'Food', name: 'Instant Noodles', defaultUnit: 'packs', isActive: true },
  { id: 4, categoryName: 'Water', name: 'Bottled Water', defaultUnit: 'bottles', isActive: true },
  { id: 5, categoryName: 'Clothing', name: 'T-Shirts & Tops', defaultUnit: 'pcs', isActive: true },
  { id: 6, categoryName: 'Clothing', name: 'Blankets & Linens', defaultUnit: 'pcs', isActive: true },
  { id: 7, categoryName: 'Medical Supplies', name: 'First Aid Supplies', defaultUnit: 'kits', isActive: true },
  { id: 8, categoryName: 'Hygiene Kits', name: 'Family Hygiene Pack', defaultUnit: 'kits', isActive: true },
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
        if (Array.isArray(data.categories) && data.categories.length > 0) setCategories(data.categories)
        if (Array.isArray(data.itemTypes)) setItemTypes(data.itemTypes)
        if (Array.isArray(data.brands)) setBrands(data.brands)
        if (Array.isArray(data.variants)) setVariants(data.variants)
        if (Array.isArray(data.units) && data.units.length > 0) setUnits(data.units)
      } else if (Array.isArray(data)) {
        setCategories(data)
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
