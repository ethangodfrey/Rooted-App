export const ADMIN_DEV_EMAIL = 'ethangodfreyy@icloud.com';

export function isAdminDevEmail(email: string | null | undefined): boolean {
  if (!__DEV__) return false;
  return (email ?? '').trim().toLowerCase() === ADMIN_DEV_EMAIL;
}
