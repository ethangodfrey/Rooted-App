export const SQUARE_SANDBOX_SETUP_URL = 'https://developer.squareup.com/apps';

export function openSquareSandboxSetup(): void {
  window.open(SQUARE_SANDBOX_SETUP_URL, '_blank', 'noopener,noreferrer');
}

export function openSquareOAuth(authorizeUrl: string): void {
  window.location.href = authorizeUrl;
}
