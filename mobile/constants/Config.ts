/** Vendorly Marketplace — app-wide constants */

export const APP_NAME = 'Vendorly Marketplace';
export const APP_TAGLINE =
  'Your local food marketplace — private chefs, home cooks, and farmers markets in one place.';
export const APP_SLUG = 'vendorly';

export const VENDOR_TYPES = [
  { value: 'farmers_market', label: 'Farmers Market Vendor' },
  { value: 'home_kitchen', label: 'Home Kitchen' },
  { value: 'food_business', label: 'Food Business' },
  { value: 'caterer', label: 'Caterer' },
  { value: 'meal_prep', label: 'Meal Prep' },
] as const;

export const CHEF_SERVICE_TYPES = [
  { value: 'private_dining', label: 'Private Dining' },
  { value: 'meal_prep', label: 'Meal Prep' },
  { value: 'event_catering', label: 'Event Catering' },
  { value: 'cooking_class', label: 'Cooking Class' },
  { value: 'personal_chef', label: 'Personal Chef' },
  { value: 'custom', label: 'Custom Service' },
] as const;

export const EXPLORE_CONTENT_TYPES = [
  'portfolio',
  'behind_scenes',
  'recipe',
  'promotion',
  'announcement',
  'menu_highlight',
] as const;
