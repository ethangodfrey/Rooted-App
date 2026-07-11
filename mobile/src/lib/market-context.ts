/** Time-of-day greeting + weekend "market day" copy for shopper surfaces. */

export interface MarketContext {
  greeting: string;
  subtitle: string;
  isMarketDay: boolean;
  season: 'spring' | 'summer' | 'fall' | 'winter';
}

function seasonForMonth(month: number): MarketContext['season'] {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function timeGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getMarketContext(now = new Date(), firstName?: string | null): MarketContext {
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const name = firstName?.trim();
  const base = timeGreeting(hour);
  const greeting = name ? `${base}, ${name.split(/\s+/)[0]}` : base;
  const season = seasonForMonth(now.getMonth());

  if (isWeekend) {
    return {
      greeting,
      subtitle: 'Market day — discover what\'s open near you this weekend.',
      isMarketDay: true,
      season,
    };
  }

  return {
    greeting,
    subtitle: 'Find farmers markets, local vendors, and fresh picks in your area.',
    isMarketDay: false,
    season,
  };
}
