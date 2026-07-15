import { normalizeSquareEnvironment, squareAuthorizeBaseUrl } from './square-environment';

describe('normalizeSquareEnvironment', () => {
  it('treats sandbox aliases as sandbox', () => {
    expect(normalizeSquareEnvironment('sandbox')).toBe('sandbox');
    expect(normalizeSquareEnvironment('dev')).toBe('sandbox');
    expect(normalizeSquareEnvironment(undefined)).toBe('sandbox');
  });

  it('treats production aliases as production', () => {
    expect(normalizeSquareEnvironment('production')).toBe('production');
    expect(normalizeSquareEnvironment('PROD')).toBe('production');
  });

  it('recovers when an authorize URL was pasted into SQUARE_ENVIRONMENT', () => {
    expect(
      normalizeSquareEnvironment('https://connect.squareupsandbox.com/oauth2/authorize'),
    ).toBe('sandbox');
    expect(normalizeSquareEnvironment('https://connect.squareup.com/oauth2/authorize')).toBe(
      'production',
    );
  });
});

describe('squareAuthorizeBaseUrl', () => {
  it('returns connect hosts', () => {
    expect(squareAuthorizeBaseUrl('sandbox')).toBe('https://connect.squareupsandbox.com');
    expect(squareAuthorizeBaseUrl('production')).toBe('https://connect.squareup.com');
  });
});
