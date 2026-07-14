import StatusBadge from '../../components/admin/shared/StatusBadge'

const inventory = [
  { item: 'Rice (50kg sacks)', quantity: 45, status: 'Low Stock' },
  { item: 'Hygiene kits', quantity: 280, status: 'Available' },
]

export default function StaffInventoryPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header"><h2>Inventory Overview</h2></div>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr><th>Item</th><th>Quantity</th><th>Status</th></tr>
          </thead>
          <tbody>
            {inventory.map((i) => (
              <tr key={i.item}>
                <td>{i.item}</td>
                <td>{i.quantity}</td>
                <td><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
