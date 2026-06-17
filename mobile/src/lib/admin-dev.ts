export const ADMIN_DEV_EMAIL = 'ethangodfreyy@icloud.com';

export function isAdminDevEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === ADMIN_DEV_EMAIL;
}
