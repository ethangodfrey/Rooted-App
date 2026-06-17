type LeafIconProps = {
  size?: number;
  className?: string;
};

export function LeafIcon({ size = 28, className }: LeafIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3C10 8 6 10 4 13c2 1 4 2 8 2s6-1 8-2c-2-3-6-5-8-10z"
        fill="currentColor"
      />
      <path
        d="M12 17v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
