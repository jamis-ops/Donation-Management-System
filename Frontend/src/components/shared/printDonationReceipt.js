function getPreparedByUser(options = {}) {
  if (options.preparedBy) return options.preparedBy
  if (options.user?.name) return options.user.name
  if (options.user?.username) return options.user.username
  try {
    const raw = localStorage.getItem('active_user')
    if (raw) {
      const u = JSON.parse(raw)
      return u?.name || u?.username || u?.email || 'Rise Above Administrator'
    }
  } catch (e) {
    // ignore
  }
  return 'Rise Above Administrator'
}

/**
 * Print Official Donation Receipt / Acknowledgement Document
 */
export function printDonationReceipt(donation, options = {}) {
  if (!donation) return

  const printWindow = window.open('', '_blank', 'width=850,height=1000')
  if (!printWindow) {
    alert('Please allow popups to print the donation receipt.')
    return
  }

  const isMonetary = donation.type === 'Monetary'
  const trackingCode = donation.trackingCode || `DON-${donation.dbId || donation.id || 'N/A'}`
  const preparedByUser = getPreparedByUser(options)
  const reportDateTime = options.date || new Date().toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const donorName = donation.donor || donation.donorName || 'Anonymous Donor'
  const donorEmail = donation.donorEmail || donation.email || '—'
  const category = donation.category || (isMonetary ? 'General Donation Fund' : 'Relief Goods')
  const amountOrItems = isMonetary
    ? (typeof donation.amountRaw === 'number'
        ? `₱${donation.amountRaw.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : (donation.amount || '₱0.00'))
    : (donation.itemsDescription || donation.items || donation.amount || 'In-Kind Relief Goods')
  const paymentMethod = donation.paymentMethod || '—'
  const status = donation.status || 'Verified'
  const notes = donation.notes || 'Official donation recorded in the Rise Above Foundation Cebu Donation Management System.'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Donation Receipt - ${trackingCode}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background: #ffffff;
      color: #1e293b;
      line-height: 1.5;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    .receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #AF101A;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .receipt-brand h1 {
      font-size: 22px;
      font-weight: 800;
      color: #AF101A;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .receipt-brand p {
      font-size: 12px;
      color: #64748b;
    }
    .receipt-meta {
      text-align: right;
    }
    .receipt-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .receipt-code {
      font-family: monospace;
      font-size: 14px;
      font-weight: 700;
      color: #AF101A;
      background: #fef2f2;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #fecaca;
      display: inline-block;
    }
    .receipt-date {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .info-section {
      background: #fafafa;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .info-group h4 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
      letter-spacing: 0.05em;
    }
    .info-group p {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .info-group small {
      font-size: 12px;
      color: #64748b;
      font-weight: 400;
      display: block;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .details-table th {
      background: #f8fafc;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      padding: 10px 14px;
      border-bottom: 2px solid #cbd5e1;
    }
    .details-table td {
      padding: 14px;
      font-size: 13px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .amount-highlight {
      font-size: 16px;
      font-weight: 700;
      color: ${isMonetary ? '#047857' : '#AF101A'};
    }
    .status-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .notes-card {
      background: #f8fafc;
      border-left: 4px solid #AF101A;
      padding: 12px 16px;
      margin-bottom: 30px;
      font-size: 12px;
      color: #475569;
    }
    .receipt-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }
    .disclaimer {
      font-size: 11px;
      color: #94a3b8;
      max-width: 420px;
      line-height: 1.4;
    }
    .signature-box {
      text-align: center;
      min-width: 200px;
    }
    .signature-line {
      width: 100%;
      height: 1px;
      background: #0f172a;
      margin-bottom: 6px;
    }
    .signature-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .signature-sub {
      font-size: 10px;
      color: #64748b;
    }
    .btn-print {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #AF101A;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      font-weight: 600;
      font-size: 13px;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(175, 16, 26, 0.25);
    }
    @media print {
      @page {
        size: A4;
        margin: 0;
      }
      .btn-print {
        display: none;
      }
      body {
        padding: 16mm 20mm;
      }
    }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨️ Print Receipt</button>

  <div class="receipt-header">
    <div class="receipt-brand">
      <h1>Rise Above Foundation Cebu</h1>
      <p>252 I. Lopez St., Cebu City, 6000 Cebu, Philippines</p>
      <p>Official Donation Acknowledgement & Receipt</p>
    </div>
    <div class="receipt-meta">
      <div class="receipt-title">Official Receipt</div>
      <div class="receipt-code">${trackingCode}</div>
    </div>
  </div>

  <div class="info-section">
    <div class="info-group">
      <h4>Donor Information</h4>
      <p>${donorName}</p>
      <small>${donorEmail}</small>
    </div>
    <div class="info-group">
      <h4>Donation Type & Allocation</h4>
      <p>${donation.type || (isMonetary ? 'Monetary' : 'In-Kind')} Contribution</p>
      <small>${category}</small>
    </div>
  </div>

  <table class="details-table">
    <thead>
      <tr>
        <th>Description / Purpose</th>
        <th>Category / Method</th>
        <th>Status</th>
        <th style="text-align: right;">Total Amount / Items</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${isMonetary ? 'Monetary Contribution' : 'In-Kind Relief Support'}</strong>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${notes}</div>
        </td>
        <td>
          <div>${category}</div>
          ${isMonetary ? `<div style="font-size: 11px; color: #64748b;">Method: ${paymentMethod}</div>` : ''}
        </td>
        <td>
          <span class="status-tag">${status}</span>
        </td>
        <td style="text-align: right;" class="amount-highlight">
          ${amountOrItems}
        </td>
      </tr>
    </tbody>
  </table>

  <div class="notes-card">
    <strong>Verification Note:</strong> This document confirms that the contribution has been recorded in the foundation's registry. Thank you for your generosity in empowering communities in need across Cebu and the Visayas.
  </div>

  <div class="receipt-footer">
    <div class="disclaimer">
      This is an official system-generated donation receipt from Rise Above Foundation Cebu. For inquiries or tax certifications, contact donations@riseabove-cebu.org.
    </div>
    <div class="signature-box">
      <div style="height: 40px;"></div>
      <div class="signature-line"></div>
      <div class="signature-title">Authorized Representative</div>
      <div class="signature-sub">Rise Above Foundation Cebu</div>
    </div>
  </div>

  <div style="margin-top: 24px; padding-top: 14px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #475569; line-height: 1.6;">
    <div><strong>Prepared By:</strong> ${preparedByUser}</div>
    <div><strong>Date:</strong> ${reportDateTime}</div>
  </div>

  <script>
    window.onload = function() {
      // automatically trigger print dialog for seamless experience
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
