import { useState } from 'react'

const donationTypes = [
  { id: 'monetary', label: 'Monetary Donation' },
  { id: 'in-kind', label: 'In-Kind Donation' },
]

const lifecycle = [
  'Donation Submission',
  'Tracking Code Generated',
  'Donation Verification',
  'Inventory Recording',
  'Repacking (if needed)',
  'Resource Allocation',
  'Distribution Planning',
  'Distribution to Beneficiaries',
  'Certificate / Official Receipt',
]

export default function DonatePage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    type: 'monetary',
    donorName: '',
    email: '',
    amount: '',
    items: '',
    paymentMethod: 'bank-transfer',
    proof: null,
    message: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  const trackingCode = `DON-${Date.now().toString(36).toUpperCase()}`

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Make a Donation</h1>
          <p>Your generosity powers relief, education, and community development across Cebu.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          {/* Lifecycle stepper */}
          <div className="donation-lifecycle">
            <h2>How Your Donation Gets There</h2>
            <ol className="lifecycle-steps">
              {lifecycle.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="info-panel__note">
              📧 Email notifications are sent at every major stage.
            </p>
          </div>

          {submitted ? (
            <div className="form-success">
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎉</div>
              <h2>Thank You for Your Donation!</h2>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Use your tracking code below to monitor verification and distribution progress.
              </p>
              <p className="tracking-code">
                Tracking code: <code>{trackingCode}</code>
              </p>
              <p style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                Status: <strong style={{ color: 'var(--color-brand)' }}>Pending Verification</strong>
              </p>
              <button
                type="button"
                className="btn btn--outline"
                style={{ marginTop: '1.5rem' }}
                onClick={() => setSubmitted(false)}
              >
                Submit Another Donation
              </button>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <h2>Donation Form</h2>

              <fieldset className="radio-group">
                <legend>Donation Type *</legend>
                {donationTypes.map((dt) => (
                  <label key={dt.id} className="radio-label">
                    <input
                      type="radio"
                      name="donationType"
                      value={dt.id}
                      checked={form.type === dt.id}
                      onChange={() => setForm({ ...form, type: dt.id })}
                    />
                    {dt.label}
                  </label>
                ))}
              </fieldset>

              <div className="form-row">
                <label>
                  Donor Name *
                  <input
                    type="text"
                    required
                    placeholder="Juan dela Cruz"
                    value={form.donorName}
                    onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                  />
                </label>
                <label>
                  Email Address *
                  <input
                    type="email"
                    required
                    placeholder="you@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
              </div>

              {form.type === 'monetary' ? (
                <>
                  <label>
                    Amount (PHP) *
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="500"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </label>
                  <label>
                    Payment Method
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    >
                      <option value="bank-transfer">Bank Transfer</option>
                      <option value="gcash">GCash</option>
                      <option value="paymaya">Maya</option>
                      <option value="cash">Cash (in person)</option>
                    </select>
                  </label>
                </>
              ) : (
                <label>
                  Items Description *
                  <textarea
                    rows={4}
                    required
                    placeholder="List items, quantities, and condition (e.g., 10 canned goods, good condition)..."
                    value={form.items}
                    onChange={(e) => setForm({ ...form, items: e.target.value })}
                  />
                </label>
              )}

              <label>
                Upload Proof of Donation
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setForm({ ...form, proof: e.target.files?.[0] ?? null })}
                />
                <span className="field-hint">Receipt, screenshot, or photo — JPG, PNG, or PDF</span>
              </label>

              <label>
                Message (optional)
                <textarea
                  rows={3}
                  placeholder="Leave a note for the foundation..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </label>

              <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
                Submit Donation
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
