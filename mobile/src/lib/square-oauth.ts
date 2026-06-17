import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/** Square Developer Console — user opens a sandbox test account from here. */
export const SQUARE_SANDBOX_SETUP_URL = 'https://developer.squareup.com/apps';

/**
 * Square sandbox OAuth cannot run in an isolated in-app browser. The seller test
 * account must be launched from the Developer Console in the same system browser
 * session (Safari/Chrome) before the authorize URL will load.
 */
export async function openSquareSandboxSetup(): Promise<void> {
  await Linking.openURL(SQUARE_SANDBOX_SETUP_URL);
}

export async function openSquareOAuth(
  authorizeUrl: string,
  environment: 'sandbox' | 'production' | undefined,
  returnUrl: string,
): Promise<'opened' | 'cancel'> {
  if (environment === 'sandbox') {
    await Linking.openURL(authorizeUrl);
    return 'opened';
  }

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl, {
    preferEphemeralSession: false,
  });
  return result.type === 'cancel' ? 'cancel' : 'opened';
}
