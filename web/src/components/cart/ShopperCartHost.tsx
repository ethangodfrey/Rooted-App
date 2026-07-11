import { Outlet } from 'react-router-dom';

import { CartDrawer } from '@/components/cart/CartDrawer';

/** Renders authenticated routes plus the global presale cart drawer. */
export function ShopperCartHost() {
  return (
    <>
      <Outlet />
      <CartDrawer />
    </>
  );
}
