import { Navigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { VendorProductsPage } from '@/pages/vendor/VendorProductsPage';

/**
 * Inventory management entry — `/vendor/inventory?vendorId=<uuid>`.
 * Reuses the product catalog UI; ensures vendorId is present for deep links.
 */
export function VendorInventoryPage() {
  const { vendor } = useAuth();
  const [searchParams] = useSearchParams();
  const vendorId = searchParams.get('vendorId')?.trim() ?? '';

  if (vendor?.id && !vendorId) {
    return <Navigate to={`/vendor/inventory?vendorId=${encodeURIComponent(vendor.id)}`} replace />;
  }

  return <VendorProductsPage inventoryMode />;
}
