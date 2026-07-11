export interface StorefrontCartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  holdId?: string | null;
  mediaUrl?: string | null;
}

export interface StorefrontCart {
  vendorId: string;
  vendorName: string;
  eventId: string | null;
  eventName: string | null;
  lines: StorefrontCartLine[];
  updatedAt: string;
}

const STORAGE_PREFIX = 'vendorly-cart:';

function storageKey(vendorId: string): string {
  return `${STORAGE_PREFIX}${vendorId}`;
}

export function loadStorefrontCart(vendorId: string): StorefrontCart | null {
  try {
    const raw = localStorage.getItem(storageKey(vendorId));
    if (!raw) return null;
    return JSON.parse(raw) as StorefrontCart;
  } catch {
    return null;
  }
}

export function saveStorefrontCart(cart: StorefrontCart): void {
  localStorage.setItem(storageKey(cart.vendorId), JSON.stringify({ ...cart, updatedAt: new Date().toISOString() }));
}

export function clearStorefrontCart(vendorId: string): void {
  localStorage.removeItem(storageKey(vendorId));
}

export function cartLineCount(cart: StorefrontCart | null): number {
  if (!cart) return 0;
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartSubtotal(cart: StorefrontCart | null): number {
  if (!cart) return 0;
  return cart.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function upsertCartLine(
  cart: StorefrontCart,
  line: Omit<StorefrontCartLine, 'quantity'> & { quantity?: number },
): StorefrontCart {
  const qty = Math.max(1, line.quantity ?? 1);
  const existingIdx = cart.lines.findIndex((l) => l.productId === line.productId);
  const nextLines = [...cart.lines];

  if (existingIdx >= 0) {
    nextLines[existingIdx] = { ...nextLines[existingIdx], quantity: qty, holdId: line.holdId ?? nextLines[existingIdx].holdId };
  } else {
    nextLines.push({ ...line, quantity: qty });
  }

  return { ...cart, lines: nextLines, updatedAt: new Date().toISOString() };
}

export function removeCartLine(cart: StorefrontCart, productId: string): StorefrontCart {
  return {
    ...cart,
    lines: cart.lines.filter((l) => l.productId !== productId),
    updatedAt: new Date().toISOString(),
  };
}
