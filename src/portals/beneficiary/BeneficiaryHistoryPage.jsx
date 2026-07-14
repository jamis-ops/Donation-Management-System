export default function BeneficiaryHistoryPage() {
  const history = [
    { date: '2026-06-28', program: 'Disaster Relief', item: 'Family relief pack', status: 'Received' },
    { date: '2026-05-12', program: 'Feeding Programs', item: 'Meal allocation', status: 'Received' },
  ]

  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Assistance History</h2></div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Program</th>
              <th>Assistance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.date + h.item}>
                <td>{h.date}</td>
                <td>{h.program}</td>
                <td>{h.item}</td>
                <td>{h.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
