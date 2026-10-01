import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

function uniqueOptions(data, key) {
  const set = new Set()
  data.forEach((row) => {
    const v = row[key]
    if (v !== undefined && v !== null && v !== '') set.add(v)
  })
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
}

function getInitialValues(filters, searchStr) {
  const params = new URLSearchParams(searchStr || '')
  const initial = {}
  filters.forEach((f) => {
    const fromParam = params.get(f.key) || params.get(f.optionKey || '')
    initial[f.key] = fromParam || 'all'
  })
  return initial
}

/**
 * Generic client-side filtering for list/table modules with URL query sync.
 */
export function useFilters(data, config = {}) {
  const {
    searchKeys = [], filters = [], dateKey = null,
    dateFromLabel = 'From', dateToLabel = 'To',
  } = config
  const location = useLocation()

  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(location?.search || '')
    return params.get('q') || params.get('search') || ''
  })
  const [values, setValues] = useState(() => getInitialValues(filters, location?.search))
  const [dateFrom, setDateFrom] = useState(() => {
    const params = new URLSearchParams(location?.search || '')
    return params.get('from') || params.get('dateFrom') || ''
  })
  const [dateTo, setDateTo] = useState(() => {
    const params = new URLSearchParams(location?.search || '')
    return params.get('to') || params.get('dateTo') || ''
  })

  // Sync state when URL query changes (e.g. clicking dashboard cards)
  useEffect(() => {
    if (!location?.search) return
    const params = new URLSearchParams(location.search)
    filters.forEach((f) => {
      const fromParam = params.get(f.key) || params.get(f.optionKey || '')
      if (fromParam) {
        setValues((prev) => ({ ...prev, [f.key]: fromParam }))
      }
    })
    const q = params.get('q') || params.get('search')
    if (q !== null) setSearch(q)
    const from = params.get('from') || params.get('dateFrom')
    if (from !== null) setDateFrom(from)
    const to = params.get('to') || params.get('dateTo')
    if (to !== null) setDateTo(to)
  }, [location?.search])

  const options = useMemo(() => {
    const o = {}
    filters.forEach((f) => {
      if (f.options && f.options.length) o[f.key] = f.options
      else if (f.deriveOptions) o[f.key] = f.deriveOptions(data)
      else o[f.key] = uniqueOptions(data, f.optionKey || f.key)
    })
    return o
  }, [data, filters])

  const setValue = (key, val) => setValues((prev) => ({ ...prev, [key]: val }))

  const reset = () => {
    setSearch('')
    setValues(Object.fromEntries(filters.map((f) => [f.key, 'all'])))
    setDateFrom('')
    setDateTo('')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((row) => {
      if (q && searchKeys.length) {
        const hit = searchKeys.some((k) => {
          const v = row[k]
          return v !== undefined && v !== null && String(v).toLowerCase().includes(q)
        })
        if (!hit) return false
      }

      for (const f of filters) {
        const val = values[f.key]
        if (!val || val === 'all') continue
        if (f.match) {
          if (!f.match(row, val)) return false
        } else if (String(row[f.optionKey || f.key]) !== String(val)) {
          return false
        }
      }

      if (dateKey && (dateFrom || dateTo)) {
        const raw = row[dateKey]
        const d = raw && raw !== '—' ? String(raw).slice(0, 10) : ''
        if (!d) return false
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
      }

      return true
    })
  }, [data, search, values, dateFrom, dateTo, searchKeys, filters, dateKey])

  const activeCount =
    (search ? 1 : 0) +
    filters.reduce((n, f) => n + (values[f.key] && values[f.key] !== 'all' ? 1 : 0), 0) +
    (dateFrom || dateTo ? 1 : 0)

  return {
    filtered,
    search,
    setSearch,
    values,
    setValue,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    reset,
    activeCount,
    options,
    config: { searchKeys, filters, dateKey, dateFromLabel, dateToLabel },
  }
}
