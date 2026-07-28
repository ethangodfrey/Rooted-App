/**
 * MVP launch feature flags — prune non-essential mobile surfaces while keeping
 * Private Chef active for wholesale demand.
 */
export const LAUNCH_FEATURES = {
  /** Private Chef remains active for wholesale demand. */
  ENABLE_CHEF_ROLE: true,
  /** Creator shell fully disabled for launch. */
  ENABLE_CREATOR_ROLE: false,
  /** Vendor post vault / content vault. */
  ENABLE_VENDOR_POST_VAULT: false,
  /** LLC formation steps during onboarding. */
  ENABLE_LLC_ONBOARDING: false,
  /** Complex vendor/farmer analytics dashboards. */
  ENABLE_COMPLEX_ANALYTICS: false,
  /** B2B invoicing (procurement invoices, catering invoice engine). */
  ENABLE_B2B_INVOICING: false,
  /** Shopper inbox / messaging surface. */
  ENABLE_SHOPPER_INBOX: false,
} as const;

export type LaunchFeatureKey = keyof typeof LAUNCH_FEATURES;

export function isLaunchFeatureEnabled(key: LaunchFeatureKey): boolean {
  return LAUNCH_FEATURES[key];
}

/** Call once from app boot / role select to emit launch prune markers. */
let launchPruneLogged = false;
export function logLaunchPruneMarkers(): void {
  if (launchPruneLogged) return;
  launchPruneLogged = true;
  // eslint-disable-next-line no-console
  console.log('UI_PRUNED_FOR_LAUNCH');
  if (!LAUNCH_FEATURES.ENABLE_CREATOR_ROLE) {
    // eslint-disable-next-line no-console
    console.log('CREATOR_SHELL_DISABLED');
  }
}
