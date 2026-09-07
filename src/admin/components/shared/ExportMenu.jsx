import { Download, FileText, FileSpreadsheet, Printer } from 'lucide-react'
import { exportCsv, exportExcel, printPdf } from '../../../utils/exportData'

export default function ExportMenu({ filename = 'export', title = 'Report', columns = [], rows = [] }) {
  const disabled = !rows.length

  const closeMenu = (e) => {
    const details = e.currentTarget.closest('details')
    if (details) details.open = false
  }

  return (
    <details className="export-menu">
      <summary className="btn btn--admin-outline export-menu__trigger">
        <Download size={14} /> Export
      </summary>
      <div className="export-menu__list">
        <button type="button" disabled={disabled} onClick={(e) => { exportCsv(filename, columns, rows); closeMenu(e) }}>
          <FileText size={14} /> CSV (.csv)
        </button>
        <button type="button" disabled={disabled} onClick={(e) => { exportExcel(filename, columns, rows); closeMenu(e) }}>
          <FileSpreadsheet size={14} /> Excel (.xls)
        </button>
        <button type="button" disabled={disabled} onClick={(e) => { printPdf(title, [{ heading: title, columns, rows }]); closeMenu(e) }}>
          <Printer size={14} /> PDF / Print
        </button>
      </div>
    </details>
  )
}
