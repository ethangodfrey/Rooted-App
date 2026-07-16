export type VendorPersona = 'farmers_market' | 'home_kitchen' | 'private_chef';

export const VENDOR_PERSONA_OPTIONS: Array<{
  value: VendorPersona;
  emoji: string;
  title: string;
  description: string;
}> = [
  {
    value: 'farmers_market',
    emoji: '🌾',
    title: 'Market Vendor',
    description: 'I sell at physical farmers markets.',
  },
  {
    value: 'home_kitchen',
    emoji: '🍳',
    title: 'Home Chef',
    description: 'I offer prepared meals, batch orders, or cottage food for pickup/delivery.',
  },
  {
    value: 'private_chef',
    emoji: '🔪',
    title: 'Private Chef',
    description: 'I offer private dining, catering, and customized culinary experiences.',
  },
];

export const PRIVATE_CHEF_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-amber-500/50 bg-amber-950/80 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-200';

export const HOME_KITCHEN_BADGE_CLASS =
  'inline-flex items-center rounded-lg border border-orange-700/60 bg-orange-950/70 px-2.5 py-1 text-[11px] font-bold tracking-wide text-orange-200';
