import { useState } from 'react'
import { notify, confirmAction, showSuccessModal } from '../utils/confirm'
import { notifyBadgesChanged } from '../utils/badgeSync'

/**
 * Hook to manage multi-select and bulk operations across admin tables.
 * @param {Array} data - List of table data rows
 * @param {Function} deleteFn - API function to delete a single item by id/dbId (e.g. (id) => donorsApi.remove(id))
 * @param {Function} reloadFn - Function to reload table data after deletion
 * @param {string} noun - Resource name for confirmation and toast messages (e.g. 'donors', 'records')
 * @param {string} idKey - Optional key to identify rows (defaults to checking row.dbId || row.id)
 */
export function useBulkSelection(data, deleteFn, reloadFn, noun = 'records', idKey = null) {
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  const handleBulkDelete = async () => {
    if (!selectedIds.length || deleting) return
    const count = selectedIds.length
    const label = count === 1 ? noun.replace(/s$/, '') : noun

    const confirmed = await confirmAction({
      title: `Delete Selected ${label}`,
      message: `Are you sure you want to permanently delete ${count} selected ${label}? This cannot be undone.`,
      confirmText: `Delete ${count} ${label}`,
      type: 'danger',
    })
    if (!confirmed) return

    setDeleting(true)
    try {
      // Execute deletions
      await Promise.all(selectedIds.map((id) => deleteFn(id)))
      showSuccessModal(`Successfully deleted ${count} ${label}.`)
      setSelectedIds([])
      reloadFn?.()
      notifyBadgesChanged()
    } catch (err) {
      notify.error(err.message || `Failed to delete selected ${noun}`)
      reloadFn?.()
    } finally {
      setDeleting(false)
    }
  }

  const clearSelection = () => setSelectedIds([])

  return {
    selectedIds,
    setSelectedIds,
    deleting,
    handleBulkDelete,
    clearSelection,
  }
}
