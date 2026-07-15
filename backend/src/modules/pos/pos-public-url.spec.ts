import type { ConfigService } from '@nestjs/config';

import {
  isHttpsUrl,
  posOAuthRedirectUri,
  posProviderBaseUrl,
  posWebhookUrl,
} from './pos-public-url';

function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, def?: string) => (key in values ? values[key] : def),
  } as unknown as ConfigService;
}

describe('pos-public-url', () => {
  it('prefers POS_PROVIDER_BASE_URL over PUBLIC_BASE_URL', () => {
    const config = fakeConfig({
      POS_PROVIDER_BASE_URL: 'https://tunnel.example/',
      PUBLIC_BASE_URL: 'http://10.0.0.1:4000',
    });
    expect(posProviderBaseUrl(config)).toBe('https://tunnel.example');
    expect(posOAuthRedirectUri(config, 'SQUARE')).toBe(
      'https://tunnel.example/pos/oauth/square/callback',
    );
    expect(posWebhookUrl(config, 'SQUARE')).toBe(
      'https://tunnel.example/pos/webhooks/square',
    );
  });

  it('falls back to PUBLIC_BASE_URL when POS_PROVIDER_BASE_URL is unset', () => {
    const config = fakeConfig({ PUBLIC_BASE_URL: 'https://api.rooted.app' });
    expect(posProviderBaseUrl(config)).toBe('https://api.rooted.app');
  });

  it('remaps retired Railway public hosts to the live production service', () => {
    const config = fakeConfig({
      PUBLIC_BASE_URL: 'https://rooted-app-production-8ba5.up.railway.app',
    });
    expect(posProviderBaseUrl(config)).toBe(
      'https://rooted-app-production-43fb.up.railway.app',
    );
    expect(posOAuthRedirectUri(config, 'SQUARE')).toBe(
      'https://rooted-app-production-43fb.up.railway.app/pos/oauth/square/callback',
    );
  });

  it('ignores HTTP PUBLIC_BASE_URL and uses the live Railway production default', () => {
    const config = fakeConfig({ PUBLIC_BASE_URL: 'http://10.0.0.165:4000' });
    expect(posProviderBaseUrl(config)).toBe(
      'https://rooted-app-production-43fb.up.railway.app',
    );
  });

  it('detects HTTPS URLs', () => {
    expect(isHttpsUrl('https://abc.ngrok-free.app')).toBe(true);
    expect(isHttpsUrl('http://10.0.0.165:4000')).toBe(false);
  });
});
