import InventoryManagement from '../../components/shared/InventoryManagement'

export default function StaffInventoryPage() {
  return (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <h2>Inventory &amp; Repacking</h2>
      </div>
      <InventoryManagement />
    </section>
  )
}
