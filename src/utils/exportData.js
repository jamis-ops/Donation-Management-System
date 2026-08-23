// Client-side data export helpers (CSV, Excel, PDF/Print).
// Works off the already-loaded, filtered table data so exports match what the user sees.

import { notify } from './toast'
import { logo } from '../assets'

function cellValue(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join('; ')
  if (typeof value === 'object') return JSON.stringify(value)
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

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvEscape(value) {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv(filename, columns, rows) {
  const { header, body } = buildMatrix(columns, rows)
  const lines = [header, ...body].map((r) => r.map(csvEscape).join(','))
  // BOM so Excel reads UTF-8 (₱, accents) correctly.
  triggerDownload(`${filename}.csv`, '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8;')
}

function htmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function exportExcel(filename, columns, rows) {
  const { header, body } = buildMatrix(columns, rows)
  const thead = `<tr>${header.map((h) => `<th style="background:#1e293b;color:#fff;padding:6px 10px;text-align:left">${htmlEscape(h)}</th>`).join('')}</tr>`
  const tbody = body
    .map((r) => `<tr>${r.map((c) => `<td style="padding:5px 10px;border:1px solid #cbd5e1">${htmlEscape(c)}</td>`).join('')}</tr>`)
    .join('')
  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<head><meta charset="utf-8"></head><body>' +
    `<table border="1" cellspacing="0">${thead}${tbody}</table></body></html>`
  triggerDownload(`${filename}.xls`, html, 'application/vnd.ms-excel')
}

/**
 * Open a print-ready window and trigger the browser print dialog (Save as PDF).
 * sections: [{ heading, columns, rows }] — supports multi-table reports.
 */
export function printPdf(title, sections) {
  const win = window.open('', '_blank', 'width=1050,height=750')
  if (!win) {
    notify.warning('Please allow pop-ups to export as PDF.')
    return
  }

  const logoUrl = new URL(logo, window.location.origin).href
  const now = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        padding: 32px 36px;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2.5px solid #AF101A;
        padding-bottom: 16px;
        margin-bottom: 22px;
        gap: 16px;
      }
      .report-header__brand {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .report-header__logo {
        width: 52px;
        height: 52px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .report-header__info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .report-header__org {
        font-size: 0.8rem;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .report-header__title {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 800;
        color: #AF101A;
        line-height: 1.2;
      }
      .report-header__meta {
        text-align: right;
        font-size: 0.78rem;
        color: #64748b;
        line-height: 1.5;
      }
      .report-header__meta strong {
        color: #1e293b;
      }
      h2 {
        font-size: 1.02rem;
        font-weight: 700;
        margin: 22px 0 10px;
        color: #1e293b;
        border-left: 3.5px solid #AF101A;
        padding-left: 8px;
      }
      table.report-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 0.8rem;
      }
      table.report-table th {
        background: #1e293b;
        color: #ffffff;
        text-align: left;
        padding: 8px 10px;
        font-weight: 600;
        letter-spacing: 0.02em;
        border: 1px solid #1e293b;
      }
      table.report-table td {
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        color: #1e293b;
        vertical-align: top;
      }
      table.report-table tr:nth-child(even) td {
        background: #f8fafc;
      }
      .report-footer {
        margin-top: 28px;
        padding-top: 10px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.74rem;
        color: #94a3b8;
      }
      @media print {
        body { padding: 16px 20px; }
        .report-header { margin-bottom: 16px; padding-bottom: 12px; }
        .report-table th { background: #1e293b !important; color: #ffffff !important; }
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
        <div><strong>Date Generated:</strong> ${htmlEscape(now)}</div>
        <div><strong>System:</strong> Donation & Operations Management</div>
      </div>
    </header>
    ${blocks || '<p style="color:#64748b; font-size:0.9rem; padding: 20px 0;">No data to export.</p>'}
    <footer class="report-footer">
      <span>Rise Above Foundation Cebu · Official System Export</span>
      <span>Confidential</span>
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
