import PageHeader from '../../components/admin/shared/PageHeader'
import InventoryManagement from '../../components/shared/InventoryManagement'

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory & Repacking"
        description="Track stock levels with color indicators (green = sufficient, yellow = moderate, red = low), manage items, and run repacking batches that update inventory automatically."
      />
      <InventoryManagement />
    </>
  )
}
