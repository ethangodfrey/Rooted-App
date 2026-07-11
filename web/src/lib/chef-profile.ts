import type { Chef } from '@/types/database';

/** Minimum chef profile before dashboard access. */
export function isChefProfileComplete(chef: Chef | null | undefined): boolean {
  if (!chef) return false;
  return Boolean(
    chef.display_name?.trim() &&
      chef.bio?.trim() &&
      chef.home_base_city?.trim() &&
      chef.home_base_state?.trim(),
  );
}
