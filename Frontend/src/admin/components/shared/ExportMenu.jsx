import { Download, FileText, FileSpreadsheet, Printer } from 'lucide-react'
import { exportCsv, exportExcel, printPdf } from '../../../utils/exportData'
import { useAuth } from '../../../context/AuthContext'

export default function ExportMenu({
  filename = 'export',
  title = 'Report',
  columns = [],
  rows = [],
  preparedBy = '',
  date = null,
  meta = null,
}) {
  const { user } = useAuth()
  const disabled = !rows.length

  const closeMenu = (e) => {
    const details = e.currentTarget.closest('details')
    if (details) details.open = false
  }

  const exportOptions = {
    title,
    preparedBy: preparedBy || user?.name || user?.fullName || user?.full_name || '',
    user,
    date,
    meta,
  }

  return (
    <details className="export-menu">
      <summary className="btn btn--admin-outline export-menu__trigger">
        <Download size={14} /> Export
      </summary>
      <div className="export-menu__list">
        <button type="button" disabled={disabled} onClick={(e) => { exportCsv(filename, columns, rows, exportOptions); closeMenu(e) }}>
          <FileText size={14} /> CSV (.csv)
        </button>
        <button type="button" disabled={disabled} onClick={(e) => { exportExcel(filename, columns, rows, exportOptions); closeMenu(e) }}>
          <FileSpreadsheet size={14} /> Excel (.xlsx)
        </button>
        <button type="button" disabled={disabled} onClick={(e) => { printPdf(title, [{ heading: title, columns, rows }], exportOptions); closeMenu(e) }}>
          <Printer size={14} /> PDF / Print
        </button>
      </div>
    </details>
  )
}
