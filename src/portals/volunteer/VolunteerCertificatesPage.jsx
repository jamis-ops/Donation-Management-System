import { useState } from 'react'
import { Award, Download, Eye, Printer } from 'lucide-react'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import ApiState from '../../components/admin/shared/ApiState'
import CertificateView from '../../components/shared/CertificateView'
import { printCertificate } from '../../components/shared/printCertificate'
import { certificatesApi } from '../../api/resources'
import { useApiList } from '../../hooks/useApiList'

export default function VolunteerCertificatesPage() {
  const { data, loading, error, reload } = useApiList(() => certificatesApi.list())
  const [preview, setPreview] = useState(null)

  return (
    <ApiState loading={loading} error={error} onRetry={reload}>
      <section className="portal-panel">
        <div className="portal-panel__header"><h2>Volunteer Certificates</h2></div>

        {data.length === 0 ? (
          <div className="cert-empty">
            <Award size={36} />
            <p>No certificates yet. Certificates are issued after completed activities.</p>
          </div>
        ) : (
          <div className="cert-grid">
            {data.map((c) => (
              <div key={c.id} className="cert-card">
                <div className="cert-card__icon"><Award size={22} /></div>
                <div className="cert-card__body">
                  <strong>{c.type}</strong>
                  <span>{c.id}{c.reference ? ` · Ref: ${c.reference}` : ''}</span>
                  <span className="cert-card__date">{c.date || 'Date pending'}</span>
                </div>
                <div className="cert-card__side">
                  <StatusBadge status={c.status} />
                  {c.status === 'Generated' ? (
                    <div className="cert-card__actions">
                      <button type="button" className="btn btn--sm btn--outline" onClick={() => setPreview(c)}>
                        <Eye size={14} /> View
                      </button>
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => printCertificate(c)}>
                        <Download size={14} /> PDF
                      </button>
                    </div>
                  ) : (
                    <span className="cert-card__pending">Being processed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {preview && (
        <div className="admin-modal-overlay" onClick={() => setPreview(null)}>
          <div className="admin-modal admin-modal--cert" onClick={(e) => e.stopPropagation()}>
            <div className="cert-preview-toolbar">
              <h2>{preview.type}</h2>
              <div className="cert-preview-toolbar__actions">
                <button type="button" className="btn btn--sm btn--outline" onClick={() => printCertificate(preview)}>
                  <Printer size={14} /> Print
                </button>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => printCertificate(preview)}>
                  <Download size={14} /> Download PDF
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPreview(null)}>Close</button>
              </div>
            </div>
            <CertificateView cert={preview} />
          </div>
        </div>
      )}
    </ApiState>
  )
}
