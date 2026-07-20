// Client-side data export helpers (CSV, Excel, PDF/Print).
// Works off the already-loaded, filtered table data so exports match what the user sees.

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
  const win = window.open('', '_blank', 'width=1000,height=700')
  if (!win) {
    alert('Please allow pop-ups to export as PDF.')
    return
  }

  const now = new Date().toLocaleString()
  const blocks = sections
    .filter((s) => s.rows && s.rows.length)
    .map((s) => {
      const { header, body } = buildMatrix(s.columns, s.rows)
      const thead = `<tr>${header.map((h) => `<th>${htmlEscape(h)}</th>`).join('')}</tr>`
      const tbody = body.map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c)}</td>`).join('')}</tr>`).join('')
      return `<h2>${htmlEscape(s.heading || '')}</h2><table>${thead}${tbody}</table>`
    })
    .join('')

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 32px; }
      header { display:flex; justify-content:space-between; align-items:baseline; border-bottom:3px solid #AF101A; padding-bottom:12px; margin-bottom:20px; }
      h1 { margin:0; font-size:1.4rem; color:#AF101A; }
      .meta { color:#64748b; font-size:.8rem; }
      h2 { font-size:1rem; margin:24px 0 8px; color:#1e293b; }
      table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:.8rem; }
      th { background:#1e293b; color:#fff; text-align:left; padding:7px 10px; }
      td { padding:6px 10px; border:1px solid #cbd5e1; }
      tr:nth-child(even) td { background:#f8fafc; }
      @media print { body { padding:0; } header { margin-bottom:14px; } }
    </style></head><body>
    <header><h1>Rise Above Foundation — ${htmlEscape(title)}</h1><span class="meta">Generated ${htmlEscape(now)}</span></header>
    ${blocks || '<p>No data to export.</p>'}
    </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 350)
}
