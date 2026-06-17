const USER_AGENT = 'RootedMarketBot/1.0 (+https://rooted.app)';

export async function validateMarketUrl(
  url: string,
  timeoutMs = 8000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const head = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });
    if (head.ok || head.status === 405 || head.status === 403) return true;
    if (head.status >= 400) {
      return await validateWithGet(url, timeoutMs);
    }
    return true;
  } catch {
    return validateWithGet(url, timeoutMs);
  } finally {
    clearTimeout(timer);
  }
}

async function validateWithGet(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Range: 'bytes=0-0',
      },
    });
    return res.ok || res.status === 206 || res.status === 403;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
