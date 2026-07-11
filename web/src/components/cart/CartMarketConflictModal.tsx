import './cart-drawer.css';

interface CartMarketConflictModalProps {
  open: boolean;
  currentMarketName: string;
  nextMarketName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CartMarketConflictModal({
  open,
  currentMarketName,
  nextMarketName,
  onConfirm,
  onCancel,
}: CartMarketConflictModalProps) {
  if (!open) return null;

  return (
    <div className="cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-market-conflict-title">
      <button type="button" className="cart-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="cart-modal__panel">
        <h2 id="cart-market-conflict-title" className="cart-modal__title">
          Switch market pickup?
        </h2>
        <p className="cart-modal__body">
          Your cart is reserved for <strong>{currentMarketName}</strong>. Adding items from{' '}
          <strong>{nextMarketName}</strong> requires clearing your current market session.
        </p>
        <div className="cart-modal__actions">
          <button type="button" className="app-btn app-btn--secondary" onClick={onCancel}>
            Keep current market
          </button>
          <button type="button" className="app-btn app-btn--primary" onClick={onConfirm}>
            Clear cart &amp; switch
          </button>
        </div>
      </div>
    </div>
  );
}
