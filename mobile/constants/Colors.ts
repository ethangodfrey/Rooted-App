/** Vendorly Marketplace brand palette — warm, appetizing tones */

const terracotta = '#C4654A';
const sage = '#7A9E7E';
const cream = '#FAF7F2';
const charcoal = '#2C2C2C';
const muted = '#6B7280';

export default {
  light: {
    text: charcoal,
    background: cream,
    tint: terracotta,
    tabIconDefault: '#B8B8B8',
    tabIconSelected: terracotta,
    primary: terracotta,
    accent: sage,
    surface: '#FFFFFF',
    muted,
  },
  dark: {
    text: cream,
    background: '#1A1A1A',
    tint: terracotta,
    tabIconDefault: '#666',
    tabIconSelected: terracotta,
    primary: terracotta,
    accent: sage,
    surface: '#2A2A2A',
    muted: '#9CA3AF',
  },
};
