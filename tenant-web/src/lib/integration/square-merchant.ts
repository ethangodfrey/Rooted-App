/** Fetch Square merchant business name after OAuth token exchange. */

export async function fetchSquareMerchantDisplayName(
  accessToken: string,
  merchantId: string | null | undefined,
): Promise<string | null> {
  const env = process.env.SQUARE_ENVIRONMENT?.trim() || 'sandbox';
  const base =
    env === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

  const path = merchantId
    ? `/v2/merchants/${encodeURIComponent(merchantId)}`
    : '/v2/merchants/me';

  try {
    const res = await fetch(`${base}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      merchant?: { business_name?: string; company_name?: string; id?: string };
    };
    const merchant = data.merchant;
    if (!merchant) return null;
    return merchant.business_name?.trim() || merchant.company_name?.trim() || null;
  } catch {
    return null;
  }
}
