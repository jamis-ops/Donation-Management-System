import { useEffect, useMemo, useState, useCallback } from 'react'
import { taskTitlesApi } from '../api/resources'
import { CATALOG_CHANGED_EVENT } from '../utils/catalogSync'

export const TASK_TITLES_CHANGED_EVENT = 'task_titles_changed'

export function notifyTaskTitlesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TASK_TITLES_CHANGED_EVENT))
    window.dispatchEvent(new CustomEvent(CATALOG_CHANGED_EVENT, { detail: { catalog: 'task_titles' } }))
  }
}

/**
 * Reusable hook to fetch active task titles dynamically connected to a selected/enrolled program.
 * Auto-refreshes when task titles are created, edited, toggled, or deleted in the CMS.
 *
 * @param {string} [selectedProgram] - The program or module selected (e.g., 'Community Feeding & Nutrition Program').
 * @returns {{
 *   taskTitles: Array<{id: number, title: string, program: string, description: string, isActive: boolean}>,
 *   options: string[],
 *   loading: boolean,
 *   reload: () => Promise<void>,
 *   allTitles: Array<any>
 * }}
 */
export function useTaskTitles(selectedProgram = '') {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  const reload = useCallback(async () => {
    try {
      const res = await taskTitlesApi.list('?active=1')
      setItems(Array.isArray(res?.data) ? res.data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    taskTitlesApi.list('?active=1')
      .then((res) => {
        if (!active) return
        setItems(Array.isArray(res?.data) ? res.data : [])
      })
      .catch(() => {
        if (active) setItems([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [version])

  useEffect(() => {
    const handleRefresh = (event) => {
      if (!event?.detail?.catalog || event.detail.catalog === 'task_titles') {
        setVersion((v) => v + 1)
      }
    }
    window.addEventListener(TASK_TITLES_CHANGED_EVENT, handleRefresh)
    window.addEventListener(CATALOG_CHANGED_EVENT, handleRefresh)
    return () => {
      window.removeEventListener(TASK_TITLES_CHANGED_EVENT, handleRefresh)
      window.removeEventListener(CATALOG_CHANGED_EVENT, handleRefresh)
    }
  }, [])

  const filteredTitles = useMemo(() => {
    const targetProg = (selectedProgram || '').trim().toLowerCase()
    if (!targetProg || targetProg === 'all' || targetProg === 'all programs') {
      return items
    }

    // Filter items matching the program or general/all programs
    const matched = items.filter((item) => {
      const p = (item.program || '').trim().toLowerCase()
      return p === targetProg || p === 'all programs' || p === 'general' || p === ''
    })

    // If matches exist, return them
    if (matched.length > 0) return matched

    // Fallback: items that contain or are contained in the program name, or general items
    const fuzzy = items.filter((item) => {
      const p = (item.program || '').trim().toLowerCase()
      return p === 'all programs' || p === 'general' || targetProg.includes(p) || p.includes(targetProg)
    })

    return fuzzy.length > 0 ? fuzzy : items
  }, [items, selectedProgram])

  const options = useMemo(() => {
    const set = new Set()
    filteredTitles.forEach((item) => {
      if (item?.title) set.add(item.title.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [filteredTitles])

  return {
    taskTitles: filteredTitles,
    options,
    loading,
    reload,
    allTitles: items,
  }
}
