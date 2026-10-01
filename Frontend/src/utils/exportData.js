// Client-side data export helpers (CSV, Excel .xlsx, PDF/Print).
// Works off the already-loaded, filtered table data so exports match what the user sees.

import { notify } from './confirm'
import { logo } from '../assets'
import { showGlobalLoading, hideGlobalLoading } from '../context/LoadingContext'

function cellValue(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join('; ')
  if (typeof value === 'object') {
    if (value.id || value.code) return String(value.id || value.code)
    if (value.name || value.title) return String(value.name || value.title)
    return JSON.stringify(value)
  }
  return String(value)
}

export function buildMatrix(columns, rows) {
  const cols = columns.filter((c) => c.key !== 'actions')
  const header = cols.map((c) => c.label ?? c.key)
  const body = rows.map((row) =>
    cols.map((c) => cellValue(c.exportValue ? c.exportValue(row) : row[c.key]))
  )
  return { header, body }
}

function triggerDownloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  triggerDownloadBlob(filename, blob)
}

function csvEscape(value) {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function htmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Reads active authenticated user from localStorage cache if available.
 */
export function getStoredCurrentUser() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('active_user')
      if (raw) return JSON.parse(raw)
    }
  } catch {
    return null
  }
  return null
}

/**
 * Formats a date into official Rise Above Foundation Cebu format:
 * "September 19, 2026 at 2:15 AM"
 */
export function formatReportDateTime(dateVal = new Date()) {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (Number.isNaN(d.getTime())) return String(dateVal || '')
  const dateStr = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${dateStr} at ${timeStr}`
}

/**
 * Resolves standard report metadata: Prepared By & Date
 */
export function resolveExportMeta(options = {}) {
  const storedUser = getStoredCurrentUser()
  const activeUser = options.user || storedUser

  let preparedBy = ''
  if (options.preparedBy && typeof options.preparedBy === 'string' && options.preparedBy.trim()) {
    preparedBy = options.preparedBy.trim()
  } else if (activeUser) {
    preparedBy = (activeUser.name || activeUser.fullName || activeUser.full_name || activeUser.email || '').trim()
  }
  if (!preparedBy) {
    preparedBy = 'Administrator'
  }

  const dateStr = options.datePrepared || options.dateStr || formatReportDateTime(options.date || new Date())
  return { preparedBy, dateStr }
}

let cachedLogoBase64 = null
export async function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64
  try {
    const res = await fetch(logo)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result === 'string') {
          const base64 = result.includes(',') ? result.split(',')[1] : result
          cachedLogoBase64 = base64
          resolve(base64)
        } else {
          resolve(null)
        }
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('Could not load logo for Excel report:', err)
    return null
  }
}

/**
 * Official CSV Export with BOM, bottom sign-off, and dated footer,
 * and clean data rows without duplicate footers.
 */
export function exportCsv(filename, columns, rows, options = {}) {
  showGlobalLoading('Exporting CSV…')
  try {
    const opt = typeof options === 'string' ? { title: options } : (options || {})
    const { preparedBy, dateStr } = resolveExportMeta(opt)
    const { header, body } = buildMatrix(columns, rows)
    const lines = []

    // Column headers
    lines.push(header.map(csvEscape).join(','))
    // Data rows
    body.forEach((r) => lines.push(r.map(csvEscape).join(',')))
    lines.push('')
    lines.push(`Prepared By,"${csvEscape(preparedBy)}"`)
    lines.push(`Date Prepared,"${csvEscape(dateStr)}"`)

    const cleanName = filename.replace(/\.csv$/i, '')
    // BOM so Excel reads UTF-8 (₱, accents) correctly.
    triggerDownload(`${cleanName}.csv`, '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8;')
    notify.success(`Exported ${cleanName}.csv successfully.`)
  } catch (err) {
    console.error('Failed to export CSV:', err)
    notify.error('Failed to export CSV: ' + err.message)
  } finally {
    hideGlobalLoading()
  }
}

/**
 * Official Excel (.xlsx) Export with embedded Rise Above Foundation Cebu logo,
 * professional header banner, bottom sign-off and dated footer, custom column widths,
 * text wrapping, borders, and clean single-instance sign-off.
 */
export async function exportExcel(filename, columns, rows, options = {}) {
  showGlobalLoading('Generating Excel report…')
  const opt = typeof options === 'string' ? { title: options } : (options || {})
  const rawTitle = opt.title || filename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const reportTitle = rawTitle.includes('Report') || rawTitle.includes('Export') ? rawTitle : `${rawTitle} Report`
  const { preparedBy, dateStr } = resolveExportMeta(opt)

  try {
    const ExcelJSModule = await import('exceljs')
    const ExcelJS = ExcelJSModule.default || ExcelJSModule

    const workbook = new ExcelJS.Workbook()
    workbook.creator = preparedBy
    workbook.lastModifiedBy = preparedBy
    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet('Report', {
      views: [{ showGridLines: true }],
      pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape' },
    })

    // 1. Embed Rise Above Foundation Cebu Logo
    const logoBase64 = await getLogoBase64()
    if (logoBase64) {
      try {
        const imageId = workbook.addImage({
          base64: logoBase64,
          extension: 'png',
        })
        worksheet.addImage(imageId, {
          tl: { col: 0.15, row: 0.35 },
          ext: { width: 58, height: 58 },
          editAs: 'undefined',
        })
      } catch (imgErr) {
        console.warn('Could not embed logo image in Excel:', imgErr)
      }
    }

    // 2. Report Header Block
    worksheet.addRow([]) // Row 1: top spacing

    const orgRow = worksheet.addRow(['', 'RISE ABOVE FOUNDATION CEBU'])
    orgRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } }

    const titleRow = worksheet.addRow(['', reportTitle])
    titleRow.getCell(2).font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFAF101A' } }

    const subRow = worksheet.addRow(['', 'Donation & Operations Management System · Official Report'])
    subRow.getCell(2).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } }

    worksheet.addRow([]) // Row 5: spacer

    // 3. Table Column Headers
    const { header, body } = buildMatrix(columns, rows)
    const headerRow = worksheet.addRow(header)
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Dark slate navy
      }
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1E293B' } },
        bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      }
    })

    // 4. Data Rows
    body.forEach((rowData, rIdx) => {
      const row = worksheet.addRow(rowData)
      row.height = 20
      const isEven = rIdx % 2 === 1
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } }
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          }
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
      })
    })

    // 5. Compute Appropriate Column Widths
    worksheet.columns.forEach((column, colIdx) => {
      let maxLen = 0
      const headerText = String(header[colIdx] || '')
      maxLen = Math.max(maxLen, headerText.length)

      body.forEach((r) => {
        const cellText = String(r[colIdx] || '')
        const lines = cellText.split('\n')
        lines.forEach((l) => {
          maxLen = Math.max(maxLen, l.length)
        })
      })

      // Clamped width between 14 and 48 characters
      column.width = Math.min(Math.max(maxLen + 4, 16), 48)
    })

    // 6. Sign-off below the table and a dated document footer.
    worksheet.addRow([])
    const prepRow = worksheet.addRow(['Prepared By:', preparedBy])
    prepRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } }
    prepRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } }
    const footerRow = worksheet.addRow(['Rise Above Foundation Cebu · Official System Export · Confidential'])
    footerRow.getCell(1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF94A3B8' } }
    const footerColumn = Math.max(header.length, 2)
    footerRow.getCell(footerColumn).value = `Date Prepared: ${dateStr}`
    footerRow.getCell(footerColumn).font = { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } }
    footerRow.getCell(footerColumn).alignment = { horizontal: 'right' }

    // 7. Write to Buffer & Trigger Download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const cleanName = filename.replace(/\.(xlsx|xls)$/i, '')
    triggerDownloadBlob(`${cleanName}.xlsx`, blob)
    notify.success(`Exported ${cleanName}.xlsx successfully.`)
  } catch (err) {
    console.error('Failed to generate Excel report:', err)
    notify.error('Failed to export Excel file: ' + err.message)
  } finally {
    hideGlobalLoading()
  }
}

export const INVENTORY_EXPORT_COLUMNS = [
  { key: 'category', label: 'Item Category', exportValue: (i) => i.category || 'General Goods' },
  { key: 'itemType', label: 'Item Type', exportValue: (i) => i.itemType || i.item || '—' },
  { key: 'brand', label: 'Brand', exportValue: (i) => i.brand || '—' },
  { key: 'variant', label: 'Variant / Size', exportValue: (i) => i.variant || '—' },
  { key: 'quantity', label: 'Available Quantity', exportValue: (i) => Number(i.available ?? i.currentStock ?? i.quantity ?? 0) },
  { key: 'totalQuantity', label: 'Total Quantity Received', exportValue: (i) => Number(i.totalQuantity ?? i.quantity ?? 0) },
  { key: 'deductedQuantity', label: 'Allocated / Deducted', exportValue: (i) => Number(i.deductedQuantity ?? 0) },
  { key: 'unit', label: 'Unit', exportValue: (i) => i.unit || 'units' },
  { key: 'status', label: 'Stock Status', exportValue: (i) => i.status || 'Available' },
  { key: 'dateReceived', label: 'Date Received', exportValue: (i) => i.dateReceived || i.lastUpdated || '—' },
  { key: 'donationReference', label: 'Source / Donation Reference', exportValue: (i) => i.donationReference || i.sourceReference || i.supplier || 'Warehouse Stock' },
]

/**
 * Dedicated Inventory Excel (.xlsx) export with accurate columns,
 * date-stamped filename (e.g. Inventory_Export_YYYY-MM-DD.xlsx),
 * and a bottom Prepared By sign-off with dated footer.
 */
export async function exportInventoryExcel(items, user = null, options = {}) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const defaultFilename = `Inventory_Export_${todayIso}.xlsx`
  const filename = options.filename || defaultFilename
  const activeUser = user || getStoredCurrentUser()

  return exportExcel(filename, INVENTORY_EXPORT_COLUMNS, items, {
    title: 'Inventory Export',
    user: activeUser,
    ...options,
  })
}

/**
 * Dedicated Inventory CSV (.csv) export with accurate columns,
 * date-stamped filename (e.g. Inventory_Export_YYYY-MM-DD.csv),
 * and a bottom Prepared By sign-off with dated footer.
 */
export function exportInventoryCsv(items, user = null, options = {}) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const defaultFilename = `Inventory_Export_${todayIso}.csv`
  const filename = options.filename || defaultFilename
  const activeUser = user || getStoredCurrentUser()

  return exportCsv(filename, INVENTORY_EXPORT_COLUMNS, items, {
    title: 'Inventory Export',
    user: activeUser,
    ...options,
  })
}

/**
 * Dedicated Inventory PDF export with properly sized landscape report layout,
 * accurate columns without cut-off, and a bottom sign-off with dated footer.
 */
export function exportInventoryPdf(items, user = null, options = {}) {
  const activeUser = user || getStoredCurrentUser()
  const datePrepared = formatReportDateTime(new Date())

  printPdf('Inventory Export', [{ heading: 'Inventory Export', columns: INVENTORY_EXPORT_COLUMNS, rows: items }], {
    title: 'Inventory Export',
    user: activeUser,
    datePrepared,
    orientation: 'landscape',
    ...options,
  })
  notify.success('Opened print-ready PDF export successfully.')
}

/**
 * Master multi-format inventory export dispatcher.
 * Supports: 'excel' | 'pdf' | 'csv'
 */
export async function exportInventory(format, items, user = null, options = {}) {
  const fmt = String(format || 'excel').toLowerCase().trim()
  if (fmt === 'pdf') {
    return exportInventoryPdf(items, user, options)
  }
  if (fmt === 'csv') {
    return exportInventoryCsv(items, user, options)
  }
  return exportInventoryExcel(items, user, options)
}

/**
 * Open a print-ready window and trigger the browser print dialog (Save as PDF).
 * sections: [{ heading, columns, rows }] — supports multi-table reports.
 * Includes Rise Above Foundation Cebu header, a bottom Prepared By sign-off,
 * properly sized landscape layout, and a dated footer.
 */
export function printPdf(title, sections, options = {}) {
  const opt = typeof options === 'string' ? { preparedBy: options } : (options || {})
  const { preparedBy, dateStr } = resolveExportMeta(opt)

  const win = window.open('', '_blank', 'width=1150,height=800')
  if (!win) {
    notify.warning('Please allow pop-ups to export as PDF.')
    return
  }

  const logoUrl = new URL(logo, window.location.origin).href
  const orientation = opt.orientation || 'landscape'
  const blocks = sections
    .filter((s) => s.rows && s.rows.length)
    .map((s) => {
      const { header, body } = buildMatrix(s.columns, s.rows)
      const thead = `<tr>${header.map((h) => `<th>${htmlEscape(h)}</th>`).join('')}</tr>`
      const tbody = body.map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c)}</td>`).join('')}</tr>`).join('')
      const headingHtml = s.heading && s.heading !== title ? `<h2>${htmlEscape(s.heading)}</h2>` : ''
      return `${headingHtml}<table class="report-table">${thead}${tbody}</table>`
    })
    .join('')

  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
    <title>${htmlEscape(title)} — Rise Above Foundation Cebu</title>
    <style>
      @page {
        size: ${orientation};
        margin: 10mm 12mm;
      }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        padding: 22px 26px;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2.5px solid #AF101A;
        padding-bottom: 12px;
        margin-bottom: 16px;
        gap: 16px;
      }
      .report-header__brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .report-header__logo {
        width: 48px;
        height: 48px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .report-header__info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .report-header__org {
        font-size: 0.76rem;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .report-header__title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 800;
        color: #AF101A;
        line-height: 1.2;
      }
      .report-header__meta {
        margin-left: auto;
        text-align: right;
        color: #64748b;
      }
      .report-header__meta-status {
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .report-signoff {
        margin-top: 18px;
        padding-top: 10px;
        border-top: 1px solid #cbd5e1;
        font-size: 0.78rem;
        color: #334155;
      }
      h2 {
        font-size: 0.98rem;
        font-weight: 700;
        margin: 16px 0 8px;
        color: #1e293b;
        border-left: 3.5px solid #AF101A;
        padding-left: 8px;
      }
      table.report-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
        font-size: 0.74rem;
        table-layout: auto;
      }
      table.report-table th {
        background: #1e293b !important;
        color: #ffffff !important;
        text-align: left;
        padding: 7px 8px;
        font-weight: 700;
        font-size: 0.73rem;
        letter-spacing: 0.02em;
        border: 1px solid #1e293b;
        white-space: nowrap;
      }
      table.report-table td {
        padding: 6px 8px;
        border: 1px solid #cbd5e1;
        color: #1e293b;
        vertical-align: top;
        font-size: 0.73rem;
        line-height: 1.35;
        word-break: break-word;
      }
      table.report-table tr:nth-child(even) td {
        background: #f8fafc;
      }
      .report-footer {
        margin-top: 20px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.72rem;
        color: #94a3b8;
      }
      @media print {
        @page {
          size: ${orientation};
          margin: 10mm 12mm;
        }
        body { padding: 0; }
        .report-header { margin-bottom: 12px; padding-bottom: 8px; }
        .report-table th { background: #1e293b !important; color: #ffffff !important; -webkit-print-color-adjust: exact; }
        .report-table tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact; }
      }
    </style></head><body>
    <header class="report-header">
      <div class="report-header__brand">
        <img src="${logoUrl}" alt="Rise Above Foundation Cebu Logo" class="report-header__logo" />
        <div class="report-header__info">
          <div class="report-header__org">Rise Above Foundation Cebu</div>
          <h1 class="report-header__title">${htmlEscape(title)}</h1>
        </div>
      </div>
      <div class="report-header__meta">
        <div class="report-header__meta-status">Donation & Operations Management · Official Export</div>
      </div>
    </header>
    ${blocks || '<p style="color:#64748b; font-size:0.9rem; padding: 20px 0;">No data to export.</p>'}
    <div class="report-signoff"><strong>Prepared By:</strong> ${htmlEscape(preparedBy)}</div>
    <footer class="report-footer">
      <span>Rise Above Foundation Cebu · Official System Export</span>
      <span>Date Prepared: ${htmlEscape(dateStr)} · Confidential</span>
    </footer>
    </body></html>`)
  win.document.close()
  win.focus()

  const triggerPrint = () => {
    try {
      win.print()
    } catch {
      // Ignored if window closed
    }
  }

  const img = win.document.querySelector('.report-header__logo')
  if (img && !img.complete) {
    img.onload = () => setTimeout(triggerPrint, 150)
    img.onerror = () => setTimeout(triggerPrint, 150)
    setTimeout(triggerPrint, 600)
  } else {
    setTimeout(triggerPrint, 350)
  }
}
