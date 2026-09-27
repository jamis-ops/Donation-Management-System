import PageHeader from '../components/shared/PageHeader'
import InventoryManagement from '../../components/shared/InventoryManagement'

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Track stock levels with color indicators (green = sufficient, yellow = moderate, red = low) and manage inventory items."
      />
      <InventoryManagement />
    </>
  )
}
