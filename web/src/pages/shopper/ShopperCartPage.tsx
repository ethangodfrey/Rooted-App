import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { useCart } from '@/hooks/use-cart';
import { formatPrice } from '@/lib/format';

/**
 * Full-page cart entry (`/shopper/cart`) — opens the shared CartDrawer review flow
 * so pay-now vs pay-at-pickup policy UI stays in one place.
 */
export function ShopperCartPage() {
  const { cart, totals, openDrawer, itemCount } = useCart();

  useEffect(() => {
    openDrawer(itemCount > 0 ? 'review' : 'cart');
  }, [openDrawer, itemCount]);

  return (
    <div className="app-screen app-screen--narrow">
      <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-orange-500 uppercase">
        Checkout
      </p>
      <h1 className="app-title">Your bag</h1>
      <p className="app-subtitle">
        Choose Pay Now (card) or Pay at Pickup when vendors allow it — including SNAP/EBT at the
        booth terminal.
      </p>

      {cart && cart.lines.length > 0 ? (
        <div className="app-card mt-4">
          <p className="app-row-title">{cart.marketName}</p>
          <p className="app-row-meta mt-1">
            {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'} · {formatPrice(totals.grandTotal)}
          </p>
          <button
            type="button"
            className="app-btn app-btn--primary mt-4 w-full"
            onClick={() => openDrawer('review')}
          >
            Continue to payment choice
          </button>
        </div>
      ) : (
        <div className="app-card mt-4">
          <p className="app-row-title">Bag is empty</p>
          <p className="app-row-meta mt-1">Browse Explore or a vendor booth to add pre-order items.</p>
          <Link to="/shopper/explore" className="app-btn app-btn--primary mt-4 inline-flex no-underline">
            Open Explore
          </Link>
        </div>
      )}
    </div>
  );
}
