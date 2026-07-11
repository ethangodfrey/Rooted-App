import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchProductAvailability } from '@/lib/cart-inventory';
import {
  cartItemCount,
  clearPresaleCart,
  computeCartTotals,
  createEmptyPresaleCart,
  loadPresaleCart,
  removePresaleLine,
  savePresaleCart,
  updatePresaleLineQuantity,
  upsertPresaleLine,
  type CartTotals,
  type PresaleCart,
  type PresaleCartMarket,
} from '@/lib/presale-cart';
import { supabase } from '@/lib/supabase';

export type CartDrawerStage = 'cart' | 'review';

export interface AddToCartInput {
  productId: string;
  vendorId: string;
  vendorName: string;
  market: PresaleCartMarket;
  quantity?: number;
  mediaUrl?: string | null;
}

export interface PendingMarketSwitch {
  market: PresaleCartMarket;
  pendingAdd: AddToCartInput;
}

interface CartContextValue {
  cart: PresaleCart | null;
  totals: CartTotals;
  itemCount: number;
  drawerOpen: boolean;
  drawerStage: CartDrawerStage;
  marketConflict: PendingMarketSwitch | null;
  inventoryError: string | null;
  openDrawer: (stage?: CartDrawerStage) => void;
  closeDrawer: () => void;
  setDrawerStage: (stage: CartDrawerStage) => void;
  addToCart: (input: AddToCartInput) => Promise<boolean>;
  confirmMarketSwitch: () => Promise<boolean>;
  cancelMarketSwitch: () => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clearCart: () => void;
  clearInventoryError: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

async function loadMarket(marketId: string): Promise<PresaleCartMarket | null> {
  const { data } = await supabase
    .from('events')
    .select(
      'id, name, city, state, address, start_datetime, end_datetime, timezone, hours_summary, sync_metadata',
    )
    .eq('id', marketId)
    .maybeSingle();

  return (data as PresaleCartMarket | null) ?? null;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<PresaleCart | null>(() => loadPresaleCart());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStage, setDrawerStage] = useState<CartDrawerStage>('cart');
  const [marketConflict, setMarketConflict] = useState<PendingMarketSwitch | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  useEffect(() => {
    if (cart) savePresaleCart(cart);
    else clearPresaleCart();
  }, [cart]);

  const totals = useMemo(() => computeCartTotals(cart), [cart]);
  const itemCount = useMemo(() => cartItemCount(cart), [cart]);

  const persistCart = useCallback((next: PresaleCart | null) => {
    setCart(next);
  }, []);

  const applyAdd = useCallback(
    async (input: AddToCartInput, baseCart: PresaleCart | null): Promise<boolean> => {
      setInventoryError(null);

      const availability = await fetchProductAvailability(input.productId, input.market.id);
      if (!availability) {
        setInventoryError('This product is not available for presale at this market.');
        return false;
      }

      if (availability.vendorId !== input.vendorId) {
        setInventoryError('Vendor mismatch for this product.');
        return false;
      }

      const requestedQty = input.quantity ?? 1;
      const existingQty =
        baseCart?.lines.find((line) => line.productId === input.productId)?.quantity ?? 0;
      const nextQty = existingQty + requestedQty;

      if (nextQty > availability.maxQuantity) {
        setInventoryError(
          availability.maxQuantity === 0
            ? `${availability.productName} is out of presale stock.`
            : `Only ${availability.maxQuantity} of ${availability.productName} available.`,
        );
        return false;
      }

      const session =
        baseCart && baseCart.marketId === input.market.id
          ? baseCart
          : createEmptyPresaleCart(input.market);

      const next = upsertPresaleLine(session, {
        productId: input.productId,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        name: availability.productName,
        price: availability.price,
        maxQuantity: availability.maxQuantity,
        mediaUrl: input.mediaUrl ?? null,
        quantity: nextQty,
      });

      persistCart(next);
      return true;
    },
    [persistCart],
  );

  const addToCart = useCallback(
    async (input: AddToCartInput): Promise<boolean> => {
      if (cart && cart.marketId !== input.market.id) {
        setMarketConflict({ market: input.market, pendingAdd: input });
        return false;
      }
      const ok = await applyAdd(input, cart);
      if (ok) setDrawerOpen(true);
      return ok;
    },
    [applyAdd, cart],
  );

  const confirmMarketSwitch = useCallback(async (): Promise<boolean> => {
    if (!marketConflict) return false;
    const { pendingAdd, market } = marketConflict;
    setMarketConflict(null);
    const fresh = createEmptyPresaleCart(market);
    const ok = await applyAdd(pendingAdd, fresh);
    if (ok) {
      setDrawerOpen(true);
      setDrawerStage('cart');
    }
    return ok;
  }, [applyAdd, marketConflict]);

  const cancelMarketSwitch = useCallback(() => {
    setMarketConflict(null);
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (!cart) return;
      const next = updatePresaleLineQuantity(cart, productId, quantity);
      persistCart(next.lines.length === 0 ? null : next);
    },
    [cart, persistCart],
  );

  const removeLine = useCallback(
    (productId: string) => {
      if (!cart) return;
      const next = removePresaleLine(cart, productId);
      persistCart(next.lines.length === 0 ? null : next);
    },
    [cart, persistCart],
  );

  const clearCart = useCallback(() => {
    persistCart(null);
    setDrawerStage('cart');
  }, [persistCart]);

  const openDrawer = useCallback((stage: CartDrawerStage = 'cart') => {
    setDrawerStage(stage);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerStage('cart');
  }, []);

  const clearInventoryError = useCallback(() => setInventoryError(null), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      totals,
      itemCount,
      drawerOpen,
      drawerStage,
      marketConflict,
      inventoryError,
      openDrawer,
      closeDrawer,
      setDrawerStage,
      addToCart,
      confirmMarketSwitch,
      cancelMarketSwitch,
      updateQuantity,
      removeLine,
      clearCart,
      clearInventoryError,
    }),
    [
      cart,
      totals,
      itemCount,
      drawerOpen,
      drawerStage,
      marketConflict,
      inventoryError,
      openDrawer,
      closeDrawer,
      addToCart,
      confirmMarketSwitch,
      cancelMarketSwitch,
      updateQuantity,
      removeLine,
      clearCart,
      clearInventoryError,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used within CartProvider');
  return ctx;
}

/** Resolve a market record by id for add-to-cart flows. */
export { loadMarket };
