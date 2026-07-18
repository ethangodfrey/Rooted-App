/** Pre-order booth token: RT-xxx (6 characters including hyphen). */
export const PICKUP_CODE_REGEX = /^RT-[A-Z0-9]{3}$/;

export function normalizePickupCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 6);
}

export function isValidPickupCode(value: string): boolean {
  return PICKUP_CODE_REGEX.test(normalizePickupCode(value));
}

/** Mask typed input toward RT-XXX (exactly 6 characters when complete). */
export function maskPickupCodeInput(raw: string): string {
  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!alnum) return '';

  if (alnum === 'R') return 'R';
  if (alnum === 'RT') return 'RT-';

  let body = alnum;
  if (body.startsWith('RT')) {
    body = body.slice(2);
  } else if (body.startsWith('R')) {
    body = body.slice(1);
  }
  body = body.slice(0, 3);
  return `RT-${body}`;
}
