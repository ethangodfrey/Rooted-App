export type TabIconName =
  | 'home'
  | 'search'
  | 'explore'
  | 'markets'
  | 'map'
  | 'feed'
  | 'profile'
  | 'orders'
  | 'products'
  | 'posts'
  | 'services'
  | 'bookings'
  | 'portfolio'
  | 'dashboard';

type TabIconProps = {
  name: TabIconName;
  size?: number;
  color?: string;
};

export function TabIcon({ name, size = 20, color = 'currentColor' }: TabIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16.5 16.5 4 4" />
        </svg>
      );
    case 'explore':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'markets':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="14" rx="2" />
          <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M4 10h16" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M9 20 4 18V6l5 2 6-2 5 2v12l-5-2-6 2Z" />
          <path d="M9 8v12M15 6v12" />
        </svg>
      );
    case 'feed':
      return (
        <svg {...common}>
          <path d="M5 5h14v14H5z" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...common}>
          <path d="M7 7h14l-1.5 10H8.5L7 7Z" />
          <path d="M7 7 6 4H3" />
        </svg>
      );
    case 'products':
      return (
        <svg {...common}>
          <path d="M6 8 12 4l6 4v10H6V8Z" />
          <path d="M9 14h6" />
        </svg>
      );
    case 'posts':
      return (
        <svg {...common}>
          <path d="M5 5h14v10H8l-3 3V5Z" />
        </svg>
      );
    case 'services':
      return (
        <svg {...common}>
          <path d="M4 12h16M12 4v16" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    case 'bookings':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="14" rx="2" />
          <path d="M8 4v4M16 4v4M4 10h16" />
        </svg>
      );
    case 'portfolio':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" fill={color} stroke="none" />
          <path d="m4 16 5-4 4 3 4-5 3 4" />
        </svg>
      );
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M4 10h6V4H4v6ZM14 20h6v-6h-6v6ZM4 20h6v-4H4v4ZM14 4v6h6V4h-6Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
