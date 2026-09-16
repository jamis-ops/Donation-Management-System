import { useState, useEffect, useCallback } from 'react'
import { inventoryCatalogApi } from '../api/resources'

export function useInventoryCatalog(options = {}) {
  const { activeOnly = true } = options
  const [categories, setCategories] = useState([])
  const [itemTypes, setItemTypes] = useState([])
  const [brands, setBrands] = useState([])
  const [variants, setVariants] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catsRes, typesRes, brandsRes, varsRes, unitsRes] = await Promise.all([
        inventoryCatalogApi.list('categories', { activeOnly }),
        inventoryCatalogApi.list('item_types', { activeOnly }),
        inventoryCatalogApi.list('brands', { activeOnly }),
        inventoryCatalogApi.list('variants', { activeOnly }),
        inventoryCatalogApi.list('units', { activeOnly }),
      ])

      setCategories(catsRes?.data || [])
      setItemTypes(typesRes?.data || [])
      setBrands(brandsRes?.data || [])
      setVariants(varsRes?.data || [])
      setUnits(unitsRes?.data || [])
    } catch (err) {
      console.error('Failed to load inventory catalog:', err)
      setError(err?.message || 'Failed to load catalog data')
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const getItemTypesByCategory = useCallback(
    (categoryIdentifier) => {
      if (!categoryIdentifier) return itemTypes
      // Can match by ID or by Category Name
      const cat = categories.find(
        (c) => c.id === categoryIdentifier || String(c.id) === String(categoryIdentifier) || c.name.toLowerCase() === String(categoryIdentifier).toLowerCase()
      )
      if (!cat) return itemTypes
      return itemTypes.filter((t) => !t.categoryId || t.categoryId === cat.id)
    },
    [categories, itemTypes]
  )

  const getBrandsByItemType = useCallback(
    (typeIdentifier) => {
      if (!typeIdentifier) return brands
      const t = itemTypes.find(
        (item) => item.id === typeIdentifier || String(item.id) === String(typeIdentifier) || item.name.toLowerCase() === String(typeIdentifier).toLowerCase()
      )
      if (!t) return brands
      return brands.filter((b) => !b.itemTypeId || b.itemTypeId === t.id)
    },
    [itemTypes, brands]
  )

  const getVariantsByItemType = useCallback(
    (typeIdentifier) => {
      if (!typeIdentifier) return variants
      const t = itemTypes.find(
        (item) => item.id === typeIdentifier || String(item.id) === String(typeIdentifier) || item.name.toLowerCase() === String(typeIdentifier).toLowerCase()
      )
      if (!t) return variants
      return variants.filter((v) => !v.itemTypeId || v.itemTypeId === t.id)
    },
    [itemTypes, variants]
  )

  return {
    categories,
    itemTypes,
    brands,
    variants,
    units,
    loading,
    error,
    refreshCatalog: fetchAll,
    getItemTypesByCategory,
    getBrandsByItemType,
    getVariantsByItemType,
  }
}
