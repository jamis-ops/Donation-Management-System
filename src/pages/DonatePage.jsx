import { useState } from 'react'

const donationTypes = [
  { id: 'monetary', label: 'Monetary Donation' },
  { id: 'in-kind', label: 'In-Kind Donation' },
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
          <h1>Donate</h1>
          <p>Your generosity powers relief, education, and community development.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <div className="donation-lifecycle">
            <h2>Donation Lifecycle</h2>
            <ol className="lifecycle-steps">
              <li>Donation Submission</li>
              <li>Tracking Code Generated</li>
              <li>Donation Verification</li>
              <li>Inventory Recording</li>
              <li>Repacking (if needed)</li>
              <li>Resource Allocation</li>
              <li>Distribution Planning</li>
              <li>Distribution to Beneficiaries</li>
              <li>Certificate / Official Receipt</li>
            </ol>
            <p className="info-panel__note">
              Email notifications are sent at every major stage.
            </p>
          </div>

          {submitted ? (
            <div className="form-success">
              <h2>Donation Submitted</h2>
              <p>
                Thank you for your donation. Use your tracking code to monitor verification and
                distribution progress.
              </p>
              <p className="tracking-code">
                Tracking code: <code>{trackingCode}</code>
              </p>
              <p>Status: <strong>Pending Verification</strong></p>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <h2>Make a Donation</h2>

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
                    value={form.donorName}
                    onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                  />
                </label>
                <label>
                  Email *
                  <input
                    type="email"
                    required
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
                    placeholder="List items, quantities, and condition..."
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
              </label>

              <label>
                Message (optional)
                <textarea
                  rows={2}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </label>

              <button type="submit" className="btn btn--primary btn--lg">
                Submit Donation
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
