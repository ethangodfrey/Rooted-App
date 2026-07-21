import { useMemo } from 'react';

/** Deterministic pseudo-QR matrix for organizer scan surfaces (same approach as PickupPass). */
function cellFilled(payload: string, index: number): boolean {
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i) + index * 17) % 9973;
  }
  return hash % 3 !== 0;
}

export function CheckInQr({
  payload,
  label,
  size = 176,
}: {
  payload: string;
  label: string;
  size?: number;
}) {
  const cells = useMemo(() => {
    const grid = 21;
    return Array.from({ length: grid * grid }, (_, index) => {
      const row = Math.floor(index / grid);
      const col = index % grid;
      const finder =
        (row < 4 && col < 4) ||
        (row < 4 && col >= grid - 4) ||
        (row >= grid - 4 && col < 4);
      const timing = row === 6 || col === 6;
      return finder || timing || cellFilled(payload, index);
    });
  }, [payload]);

  const grid = 21;
  const cell = 10;
  const view = grid * cell;

  return (
    <div className="load-in-qr" style={{ width: size }}>
      <svg
        role="img"
        aria-label={`Check-in QR code for ${label}`}
        viewBox={`0 0 ${view} ${view}`}
        width={size}
        height={size}
        className="load-in-qr__svg"
      >
        <rect x={0} y={0} width={view} height={view} fill="#ffffff" rx={12} />
        {cells.map((filled, index) => {
          if (!filled) return null;
          const x = (index % grid) * cell;
          const y = Math.floor(index / grid) * cell;
          return (
            <rect
              key={index}
              x={x + 1}
              y={y + 1}
              width={cell - 2}
              height={cell - 2}
              fill="#0B1228"
              rx={1}
            />
          );
        })}
      </svg>
      <code className="load-in-qr__code">{label}</code>
    </div>
  );
}
